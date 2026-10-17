# Configure a production OIDC provider

Create three public clients: `simple-strike-web`, `simple-strike-mobile`, and
`simple-strike-docs`. None receives a client secret.

Register these deployed redirect URIs:

- web: `https://APP_ORIGIN/callback`
- mobile: `simplestrike://callback`
- docs: `https://API_ORIGIN/docs`

Permit the web origin to perform the authorization-code token exchange. Enable
authorization code with S256 PKCE and the `openid`, `profile`, and `email`
scopes. Tokens must contain a stable subject, exact issuer, a configured client
audience, expiry, and a verified-email signal when invitation provisioning is
used. Multiple-audience tokens must include a valid authorized party.

Set the public issuer in every client and in `SIMPLE_STRIKE_OIDC_ISSUER`. Use
`SIMPLE_STRIKE_OIDC_BACKCHANNEL_URL` only when the API reaches the same issuer
through a private network address. Its path must match the public issuer; it
does not change token issuer validation.

Set `SIMPLE_STRIKE_OIDC_INSECURE=false` in production. Verify sign-in, session
exchange, refresh, revocation, account disablement, provider key rotation, and
provider unavailability before launch.

## Shared demo sign-in

The product uses OIDC for both demo and operator-hosted backends. The local demo
identity overlay replaces the development test users with one published Dex user:

- Sign-in email: `demo@example.com`
- Password: `password`

These are deliberately public demo credentials, not a private secret. The account
has no configured invitation-administrator identity. Self-deactivation is disabled
for the shared demo account. The normal PKCE and session exchange flow still applies.

Use `docker compose -f compose.yaml -f compose.demo.yaml config` to inspect the
local configuration. The overlay enables the simulated lightning source and grants
authenticated users read access to that feed. The protected HTTP feed, session
exchange, and audit path have an integration check in
`scripts/verify-demo-feed.py`. The complete mobile interface remains in progress.

Do not use these credentials for a real-data deployment. Configure the operator's
OIDC provider instead. For a hosted demo, set HTTPS issuer, origin, and redirect
URLs before deployment; the included Dex file uses localhost for local testing.
