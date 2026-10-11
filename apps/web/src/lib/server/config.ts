import { env } from '$env/dynamic/private';
import { parseWebConfig } from '$lib/config';

export function loadWebConfig() {
  return parseWebConfig({
    environment: env.SIMPLE_STRIKE_APP_ENV ?? 'development',
    apiURL: env.SIMPLE_STRIKE_API_URL ?? 'http://localhost:8080',
    oidcIssuer: env.SIMPLE_STRIKE_OIDC_ISSUER ?? 'http://localhost:5556/dex',
    oidcClientId: env.SIMPLE_STRIKE_WEB_OIDC_CLIENT_ID ?? 'simple-strike-web',
  });
}

export const webConfig = loadWebConfig();
