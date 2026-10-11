import { clientRuntimeConfig, type ClientRuntimeConfig } from '@simple-strike/client-core';

export function parseWebConfig(value: unknown): ClientRuntimeConfig {
  return clientRuntimeConfig(value);
}
