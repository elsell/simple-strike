"""Keep the raw audit and distinguish exact, reviewed remediation evidence."""
import hashlib
import importlib.util
from datetime import date, datetime, timezone
import shutil
import tempfile
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
FORGE = 'GHSA-86w9-cpqp-85rv'
REJECTED = 'GHSA-hp3w-g68c-fv3c'
BRACES = 'GHSA-vfj7-8cjw-p6xm'
BRACES_EXPIRY = date(2026, 11, 17)
PATCH_HASH = '2798686e4488058ad81c3b8e32eb763c0feff21f4c717ce4d13b6ef2432cd5b8'


def classify(data, backport_verified, artifacts_verified=False, today=None):
    if (not isinstance(data, dict) or 'error' in data or
            not isinstance(data.get('advisories'), dict) or
            not isinstance(data.get('metadata'), dict)):
        raise ValueError('Invalid or failed package audit')
    counts = data['metadata'].get('vulnerabilities')
    levels = {'info', 'low', 'moderate', 'high', 'critical'}
    if not isinstance(counts, dict) or set(counts) != levels or any(type(value) is not int or value < 0 for value in counts.values()):
        raise ValueError('Invalid vulnerability totals')
    if bool(sum(counts.values())) != bool(data['advisories']):
        raise ValueError('Audit totals disagree with advisory report')
    blocked, reviewed = [], []
    for finding in data['advisories'].values():
        if not isinstance(finding, dict):
            raise ValueError('Invalid advisory')
        identifier, package = finding.get('github_advisory_id'), finding.get('module_name')
        entries = finding.get('findings')
        if not isinstance(identifier, str) or not identifier or not isinstance(package, str) or not package:
            raise ValueError('Missing advisory identity')
        if not isinstance(entries, list) or not entries:
            raise ValueError('Missing affected versions')
        versions = set()
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get('version'), str) or not entry['version']:
                raise ValueError('Invalid affected version')
            versions.add(entry['version'])
        description = f'{identifier}: {package} ({", ".join(sorted(versions))})'
        if identifier == REJECTED and package == 'sprintf-js' and versions <= {'1.0.3', '1.1.3'}:
            reviewed.append(description + ' | CVE authority rejected CVE-2026-97058; see testing spec')
        elif identifier == FORGE and package == 'node-forge' and versions == {'1.4.0'} and backport_verified:
            reviewed.append(description + ' | exact reviewed upstream backport and installed regression verified')
        elif (identifier == BRACES and package == 'braces' and versions == {'3.0.3'}
              and artifacts_verified and today is not None and today < BRACES_EXPIRY):
            reviewed.append(description + ' | user-approved build-tool exception; runtime artifacts checked; expires 2026-11-17 UTC')
        else:
            blocked.append(description)
    return blocked, reviewed


def verify_patch_files(root):
    patch = root / 'patches/node-forge@1.4.0.patch'
    if hashlib.sha256(patch.read_bytes()).hexdigest() != PATCH_HASH:
        raise ValueError('RSA backport patch differs from reviewed content')
    lock = (root / 'pnpm-lock.yaml').read_text()
    if f'  node-forge@1.4.0: {PATCH_HASH}' not in lock:
        raise ValueError('RSA patch registration is missing')
    references = re.findall(r'^\s+node-forge: (.+)$', lock, re.MULTILINE)
    expected = f'1.4.0(patch_hash={PATCH_HASH})'
    if not references or any(reference != expected for reference in references):
        raise ValueError('Unreviewed RSA consumer resolution')


def stage_deployment_source(root, destination):
    destination.mkdir()
    for name in ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'):
        source = root / name
        if source.is_file():
            shutil.copy2(source, destination / name)
    # Include the newly built web output and workspace source packages, but no
    # installed dependency graph. pnpm deploy may rewrite installation metadata.
    for name in ('apps/web', 'packages', 'patches'):
        shutil.copytree(root / name, destination / name,
                        ignore=shutil.ignore_patterns('node_modules', '.svelte-kit', '.expo'))
    for name in ('apps/mobile', 'tools/eas-cli'):
        target = destination / name
        target.mkdir(parents=True)
        shutil.copy2(root / name / 'package.json', target / 'package.json')


