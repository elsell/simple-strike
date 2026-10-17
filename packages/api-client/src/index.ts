import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { createAuthenticatedFetch } from './transport';
import type { TokenProvider } from './transport';
export type { TokenProvider } from './transport';
export { sessionExpiryAdvanced, sessionRefreshDelay, sessionRefreshLeadMs } from './session';

export function createApiClient(baseUrl: string, tokenProvider: TokenProvider) {
  return createClient<paths>({
    baseUrl,
    fetch: createAuthenticatedFetch(tokenProvider),
  });
}

export function createSessionApiClient(baseUrl: string, tokenProvider: TokenProvider) {
  const client = createApiClient(baseUrl, tokenProvider);
  return {
    exchange: (identityToken: string) => client.POST('/v1/sessions', { body: { identityToken } }),
    refresh: () => client.POST('/v1/session/refresh'),
    profile: () => client.GET('/v1/me'),
    revoke: () => client.DELETE('/v1/session'),
  };
}

export type LightningSnapshot = {
  mode: 'demo' | 'live';
  strikes: { id: string; position: { latitude: number; longitude: number }; occurredAtMs: number }[];
};

export function createLightningApiClient(baseUrl: string, tokenProvider: TokenProvider) {
  const client = createApiClient(baseUrl, tokenProvider);
  return {
    async read(signal?: AbortSignal): Promise<LightningSnapshot> {
      const result = await client.GET('/v1/lightning/strikes', { signal });
      if (!result.response.ok) throw { kind: 'http', status: result.response.status };
      const batch = result.data?.data;
      if (!batch || !['demo', 'live'].includes(batch.mode) || !Array.isArray(batch.observations)) {
        throw new Error('invalid lightning response');
      }
      const strikes = batch.observations.map(observation => {
        if (!observation || typeof observation.id !== 'string' || !observation.id ||
          !Number.isFinite(observation.latitude) || Math.abs(observation.latitude) > 90 ||
          !Number.isFinite(observation.longitude) || Math.abs(observation.longitude) > 180 ||
          typeof observation.occurredAt !== 'string' || !Number.isFinite(Date.parse(observation.occurredAt))) {
          throw new Error('invalid lightning response');
        }
        return {
          id: observation.id,
          position: { latitude: observation.latitude, longitude: observation.longitude },
          occurredAtMs: Date.parse(observation.occurredAt),
        };
      });
      return { mode: batch.mode, strikes };
    },
  };
}
