# Simple Strike Delivery Guidance

The generated engineering rules below remain authoritative. Consequential product behavior
requires explicit user approval before implementation. Routine implementation
decisions use established platform conventions, as authorized by the user. See specs/README.md.

## Delivery scope

- Keep one demonstrable product slice in progress. At most one infrastructure
  blocker may run alongside it, and only for a demonstrated P0/P1 risk or blocker.
- Freeze unrelated foundation expansion, dependency maintenance, and hardening.
- Use short-lived branches. Integrate current main before starting a slice.
- A product slice is complete only after client demonstration, focused tests,
  authoritative specifications, and merge to main.
- Timebox infrastructure investigation to 90 minutes, then use a safe workable
  fallback and record follow-up unless delivery is still blocked or risk is P0/P1.

## Specifications and interviews

- Use normative must, must not, should, and may. Required behavior must be testable.
- Define purpose, terms, actors, preconditions, behavior, authorization, visibility,
  failure cases, and acceptance scenarios. Keep one authority per behavior.
- Separate product rules from platform implementation. Link related specifications.
- Record unresolved decisions as open questions, not permission to invent behavior.
- Interview breadth-first: purpose of all areas, then workflows and roles, then
  failures and lifecycle, then calculations and boundary cases.
- Ask one focused question at a time for consequential product decisions.
- Make trivial decisions using established platform conventions and record them.
- Small coherent decision tables may state recommendations, alternatives, rationale,
  and approval status. Update the coverage index as decisions are settled.

## Verification and operations

- Begin with the closest failing behavioral test and controlled fakes, never mocks.
- Run focused checks during development and affected integration checks at changed
  persistence, authorization, contract, and client/server boundaries.
- Run the full applicable merge gate once on the final candidate.
- Verify Docker acceptance and production images at the mechanically derived SHA.
- Run clean native builds when native inputs change. Never call an export a build.
- Always run adversarial and integration gates for identity, authorization,
  migrations, destructive lifecycle changes, and data integrity.
- Keep verification environments available during active slices and rebuild only
  affected services. Expose deployed revisions. Do not invent deployment details.
- Keep expensive unaffected-platform checks on main, nightly, or release workflows.
- CI must classify changes once, cancel superseded runs, reuse available caches,
  and route required checks without skipping risk-triggered gates.
- Hooks should give fast feedback without duplicating authoritative remote gates.

## Coordination and merge policy

- Keep the roadmap centered on product outcomes, the active slice, upcoming slices,
  and genuine blockers. Update it only at meaningful delivery transitions.
- Keep at most two project items In Progress: one slice and one qualifying blocker.
- Give subagents bounded deliverables and explicit ownership. Use one final
  read-only critic focused on confirmed P0/P1 blockers; defer lesser hardening.
- Hand confirmed generator defects to a separate bounded task without expanding
  the product slice. Do not interrupt delivery for unrelated template improvements.
- Track lead time, branch age, CI duration/reruns, infrastructure effort, and shipped
  slices to remove repeated delay, not to add reporting ceremony.
- Commit atomically with Conventional Commits. Never use raw gh pr merge or
  auto-merge. Use scripts/merge-checked-pr.sh PR_NUMBER EXPECTED_HEAD_SHA with
  SIMPLE_STRIKE_REPOSITORY set. It requires five immutable checks and protected
  policy review. The initial root commit exception is in bootstrap.spec.md.

## Public communication

- Use Simplified Technical English principles: short sentences, active voice,
  consistent terms, and one instruction per sentence. Do not use em dashes.
- Do not claim formal ASD-STE100 compliance without a rule and vocabulary review.
- Never publish credentials, private infrastructure details, or personal information.

<!-- BEGIN MAKE-APP BASELINE GUIDANCE -->
# Simple Strike Engineering Guidance

This is a spec-driven, security-conscious application. Specifications under
`specs/` are the source of truth. Update the relevant `*.spec.md` before coding.

