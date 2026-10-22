# Platform Roadmap Specification

## Current slice

Implement optional driving navigation and native CarPlay integration. See
[navigation](../navigation/navigation.spec.md). This is the only product slice
in active implementation. Backend connection setup is implemented in a stacked
draft and awaits native verification and its required CI checks.

## Awaiting verification

The demo-map slice remains unmerged and awaits native interaction evidence and
its required CI and production-image checks. It is not complete. Its draft PR
remains the base of the connection-setup work; the next slice must not merge ahead
of that dependency. Runtime image security is the one active infrastructure blocker.

## Following slices

1. Complete device, deployment, and Apple review preparation and verification.

## External dependencies

Apple Developer access, signing, entitlement, and approval require external action.
Real provider adapters require operator-authorized data access. The demo provider
does not depend on a real subscription.

## Evidence

The demo backend has passed an isolated integration check through real Dex,
PostgreSQL, SpiceDB, and the runtime capability proxy. Session exchange, protected
feed access, and durable read auditing were verified. This is not native-client
or browser-PKCE acceptance. Product implementation is not yet complete.
Local browser experiments are separate and are not native acceptance evidence.
See [map](../lightning/map.spec.md), [data source](../lightning/data-source.spec.md),
and [bootstrap notes](../../docs/bootstrap.md).

The active slice also requires native simulator interaction evidence and final
production-image verification. See [runtime image review](../../docs/image-review.md)
for the current image findings and verified API base refresh.
