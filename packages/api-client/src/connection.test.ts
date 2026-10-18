import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createConfigurationApiClient } from './index.js';

test('public configuration uses the selected server without credentials and supports cancellation', async context => {
  const requests: { path?: string; authorization?: string }[] = [];
  const server = createServer((req, res) => {
    requests.push({ path: req.url, authorization: req.headers.authorization });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: { version: 1, oidcIssuer: 'https://id.example', oidcClientId: 'mobile' } }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  context.after(() => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(err => err ? reject(err) : resolve()); }));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing address');
  const client = createConfigurationApiClient(`http://127.0.0.1:${address.port}`);
  assert.equal((await client.read()).oidcClientId, 'mobile');
  assert.deepEqual(requests, [{ path: '/v1/client-configuration', authorization: undefined }]);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(client.read(controller.signal));
  assert.equal(requests.length, 1);
});