def verify_runtime_artifacts():
    spec = importlib.util.spec_from_file_location('runtime_artifacts', ROOT / 'scripts/check-runtime-artifacts.py')
    artifacts = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(artifacts)
    with tempfile.TemporaryDirectory(prefix='runtime-audit-', dir=ROOT / '.bin') as directory:
        staging = Path(directory)
        ios, web = staging / 'ios', staging / 'web'
        # Rebuild the outputs whose evidence will enable this exception. Never
        # accept an old export or a caller-supplied success flag in the CLI.
        shutil.rmtree(ROOT / 'apps/web/build', ignore_errors=True)
        shutil.rmtree(ROOT / 'apps/web/.svelte-kit/output', ignore_errors=True)
        commands = [
            ([str(ROOT / 'apps/mobile/node_modules/.bin/expo'), 'export', '--platform', 'ios', '--source-maps', '--output-dir', str(ios)], ROOT / 'apps/mobile'),
            ([str(ROOT / 'apps/web/node_modules/.bin/vite'), 'build', '--sourcemap'], ROOT / 'apps/web'),

        ]
        with (ROOT / '.bin/runtime-artifact-build.log').open('w') as log:
            for command, directory in commands:
                subprocess.run(command, cwd=directory, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=300)
            deployment_source = staging / 'deployment-source'
            stage_deployment_source(ROOT, deployment_source)
            store = subprocess.run(['pnpm', 'store', 'path', '--silent'], cwd=ROOT,
                                   capture_output=True, text=True, check=True, timeout=30).stdout.strip()
            if not Path(store).is_absolute() or Path(store).name != 'v11':
                raise ValueError('Unexpected pnpm store layout')
            subprocess.run(['pnpm', '--store-dir', str(Path(store).parent), '--filter',
                            '@simple-strike/web', 'deploy', '--legacy', '--prod', str(web)],
                           cwd=deployment_source, stdout=log, stderr=subprocess.STDOUT,
                           check=True, timeout=300)
        sources, web_sources, packages = artifacts.inspect(ios, web)
        print(f'Fresh runtime evidence: {sources} iOS mapped sources, {web_sources} web mapped sources, {packages} web manifests')


def main():
    output = ROOT / '.bin/pnpm-audit.json'
    output.parent.mkdir(exist_ok=True)
    process = subprocess.run(['pnpm', 'audit', '--json', '--audit-level', 'low'],
                             cwd=ROOT, capture_output=True, timeout=180)
    output.write_bytes(process.stdout)
    if process.returncode not in (0, 1):
        raise ValueError(f'Package audit failed with exit code {process.returncode}; raw output: {output}')
    data = json.loads(process.stdout)
    # Validate the full report before examining its individual identities.
    classify(data, False)
    if process.returncode == 1 and not data['advisories']:
        raise ValueError('Failed audit returned no advisory explanation')
    backport_verified = False
    if any(finding['github_advisory_id'] == FORGE for finding in data['advisories'].values()):
        verify_patch_files(ROOT)
        subprocess.run(['node', 'scripts/check-rsa-verification.mjs'], cwd=ROOT,
                       check=True, timeout=60)
        backport_verified = True
    artifacts_verified = False
    if (any(finding['github_advisory_id'] == BRACES for finding in data['advisories'].values())
            and datetime.now(timezone.utc).date() < BRACES_EXPIRY):
        verify_runtime_artifacts()
        artifacts_verified = True
    blocked, reviewed = classify(data, backport_verified, artifacts_verified, datetime.now(timezone.utc).date())
    print(f'Unmodified package audit retained at {output.relative_to(ROOT)}')
    for finding in reviewed:
        print('REVIEWED:', finding)
    for finding in blocked:
        print('UNRESOLVED:', finding)
    return 1 if blocked else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f'JavaScript security verification failed: {error}', file=sys.stderr)
        sys.exit(1)
