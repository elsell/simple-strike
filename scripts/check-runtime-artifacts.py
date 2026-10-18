"""Inspect supplied build artifacts; this does not waive any advisory."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

FORBIDDEN = {'braces', 'micromatch'}
PACKAGE_PATH = re.compile(r'(^|[/\\])(braces|micromatch)(@|[/\\]|$)')


def mapped_sources(path, allow_empty=False):
    source_map = json.loads(path.read_text())
    if not isinstance(source_map, dict):
        raise ValueError('Invalid source map')
    sources = source_map.get('sources')
    if source_map.get('version') != 3 or 'sections' in source_map or not isinstance(sources, list) or (not sources and not allow_empty):
        raise ValueError('Expected a flat source map')
    if any(not isinstance(source, str) or not source for source in sources):
        raise ValueError('Invalid mapped source')
    source_root = source_map.get('sourceRoot', '')
    if not isinstance(source_root, str):
        raise ValueError('Invalid source root')
    if any(PACKAGE_PATH.search(source_root + '/' + source) for source in sources):
        raise ValueError('Build-only matching package is included in a runtime bundle')
    return len(sources)


def verified_generated_stub(script, build):
    # Vite 8.0.16 emits this reviewed module-preload helper without a source map.
    # Its exact bytes implement link insertion and preload error propagation.
    # Any compiler/output change requires a fresh review, not a wildcard bypass.
    content = script.read_bytes()
    if (script.is_relative_to(build / 'client/_app/immutable/chunks') and
            hashlib.sha256(content).hexdigest() == '2f8a57aecfda9c30a9e1e5b32d55c33dc107941c5a3c87a003017d6eccc0847a'):
        return True
    # SvelteKit's start shim only re-exports names from an inspected local chunk.
    name = r'[A-Za-z_$][\w$]*(?: as [A-Za-z_$][\w$]*)?'
    names = name + '(?:,' + name + ')*'
    match = re.fullmatch(rf'import\{{{names}\}}from"(\.\./chunks/[\w.-]+\.js)";export\{{{names}\}};', content.decode())
    if not script.is_relative_to(build / 'client/_app/immutable/entry') or not match:
        return False
    target = (script.parent / match.group(1)).resolve()
    return target.is_relative_to(build) and target.is_file()



def import_only_stub(script, build):
    # Empty maps are legitimate only for empty chunks or static import/export
    # shims. Imported code is inspected elsewhere in this deployment.
    content = re.sub(r'(?m)^\s*//[#@] sourceMappingURL=[^\s]+\s*$', '', script.read_text()).strip()
    statement = re.compile(r"(?:import\s+|export\s*\{[\w$,\s]+\}\s+from\s+)(['\"])([^'\"\n]+)\1\s*;")
    while content:
        match = statement.match(content)
        if not match:
            return False
        target = match.group(2)
        if target.startswith('.'):
            resolved = (script.parent / target).resolve()
            if not resolved.is_relative_to(build) or not resolved.is_file() or resolved.suffix != '.js':
                return False
        elif not re.fullmatch(r'(?:node:[a-z_/]+|@?[a-z0-9_-]+(?:/[a-z0-9_.-]+)*)', target):
            return False
        content = content[match.end():].strip()
    return True


def inspect(ios, web):
    ios, web = ios.resolve(), web.resolve()
    metadata = json.loads((ios / 'metadata.json').read_text())
    try:
        bundle_name = metadata['fileMetadata']['ios']['bundle']
    except (KeyError, TypeError) as error:
        raise ValueError('Missing iOS bundle metadata') from error
    if metadata.get('bundler') != 'metro' or not isinstance(bundle_name, str) or not bundle_name:
        raise ValueError('Unexpected bundle metadata')
    bundle = (ios / bundle_name).resolve()
    if not bundle.is_relative_to(ios) or not bundle.is_file() or bundle.stat().st_size == 0:
        raise ValueError('Missing or external iOS bundle')
    ios_sources = mapped_sources(Path(str(bundle) + '.map'))
    if not (web / 'build/index.js').is_file():
        raise ValueError('Missing built web server entrypoint')
    web_sources = 0
    coverage = {'client': 0, 'server': 0}
    for script in (web / 'build').rglob('*.js'):
        references = re.findall(r'[#@] sourceMappingURL=([^\s]+)', script.read_text())
        if not references and not verified_generated_stub(script, web / 'build'):
            raise ValueError(f'Unmapped web runtime code: {script.relative_to(web)}')
        for reference in references:
            source_map = (script.parent / reference).resolve()
            if not source_map.is_relative_to(web / 'build'):
                raise ValueError('External web source map')
            count = mapped_sources(source_map, allow_empty=True)
            if count == 0 and not import_only_stub(script, web / 'build'):
                raise ValueError('Empty source map for executable web code')
            web_sources += count
            area = script.relative_to(web / 'build').parts[0]
            if area in coverage:
                coverage[area] += count
    if any(count == 0 for count in coverage.values()):
        raise ValueError('Missing client or server web bundle source evidence')
    store = web / 'node_modules/.pnpm' 
    if not store.is_dir():
        raise ValueError('Missing production dependency store')
    count = 0
    # pnpm stores physical packages here. Do not follow dependency symlinks back
    # into unrelated workspaces or traverse cycles in dependency relationships.
    for directory, _, files in os.walk(store, followlinks=False):
        if 'package.json' not in files:
            continue
        package = json.loads((Path(directory) / 'package.json').read_text())
        name = package.get('name')
        if name in FORBIDDEN:
            raise ValueError(f'Build-only package included in web deployment: {name}')
        if isinstance(name, str) and name:
            count += 1
    if count == 0:
        raise ValueError('No production packages inspected')
    return ios_sources, web_sources, count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ios-export', type=Path, required=True)
    parser.add_argument('--web-deployment', type=Path, required=True)
    args = parser.parse_args()
    try:
        sources, web_sources, packages = inspect(args.ios_export, args.web_deployment)
    except (ValueError, OSError, TypeError) as error:
        print(f'Artifact verification failed: {error}', file=sys.stderr)
        return 1
    print(f'Inspected {sources} iOS sources, {web_sources} web sources and {packages} web package manifests; no braces or micromatch')
    print('This proves exclusion only in the supplied artifacts, not a clean vulnerability scan or native UI acceptance.')
    return 0


if __name__ == '__main__': sys.exit(main())
