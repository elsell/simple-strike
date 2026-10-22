# Production checklist

Deploy the API and web images by immutable digest. Run PostgreSQL migrations and
the SpiceDB datastore migration/schema jobs with separate credentials before
starting API replicas. API database credentials must not own schema or migration
state; API SpiceDB credentials go through the capability proxy and cannot change
schema.

Required preparation:

- Set `SIMPLE_STRIKE_APP_ENV=production`, `SIMPLE_STRIKE_API_URL`,
  `SIMPLE_STRIKE_OIDC_ISSUER`, and `SIMPLE_STRIKE_WEB_OIDC_CLIENT_ID` for the
  web container. The image defaults to production
  mode and refuses to serve with absent, local, credentialed, or non-HTTPS
  production endpoints. Local Compose explicitly overrides this to development.
- Keep the generated Red Hat Hardened Images for Go, the static API runtime,
  Node.js, and PostgreSQL unless a documented compatibility constraint requires
  another source. When updating a base, select an immutable catalog release,
  pin its manifest-list digest, inspect its SBOM and CVE report, and verify its
  Red Hat signature using the catalog's current instructions. Hardened Images
  are usable without a Red Hat subscription. Do not claim FIPS compliance from
  a FIPS image tag alone; validate the complete application, cryptographic
  configuration, host, and deployment boundary.
- Terminate TLS at a trusted proxy and forward only validated scheme/host data.
  Keep API, PostgreSQL, SpiceDB, OTLP, and OIDC transport encryption enabled.
  Set `SIMPLE_STRIKE_TRUSTED_PROXY_CIDRS` to only that proxy network when
  client-source forwarding is required; leave it empty for direct deployments.
- Generate independent high-entropy cursor, metrics, database, SpiceDB, and
  other credentials. Never deploy values from `.env.example` or Compose.
- Configure exact public API/web origins, CORS origins, OIDC clients and redirect
  URIs using `docs/oidc.md`.
- Size the PostgreSQL connection pool across all replicas, not per process in
  isolation. Configure request/audit limits, session lifetimes, and authorization
  retry/dead-letter policy for expected traffic.
- Configure OTLP export, scrape the authenticated metrics endpoint, and alert on
  readiness, authorization dead letters, audit-write rate, database capacity,
  latency, and error probes.
- Choose and test an audit retention period. Retention is disabled by default
  and must run with its separate database role; the API runtime cannot erase
  audit events.
- Bootstrap invitation administrators before selecting invitation-only account
  provisioning, then test invitation expiry, consumption, revocation, and
  concurrent first login.
- Route liveness and readiness separately. During rolling deployment, complete
  migrations and authorization schema first, wait for readiness, and drain API
  replicas using their bounded shutdown window.
- Exercise restore procedures and a complete staging rollout even when backup
  infrastructure is managed outside this repository.

Scalar documentation can be disabled. Do so unless interactive production API
documentation is intentional and its public OIDC client is registered.

## Go builder update under verification

The candidate builder is Red Hat Hardened Images
`hi/go:1.26.9-builder-1792219929`, pinned to multi-platform digest
`sha256:b4e44ef2280aace1a866614567ab6b373a4f92a971283246e74d64ae5b056c79`.
Its Red Hat signature verified against the published `63405576.txt` key.

The amd64 and arm64 SPDX inventories were read from the registry and their blob
hashes verified. Both list Go 1.26.9. The amd64 inventory has 277 package records;
the arm64 inventory has 281. Their SPDX blob digests are, respectively:

- `sha256:63d149c72166959ab4b4094dc341aa8d9ff9b5fa22a966aaf00bfb5b792a1d9d`
- `sha256:445a36cd32996bcd27c7d4a95d5245b3b987b99ac1e3a12379bfedcef2525285`

Signature and inventory checks do not prove absence of vulnerabilities. The CVE
report review, resolved application vulnerability scan, and production-image
build verification remain required before this candidate is ready to merge.

The initial Grype scans of both platform SBOMs report high-severity matches.
The inventories include both source versions and RPM release versions, so a
package-name match alone is not sufficient to decide whether a backported fix
is present. Findings against the installed image and the final runtime image
remain unresolved. No scanner exclusion or vulnerability waiver has been added.
