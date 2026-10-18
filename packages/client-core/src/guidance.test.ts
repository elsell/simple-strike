import assert from 'node:assert/strict';
import test from 'node:test';
import { Guidance, type SpeechPort } from './guidance.js';
import type { Route } from './route-planner';
const route: Route = { id: 'r', distanceMeters: 2200, expectedTravelSeconds: 200, coordinates: [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: .01 }, { latitude: .01, longitude: .01 }], steps: [
  { instructions: 'East', distanceMeters: 1100, coordinates: [] }, { instructions: 'North', distanceMeters: 1100, coordinates: [] },
] };
const destination = { id: 'd', name: 'Destination', position: { latitude: .01, longitude: .01 } };
class Speech implements SpeechPort {
  messages: string[] = []; stops = 0;
  speak(text: string) { this.messages.push(text); }
  stop() { this.stops++; }
}
function setup(calculate: () => Promise<Route> = async () => route) {
  let now = 1000; const speech = new Speech();
  const guidance = new Guidance({ calculate }, speech, { now: () => now }, 'Arrived');
  const fix = (latitude: number, longitude: number, advance = 1000) => { now += advance; return { latitude, longitude, accuracyMeters: 5, timestampMs: now }; };
  guidance.start(route, destination, fix(0, 0));
  return { guidance, speech, fix };
}
test('guidance announces maneuvers once and End Route clears state and speech', async () => {
  const { guidance, speech, fix } = setup();
  assert.deepEqual(speech.messages, ['East']);
  await guidance.update(fix(0, .001)); await guidance.update(fix(0, .0011));
  assert.deepEqual(speech.messages, ['East']);
  guidance.end(); assert.equal(guidance.snapshot().phase, 'idle');
  assert.equal(guidance.snapshot().route, null); assert.ok(speech.stops > 0);
});
test('a late recalculation cannot revive an ended route or speak', async () => {
  let resolve!: (value: Route) => void; let calls = 0;
  const { guidance, speech, fix } = setup(() => { calls++; return new Promise(done => { resolve = done; }); });
  await guidance.update(fix(.005, .001));
  const pending = guidance.update(fix(.005, .001, 8000));
  assert.equal(guidance.snapshot().phase, 'rerouting');
  await guidance.update(fix(.005, .001)); assert.equal(calls, 1);
  guidance.end(); const count = speech.messages.length;
  resolve({ ...route, id: 'late' }); await pending;
  assert.equal(guidance.snapshot().route, null); assert.equal(speech.messages.length, count);
});
test('reroute failures are bounded and rate limited until explicit retry', async () => {
  let calls = 0;
  const { guidance, fix } = setup(async () => { calls++; throw new Error('offline'); });
  await guidance.update(fix(.005, .001));
  await guidance.update(fix(.005, .001, 8000)); assert.equal(calls, 1);
  await guidance.update(fix(.005, .001)); assert.equal(calls, 1);
  for (let i = 0; i < 5; i++) await guidance.update(fix(.005, .001, 30000));
  assert.equal(calls, 3); assert.equal(guidance.snapshot().error, 'route');
});
test('a simulated drive announces arrival once', async () => {
  const { guidance, speech, fix } = setup();
  for (let i = 1; i <= 10; i++) await guidance.update(fix(0, i * .001));
  for (let i = 1; i <= 10; i++) await guidance.update(fix(i * .001, .01));
  await guidance.update(fix(.01, .01));
  assert.equal(guidance.snapshot().phase, 'arrived');
  assert.equal(speech.messages.filter(message => message === 'Arrived').length, 1);
});

test('a valid recalculation replaces the route and resumes visual and spoken guidance', async () => {
  const replacement: Route = { ...route, id: 'replacement', coordinates: [{ latitude: .005, longitude: .001 }, { latitude: .01, longitude: .01 }], steps: [{ instructions: 'Continue to destination', distanceMeters: 1000, coordinates: [] }] };
  const { guidance, speech, fix } = setup(async () => replacement);
  await guidance.update(fix(.005, .001));
  await guidance.update(fix(.005, .001, 8000));
  assert.equal(guidance.snapshot().route?.id, 'replacement');
  assert.equal(guidance.snapshot().progress?.status, 'tracking');
  assert.equal(speech.messages.at(-1), 'Continue to destination');
});

test('location loss during a pending recalculation suppresses speech until a usable fix', async () => {
  let resolve!: (value: Route) => void;
  const replacement: Route = { ...route, id: 'replacement', coordinates: [{ latitude: .005, longitude: .001 }, { latitude: .01, longitude: .01 }], steps: [{ instructions: 'Continue to destination', distanceMeters: 1000, coordinates: [] }] };
  const { guidance, speech, fix } = setup(() => new Promise(done => { resolve = done; }));
  await guidance.update(fix(.005, .001));
  const pending = guidance.update(fix(.005, .001, 8000));
  await guidance.update({ ...fix(.005, .001), accuracyMeters: 100 });
  const spoken = speech.messages.length; resolve(replacement); await pending;
  assert.equal(speech.messages.length, spoken);
  await guidance.update(fix(.005, .001));
  assert.equal(speech.messages.at(-1), 'Continue to destination');
});

test('an approaching maneuver does not immediately interrupt the current instruction', async () => {
  let now = 1000; const speech = new Speech();
  const guidance = new Guidance({ calculate: async () => route }, speech, { now: () => now }, 'Arrived');
  const shortFirstStep = { ...route, steps: [{ ...route.steps[0], distanceMeters: 50 }, { ...route.steps[1], distanceMeters: 2150 }] };
  const fix = () => ({ latitude: 0, longitude: 0, accuracyMeters: 5, timestampMs: now });
  guidance.start(shortFirstStep, destination, fix());
  assert.deepEqual(speech.messages, ['East']);
  now += 1000; await guidance.update(fix()); assert.deepEqual(speech.messages, ['East']);
  now += 5000; await guidance.update(fix()); assert.deepEqual(speech.messages, ['East', 'North']);
});

test('pausing invalidates pending work and resumes only on a fresh location', async () => {
  let resolve!: (value: Route) => void;
  const { guidance, speech, fix } = setup(() => new Promise(done => { resolve = done; }));
  await guidance.update(fix(.005, .001));
  const pending = guidance.update(fix(.005, .001, 8000));
  guidance.pause(); const count = speech.messages.length;
  resolve({ ...route, id: 'obsolete' }); await pending;
  assert.equal(guidance.snapshot().route?.id, 'r');
  assert.equal(guidance.snapshot().progress?.status, 'location-unavailable');
  assert.equal(speech.messages.length, count);
  await guidance.update(fix(0, .001));
  assert.equal(guidance.snapshot().progress?.status, 'tracking');
});
