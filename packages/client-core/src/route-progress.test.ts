import assert from 'node:assert/strict';
import test from 'node:test';
import { RouteProgress } from './route-progress.js';
import type { Route } from './route-planner';
const route: Route = { id: 'r', distanceMeters: 2200, expectedTravelSeconds: 200, coordinates: [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: .01 }, { latitude: .01, longitude: .01 }], steps: [
  { instructions: 'East', distanceMeters: 1100, coordinates: [] },
  { instructions: 'North', distanceMeters: 1100, coordinates: [] },
] };
function setup() {
  let now = 1000;
  const progress = new RouteProgress(route, { now: () => now });
  return { progress, fix(latitude: number, longitude: number, accuracyMeters = 5, advance = 1000) {
    now += advance; return progress.update({ latitude, longitude, accuracyMeters, timestampMs: now });
  }, now: () => now };
}
test('simulated drive advances route distance and maneuvers before arrival', () => {
  const { fix } = setup();
  assert.equal(fix(0, 0).stepIndex, 0);
  for (let i = 1; i <= 10; i++) fix(0, i * .001);
  const turn = fix(.001, .01);
  assert.equal(turn.stepIndex, 1); assert.ok(turn.remainingMeters < 1100);
  assert.ok(turn.maneuverDistanceMeters > 900 && turn.maneuverDistanceMeters < 1000);
  for (let i = 2; i < 10; i++) fix(i * .001, .01);
  assert.equal(fix(.01, .01).status, 'arrived');
});
test('deviation requires eight seconds and does not advance maneuvers', () => {
  const { fix } = setup(); fix(0, 0);
  assert.equal(fix(.005, .001).needsReroute, false);
  assert.equal(fix(.005, .001, 5, 7000).needsReroute, false);
  const away = fix(.005, .001); assert.equal(away.needsReroute, true);
  assert.equal(away.alongMeters, 0); assert.equal(away.stepIndex, 0);
  assert.equal(fix(0, 0).needsReroute, false);
});
test('stale and inaccurate locations pause matching and reset deviation time', () => {
  const { progress, fix, now } = setup(); fix(0, 0); fix(.005, .001);
  assert.equal(fix(.005, .001, 51).status, 'location-unavailable');
  assert.equal(fix(.005, .001, 5, 9000).needsReroute, false);
  assert.equal(progress.update({ latitude: 0, longitude: .001, accuracyMeters: 5, timestampMs: now() - 10001 }).status, 'location-unavailable');
});
test('being near the destination cannot skip the intervening route', () => {
  const { fix } = setup(); fix(0, 0);
  const jumped = fix(.01, .01);
  assert.equal(jumped.status, 'off-route'); assert.equal(jumped.stepIndex, 0);
  assert.ok(jumped.remainingMeters > 2000);
});

test('repeated timestamps do not create a sustained-deviation observation', () => {
  const { progress, fix, now } = setup(); fix(0, 0);
  const timestampMs = now();
  const repeated = progress.update({ latitude: .005, longitude: .001, accuracyMeters: 5, timestampMs });
  assert.equal(repeated.status, 'location-unavailable');
  assert.equal(repeated.needsReroute, false);
});
