# Backend Connection Specification

Status: implements the approved user-hosted, single-backend product direction.
Routine setup and isolation choices follow the user's authorization to use
established platform conventions.

## Purpose and actors

A driver connects the phone app to one operator-hosted Simple Strike backend.
A connection consists of the API base URL, OIDC issuer, and public mobile client
identifier. This configuration contains no provider subscription credentials.

## Setup

- The app must let the driver enter a backend base URL before signing in.
- The address field must retain a visible localized label when it contains a value.
- The backend must expose a public, versioned client-configuration endpoint at
  `GET /v1/client-configuration`. Its Huma contract must return the configured
  OIDC issuer and mobile public client identifier in a `data` envelope.
- This endpoint must work without a session and when API documentation is disabled.
  It must use the normal request rate limiter. It exposes public bootstrap metadata,
  not an authenticated domain read, and must not create per-request audit records.
- An absent mobile client identifier must return service unavailable. A configured
  identifier must belong to the server's accepted OIDC audiences.
- The configuration response must not contain secrets, tokens, provider names,
  subscription credentials, or arbitrary upstream URLs supplied by a request.
- The client must use the entered backend as the API destination. The response
  must not override that destination.
- Release connections and their OIDC issuers must use HTTPS, with no embedded
  credentials, query, or fragment. Explicit development builds may use HTTP for
  local development. Empty or malformed settings must fail closed.
- Discovery must have a bounded timeout. Failure must leave the user on setup
  with localized feedback and a retry path; it must not create a partial session.
- The app must display the connected backend address in account settings and
  provide a Change Server action. It must not expose a provider selector.
- Configured build-time defaults may prefill setup. They must not silently replace
  a driver's persisted connection.

## Identity and lifecycle

- A session must be scoped to the normalized API URL, exact OIDC issuer, and client ID.
  The issuer must preserve its exact identifier, including a trailing slash.
  Sessions from one connection must never be restored or transmitted to another.
- Connection settings must persist on the device. Provider credentials remain on
  the server. Native session credentials remain in platform secure storage.
- Changing server must sign out locally, clear the map's in-memory observations,
  and return to setup. Remote revocation is best effort and must use the old API.
- Sign-out must immediately retire the current session scope and clear phone and
  car presentation. Pending refresh or profile responses must not restore it.
  The app must retain backend settings and permit a fresh sign-in only after
  secure storage disposal completes. A disposal failure must keep access closed.
- In-flight work from an old connection must not change the new connection or
  write credentials into its storage namespace.
- Restoring a saved connection must not require network discovery before restoring
  its locally valid session. Existing offline session rules remain authoritative.
- Successful setup must proceed to the existing OIDC authorization-code/PKCE flow.
  This endpoint does not replace OIDC discovery or token validation.

## Acceptance

1. Enter a demo backend URL, resolve its configuration, sign in through Dex, and
   see the labeled demo map.
2. Reject missing, malformed, unsupported-version, credentialed, and insecure
   release configuration without attempting sign-in.
3. On timeout or unavailable backend, remain on setup and permit retry.
4. Change from backend A to B. A's token must not appear in any request to B,
   including when a late refresh or sign-in response from A completes.
5. Restart offline with a saved connection and locally valid session. Restore the
   existing offline state without requiring configuration discovery.

## Related authorities

See [data sources](data-source.spec.md), [map behavior](map.spec.md), and
[identity access](../identity-access/identity-access.spec.md). Navigation background
behavior and Apple entitlement remain separate unresolved decisions.
