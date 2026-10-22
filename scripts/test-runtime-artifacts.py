import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('artifacts', Path(__file__).with_name('check-runtime-artifacts.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class ArtifactTest(unittest.TestCase):
    def fixture(self, root):
        ios, web = root / 'ios', root / 'web'
        ios.mkdir(); web.mkdir()
        (ios / 'entry.hbc').write_bytes(b'compiled fixture')
        (ios / 'metadata.json').write_text(json.dumps({'bundler': 'metro', 'fileMetadata': {'ios': {'bundle': 'entry.hbc'}}}))
        (ios / 'entry.hbc.map').write_text(json.dumps({'version': 3, 'sources': ['node_modules/react/index.js']}))
        (web / 'build').mkdir(); (web / 'build/index.js').write_text('export {};\n//# sourceMappingURL=index.js.map')
        (web / 'build/index.js.map').write_text(json.dumps({'version': 3, 'sources': ['node_modules/adapter/index.js']}))
        for area in ['client', 'server']:
            directory = web / 'build' / area
            directory.mkdir()
            (directory / 'chunk.js').write_text('export {};\n//# sourceMappingURL=chunk.js.map')
            (directory / 'chunk.js.map').write_text(json.dumps({'version': 3, 'sources': ['node_modules/react/index.js']}))
        package = web / 'node_modules/.pnpm/react@19/node_modules/react'
        package.mkdir(parents=True)
        (package / 'package.json').write_text(json.dumps({'name': 'react'}))
        return ios, web, package

    def test_clean_complete_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            ios, web, _ = self.fixture(Path(directory))
            self.assertEqual(gate.inspect(ios, web), (1, 3, 1))

    def test_native_package_inclusion_fails(self):
        for source in ['node_modules/braces/index.js', '/node_modules/.pnpm/micromatch@4.0.8/node_modules/micromatch/index.js', r'C:\node_modules\braces\index.js']:
            with self.subTest(source=source), tempfile.TemporaryDirectory() as directory:
                ios, web, _ = self.fixture(Path(directory))
                (ios / 'entry.hbc.map').write_text(json.dumps({'version': 3, 'sources': [source]}))
                with self.assertRaises(ValueError): gate.inspect(ios, web)

    def test_web_package_inclusion_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            ios, web, package = self.fixture(Path(directory))
            (package / 'package.json').write_text('{"name":"braces"}')
            with self.assertRaises(ValueError): gate.inspect(ios, web)

    def test_web_bundled_package_and_missing_map_fail(self):
        for missing in [False, True]:
            with tempfile.TemporaryDirectory() as directory:
                ios, web, _ = self.fixture(Path(directory))
                source_map = web / 'build/server/chunk.js.map'
                if missing: source_map.unlink()
                else: source_map.write_text(json.dumps({'version': 3, 'sources': ['node_modules/braces/index.js']}))
                with self.assertRaises((ValueError, OSError)): gate.inspect(ios, web)

    def test_missing_or_empty_evidence_fails(self):
        for missing in ['entry.hbc.map', 'entry.hbc', 'metadata.json', 'web-build', 'web-packages']:
            with self.subTest(missing=missing), tempfile.TemporaryDirectory() as directory:
                ios, web, package = self.fixture(Path(directory))
                target = web / 'build/index.js' if missing == 'web-build' else package / 'package.json' if missing == 'web-packages' else ios / missing
                target.unlink()
                with self.assertRaises((ValueError, OSError)): gate.inspect(ios, web)

    def test_unmapped_runtime_code_fails(self):
        for location in ['client/extra.js', 'server/extra.js', 'extra.js']:
            with tempfile.TemporaryDirectory() as directory:
                ios, web, _ = self.fixture(Path(directory))
                (web / 'build' / location).write_text('const hidden = "unchecked code";')
                with self.assertRaises(ValueError): gate.inspect(ios, web)

    def test_generated_start_shim_only_allows_local_reexports(self):
        with tempfile.TemporaryDirectory() as directory:
            build = Path(directory)
            entry = build / 'client/_app/immutable/entry'
            chunks = build / 'client/_app/immutable/chunks'
            entry.mkdir(parents=True); chunks.mkdir()
            (chunks / 'target.js').write_text('export {};')
            shim = entry / 'start.js'
            safe = 'import{o as e,t}from"../chunks/target.js";export{e as load_css,t as start};'
            shim.write_text(safe)
            self.assertTrue(gate.verified_generated_stub(shim, build))
            shim.write_text(safe + 'eval("extra code");')
            self.assertFalse(gate.verified_generated_stub(shim, build))
            shim.write_text(safe.replace('../chunks/target.js', 'https://example.com/target.js'))
            self.assertFalse(gate.verified_generated_stub(shim, build))

    def test_source_root_cannot_hide_package(self):
        with tempfile.TemporaryDirectory() as directory:
            ios, web, _ = self.fixture(Path(directory))
            (ios / 'entry.hbc.map').write_text(json.dumps({'version': 3, 'sourceRoot': '/node_modules/braces', 'sources': ['index.js']}))
            with self.assertRaises(ValueError): gate.inspect(ios, web)

    def test_empty_web_map_only_allows_static_shims(self):
        for code, permitted in [('import "react";', True), ('', True), ('eval("hidden");', False), ('import "https://example.com/code.js";', False), ('import "./missing.js";', False), ('import "./hidden.mjs";', False)]:
            with self.subTest(code=code), tempfile.TemporaryDirectory() as directory:
                ios, web, _ = self.fixture(Path(directory))
                (web / 'build/server/hidden.mjs').write_text('eval("hidden");')
                chunk = web / 'build/server/empty.js'
                chunk.write_text(code + '\n//# sourceMappingURL=empty.js.map')
                chunk.with_suffix('.js.map').write_text('{"version":3,"sources":[]}')
                if permitted:
                    gate.inspect(ios, web)
                else:
                    with self.assertRaises(ValueError): gate.inspect(ios, web)

    def test_indexed_maps_are_not_silently_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            ios, web, _ = self.fixture(Path(directory))
            (ios / 'entry.hbc.map').write_text('{"version":3,"sections":[]}')
            with self.assertRaises(ValueError): gate.inspect(ios, web)


if __name__ == '__main__': unittest.main()
