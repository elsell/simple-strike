import assert from 'node:assert/strict';
import test from 'node:test';
import { RecentLightning } from './recent-lightning.js';

const strike = { id: 'one', position: { latitude: 27, longitude: -82 }, occurredAtMs: 0 };
test('disconnected observations expire at five minutes without another network response', () => {
  let now = 290_000;
  const cache = new RecentLightning({ now: () => now });
  cache.receive({ mode: 'demo', strikes: [strike] });
  cache.disconnect();
  assert.equal(cache.snapshot().connection, 'disconnected');
  assert.equal(cache.snapshot().strikes.length, 1);
  now = 300_000;
  assert.equal(cache.snapshot().strikes.length, 0);
  assert.equal(cache.snapshot().connection, 'disconnected');
});
test('reconnection deduplicates while source-mode changes and access denial clear observations', () => {
  const cache = new RecentLightning({ now: () => 1000 });
  cache.receive({ mode: 'demo', strikes: [strike] });
  cache.disconnect();
  cache.receive({ mode: 'demo', strikes: [strike] });
  assert.equal(cache.snapshot().connection, 'online');
  assert.equal(cache.snapshot().strikes.length, 1);
  cache.receive({ mode: 'live', strikes: [] });
  assert.equal(cache.snapshot().strikes.length, 0);
  cache.receive({ mode: 'live', strikes: [strike] });
  cache.deny();
  assert.equal(cache.snapshot().strikes.length, 0);
  assert.equal(cache.snapshot().connection, 'denied');
});
test('future observations are excluded and callers cannot mutate cached positions', () => {
  const cache = new RecentLightning({ now: () => 1000 });
  const supplied = { ...strike, position: { ...strike.position } };
  cache.receive({ mode: 'demo', strikes: [supplied, { ...strike, id: 'future', occurredAtMs: 2000 }] });
  supplied.position.latitude = 0;
  const returned = cache.snapshot();
  returned.strikes[0].position.latitude = 1;
  assert.deepEqual(cache.snapshot().strikes, [strike]);
});