## Architecture

- Always use hexagonal architecture with explicit domain, application, port,
  adapter, and bootstrap boundaries.
- Domain code must not import HTTP, persistence, OIDC, SpiceDB, framework, or
  observability implementations.
- Use dependency injection. Keep command entrypoints thin.
- Organize HTTP adapters domain-first; separate routes, DTOs, and mapping when a
  surface grows beyond trivial behavior.
- GORM models are infrastructure mappers. Domain entities never persist themselves.
- User-owned repository reads require a user ID. Unscoped reads are a security smell.

## Specifications and documentation

- Product specs live in domain directories as `specs/<domain>/*.spec.md`.
- Cross-cutting engineering specs live under `specs/platform/`.
- Code and docs follow specs. Resolve disagreements by updating the spec first.
- Keep human documentation concise, verified, and focused on useful workflows.

## Internationalization

- Internationalization is mandatory, not an optional feature.
- All user-facing copy in web and mobile clients must come from the shared
  `packages/i18n` locale catalog, including labels, buttons, placeholders,
  validation feedback, empty states, errors, accessibility text, and notices.
- Do not place literal user-facing strings in Svelte or JSX/TSX. Product names,
  external data, and non-user-facing diagnostic identifiers are not copy.
- Add every key to every supported locale in the same change. Preserve matching
  interpolation parameters and plural forms across catalogs.
- Use the shared translator for locale negotiation, fallback, interpolation,
  plurals, numbers, dates, and times. Do not build presentation sentences in APIs.
- API errors must expose stable machine-readable codes and structured data;
  clients own their localized presentation.
- Run the i18n structural gate whenever client copy or locale catalogs change.

## Identity, authorization, and tenancy

- OIDC identities use immutable `(issuer, subject)` keys. Email is profile data.
- OIDC tokens are accepted only at session exchange. Ordinary routes accept only
  rotating opaque application sessions; never store or reuse provider tokens.
- Session rotation must preserve the original absolute session-family expiry;
  never implement indefinitely renewable sliding sessions.
- Authentication and authorization use separate ports.
- SpiceDB is the permission decision point for protected resources.
- The API runtime credential must go through the typed SpiceDB capability proxy.
  Never give the API process or its credential schema-write capability.
- Do not assume organizations or tenants. Add them only through a product spec.
- Model ownership and sharing explicitly in domain language and authorization schema.
- Invitation administration is authorized by persisted administrator status
  derived from exact configured issuer/subject bootstrap identities, never email.
  Invitation consumption and user provisioning remain one transaction.

## Security

- Added-domain services are generated with typed injected dependencies and a
  fail-closed authorization-policy placeholder. Replace that placeholder only
  after specifying policy and writing adversarial boundary tests. Never bypass
  authentication, SpiceDB, audit behavior, or the generated repository port to
  make a newly registered route return data.
- Keep `apps/api/internal/generated/domains.go` generator-owned. Domain policy
  belongs in `internal/app/<domain>`; the generated registry owns only adapter
  construction and Huma route composition.

- Pin dependencies, actions, tools, and container images. Runtime images require
  immutable digests; floating tags such as `latest` are forbidden.
- Use Red Hat Hardened Images wherever the catalog supplies a compatible build
  or runtime component. Pin an immutable release tag and multi-platform digest,
  review its SBOM and CVE report, and verify Red Hat's signature when updating
  it. Use a reviewed upstream image only when no compatible HI component exists.
  Selecting a FIPS-tagged image alone does not establish FIPS compliance.
- Every authentication or authorization boundary needs adversarial end-to-end
  coverage: unauthenticated, malformed, expired, wrong issuer/audience,
  cross-user, insufficient permission, dependency failure, and legitimate access.
- Fail closed and avoid leaking whether inaccessible resource identifiers exist.
- Run the fourteen-day dependency-age gate for every dependency change. Exact,
  reviewed exceptions require a spec update and `dependency-age-allowlist.json`
  entry with a reason and compensating verification.

