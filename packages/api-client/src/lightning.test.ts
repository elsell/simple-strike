import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createLightningApiClient } from './index.js';

async function service(context: { after(fn: () => Promise<void>): void }, status: number, body: unknown) {
  const requests: { url?: string; authorization?: string }[] = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, authorization: req.headers.authorization });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  context.after(() => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(err => err ? reject(err) : resolve()); }));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing address');
  return { url: `http://127.0.0.1:${address.port}`, requests };
}
const observation = { id: 'strike-1', latitude: 27, longitude: -82, occurredAt: '2026-10-17T12:00:00Z' };
test('reads labeled observations using the current application session', async context => {
  const backend = await service(context, 200, { data: { mode: 'demo', observations: [observation] } });
  let token = 'first-session'; const client = createLightningApiClient(backend.url, () => token);
  const batch = await client.read();
  assert.equal(batch.mode, 'demo'); assert.equal(batch.strikes[0].occurredAtMs, Date.parse(observation.occurredAt));
  token = 'rotated-session'; await client.read();
  assert.deepEqual(backend.requests.map(r => r.authorization), ['Bearer first-session', 'Bearer rotated-session']);
  assert.equal(backend.requests[0].url, '/v1/lightning/strikes');
});
test('preserves rejected HTTP status instead of accepting payload data', async context => {
  const backend = await service(context, 403, { data: { mode: 'demo', observations: [observation] } });
  await assert.rejects(createLightningApiClient(backend.url, () => 'session').read(), error => (error as { status: number }).status === 403);
});
test('rejects malformed coordinates', async context => {
  const backend = await service(context, 200, { data: { mode: 'demo', observations: [{ ...observation, latitude: 100 }] } });
  await assert.rejects(createLightningApiClient(backend.url, () => 'session').read(), /invalid lightning response/);
});

test('cancels an in-flight feed request through the real HTTP transport', async context => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing address');
  const incoming = once(server, 'request');
  const controller = new AbortController();
  const request = createLightningApiClient(`http://127.0.0.1:${address.port}`, () => 'session').read(controller.signal);
  const rejected = assert.rejects(request, error => (error as Error).name === 'AbortError');
  await incoming;
  controller.abort();
  await rejected;
});
