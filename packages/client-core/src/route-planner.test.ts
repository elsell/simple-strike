import assert from 'node:assert/strict';
import test from 'node:test';
import { RoutePlanner, type Route, type Place, type RoutePort } from './route-planner.js';
const origin = { latitude: 27, longitude: -82 };
const place: Place = { id: 'destination', name: 'Library', position: { latitude: 27.1, longitude: -82.1 } };
const route: Route = { id: 'route', distanceMeters: 14000, expectedTravelSeconds: 900, coordinates: [origin, place.position], steps: [{ instructions: 'Continue', distanceMeters: 14000, coordinates: [origin, place.position] }] };
class Routes implements RoutePort {
  searches: string[] = [];
  async search(query: string) { this.searches.push(query); return [place]; }
  async calculate() { return route; }
}
test('search and destination selection produce a preview without starting guidance', async () => {
  const port = new Routes(); const planner = new RoutePlanner(port);
  await planner.search(' Library ', origin);
  assert.deepEqual(port.searches, ['Library']);
  assert.equal(planner.snapshot().phase, 'results');
  await planner.select(place, origin);
  const result = planner.snapshot();
  assert.equal(result.phase, 'preview');
  assert.equal(result.route?.distanceMeters, 14000);
  assert.equal(result.destination?.name, 'Library');
});
test('cancel and replacement invalidate pending route calculations', async () => {
  let resolve!: (value: Route) => void;
  const planner = new RoutePlanner({ search: async () => [place], calculate: () => new Promise(done => { resolve = done; }) });
  const pending = planner.select(place, origin);
  planner.cancel(); resolve(route); await pending;
  assert.equal(planner.snapshot().phase, 'idle');
  assert.equal(planner.snapshot().route, null);
});
test('a late search failure cannot overwrite a newer selection', async () => {
  let reject!: (error: Error) => void;
  const planner = new RoutePlanner({ search: () => new Promise((_, fail) => { reject = fail; }), calculate: async () => route });
  const pending = planner.search('old', origin);
  await planner.select(place, origin);
  reject(new Error('offline')); await pending;
  assert.equal(planner.snapshot().phase, 'preview');
});
test('missing location, empty search and malformed route fail without invented geometry', async () => {
  const port = new Routes(); const planner = new RoutePlanner(port);
  await planner.search(' ', origin); assert.equal(port.searches.length, 0);
  await planner.select(place, null); assert.equal(planner.snapshot().error, 'location');
  const broken = new RoutePlanner({ search: async () => [], calculate: async () => ({ ...route, coordinates: [] }) });
  await broken.select(place, origin);
  assert.equal(broken.snapshot().error, 'route'); assert.equal(broken.snapshot().route, null);
});
test('returned geometry cannot mutate the adapter or planner state', async () => {
  const planner = new RoutePlanner(new Routes()); await planner.select(place, origin);
  planner.snapshot().route!.coordinates[0].latitude = 0;
  assert.equal(planner.snapshot().route!.coordinates[0].latitude, 27);
  assert.equal(route.coordinates[0].latitude, 27);
});

test('a late route for A cannot replace the completed route for B', async () => {
  let resolve!: (value: Route) => void;
  const destinationB = { ...place, id: 'b', name: 'Station', position: { latitude: 28, longitude: -82 } };
  const routeB = { ...route, id: 'route-b' };
  const planner = new RoutePlanner({ search: async () => [], calculate: async (_, destination) => {
    if (destination.latitude === 28) return routeB;
    return new Promise(done => { resolve = done; });
  } });
  const pending = planner.select(place, origin);
  await planner.select(destinationB, origin);
  resolve(route); await pending;
  assert.equal(planner.snapshot().destination?.id, 'b');
  assert.equal(planner.snapshot().route?.id, 'route-b');
});
