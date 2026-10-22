import assert from 'node:assert/strict';
import test from 'node:test';
import { closestStrike, distanceMeters, type Strike, type Eligibility } from './closest-strike.js';
import { MapSession } from './map-session.js';

const now = 1_800_000_000_000;
const clock = { now: () => now };
// Controlled test policy. Exact production cutoff semantics remain open.
const eligible: Eligibility = ({ ageMs, distanceMeters }) => ageMs >= 0 && ageMs < 300_000 && distanceMeters < 50 * 1609.344;
const strike = (id: string, latitude: number, ageMs: number): Strike => ({
  id, position: { latitude, longitude: 0 }, occurredAtMs: now - ageMs,
});

test('selects the closest eligible strike, not the newest', () => {
  const result = closestStrike({ latitude: 0, longitude: 0 }, [strike('far-new', .2, 1000), strike('near-old', .1, 120000)], clock, eligible);
  assert.equal(result?.strike.id, 'near-old');
  assert.equal(result?.ageMs, 120000);
  assert.ok(result!.distanceMeters > 11000 && result!.distanceMeters < 11200);
});

test('excludes stale and distant strikes under the supplied policy', () => {
  const result = closestStrike({ latitude: 0, longitude: 0 }, [strike('stale', .001, 360000), strike('distant', 2, 1000), strike('eligible', .1, 1000)], clock, eligible);
  assert.equal(result?.strike.id, 'eligible');
  assert.equal(closestStrike({ latitude: 0, longitude: 0 }, [], clock, eligible), null);
});

test('panning does not change distance from the vehicle', () => {
  const session = new MapSession({ latitude: 0, longitude: 0 });
  session.explore({ latitude: 40, longitude: 20 });
  const result = closestStrike(session.snapshot().vehicle, [strike('near', .1, 1000)], clock, eligible);
  assert.equal(result?.strike.id, 'near');
});

test('great-circle distance handles the dateline and identical locations', () => {
  assert.equal(distanceMeters({latitude:0,longitude:0},{latitude:0,longitude:0}),0);
  const across = distanceMeters({latitude:0,longitude:179.9},{latitude:0,longitude:-179.9});
  assert.ok(across > 22000 && across < 22400);
});
