import type { SessionScope } from '@simple-strike/client-core';

export async function replaceSessionScope<T>(scope: SessionScope, prepare: () => Promise<T>): Promise<T> {
  await scope.close();
  return prepare();
}
