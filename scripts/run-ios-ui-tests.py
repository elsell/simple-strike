#!/usr/bin/env python3
"""Run real app interaction tests on an owned hosted simulator."""
import importlib.util
import json
from pathlib import Path
import subprocess
import uuid


def main():
    root = Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location('launch', root / 'scripts/ios-launch-smoke.py')
    launch = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(launch)
    device_type, runtime = launch.simulator_type(json.loads(launch.command('xcrun', 'simctl', 'list', 'devices', 'available', '--json')))
    device = launch.command('xcrun', 'simctl', 'create', f'SimpleStrike-UI-{uuid.uuid4()}', device_type, runtime)
    output = root / '.bin/ios-ui-tests'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'revision.txt').write_text(launch.command('git', '-C', str(root), 'rev-parse', 'HEAD') + '\n')
    try:
        launch.command('xcrun', 'simctl', 'boot', device)
        launch.command('xcrun', 'simctl', 'bootstatus', device, '-b', timeout=240)
        workspaces = list((root / 'apps/mobile/ios').glob('*.xcworkspace'))
        if len(workspaces) != 1:
            raise ValueError('Expected one application workspace')
        subprocess.run(['xcodebuild', '-workspace', str(workspaces[0]), '-scheme', 'SimpleStrikeAcceptance',
            '-configuration', 'Release', '-destination', f'platform=iOS Simulator,id={device}',
            '-derivedDataPath', str(root / '.bin/ios-simulator'), '-resultBundlePath', str(output / 'results.xcresult'),
            '-parallel-testing-enabled', 'NO', 'CODE_SIGN_IDENTITY=-', 'CODE_SIGNING_ALLOWED=YES', 'test'],
            check=True, timeout=900)
    finally:
        for operation in ('shutdown', 'delete'):
            subprocess.run(['xcrun', 'simctl', operation, device], capture_output=True, timeout=60, check=False)


if __name__ == '__main__':
    main()
