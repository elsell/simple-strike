import en from '../../packages/i18n/src/locales/en.json';
import es from '../../packages/i18n/src/locales/es.json';

export default ({ config }: { config: Record<string, unknown> }) => ({
  ...config,
  ios: {
    ...((config.ios as Record<string, unknown> | undefined) ?? {}),
    infoPlist: {
      ...(((config.ios as Record<string, unknown> | undefined)?.infoPlist as Record<string, unknown> | undefined) ?? {}),
      NSLocationWhenInUseUsageDescription: en['map.locationPermission'],
    },
  },
  locales: {
    en: { NSLocationWhenInUseUsageDescription: en['map.locationPermission'] },
    es: { NSLocationWhenInUseUsageDescription: es['map.locationPermission'] },
  },
  extra: {
    ...((config.extra as Record<string, unknown> | undefined) ?? {}),
    application: {
      environment: process.env.SIMPLE_STRIKE_APP_ENV ?? 'development',
      apiURL: process.env.SIMPLE_STRIKE_API_URL ?? 'http://localhost:8080',
      oidcIssuer: process.env.SIMPLE_STRIKE_OIDC_ISSUER ?? 'http://localhost:5556/dex',
      oidcClientId: process.env.SIMPLE_STRIKE_MOBILE_OIDC_CLIENT_ID ?? 'simple-strike-mobile',
    },
  },
});
