# Platform Architecture Specification

## Structure

The API uses hexagonal architecture. Domain packages contain business concepts;
application packages coordinate use cases; ports describe required capabilities;
adapters implement transport, persistence, identity, authorization, and telemetry;
bootstrap composes adapters and owns lifecycle.

Added domains are composed through generated dependency injection rather than
package globals. Their application service receives authentication,
authorization, persistence, audit, clock, observability, ID generation,
authorization outbox, per-resource serializer, authorization-worker, and
cursor-signing capabilities through a typed `Dependencies` value. The generated registry constructs the dedicated
repository and registers the domain route adapter for runtime and OpenAPI use.

Generation does not invent a domain authorization policy. Until the developer
implements that policy, every generated operation authenticates the application
session and then returns a typed policy-not-configured error. This placeholder is
fail-closed: unauthenticated and malformed credentials return 401, while a valid
principal receives 503 and no repository or SpiceDB operation runs.
Only `ErrInvalidCredential` is translated to 401. Authentication dependency and
context errors retain their original classification and cannot trick clients
into discarding a legitimate session.

## Baseline stack

The checked-in local cursor-signing and metrics-token sentinel values are valid
only when database, OIDC, and SpiceDB insecure modes are all explicitly enabled.
Any secure deployment fails startup until both known values are replaced.

`apps/api/internal/adapters/spicedb/schema.zed` is the sole authorization-schema
artifact and is embedded by the SpiceDB adapter for both schema application and
readiness comparison. Authorization outbox changes carry relation, subject,
resource owner, and initiating actor independently so non-owner sharing never
misattributes audit history. Outbox completion validates audit ownership and
attribution against those explicit owner and actor fields, never against the
relationship subject. Dead-letter listing and recovery are likewise scoped by
the explicit resource owner, never the relationship subject. PostgreSQL
serializes every same-resource outbox insert through the per-resource lock table
and assigns strictly increasing database timestamps, so producer clock skew
cannot invert authorization operations.

- Go API with Huma-generated OpenAPI.
- PostgreSQL with GORM and versioned migrations.
- OIDC authentication with immutable issuer/subject identity mapping.
- SpiceDB authorization behind a project-owned port.
- TypeScript contracts generated with pinned `openapi-typescript` and consumed
  using pinned `openapi-fetch`.
  The shared authenticated fetch adapter preserves every unrelated header
  serialized by that generated contract or supplied by its caller. It owns the
  authorization header: a current non-empty application-session token replaces
  any caller value, while a null or empty token removes any caller value so stale
  credentials cannot survive; idempotency, content-type, and future domain
  headers remain intact.
  Session exchange, refresh, current-profile validation, and revocation use the
  same generated client and credential adapter. Web and mobile application code
  cannot issue raw `/v1` fetches; provider OIDC protocol requests remain owned
  by their provider libraries.

Shared request-rate state has a hard configured principal bound. Expired state
may be removed, but capacity pressure never evicts an active principal: a new
unknown source fails closed until capacity becomes stale. Source identity uses
the direct peer by default. Forwarded client addresses are honored only when
the immediate peer and every skipped proxy hop match explicitly configured
trusted proxy CIDRs; untrusted or malformed forwarding headers are ignored.
- Separate SvelteKit web and Expo React Native applications.
- A framework-independent `packages/client-core` package supplies session state,
  transport-failure classification, retry decisions, clocks, and identifiers to
  web and mobile adapters. It contains no Svelte or React Native dependencies and
  does not collapse the clients' separate presentation models.
- Mobile cold-launch restoration reads secure storage independently of OIDC
  discovery. Provider discovery gates only new interactive sign-in and code
  exchange; a valid stored credential can enter authenticated-offline state when
  both discovery and the application API are unavailable.
- A shared typed internationalization package consumed by both clients. English
  is the safe fallback and the generated baseline also contains a complete
Spanish catalog. Browser/device locale negotiation selects only explicitly
supported locales; unsupported and malformed locale values fall back safely.
Server-rendered web responses honor `Accept-Language` quality values, exclude
zero-quality languages, and emit `Vary: Accept-Language` so caches cannot mix
localized representations.

