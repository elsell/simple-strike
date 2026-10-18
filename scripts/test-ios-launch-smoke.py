import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).with_name('ios-launch-smoke.py'))
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)

class LaunchEvidenceTests(unittest.TestCase):
    def test_splash_or_dev_launcher_is_not_application_readiness(self):
        self.assertFalse(smoke.setup_visible(['Simple Strike', 'Loading']))
        self.assertFalse(smoke.setup_visible(['Development servers', 'Connect']))
        self.assertTrue(smoke.setup_visible(['Simple Strike', 'Backend URL', 'http://localhost:8080', 'Connect']))

    def test_pid_must_belong_to_requested_application(self):
        self.assertEqual(smoke.launch_pid('com.elsell.simplestrike: 1234', 'com.elsell.simplestrike'), 1234)
        for value in ['another.app: 1234', 'com.elsell.simplestrike: 0', 'warning: 1234']:
            with self.assertRaises(ValueError): smoke.launch_pid(value, 'com.elsell.simplestrike')

    def test_selects_an_available_iphone_runtime(self):
        devices = {'devices': {
            'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [{'name':'iPhone 17','isAvailable':True,'deviceTypeIdentifier':'phone'}],
            'com.apple.CoreSimulator.SimRuntime.iOS-27-0': [{'name':'iPhone 18','isAvailable':False,'deviceTypeIdentifier':'future'}],
            'com.apple.CoreSimulator.SimRuntime.tvOS-26-0': [{'name':'Apple TV','isAvailable':True,'deviceTypeIdentifier':'tv'}],
        }}
        self.assertEqual(smoke.simulator_type(devices), ('phone', 'com.apple.CoreSimulator.SimRuntime.iOS-26-0'))
        with self.assertRaises(ValueError): smoke.simulator_type({'devices': {}})

if __name__ == '__main__': unittest.main()
