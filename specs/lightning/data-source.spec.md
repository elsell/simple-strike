# Lightning Data Source Specification

Status: approved product direction. OIDC sign-in is approved. Transport details are open.

## Purpose and terminology

The backend normalizes one operator-selected source into the Simple Strike API.
An adapter translates a provider protocol into domain observations. The demo
adapter generates simulated observations without an upstream subscription.

## Required boundaries

- Each backend deployment must configure exactly one provider adapter.
- The backend must not aggregate providers. The app must not select providers.
- The iOS and CarPlay clients must receive lightning data through that backend.
- Provider subscription credentials must remain on the backend.
- The public application and API must remain provider-neutral.
- Provider-specific private adapters may be maintained and deployed separately.
- The extension boundary must permit replacing the source without changing
  domain or client behavior. Use dependency injection and explicit ports.
- A demo adapter and runnable demo server must be supplied through the same API.
- The API must identify whether observations are simulated. Clients must preserve
  that distinction in presentation.
- Public source must contain no secrets, private deployment details, or experimental
  third-party feed code. Operators are responsible for authorized provider access.
- Review documentation must disclose both demo and real-data connection behavior.
  Demo credentials or data must not hide intended live functionality from review.

## Sign-in

Users must sign in through the backend's OIDC provider. The demo backend must use
Dex and published shared demo credentials. See the authoritative
[identity access specification](../identity-access/identity-access.spec.md).

## Acceptance scenarios

- A deployment configured for demo emits labeled simulated observations.
- A separately supplied conforming adapter can replace the demo source without
  changing clients or domain code.
- A client receives normalized observations without receiving provider credentials.
- One backend exposes one source, with no runtime user-facing provider selector.

Backend connection setup is specified in [connection setup](connection.spec.md).

## Open questions

- Operator provisioning of feed-view permission.

- Normalized observation identifiers, accuracy metadata, attribution, coverage,
  delay, freshness, health, retention, limits, and error contract.
- Subscription transport, replay, reconnect, and duplicate handling.
- Deployment packaging for independently maintained adapters.

## Feed read application boundary

An observation read must require an active application session and an active local
user. It must check the configured feed's view permission through the existing
authorizer port before consulting the source. A denied decision or authorization
service failure must return no observations. Reads must use the principal audit
limiter and emit a structured resource-view audit event before returning data.
A failed audit write must prevent a successful response. Audit records must not
contain vehicle locations, provider credentials, or strike batches.

The initial read use case requests the last five minutes using the injected server
clock. HTTP route composition and operator permission provisioning must preserve
these checks; this application use case alone does not expose an endpoint.

## Initial HTTP transport

`GET /v1/lightning/strikes` returns a Huma-described `data` envelope containing
`mode` and `observations`. Each observation has `id`, `latitude`, `longitude`, and
`occurredAt`. This is a snapshot read, not a complete-feed guarantee. The endpoint
must use the feed-read application boundary and existing machine-readable error
mapping. Source selection and credentials must not be request parameters.

Authenticated feed reads that fail because the source or authorizer is unavailable
must emit a failed resource-read audit event. If the audit write also fails, the
request must still fail and must not return observations.
