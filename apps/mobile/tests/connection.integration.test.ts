import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createConfigurationApiClient, createSessionApiClient } from '@simple-strike/api-client';
import { backendConnection, connectionIdentity, refreshSessionCredential, SessionScope } from '@simple-strike/client-core';

test('switching servers while A refreshes cannot persist or send its replacement session to B', async context => {
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { arrived = resolve; });
  const requests: { server: string; path?: string; authorization?: string }[] = [];
  async function service(name: string) {
    const server = createServer(async (req, res) => {
      requests.push({ server: name, path: req.url, authorization: req.headers.authorization });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/v1/client-configuration') {
        res.end(JSON.stringify({ data: { version: 1, oidcIssuer: `https://${name}.example`, oidcClientId: 'mobile' } }));
      } else if (req.url === '/v1/session/refresh') {
        arrived(); await held;
        res.end(JSON.stringify({ data: { token: 'a-replacement', expiresAt: '2099-01-01T00:00:00Z' } }));
      } else {
        res.end(JSON.stringify({ data: { id: name, displayName: name, email: `${name}@example.com` } }));
      }
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    context.after(() => new Promise<void>(resolve => { release(); server.closeAllConnections(); server.close(() => resolve()); }));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing address');
    return `http://127.0.0.1:${address.port}`;
  }
  const aURL = await service('a'); const bURL = await service('b');
  const records = new Map<string, string>();
  const storage = { read: async (key: string) => records.get(key) ?? null, write: async (key: string, value: string) => { records.set(key, value); }, remove: async (key: string) => { records.delete(key); } };
  const aConfig = backendConnection(aURL, await createConfigurationApiClient(aURL).read(), 'development');
  const a = new SessionScope(connectionIdentity(aConfig), storage);
  const initial = { token: 'a-initial', expiresAt: '2098-01-01T00:00:00Z' };
  await a.save(JSON.stringify(initial));
  const refresh = refreshSessionCredential(initial,
    session => createSessionApiClient(aURL, () => session.token).refresh(),
    replacement => a.save(JSON.stringify(replacement)));
  await requested;
  await a.close();
  const bConfig = backendConnection(bURL, await createConfigurationApiClient(bURL).read(), 'development');
  const b = new SessionScope(connectionIdentity(bConfig), storage);
  await b.save(JSON.stringify({ token: 'b-session', expiresAt: initial.expiresAt }));
  release(); await refresh;
  assert.equal(await a.read(), null);
  assert.equal(records.has(a.key), false);
  const bSession = JSON.parse((await b.read())!);
  await createSessionApiClient(bURL, () => bSession.token).profile();
  assert.deepEqual(requests.filter(request => request.server === 'b').map(request => request.authorization), [undefined, 'Bearer b-session']);
});


test('sign-out retires pending work before storage completes and preserves a fresh sign-in', async () => {
  const { replaceSessionScope } = await import('../src/session-disposal');
  const records = new Map<string, string>();
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const storage = {
    read: async (key: string) => records.get(key) ?? null,
    write: async (key: string, value: string) => { records.set(key, value); },
    remove: async (key: string) => { await blocked; records.delete(key); },
  };
  const old = new SessionScope('same-backend', storage);
  await old.save('old-session');
  let replaced = false;
  const replacing = replaceSessionScope(old, async () => {
    replaced = true;
    return new SessionScope(old.key, storage);
  });
  assert.equal(old.active, false);
  assert.equal(replaced, false);
  release();
  const fresh = await replacing;
  assert.equal(await fresh.read(), null);
  await fresh.save('new-sign-in');
  // Both successful refresh and transient failure callbacks can attempt saves.
  await old.save('late-replacement');
  await old.save('old-session');
  assert.equal(old.active, false);
  assert.equal(await old.read(), null);
  assert.equal(await fresh.read(), 'new-sign-in');
});

test('failed secure-storage disposal keeps the retired account closed', async () => {
  const { replaceSessionScope } = await import('../src/session-disposal');
  const scope = new SessionScope('backend', {
    read: async () => 'old-session',
    write: async () => { throw new Error('must not write'); },
    remove: async () => { throw new Error('storage unavailable'); },
  });
  let prepared = false;
  await assert.rejects(replaceSessionScope(scope, async () => { prepared = true; }), /storage unavailable/);
  assert.equal(scope.active, false);
  assert.equal(prepared, false);
  assert.equal(await scope.read(), null);
  await scope.save('late-session');
});
