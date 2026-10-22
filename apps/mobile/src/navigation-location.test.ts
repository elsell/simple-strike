import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationActivity, openNavigationLocation, type NavigationLocationPort } from './navigation-location';

test('only an authorized active route continues when both scenes are inactive', () => {
  for (const phase of ['guiding', 'rerouting'] as const) {
    assert.deepEqual(navigationActivity(false, true, phase), { running: true, background: true });
    assert.deepEqual(navigationActivity(false, false, phase), { running: false, background: false });
  }
  for (const phase of ['idle', 'arrived'] as const) {
    assert.deepEqual(navigationActivity(false, true, phase), { running: false, background: false });
    assert.deepEqual(navigationActivity(true, true, phase), { running: true, background: false });
  }
});

test('closing during native startup releases the late generation exactly once', async () => {
  let complete!: (generation: number) => void;
  const ended: number[] = [];
  let removed = 0;
  const port: NavigationLocationPort = {
    begin: () => new Promise(resolve => { complete = resolve; }),
    end: async generation => { ended.push(generation); },
    observe: () => ({ remove() { removed++; } }),
  };
  const close = openNavigationLocation(port, () => {}, () => {});
  close(); close(); complete(7);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(removed, 1);
  assert.deepEqual(ended, [7]);
});

test('a failed native start reports unavailable only while the subscription is open', async () => {
  const states: string[] = [];
  const port: NavigationLocationPort = {
    begin: async () => { throw new Error('location_unavailable'); },
    end: async () => {}, observe: () => ({ remove() {} }),
  };
  const close = openNavigationLocation(port, () => {}, state => states.push(state));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(states, ['unavailable']); close();
  const closeEarly = openNavigationLocation(port, () => {}, state => states.push(state));
  closeEarly(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(states, ['unavailable']);
});

test('ending an established subscription releases it and ignores later native events', async () => {
  let position!: (value: { latitude: number; longitude: number; accuracyMeters: number; timestampMs: number }) => void;
  let status!: (value: string) => void;
  const ended: number[] = [];
  let fixes = 0;
  const states: string[] = [];
  const port: NavigationLocationPort = {
    begin: async () => 9,
    end: async generation => { ended.push(generation); },
    observe: (fix, state) => { position = fix; status = state; return { remove() {} }; },
  };
  const close = openNavigationLocation(port, () => { fixes++; }, state => states.push(state));
  await Promise.resolve();
  position({ latitude: 1, longitude: 2, accuracyMeters: 5, timestampMs: 1 });
  status('authorized'); close();
  position({ latitude: 1, longitude: 3, accuracyMeters: 5, timestampMs: 2 });
  status('unavailable');
  assert.equal(fixes, 1);
  assert.deepEqual(states, ['authorized']);
  assert.deepEqual(ended, [9]);
});
