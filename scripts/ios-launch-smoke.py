#!/usr/bin/env python3
"""Hosted macOS smoke check. Not a substitute for CarPlay interaction tests."""
import json
import os
from pathlib import Path
import plistlib
import re
import signal
import subprocess
import time
import urllib.request
import uuid


def setup_visible(lines):
    text = ' '.join(lines).casefold()
    return all(label in text for label in ('simple strike', 'backend url', 'connect'))


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
    applications = list((root / '.bin/ios-simulator/Build/Products/Debug-iphonesimulator').glob('*.app'))
    if len(applications) != 1:
        raise ValueError('Expected exactly one built iOS application')
    app = applications[0]
    with (app / 'Info.plist').open('rb') as source:
        info = plistlib.load(source)
    bundle = info['CFBundleIdentifier']
    device_type, runtime = simulator_type(json.loads(command('xcrun', 'simctl', 'list', 'devices', 'available', '--json')))
    device = command('xcrun', 'simctl', 'create', f'SimpleStrike-smoke-{uuid.uuid4()}', device_type, runtime)
    metro = None
    try:
        command('swiftc', str(root / 'scripts/recognize-ios-screenshot.swift'), '-o', str(output / 'recognize'), timeout=120)
        command('xcrun', 'simctl', 'boot', device)
        command('xcrun', 'simctl', 'bootstatus', device, '-b', timeout=240)
        # Fresh hosted simulators can still be provisioning system services after
        # bootstatus finishes. Allow installation time without relaxing UI checks.
        command('xcrun', 'simctl', 'install', device, str(app), timeout=180)
        env = {**os.environ, 'CI': '1', 'EXPO_NO_TELEMETRY': '1', 'SIMPLE_STRIKE_APP_ENV': 'development',
               'SIMPLE_STRIKE_API_URL': 'http://localhost:8080', 'SIMPLE_STRIKE_OIDC_ISSUER': 'http://localhost:5556/dex',
               'SIMPLE_STRIKE_MOBILE_OIDC_CLIENT_ID': 'simple-strike-mobile'}
        with (output / 'metro.log').open('w') as log:
            # Expo's localhost binding can select IPv6 only. The native bundle
            # loader requests IPv4, so use the isolated runner's dual-stack bind.
            metro = subprocess.Popen(['node', 'node_modules/expo/bin/cli', 'start', '--dev-client', '--lan', '--port', '8081'],
                                     cwd=root / 'apps/mobile', env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            deadline = time.monotonic() + 90
            while True:
                if metro.poll() is not None:
                    raise RuntimeError('Metro exited before readiness')
                try:
                    with urllib.request.urlopen('http://127.0.0.1:8081/status', timeout=2) as response:
                        if response.read().decode().strip() == 'packager-status:running':
                            break
                except (OSError, ValueError):
                    pass
                if time.monotonic() >= deadline:
                    raise TimeoutError('Metro readiness timeout')
                time.sleep(1)
            # Expo's simulator launcher accepts a project URL without a system open-URL dialog.
            pid = launch_pid(command('xcrun', 'simctl', 'launch', device, bundle,
                '-AppleLanguages', '(en)', '-AppleLocale', 'en_US',
                '--initialUrl', 'http://127.0.0.1:8081/?disableOnboarding=1'), bundle)
            deadline = time.monotonic() + 180
            while time.monotonic() < deadline:
                os.kill(pid, 0)
                command('xcrun', 'simctl', 'io', device, 'screenshot', str(output / 'launch.png'))
                lines = json.loads(command(str(output / 'recognize'), str(output / 'launch.png')))
                (output / 'recognized-text.json').write_text(json.dumps(lines, indent=2) + '\n')
                if setup_visible(lines):
                    (output / 'result.json').write_text(json.dumps({'revision': command('git', '-C', str(root), 'rev-parse', 'HEAD'),
                        'bundleIdentifier': bundle, 'runtime': runtime, 'setupScreenVisible': True, 'carPlayVerified': False}, indent=2) + '\n')
                    return
                time.sleep(3)
            raise TimeoutError('The backend setup screen did not appear; inspect launch.png and metro.log')
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
        if metro and metro.poll() is None:
            os.killpg(metro.pid, signal.SIGTERM)
            try:
                metro.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(metro.pid, signal.SIGKILL)
                metro.wait(timeout=10)
        for operation in ('shutdown', 'delete'):
            subprocess.run(['xcrun', 'simctl', operation, device], capture_output=True, timeout=60, check=False)


if __name__ == '__main__':
    main()
