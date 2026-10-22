import assert from 'node:assert/strict';
import test from 'node:test';
import { CarPresentation } from './car-presentation.js';
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
test('closing before native session creation completes closes only its own generation', async () => {
  const opening = deferred<number>(); const writes: number[] = []; const closes: number[] = [];
  const presentation = new CarPresentation<number>({ begin: () => opening.promise, publish: async (_, value) => { writes.push(value); }, end: async generation => { closes.push(generation); } }, () => undefined);
  presentation.update(1); const closing = presentation.close(); opening.resolve(17); await closing;
  assert.deepEqual(writes, []); assert.deepEqual(closes, [17]);
  presentation.update(2); await presentation.close(); assert.deepEqual(closes, [17]);
});
test('a slow native write coalesces updates and does not send state after close', async () => {
  const entered = deferred<void>(); const first = deferred<void>(); const second = deferred<void>(); const writes: number[] = [];
  const presentation = new CarPresentation<number>({ begin: async () => 2, publish: async (_, value) => { writes.push(value); if (value === 1) { entered.resolve(); await first.promise; } else second.resolve(); }, end: async () => undefined }, () => undefined);
  presentation.update(1); await entered.promise;
  presentation.update(2); presentation.update(3); first.resolve(); await second.promise;
  assert.deepEqual(writes, [1, 3]); await presentation.close();
  presentation.update(4); assert.deepEqual(writes, [1, 3]);
});
test('a failed native write reports the error without endlessly retrying', async () => {
  const reported = deferred<void>(); let attempts = 0;
  const presentation = new CarPresentation<number>({ begin: async () => 1, publish: async () => { attempts++; throw new Error('disconnected'); }, end: async () => undefined }, () => reported.resolve());
  presentation.update(1); await reported.promise; await presentation.close();
  assert.equal(attempts, 1);
});

test('close invalidates an in-flight generation without waiting for a slow write', async () => {
  const entered = deferred<void>(); const release = deferred<void>();
  const finished = deferred<void>(); let generation = 0; let displayed: number | null = null;
  const port = {
    begin: async () => { displayed = null; return ++generation; },
    publish: async (candidate: number, value: number) => {
      if (value === 1) { entered.resolve(); await release.promise; }
      if (candidate === generation) displayed = value;
      if (value === 1) finished.resolve();
    },
    end: async (candidate: number) => { if (candidate === generation) { generation++; displayed = null; } },
  };
  const errors: unknown[] = [];
  const first = new CarPresentation(port, cause => { errors.push(cause); });
  first.update(1); await entered.promise;
  first.update(2);
  await first.close();
  assert.equal(displayed, null);
  const second = new CarPresentation(port, cause => { errors.push(cause); });
  second.update(3);
  // Opening and publication each cross one asynchronous port boundary.
  await Promise.resolve(); await Promise.resolve();
  assert.equal(displayed, 3);
  release.resolve(); await finished.promise;
  assert.equal(displayed, 3);
  await first.close(); assert.equal(displayed, 3);
  await second.close(); assert.equal(displayed, null);
  assert.deepEqual(errors, []);
});
