import assert from 'node:assert/strict';
import test from 'node:test';
import { carNavigationFeedback } from './car-navigation-feedback';

test('car navigation distinguishes failed start, route calculation, and rerouting', () => {
  assert.deepEqual(carNavigationFeedback(true, null, null), { key: 'navigation.locationRequired', retry: false });
  assert.deepEqual(carNavigationFeedback(false, 'location', null), { key: 'navigation.locationRequired', retry: false });
  assert.deepEqual(carNavigationFeedback(false, 'route', null), { key: 'navigation.failed', retry: false });
  assert.deepEqual(carNavigationFeedback(false, null, 'route'), { key: 'navigation.failed', retry: true });
  assert.deepEqual(carNavigationFeedback(false, null, null), { key: null, retry: false });
});
