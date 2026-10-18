#!/usr/bin/env python3
"""Hosted macOS smoke check. Not a substitute for CarPlay interaction tests."""
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import time
import uuid


def setup_visible(lines):
    text = ' '.join(lines).casefold()
    return (all(label in text for label in ('simple strike', 'backend url', 'connect'))
            and 'cannot read or save the connection' not in text
            and 'loading' not in text)


def launch_pid(output, bundle):
    match = re.search(r'^' + re.escape(bundle) + r': ([1-9][0-9]*)$', output.strip(), re.MULTILINE)
    if not match:
        raise ValueError('Simulator did not return the application PID')
    return int(match.group(1))


def simulator_type(inventory):
    for runtime, devices in sorted(inventory.get('devices', {}).items(), reverse=True):
        if '.iOS-' not in runtime:
            continue
        for device in devices:
            if device.get('isAvailable') and device.get('name', '').startswith('iPhone') and device.get('deviceTypeIdentifier'):
                return device['deviceTypeIdentifier'], runtime
    raise ValueError('No available iPhone simulator runtime')


def command(*args, timeout=60):
    try:
        return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout.strip()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as failure:
        raise RuntimeError(f'{failure}\nstdout: {failure.stdout!r}\nstderr: {failure.stderr!r}') from failure


def main():
    root = Path(__file__).resolve().parent.parent
    output = root / '.bin/ios-launch-smoke'
    output.mkdir(parents=True, exist_ok=True)
    applications = list((root / '.bin/ios-simulator/Build/Products/Release-iphonesimulator').glob('*.app'))
    if len(applications) != 1:
        raise ValueError('Expected exactly one built iOS application')
    app = applications[0]
    if not (app / 'main.jsbundle').is_file():
        raise ValueError('Simulator app is missing its embedded JavaScript bundle')
    with (app / 'Info.plist').open('rb') as source:
        info = plistlib.load(source)
    bundle = info['CFBundleIdentifier']
    device_type, runtime = simulator_type(json.loads(command('xcrun', 'simctl', 'list', 'devices', 'available', '--json')))
    device = command('xcrun', 'simctl', 'create', f'SimpleStrike-smoke-{uuid.uuid4()}', device_type, runtime)
    try:
        command('swiftc', str(root / 'scripts/recognize-ios-screenshot.swift'), '-o', str(output / 'recognize'), timeout=120)
        command('xcrun', 'simctl', 'boot', device)
        command('xcrun', 'simctl', 'bootstatus', device, '-b', timeout=240)
        # Fresh hosted simulators can still be provisioning system services after
        # bootstatus finishes. Allow installation time without relaxing UI checks.
        command('xcrun', 'simctl', 'install', device, str(app), timeout=180)
        pid = launch_pid(command('xcrun', 'simctl', 'launch', device, bundle,
            '-AppleLanguages', '(en)', '-AppleLocale', 'en_US'), bundle)
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            os.kill(pid, 0)
            command('xcrun', 'simctl', 'io', device, 'screenshot', str(output / 'launch.png'), timeout=90)
            lines = json.loads(command(str(output / 'recognize'), str(output / 'launch.png')))
            (output / 'recognized-text.json').write_text(json.dumps(lines, indent=2) + '\n')
            if setup_visible(lines):
                (output / 'result.json').write_text(json.dumps({'revision': command('git', '-C', str(root), 'rev-parse', 'HEAD'),
                    'bundleIdentifier': bundle, 'runtime': runtime, 'setupScreenVisible': True,
                    'embeddedBundle': True, 'carPlayVerified': False}, indent=2) + '\n')
                return
            time.sleep(3)
        raise TimeoutError('The backend setup screen did not become ready; inspect launch.png')
    except Exception as failure:
        (output / 'failure.log').write_text(str(failure) + '\n')
        diagnostics = {
            'screenshot': ['xcrun', 'simctl', 'io', device, 'screenshot', str(output / 'failure.png')],
            'app-system': ['xcrun', 'simctl', 'spawn', device, 'log', 'show', '--last', '3m', '--style', 'compact',
                '--predicate', 'process == "SimpleStrike" OR (process == "SpringBoard" AND eventMessage CONTAINS "simplestrike")'],
        }
        for name, args in diagnostics.items():
            try:
                result = subprocess.run(args, capture_output=True, text=True, timeout=30)
                (output / f'{name}.log').write_text((result.stdout + '\n' + result.stderr)[-128_000:])
            except Exception as diagnostic_failure:
                (output / f'{name}.log').write_text(str(diagnostic_failure))
        raise
    finally:
        for operation in ('shutdown', 'delete'):
            subprocess.run(['xcrun', 'simctl', operation, device], capture_output=True, timeout=60, check=False)


if __name__ == '__main__':
    main()
