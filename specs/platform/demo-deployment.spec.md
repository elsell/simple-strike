# Public Demo Deployment

## Purpose and actors

The operator supplies a public demo backend for users and Apple reviewers. The
demo uses the same authenticated API as a user-hosted backend and generates
simulated lightning only. A demo account is shared and must not contain private
user data.

## Approved deployment behavior

- The public demo endpoint must be `https://demo.simplestrike.online`.
- Kubernetes deployment must use the operator's Flux GitOps repository. Public
  application sources must not contain private cluster configuration or secrets.
- The demo must use Dex OIDC and the documented shared demo credentials. Public
  demo credentials must not also grant database, infrastructure, or administrative
  access. Account self-deactivation must be disabled for the shared account.
- Each backend must load exactly one provider adapter. This deployment must use
  the demo adapter and label simulated data according to the map specification.
- API and authorization runtime credentials must remain separate from database
  migration and authorization schema credentials.
- Images must be pinned by digest and pass the applicable release security gate.
  Deployment evidence must identify the mechanically derived source revision.
- The operator must configure secrets through the cluster secret manager. Missing
  secrets must prevent startup; known development secrets must not be substituted.
- Public OIDC issuer and redirect URIs must match the deployed HTTPS endpoints.
- Mac builds and simulator acceptance must run on CI macOS runners.

## Verification and failure behavior

Before declaring the demo available, verify public TLS, OIDC discovery, native
PKCE sign-in, protected demo feed access, sign-out, and denial of unauthenticated
requests. A manifest render or successful container build alone is not deployment
evidence. Flux must complete migrations and authorization schema publication
before making the API ready. A failed prerequisite must leave the rollout unready.

## Dependencies

DNS zone access, a reachable cluster, secret-manager configuration, and approved
runtime images are deployment prerequisites. Apple signing and CarPlay entitlement
remain separate external prerequisites. No deployment configuration grants them.

See [data source](../lightning/data-source.spec.md),
[connection](../lightning/connection.spec.md), and
[production guidance](../../docs/production.md).
