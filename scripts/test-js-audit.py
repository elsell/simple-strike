import importlib.util
from pathlib import Path
import unittest
import tempfile
import shutil

spec = importlib.util.spec_from_file_location('audit_gate', Path(__file__).with_name('check-js-audit.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def report(identifier, package, version):
    return {'advisories': {'1': {'github_advisory_id': identifier, 'module_name': package,
                               'findings': [{'version': version}]}}, 'metadata': {'vulnerabilities': {'info': 0, 'low': 1, 'moderate': 0, 'high': 0, 'critical': 0}}}


class AuditTest(unittest.TestCase):
    def test_rejected_cve_is_explicitly_reported(self):
        blocked, reviewed = gate.classify(report(gate.REJECTED, 'sprintf-js', '1.0.3'), False)
        self.assertEqual(blocked, [])
        self.assertIn(gate.REJECTED, reviewed[0])

    def test_backport_requires_verified_evidence(self):
        data = report(gate.FORGE, 'node-forge', '1.4.0')
        self.assertTrue(gate.classify(data, False)[0])
        self.assertFalse(gate.classify(data, True)[0])

    def test_unknown_and_active_findings_fail(self):
        for identifier in ['GHSA-vfj7-8cjw-p6xm', 'GHSA-new-new-new']:
            self.assertTrue(gate.classify(report(identifier, 'braces', '3.0.3'), True)[0])

    def test_package_and_version_mismatches_fail(self):
        for identifier, package, version in [(gate.REJECTED, 'other', '1.0.3'),
                                             (gate.REJECTED, 'sprintf-js', '2.0.0'),
                                             (gate.FORGE, 'node-forge', '1.3.1')]:
            self.assertTrue(gate.classify(report(identifier, package, version), True)[0])

    def test_missing_or_malformed_output_fails(self):
        for data in [{}, {'advisories': []}, {'advisories': {}, 'error': 'offline'},
                     report(gate.FORGE, 'node-forge', None)]:
            with self.assertRaises(ValueError):
                gate.classify(data, True)

    def test_clean_report(self):
        self.assertEqual(gate.classify({'advisories': {}, 'metadata': {'vulnerabilities': {'info': 0, 'low': 0, 'moderate': 0, 'high': 0, 'critical': 0}}}, False), ([], []))

    def test_patch_integrity_and_each_consumer_are_required(self):
        gate.verify_patch_files(gate.ROOT)
        for mutation in ['patch', 'registration', 'consumer']:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / 'patches').mkdir()
                patch = root / 'patches/node-forge@1.4.0.patch'
                shutil.copyfile(gate.ROOT / 'patches/node-forge@1.4.0.patch', patch)
                lock = (gate.ROOT / 'pnpm-lock.yaml').read_text()
                if mutation == 'patch':
                    patch.write_text(patch.read_text() + '\n')
                elif mutation == 'registration':
                    lock = lock.replace(f'node-forge@1.4.0: {gate.PATCH_HASH}', 'node-forge@1.4.0: missing')
                else:
                    lock = lock.replace(f'node-forge: 1.4.0(patch_hash={gate.PATCH_HASH})', 'node-forge: 1.4.0', 1)
                (root / 'pnpm-lock.yaml').write_text(lock)
                with self.assertRaises(ValueError):
                    gate.verify_patch_files(root)

    def test_positive_total_without_advisories_fails(self):
        data = report(gate.REJECTED, 'sprintf-js', '1.0.3')
        data['advisories'] = {}
        with self.assertRaises(ValueError):
            gate.classify(data, True)

    def test_one_unresolved_finding_still_blocks(self):
        data = report(gate.REJECTED, 'sprintf-js', '1.1.3')
        data['advisories']['2'] = report('GHSA-vfj7-8cjw-p6xm', 'braces', '3.0.3')['advisories']['1']
        blocked, reviewed = gate.classify(data, True)
        self.assertEqual((len(blocked), len(reviewed)), (1, 1))


if __name__ == '__main__':
    unittest.main()
