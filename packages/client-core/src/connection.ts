import type { ClientRuntimeConfig } from './index';

export function normalizeBackendURL(value: string, environment: ClientRuntimeConfig['environment']): string {
  const url = new URL(value.trim());
  if ((url.protocol !== 'https:' && !(environment === 'development' && url.protocol === 'http:')) ||
      !url.hostname || url.username || url.password || url.search || url.hash) {
    throw new Error('BACKEND_CONFIGURATION');
  }
  return url.toString().replace(/\/+$/, '');
}

export function backendConnection(apiURL: string, metadata: unknown, environment: ClientRuntimeConfig['environment']): ClientRuntimeConfig {
  if (!metadata || typeof metadata !== 'object') throw new Error('BACKEND_CONFIGURATION');
  const value = metadata as Record<string, unknown>;
  if (value.version !== 1 || typeof value.oidcIssuer !== 'string' ||
      typeof value.oidcClientId !== 'string' || !value.oidcClientId || /\s/.test(value.oidcClientId)) {
    throw new Error('BACKEND_CONFIGURATION');
  }
  return {
    environment,
    apiURL: normalizeBackendURL(apiURL, environment),
    // OIDC issuer identifiers are exact strings, including a trailing slash.
    oidcIssuer: validatedIssuer(value.oidcIssuer, environment),
    oidcClientId: value.oidcClientId,
  };
}

// Hash this stable tuple in the native storage adapter. Do not use tokens or email.
export function connectionIdentity(connection: ClientRuntimeConfig): string {
  return JSON.stringify([connection.apiURL, connection.oidcIssuer, connection.oidcClientId]);
}

function validatedIssuer(value: string, environment: ClientRuntimeConfig['environment']): string {
  if (value.trim() !== value) throw new Error('BACKEND_CONFIGURATION');
  normalizeBackendURL(value, environment);
  return value;
}