Internationalization is a presentation-layer invariant. All client-visible copy,
including errors and accessibility labels, comes from locale catalogs. Catalogs
must have identical keys, interpolation parameters, and plural forms. The shared
adapter owns interpolation and locale-aware plural, number, date, and time rules.
API and domain layers expose stable error codes and structured values rather than
pre-localized presentation sentences.
Every HTTP failure boundary includes a stable `code`: Huma operation and
validation problems use the project-owned RFC 9457 model; health, routing, and
CORS failures use the same model; and OIDC relay failures retain OAuth-compatible
fields while adding the stable code.

Audit is a first-class application port and append-only persistence model, not
HTTP access logging. User provisioning and every authenticated domain list,
detail read, command, and denied authorization decision emit a structured event
with immutable ID, owner, actor, action, target, outcome, correlation ID, and
UTC occurrence time. A successful business mutation and its audit event commit
in one PostgreSQL transaction. If the audit write fails, the mutation fails.
Read and denial events must be durably appended before their response is
returned. Health checks, documentation assets, and unauthenticated malformed
traffic are excluded because they do not have a trustworthy application actor.
Audit-history listing is also excluded because recursively auditing observation
would mutate the stream and prevent stable traversal.

Audit history uses the same signed, principal-bound keyset pagination guarantees
as other collections. A user may see events they performed and events affecting
resources they own. Audit records have no update or delete application port, and
PostgreSQL rejects direct row updates and deletes. Retention or export must be a
separately specified privileged lifecycle rather than ordinary CRUD.
PostgreSQL also rejects audit truncation. Runtime and migration database roles
are distinct; the runtime role may select and insert audit records but cannot
update, delete, truncate, change schema, or mutate the migration ledger.
Authenticated operations that generate audit writes pass through a bounded
per-principal limiter, including identity exchange/profile synchronization and
session revocation. The PostgreSQL-coordinated enforcement tier preserves the
configured limit across replicas; operators also configure audit-write-rate and
database-capacity alerts.
Every `/v1` interaction also passes through a separately configurable bounded
source limiter before transport decoding. Health checks are not counted against
the application budget. The default adapter coordinates fixed windows through
PostgreSQL so adding API replicas cannot multiply either limit. An in-process
implementation is retained only as an injected test or explicitly selected
single-process development adapter.

