# Platform Roadmap Specification

## Current slice

Implement the demo lightning map through the self-hosted backend and iOS client.
Record approved behavior before coding. Resolve access and failure policies before
implementing their boundaries. No other product slice is in progress.

## Following slices

1. Complete backend connection setup and private adapter extension documentation.
2. Deliver optional turn-by-turn navigation and native CarPlay integration.
3. Complete device, deployment, and Apple review preparation and verification.

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