## Audit

- Audit history is a first-class domain boundary, not a substitute for logs.
- Every authenticated domain read, list, state change, and denied authorization
  decision must emit a structured audit event.
- Successful state changes and their audit events must commit atomically. Never
  return success for an unaudited mutation.
- Audit records are append-only. Do not add ordinary update or delete behavior.
- Never place tokens, credentials, request bodies, or unrestricted metadata in
  audit events.
- Audit queries must preserve actor/owner visibility and must have adversarial
  cross-user tests.
- Audit-producing interaction points must use the configured principal limiter;
  do not add an endpoint that can generate unbounded audit writes.
- Runtime database credentials must never own migrations or receive audit
  update, delete, or truncate privileges.
- Audit retention uses only the separately credentialed bounded retention
  adapter. Never grant its delete capability to the API runtime or bypass the
  immutable retention summary.

## Testing

- Use TDD: failing behavioral test, smallest implementation, then refactor.
- Never use mocks. Use realistic in-memory or controlled fakes behind ports.
- Test functionality through appropriate ports and real interaction boundaries.
- Inject clocks for behavior involving time, leases, audit, expiration, or tests.

## Observability and configuration

- Use typed, domain-oriented events through injected, fan-out-capable ports.
- Preserve W3C trace context and emit domain probes to configured OTLP exporters;
  synthetic identifiers are only a fallback when export is disabled.
- Do not add `print`, `println`, or ad hoc logging in application code.
- Read environment variables only in configuration/bootstrap packages.
- Validate configuration before starting network listeners or workers.
- Request and audit rate limiting must remain coordinated across replicas through
  the PostgreSQL adapter; process-local limiting is test/single-process only.

## API contracts and clients

- Use Huma-generated OpenAPI as the REST contract.
- Keep envelopes and pagination consistent.
- Generate TypeScript contracts with pinned `openapi-typescript`; access them
  through pinned `openapi-fetch` behind frontend adapters.
- CI must reject stale generated output.

## Workflow

1. Update the relevant spec.
2. Write the failing test with fakes.
3. Implement through ports and adapters.
4. Add adversarial security tests for boundaries touched.
5. Run formatting, tests, contract drift checks, and structural checks.
6. Update the roadmap only when focus, sequencing, evidence, or blockers change.
7. Run the project-scoped `code-critic` agent; fix confirmed findings or record a concrete deferral.
8. Commit atomically using a Conventional Commit message when asked.

## Native mobile delivery

- Do not call an Expo export a native build. Preserve separate export, clean
  prebuild, Android Gradle, iOS Xcode, development-client, and signed-release gates.
- Keep callback scheme, iOS bundle identifier, Android package, application
  version, and platform build numbers explicit and validated.
- Never commit signing credentials or permit release commands to consume local
  development endpoints.
- Treat mobile session classification as security-sensitive. Transient network,
  rate-limit, and service failures retain a locally valid credential; only expiry,
  explicit rejection, revocation, or unreadable secure storage removes it.
- Restore mobile secure storage independently of OIDC discovery. Discovery may
  gate interactive sign-in and code exchange, never cold offline entry with an
  otherwise valid application session.
- Production web images default to fail-closed production mode. Never restore
  localhost fallbacks or permit absent, local, credentialed, or non-HTTPS API and
  OIDC settings outside an explicitly selected development environment.
- Framework-independent client orchestration belongs in `packages/client-core`;
  Svelte and React Native presentation models remain separate.

## Custom agents

- Project-scoped Codex agents live under `.codex/agents/`.
- The read-only code critic owns post-implementation review for security,
  architecture drift, weak tests, unsafe configuration, supply-chain ambiguity,
  and spec/code disagreement.

<!-- END MAKE-APP BASELINE GUIDANCE -->
