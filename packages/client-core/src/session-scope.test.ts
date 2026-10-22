import assert from 'node:assert/strict';
import test from 'node:test';
import { SessionScope } from './session-scope.js';

test('closing a connection drains writes, deletes its session and rejects late writes', async () => {
  const stored = new Map<string, string>();
  let release!: () => void;
  let started!: () => void;
  const writing = new Promise<void>(resolve => { started = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const store = {
    read: async (key: string) => stored.get(key) ?? null,
    write: async (key: string, value: string) => { started(); await held; stored.set(key, value); },
    remove: async (key: string) => { stored.delete(key); },
  };
  const a = new SessionScope('server-a', store);
  const b = new SessionScope('server-b', store);
  const write = a.save('a-token');
  await writing;
  const close = a.close();
  const late = a.save('late-a-token');
  release();
  await Promise.all([write, close, late]);
  assert.equal(await a.read(), null);
  assert.equal(stored.has('server-a'), false);
  await b.save('b-token');
  assert.equal(await b.read(), 'b-token');
});
