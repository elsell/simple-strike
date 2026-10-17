import assert from 'node:assert/strict';
import test from 'node:test';
import { MapSession } from './map-session.js';

test('following tracks vehicle while exploration preserves the chosen map center', () => {
  const start = { latitude: 27.95, longitude: -82.46 };
  const session = new MapSession(start);
  const next = { latitude: 27.96, longitude: -82.45 };
  session.updatePosition(next);
  assert.deepEqual(session.snapshot().center, next);
  const explored = { latitude: 28, longitude: -82 };
  session.explore(explored);
  session.updatePosition(start);
  assert.deepEqual(session.snapshot(), { vehicle: start, center: explored, following: false, radiusMeters: 32186.88 });
  session.recenter();
  assert.deepEqual(session.snapshot(), { vehicle: start, center: start, following: true, radiusMeters: 32186.88 });
});

test('ending route guidance restores follow-me after map exploration', () => {
  const session = new MapSession({ latitude: 27, longitude: -82 });
  session.explore({ latitude: 28, longitude: -81 });
  session.endRoute();
  assert.equal(session.snapshot().following, true);
  assert.deepEqual(session.snapshot().center, session.snapshot().vehicle);
});

test('callers cannot mutate map state through supplied or returned positions', () => {
  const position = { latitude: 27, longitude: -82 };
  const session = new MapSession(position);
  position.latitude = 0;
  const snapshot = session.snapshot();
  snapshot.vehicle.latitude = 1;
  snapshot.center.longitude = 0;
  assert.deepEqual(session.snapshot().vehicle, { latitude: 27, longitude: -82 });
  assert.deepEqual(session.snapshot().center, { latitude: 27, longitude: -82 });
});

test('zoom changes the viewport without changing tracking and recenter preserves zoom', () => {
  const session = new MapSession({ latitude: 27, longitude: -82 });
  assert.equal(session.snapshot().radiusMeters, 20 * 1609.344);
  session.zoomIn();
  assert.equal(session.snapshot().radiusMeters, 10 * 1609.344);
  assert.equal(session.snapshot().following, true);
  session.explore({ latitude: 28, longitude: -81 });
  session.zoomOut();
  session.zoomOut();
  assert.equal(session.snapshot().radiusMeters, 40 * 1609.344);
  assert.equal(session.snapshot().following, false);
  session.recenter();
  assert.equal(session.snapshot().radiusMeters, 40 * 1609.344);
  assert.deepEqual(session.snapshot().center, session.snapshot().vehicle);
  session.endRoute();
  assert.equal(session.snapshot().radiusMeters, 40 * 1609.344);
});
