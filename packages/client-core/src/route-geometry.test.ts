import assert from 'node:assert/strict';
import test from 'node:test';
import { RouteGeometry } from './route-geometry.js';
const p = (latitude: number, longitude: number) => ({ latitude, longitude });
test('matches a location to a segment and reports along-route distance', () => {
  const geometry = new RouteGeometry([p(0, 0), p(0, .01), p(.01, .01)]);
  const match = geometry.match(p(.001, .005));
  assert.ok(Math.abs(match.alongMeters - geometry.lengthMeters / 4) < 1);
  assert.ok(match.distanceMeters > 110 && match.distanceMeters < 112);
  assert.equal(match.segmentIndex, 0);
});
test('route distance includes turns instead of cutting directly to destination', () => {
  const geometry = new RouteGeometry([p(0, 0), p(0, .01), p(.01, .01)]);
  const match = geometry.match(p(.005, .01));
  assert.ok(Math.abs(match.alongMeters - geometry.lengthMeters * .75) < 1);
  assert.equal(match.segmentIndex, 1);
});
test('progress bounds exclude a nearby return leg and clip a segment', () => {
  const geometry = new RouteGeometry([p(0, 0), p(0, .02), p(.001, .02), p(.001, 0)]);
  const match = geometry.match(p(.001, .005), { minimum: 0, maximum: 1000 });
  assert.equal(match.segmentIndex, 0);
  assert.ok(match.alongMeters < 600);
  const clipped = geometry.match(p(0, .015), { minimum: 200, maximum: 500 });
  assert.equal(clipped.alongMeters, 500);
});
test('date-line segments follow the short arc', () => {
  const geometry = new RouteGeometry([p(0, 179.99), p(0, -179.99)]);
  const match = geometry.match(p(.001, 180));
  assert.ok(geometry.lengthMeters > 2200 && geometry.lengthMeters < 2230);
  assert.ok(Math.abs(match.alongMeters - geometry.lengthMeters / 2) < 1);
  assert.ok(match.distanceMeters < 112);
});
test('duplicate points remain finite and caller mutations cannot alter the path', () => {
  const points = [p(0, 0), p(0, 0), p(0, .01)];
  const geometry = new RouteGeometry(points); points[2].longitude = 30;
  const match = geometry.match(p(0, .005));
  assert.ok(Number.isFinite(match.alongMeters));
  assert.ok(match.alongMeters > 550 && match.alongMeters < 560);
});
test('invalid geometry and progress windows fail explicitly', () => {
  for (const points of [[], [p(0, 0)], [p(0, 0), p(0, 0)], [p(0, 0), p(91, 0)]]) {
    assert.throws(() => new RouteGeometry(points));
  }
  const geometry = new RouteGeometry([p(0, 0), p(0, .01)]);
  assert.throws(() => geometry.match(p(NaN, 0)));
  for (const interval of [{ minimum: 2, maximum: 1 }, { minimum: -1, maximum: 5 }, { minimum: 0, maximum: Infinity }]) {
    assert.throws(() => geometry.match(p(0, 0), interval));
  }
});