All runtime configuration is environment-backed and validated at startup.
Infrastructure dependencies are replaceable adapters.
Shared PostgreSQL rate-limit windows map the database's complete `(scope,
principal_hash)` identity and every update must affect exactly one row. An
incomplete ORM identity must fail closed without becoming an unscoped update or
an accidental global denial.
Observability uses a typed injected probe port with fan-out to structured JSON
logging, a bounded authenticated Prometheus registry, and optional environment-
configured OTLP/HTTP trace and metric exporters. The OpenTelemetry adapter uses
real W3C trace context and records domain probes as span events and metrics;
exporter shutdown flushes within a bounded deadline. Access events include method, route,
status, duration, correlation ID, and trace ID, but never credentials, query
values, or bodies. The metrics endpoint uses a dedicated bearer credential.
Readiness executes bounded checks through injected PostgreSQL and SpiceDB health
ports and returns unavailable whenever either security dependency cannot be reached,
the database migration ledger is dirty or behind the generated migration set, or
SpiceDB does not contain the exact generated authorization schema.
Collection APIs use versioned, HMAC-authenticated keyset cursors rather than
offsets. A cursor is bound to its principal and domain and carries a first-page
snapshot boundary plus the last immutable `(created_at, id)` key. Pages default
to 50 entries, accept at most 100, fetch one extra row to determine continuation,
and exclude inserts after traversal began. Malformed, forged, cross-principal,
cross-domain, and out-of-range cursors are client errors.
List envelopes always encode `data` as a JSON array, including `[]` for an empty
page; generated clients never receive `null` for a collection contract.
Successful REST resource and invitation creation returns `201 Created` and the
created representation. Credential exchange and command-style POST operations
retain their protocol-appropriate status instead of being treated as resources.
First-party container build and runtime stages use Red Hat Hardened Images for
the Go builder, static API runtime, Node.js builder and runtime, and PostgreSQL.
Every Hardened Image is pinned to an immutable release tag and multi-platform
manifest digest. SpiceDB and Dex retain reviewed upstream images because the
catalog does not supply compatible components. The baseline does not claim FIPS
compliance merely because catalog variants exist; that requires separately
specified end-to-end cryptographic and deployment validation.
The unprivileged Node builder writes dependencies, build output, and deploy
artifacts only beneath its owned application workspace or writable temporary
directories; container assembly does not rely on root-owned output paths.

The separately deployed web image reads its API and OIDC public settings from
runtime environment variables for every authentication and API adapter; it does
not bake one API endpoint into the production bundle. Its image defaults to a
production deployment environment and rejects missing, insecure, credentialed,
local, query-bearing, or fragment-bearing API and issuer URLs plus a missing OIDC
client ID before starting the server. Local Compose explicitly selects the
development environment and supplies loopback configuration.
Its production Content Security Policy preserves SvelteKit-managed nonces for
framework bootstrap scripts while restricting all default sources. Runtime API
and OIDC origins may extend only `connect-src`; handwritten CSP headers must not
disable hydration or require `unsafe-inline` script execution.
The public HTTP server sets bounded header, request, response, idle, and shutdown
timeouts plus a bounded maximum header size so slow or oversized clients cannot
hold resources indefinitely.
API responses disable MIME sniffing and sensitive response caching. Request
bodies are capped before transport decoding, and rejected oversized payloads do
not reach application services.

Database schema changes are ordered, immutable `golang-migrate` SQL migrations
recorded in the database migration ledger. A separate one-shot migration command
applies them before API replicas start. The long-running API must validate and use
the resulting schema; it must never create, alter, or migrate schema at startup.

Local Compose uses durable named PostgreSQL storage. SpiceDB uses its PostgreSQL
datastore rather than the ephemeral testing server, runs its datastore migration
as an explicit one-shot dependency, and authenticates API gRPC requests even on
the explicitly plaintext loopback development transport. Resource and relationship
state must remain aligned across complete stack restarts.
PostgreSQL health remains false while its image entrypoint runs the temporary
initialization server. Dependent migrations start only after the final PostgreSQL
process is PID 1 and accepts connections, including on a brand-new volume.
Compose runs the same non-root hardened Node adapter-node web image used for
production. Its
build consumes the frozen workspace lockfile and deploys production
dependencies, so local acceptance exercises the deployable artifact.
Local Compose uses ordinary bridge networking and binds every published port to
`127.0.0.1`; host networking is not a prerequisite. OIDC discovery and key
retrieval may use a separately validated internal backchannel base URL while
signature, issuer, and audience validation continue to use the browser-visible
issuer. None of these services accepts LAN connections despite reviewed
development credentials. Compose loads `.env` for policy configuration and
overrides only topology-specific bind addresses and internal service endpoints.
The host-published SpiceDB port belongs to a typed runtime-capability proxy, not
the upstream SpiceDB server. Its bearer credential is unable to invoke schema
mutation RPCs.

`make dev` starts the stateful infrastructure in containers and runs the Go API
and SvelteKit development server on the host with hot reload and clean signal
handling. Production-like Compose continues to run the same non-root API and web
images used by release acceptance.

Authorization schema application is a separate, one-shot bootstrap operation.
The long-running API process never writes authorization policy during startup and
does not require schema-administration behavior. Deployment must run the schema
job before API replicas start and may provide it distinct credentials.

Authorization relationship changes use a transactional outbox. Workers claim
bounded batches with an owner token and expiring lease before contacting SpiceDB.
Only the lease owner may complete or fail a claim. This prevents concurrent API
replicas from processing the same change while allowing abandoned work to recover.
Workers renew the claim only after obtaining the per-resource serializer and
must not contact SpiceDB when renewal proves that their lease is stale.
PostgreSQL is the sole time authority for authorization outbox leases so clock
skew between API replicas cannot steal, extend, or complete another claim.
Create responses are not successful until their owner relationship has been
written; durable pending work remains retryable when SpiceDB is unavailable.

## Lightning provider extension boundary

The provider SDK lives in `apps/api/pkg/lightning`, outside Go's `internal`
visibility boundary, so separately maintained adapters can import it. Domain
observations contain a source-local identifier, WGS84 coordinates, and an occurrence
time. A source returns a batch labeled demo or live. That label describes the
source, not a user identity or an authorization decision.

The source port accepts cancellation and an observation-time window. The initial
demo adapter accepts a configured finite scenario and injected clock. It emits
only scenario events that have occurred within the requested window. Scenario
events have stable identifiers across repeated reads. It never opens a network
connection. The backend will compose exactly one source through dependency
injection. This SDK does not expose HTTP or bypass the pending access policy.

These are internal adapter contract details, not a settled public HTTP schema.
The public REST contract remains Huma-generated. HTTP authorization, geographic
query rules, pagination, polling/replay, and client error behavior remain open.

## Client lightning calculations

Shared client calculations must accept the vehicle position and an injected clock.
They must return structured distance and age values for the localization layer.
Geographic distance uses a spherical great-circle approximation in meters, with
longitude differences normalized by trigonometric calculation across the dateline.
Eligibility is an injected policy until exact cutoff, clock-skew, and tie behavior
are approved. The calculation must not read a map viewport or system clock.

## Demo runtime composition

The standard server selects `disabled` or `demo` through bootstrap configuration.
Unknown source names must fail configuration validation. The demo Compose overlay
selects `demo`. A rolling demo scenario repeats configured positions at a fixed
interval and uses epoch-based sequence IDs; repeated reads of the same event must
preserve its ID and timestamp. The source must remain labeled simulated. This
rolling source is separate from the finite scenario adapter used in tests.

The schema bootstrap may explicitly grant authenticated feed access through a
`lightning_feed` viewer wildcard. The API still authenticates sessions and checks
active users before checking feed permission. The schema credential owns this
bootstrap change; the API must not acquire schema-write permission.

## Client feed adapter

The shared API adapter must read the lightning endpoint through generated
`openapi-fetch` types and the existing application-session token provider. It must
preserve request cancellation and HTTP failure status. It must reject malformed
source mode, coordinates, timestamps, and observation identifiers before returning
normalized client observations. It must not issue requests to provider endpoints
or alter stored credentials. The presentation layer owns retry and offline policy.

## Native map adapter

The mobile client includes a local Expo module for the iOS MapKit surface.
The module must render map state supplied by the client and report user map
interaction back to the client. It must not fetch lightning data, own provider
credentials, or decide authentication. Native markers and rings are presentation
adapters for normalized observations. Native compilation and simulator verification
are required; JavaScript export does not prove this module works on iOS.

The native location adapter must report coordinates and permission state to the
client. It must stop location updates when its view is detached or tracking is
disabled. Lightning API requests must not include vehicle coordinates. Permission
purpose text must come from the shared locale catalog. Location-denied presentation
and background navigation policy remain open product decisions.

Native module TypeScript wrappers must remain inside the client transport checks.
The checks must allow the Expo native bridge and imports from the local module
directory, but must reject direct network calls in those wrappers.

## MapKit route calculation adapter

The iOS native module must expose driving-route calculation using MapKit. It must
return a normalized route with geometry, distance, expected travel time, and maneuver
instructions. The adapter must reject invalid coordinates and propagate a route
service failure. Route calculation alone is not turn-by-turn guidance: progress,
missed turns, rerouting, speech, and CarPlay maneuver presentation remain required.

## External source executable

The public bootstrap package must expose a source-factory entrypoint so a private
Go module can build its own server executable without importing internal packages.
`external` selects that injected factory. The standard binary must fail startup
when `external` is selected without a factory. Selecting `demo` must not execute
an external factory. All source variants must use the same session, authorization,
audit, and HTTP composition. A private entrypoint owns its provider configuration.

## Map viewport state

The shared map session must own the viewport radius as well as its center and
following state. It starts at 20 statute miles (32186.88 meters). Zoom controls
multiply or divide the radius by two without changing following state or vehicle
position. Recenter and End Route must preserve the selected radius. A non-finite
or non-positive radius update must leave the previous radius intact.

## Client feed request lifecycle

The client must allow at most one feed read in flight for a mounted feed session.
Stopping that session must cancel its request and suppress late success or failure
notifications, even if a transport ignores cancellation. Signing out or changing
the backend must stop the old feed session before creating another. Request
failures must preserve their original classification for the presentation and
session layers. This lifecycle does not select retry timing or stale-data policy.

Shared client packages exported as TypeScript source must use bundler-compatible
module resolution. Their runtime imports must resolve in Metro and the web
bundler without generated JavaScript files. Type checks alone are insufficient;
mobile exports must verify the source package boundary.

The feed reader must capture the application credential used for each request.
If that credential rotates before a 401 response arrives, the client must retry
with the replacement rather than invalidating the new session. A 401 for the
current credential retains its normal unauthorized classification.

Client transport checks must permit AbortController and animation-frame scheduling
for request cancellation and map animation. These globals do not initiate network
requests. Direct fetch, sockets, and alternate transports remain prohibited.

The source import check must resolve the standard .ios, .android, and .native
module suffixes to checked source files inside approved client roots.
