import assert from 'node:assert/strict';
import test from 'node:test';
import { LightningFeed, type FeedSnapshot, type FeedSource } from './lightning-feed.js';

class PendingSource implements FeedSource {
  requests: { signal: AbortSignal; resolve(value: FeedSnapshot): void; reject(error: unknown): void }[] = [];
  read(signal: AbortSignal): Promise<FeedSnapshot> {
    return new Promise((resolve, reject) => this.requests.push({ signal, resolve, reject }));
  }
}
const snapshot: FeedSnapshot = {
  mode: 'demo', strikes: [{ id: 'demo-1', position: { latitude: 27, longitude: -82 }, occurredAtMs: 1000 }],
};

test('refresh coalesces concurrent reads and permits a new read after completion', async () => {
  const source = new PendingSource();
  const received: FeedSnapshot[] = [];
  const feed = new LightningFeed(source, { received: value => received.push(value), failed: () => assert.fail() });
  const first = feed.refresh();
  const concurrent = feed.refresh();
  assert.equal(source.requests.length, 1);
  source.requests[0].resolve(snapshot);
  await Promise.all([first, concurrent]);
  assert.deepEqual(received, [snapshot]);
  const next = feed.refresh();
  assert.equal(source.requests.length, 2);
  source.requests[1].resolve({ mode: 'live', strikes: [] });
  await next;
  assert.equal(received[1].mode, 'live');
});

for (const outcome of ['success', 'failure'] as const) {
  test(`stopping a feed cancels its request and ignores a late ${outcome}`, async () => {
    const source = new PendingSource();
    const feed = new LightningFeed(source, { received: () => assert.fail(), failed: () => assert.fail() });
    const request = feed.refresh();
    feed.stop();
    assert.equal(source.requests[0].signal.aborted, true);
    if (outcome === 'success') source.requests[0].resolve(snapshot);
    else source.requests[0].reject({ kind: 'http', status: 401 });
    await request;
    await feed.refresh();
    assert.equal(source.requests.length, 1);
  });
}

test('feed errors retain their classification without mutating the session', async () => {
  const source = new PendingSource();
  const failures: unknown[] = [];
  const feed = new LightningFeed(source, { received: () => assert.fail(), failed: error => failures.push(error) });
  const failure = { kind: 'http', status: 403 };
  const request = feed.refresh();
  source.requests[0].reject(failure);
  await request;
  assert.equal(failures[0], failure);
  feed.stop();
});
