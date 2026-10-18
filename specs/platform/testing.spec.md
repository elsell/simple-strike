# Testing and Delivery Specification

Tests use fakes rather than mocks and validate behavior through ports. Every auth
boundary covers missing, invalid, expired, wrong-issuer, wrong-audience,
cross-user, dependency-failure, and legitimate cases where applicable.
Audit tests prove atomic mutation/event commits, append-only database enforcement,
successful read and command coverage, denied-decision coverage, actor/owner
visibility, cross-user isolation, stable pagination, and persistence across a
complete stack restart. Persistence acceptance follows cursor pagination until it
finds the pre-restart audit event; it must not depend on a default page being large
enough for the accumulated acceptance history.
Platform audit adapter tests do not depend on an installed product domain or
create test-only product storage. The removable example owns its resource/audit
atomicity proof, and every added domain owns the corresponding repository proof.
Account lifecycle tests prove self-deactivation is configuration-gated, atomically
disables the account, revokes all of its sessions, writes audit history, and
rejects every old session and later OIDC exchange.

Pre-commit and CI run Go formatting and tests, structural checks, OpenAPI/client
drift checks, TypeScript checks, and production builds. Dependencies, CI actions,
toolchains, and images are pinned. Generated projects must pass checks immediately
after bootstrap without manual source edits.
Mobile verification names its evidence precisely. Fast checks run Expo Doctor,
Expo dependency compatibility, JavaScript bundle export, configuration/identifier
validation, and clean iOS/Android prebuild. Linux CI compiles an unsigned Android
debug application with Gradle. A macOS main/release/manual job compiles an ad hoc signed
iOS simulator application with Xcode. Export success alone is never reported as
a native build. Session-state tests prove that transient network, 429, and 5xx
failures preserve a locally valid credential, while expiry, explicit 401, and
malformed secure storage remove it.
Shared web/mobile refresh adapter tests cover network loss, 401, 429, 503,
successful rotation followed by profile-read failure, credential retention or
disposal, bounded retry, and expiry enforcement.
Production mobile configuration tests reject missing, non-HTTPS, loopback, and
localhost endpoint values in the actual Expo bundle environment.
First-party GitHub actions are pinned by full commit SHA to maintained releases
whose action runtime is Node 24 or newer; generated CI must not emit deprecated
action-runtime warnings. Release attestations use the maintained unified GitHub
attestation action, not deprecated compatibility wrappers, and disable optional
organization-only artifact storage records for personal-repository compatibility.
Release tooling, including EAS CLI, is installed from the same frozen pnpm
lockfile and is included in dependency-age and vulnerability gates.
The locked EAS executable retains the mobile app as its working directory.
CocoaPods is Bundler-locked, Android CI selects an exact JDK patch, and signed
EAS profiles select reviewed named Expo SDK 55 build images.
Hosted iOS compilation runs on the explicit GitHub `macos-26` image because
Expo SDK 55 requires Xcode 26 or newer.
Every locked Ruby gem participates in dependency-age and OSV vulnerability
checks. The normal generated check starts the real locked EAS executable.
Reviewed overrides raise vulnerable EAS transitive parsers and matchers to fixed
versions; the locked CLI must pass version startup, Expo Doctor, and audit after
any override change.
The initial locked EAS 21.0.2 toolchain has exact, reviewed age exceptions for
`eas-cli`, its matching `@expo/eas-build-job`, `@expo/eas-json`, `@expo/steps`,
`@expo/logger`, `@expo/turtle-spawn`, and resolved `multipasta`. Compensating
verification includes the frozen graph, fixed security overrides, clean audit,
CLI startup, Expo Doctor, prebuild, and hosted native compilation.
Security overrides require PostCSS 8.5.18 or newer, brace-expansion 5.0.8 or
newer, node-tar 7.5.21 or newer, and fast-uri 3.1.4 or newer, while the web
workspace requires SvelteKit 2.69.1 or newer. Exact, reviewed age exceptions
cover security releases still inside the standard fourteen-day observation
window. The brace-expansion override carries a deterministic pnpm patch that
preserves the callable CommonJS API used by legacy Minimatch without removing
the current named exports. Compensating verification includes frozen-lock
regeneration, legacy and modern Minimatch probes, the generated security-policy
test, a clean package audit, workspace tests and builds, Expo Doctor, clean
prebuild, and hosted native compilation.
Migration acceptance applies the prior released migration set first, then runs
the current migrator and verifies preserved baseline data and new schema objects.
Every prior-release up and down migration is frozen by a checked-in SHA-256
inventory that normal tests enforce before the live PostgreSQL upgrade proof.
Each supported generated baseline variant selects a separate reviewed inventory.
PostgreSQL adapter acceptance also verifies that session rotation revokes the old
credential atomically and caps the replacement at the original family deadline.

The release gate runs Go vulnerability analysis and the package-manager audit
against the resolved dependency graph. CI has least-privilege permissions,
bounded runtime, and cancels superseded work. High or critical dependency
findings at any severity fail delivery rather than being silently accepted.
The API dependency graph pins `golang.org/x/net v0.60.0`, excluding the
GO-2026-5026-affected v0.53.0 release from generated modules and images.
Release image scans use the locally installed Grype 0.111.1 executable from a
checksum-verified immutable release archive. Scanner bootstrap must not execute a
mutable branch installer or delegate installation to the scan action.
CI runs the live Compose acceptance harness. A pinned Playwright/Chromium browser
must operate Scalar itself: authorize through Dex with PKCE, then send authenticated
Try It requests to `/v1/me` and a protected resource endpoint. Protocol-only
reconstruction is supporting evidence, not a substitute for this browser boundary.
The harness permits bounded UI retries while Scalar renders the Try It request
control and applies a successfully exchanged credential, but must fail if the
control never appears or Scalar never attaches the bearer credential. It opens
Try It only after the exact exchanged credential matches throughout the complete
expected sequence of repeated observations spanning Scalar's 500-millisecond
debounced authentication-store settling interval. An observed mismatch resets
both the interval and its matching-observation count; slow or stalled browser
observations cannot replace that sequence or extend its absolute bound.
Every harness invocation has a unique Compose project and performs project and
volume cleanup both before setup and on exit. Interrupted, stale, or concurrent
runs must not share migration state or persistence fixtures.
Harness assertions capture bounded multi-line producer output before applying
early-exit searches, so `pipefail` cannot relabel a successful match as a
nondeterministic upstream SIGPIPE failure.
Each added domain carries an adversarial HTTP composition test proving its
generated routes are registered, missing or invalid sessions return 401, and a
valid session receives 503 until an explicit authorization policy replaces the
fail-closed scaffold. The test exercises the real Huma route boundary rather
than substituting a direct service-only assertion.
It also proves an authentication dependency failure is not rewritten as an
invalid credential. Multi-domain generator tests include domain names whose
separator-stripping title forms would otherwise collide in Huma.
The browser also opens the web client with `es-ES`, verifies negotiation to the
supported `es` locale, checks the document language, and observes Spanish catalog
copy. Static catalog checks alone are not sufficient rendering evidence.
Shared runtime tests exercise supported and unsupported locale selection,
interpolation, singular and plural forms, and locale-aware number/date formatting.
The Expo adapter is tested with controlled device-locale readers for supported
regional and unsupported locales. These behavioral tests run in `make check`,
the pre-commit release gate, and CI.
Playwright is exact and age-gated. Its exact package version fixes the Chromium
revision used by acceptance; the browser is not independently represented as an
npm dependency and must not be described as independently age-gated.
Go release tools and their transitive dependencies are pinned in the dedicated
`tools` module, which is covered by the same dependency-age gate.
The generated web development service uses the digest-pinned hardened Node 24
builder and npm so its exact pnpm package-manager pin can start without an
unpinned global install. Its Compose environment enables pnpm's
non-interactive CI behavior so a stale or host-created modules directory cannot
block first startup waiting for a terminal prompt. The service runs with the
unprivileged `MAKE_APP_UID` and `MAKE_APP_GID` (both defaulting to 1000) so it
does not leave root-owned artifacts in the bind-mounted generated repository.
The supported Make and acceptance entrypoints populate those values from
`id -u` and `id -g`, including on CI hosts whose user is not UID 1000. Writable
temporary HOME, XDG cache, and npm prefix/cache locations make arbitrary numeric users
independent of `/etc/passwd`; release acceptance runs the image as 1001:1001.
The repository-local ignored pnpm store is shared by host bootstrap and the web
container. Live acceptance gives a cold container installation up to ten minutes
to become ready on a slow registry, then fails if the web boundary is unavailable.
Once Compose is live, browser acceptance runs through Node directly; it must not
ask pnpm to reconcile the bind-mounted dependency tree during the live test.
Browser acceptance drives the generated SvelteKit client through Dex sign-in,
the callback code exchange, application-session exchange, and authenticated
profile rendering. An unauthenticated localization-only render is insufficient.
Frontend session adapters validate exchanges before persistence, retry only
retryable failures, and preserve authenticated-offline presentation state. A
mobile orchestration test cold-starts with a valid stored credential while OIDC
discovery and the API are unavailable, and proves restoration completes in the
authenticated-offline state without deleting the credential. Default and blank
mobile clients invoke that restoration independently of provider discovery.
Post-exchange orchestration proves a profile 401 deletes the newly exchanged
credential while a profile 503 retains it and enters authenticated-offline.
Controlled loopback transport tests prove generated session exchange, refresh,
profile validation, and revocation request paths, bodies, credential ownership,
and status propagation without replacing the network transport. The structural
gate uses a fail-closed AST/import allowlist to reject direct, computed, aliased,
beacon, and dynamically imported application transports in both clients while
permitting provider traffic only through the exact OIDC adapters. Fixtures cover
same-directory `.mjs` and `.cjs` transports, unresolved or unsupported `$lib`
aliases, bare-window aliases and destructuring, and relative-import escapes into unapproved
shared helper roots. The browser-global policy permits only direct reviewed
`window.location` and `window.sessionStorage` access and rejects Window or
WindowProxy provenance through document, frame, opener, parent, top, assignment,
reassignment, and aliased window-opening forms.
Lexical binding tests distinguish legitimate local names from unresolved global
network primitives and reject alias, assignment, call, and constructor flows for
fetch, request, beacon, socket, event-stream, worker, RTC, and web-transport APIs.
Runtime-binding classification rejects erased ambient declarations (including
global augmentations), admits runtime enum and namespace bindings, and ignores
interface and type-only primitive names that cannot initiate network traffic.
Dotted namespace bindings remain within their outer namespace, while runtime
re-exports, import-equals declarations, and aliased CommonJS loaders pass through
the same exact import and global-reference allowlists as ordinary imports.
Provider imports remain confined to two small protected OIDC adapters. Web and
mobile presentation import only their primitive/application-domain operations;
the adapters accept no caller-owned objects or callbacks. A reviewed SHA-256
manifest pins both complete adapter sources, and the structural gate fails on
any adapter or manifest mismatch before semantic transport checks. Every
provider escape mutation class is therefore one protected-file hash failure,
including re-exports, aliasing, closures, callback arguments, container writes,
classes, composite values, and provider side effects. Changing a protected
adapter requires an explicit template change, regenerated canonical hashes,
updated behavior tests, and ordinary code review; presentation files may never
import provider libraries. Mobile `Home` remains a synchronous, non-generator,
parameterless default component.
Generator unit fixtures that exercise dependency-free structural rules block
package installation and run with no `node_modules`; bootstrapped default and
blank acceptance exercise the real pinned AST parser.
The web runtime configuration tests reject absent and unsafe production API,
issuer, and client settings. Container acceptance proves the production image
fails before serving without them while local Compose explicitly selects the
development contract.
PostgreSQL adapter integration tests run while the API service is stopped so its
authorization outbox worker cannot consume test fixtures concurrently. The
harness restarts the API and re-establishes readiness before exercising live HTTP
boundaries.
Both example and blank live harnesses stop SpiceDB and assert that `/readyz`
fails closed with 503 while `/livez` remains a dependency-independent 204.

npm packages and Go modules must be at least fourteen days old. The age gate
fails closed when registry metadata cannot be retrieved or parsed. A reviewed
exception must pin one exact ecosystem, name, and version in
`dependency-age-allowlist.json`, state why it is required, name compensating
verification, and be recorded in this specification. Lowering the global age
threshold is not an acceptable shortcut.
Metadata requests have bounded connection and total timeouts; unavailable
registries fail the gate closed instead of hanging local hooks or CI.
Broad transitive ranges are constrained when necessary to keep resolution
reviewable and age-compliant. The React Native/Jest 29 schema edge pins compatible
`@sinclair/typebox 0.27.8` instead of accepting newly published artifacts from
its broad range.

Reviewed baseline exceptions align native OIDC with the pinned Expo SDK 55
runtime: `expo-auth-session 55.0.17`, `expo-web-browser 55.0.18`,
`expo-secure-store 55.0.16`, `expo-application 55.0.17`, `expo-crypto 55.0.17`,
and `expo-linking 55.0.16`. Their compensating checks are exact pins, resolved
lockfile review, a clean vulnerability audit, Expo compatibility validation,
mobile type checking, and live OIDC/API acceptance as applicable.

The structural gate rejects oversized handwritten Go files, mocks, ad hoc print
calls, direct SQL helpers, environment reads outside configuration/bootstrap,
floating CI action references, and container images without immutable digests.
Generated delivery tests also enforce the reviewed Red Hat Hardened Images
boundary: Go and Node build stages, API and web runtimes, and PostgreSQL use
immutable HI references, while unsupported SpiceDB and Dex components remain
version-and-digest-pinned upstream images. Live acceptance proves that the
hardened PostgreSQL entrypoint, non-root Node runtime, and static Go runtime
preserve the generated application contract.
When the frozen JavaScript graph uses reviewed dependency patch files, every
container build copies those patches before its frozen install so production
images resolve the same verified dependency graph as the host build.
Generated Go files carrying the standard `Code generated ... DO NOT EDIT` marker
are exempt only from the line-length rule.
The structural gate also rejects literal user-facing text and translatable
attributes in Svelte and JSX/TSX. It validates every locale as non-empty and
key-complete against English, verifies matching interpolation parameters and
plural pairs, and runs before dependency installation as part of the normal gate.
Object property keys used only as protocol syntax, including HTTP header names,
are not copy; the gate must distinguish them from nested literal JSX expressions.

Routine pre-commit checks are change-aware. They always run structural,
formatting, contract-drift, and focused tests, and must run dependency-age and
resolved-graph security gates whenever a dependency manifest, lockfile, action,
tool module, or container definition changes. Full race, production-build, and
live acceptance gates remain mandatory before push and release. Release
publication may reuse successful CI evidence only when it is tied to the exact
commit SHA and fails closed if that evidence is absent.
Pre-commit and pre-push retain the hook-owned index for direct caller-repository
comparisons, including staged-change classification. Recursive check, generation,
dependency, verification, and acceptance make processes clear inherited Git
directory, worktree, index, and prefix variables so nested fixture repositories
cannot read or mutate the caller's hook index.
Tests that create temporary Git repositories clear inherited repository-local
Git environment variables, disable fixture hooks, and prove they leave the
caller's staged name-status unchanged, including under pre-commit alternate-index
execution.

Static Compose tests reject host networking and prove `.env` loading. Live
acceptance exercises bridge-network service discovery and the OIDC backchannel
without weakening public issuer validation. Acceptance cleanup removes its
project-scoped containers, volumes, and locally built images so repeated clean
runs do not exhaust a development or CI host.

## Demo slice security gate repairs

The demo slice must not publish with the inherited vulnerable Go graph. The
compiler must use Go 1.26.9 or a later reviewed patch. The API graph must use
`golang.org/x/net` v0.60.0, `golang.org/x/text` v0.42.0, OpenTelemetry v1.45.0,
and gRPC v1.83.2 or later reviewed fixed releases. These pins address the current
Go vulnerability database findings, including GO-2026-6617, GO-2026-6629,
GO-2026-6505, GO-2026-6443, and GO-2026-6348. Verification must include the resolved
graph vulnerability scan, application and boundary tests, and image build checks.
The exact `golang.org/x/net` v0.60.0 security release has an age exception because
it fixes reachable HTTP/2 denial-of-service findings. The module proxy records its
release on 2026-10-08. The allowlist requires application tests, race tests, the
resolved vulnerability scan, live API/SpiceDB acceptance, and Docker build checks
before merge. This exception does not waive those checks.

The configured OTLP endpoint is a collector base URL. The adapter must append
`/v1/traces` and `/v1/metrics` explicitly, preserving any configured path prefix,
so exporter version changes cannot send both signal types to the collector root.

## SDK 55 native compatibility repair

Native compilation must use the SDK 55 patch set reported by Expo compatibility
validation: Expo 55.0.31, auth-session 55.0.18, crypto 55.0.19, dev-client 55.0.40,
linking 55.0.17, localization 55.0.19, router 55.0.18, secure-store 55.0.18,
system-ui 55.0.22, updates 55.0.33, and web-browser 55.0.20. All versions must be
exactly pinned. The frozen lockfile, native compatibility check, type checks,
OIDC client tests, package audit, age gate, and native builds must verify this
update. This repairs a demonstrated native build blocker, not an SDK major upgrade.

Transitive Expo overrides must match the updated SDK requirements. In particular,
auth-session must resolve the same crypto and web-browser versions as the app.
The exact config, prebuild, schema, asset, file-system, and Babel pins must satisfy
the new Expo and CLI manifests. Doctor must reject duplicate native modules.

The JavaScript security gate must use fixed releases for the advisories found in
the inherited lockfile. Required minimums are shell-quote 1.11.0, fast-uri 3.1.8,
brace-expansion 5.0.12, js-yaml 3.15.2 or 4.3.2 within its existing major version,
nanoid 3.3.18, browserslist 4.28.7, xmldom 0.8.15 or 0.9.12 within its existing
minor series, image-size 2.0.3, devalue 5.9.3,
source-map-js 1.2.2, compression 1.8.2, Joi 17.13.8, PostCSS 8.5.23,
SvelteKit 2.70.2, decode-uri-component 0.5.0, baseline-browser-mapping 2.11.0,
and moment 2.31.0. Preserve the legacy callable brace-expansion
adapter and verify both legacy and modern consumers. These changes require a
clean package audit, the age gate, workspace tests and builds, native compatibility
validation, and native compilation before merge.

The upstream advisories list no patched release for
[node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv) or
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), as checked on
2026-10-18. Their upstream advisory records remain active. Local treatment is
defined below.
Do not invent package versions or silently suppress the audit. Resolve active
findings with a verified upstream release or a separately reviewed backport before
the merge gate passes.

The CVE authority rejected `CVE-2026-97058` for `sprintf-js` on 2026-10-12.
The [immutable CVE record](https://github.com/CVEProject/cvelistV5/blob/c3f6773766e2cf1dc050bfff2d59b236c86bb687/cves/2026/97xxx/CVE-2026-97058.json)
records state `REJECTED` and the authority's rejection reason. On 2026-10-18,
GitHub still reported `GHSA-hp3w-g68c-fv3c` with a null `withdrawn_at`, so the
raw package audit still fails on it. Treat this as a feed discrepancy, not an
unresolved vulnerability or a reason to change numeric formatting semantics.
The reviewed classification below identifies the exact advisory and preserves
the raw scan result and rejection evidence.

The decode-uri-component 0.5.0 security release is available. Its reviewed patch
must change only module packaging so existing CommonJS query-string consumers
receive the callable decoder. The upstream decoding algorithm must remain intact.
Verify valid Unicode and malformed percent-encoded input through the installed
query-string consumer, with a bounded subprocess timeout. Verify CommonJS and
ES module access to the decoder.

### RSA backport candidate

The unmerged [upstream fix](https://github.com/digitalbazaar/forge/pull/1152)
at commit `ceba34402e329f0365134f23fe19898756527d65` adds the missing nested
DigestAlgorithm element-count check. An isolated test on 2026-10-17 reproduced
acceptance of its malformed signature with the unmodified 1.4.0 package, using
default verification options. The candidate rejected that signature and accepted
valid SHA-256, SHA-384, and SHA-512 signatures while rejecting altered messages.
The upstream RSA suite passed against the isolated candidate: 101 passing and
four upstream pending cases, using Mocha 11.7.5. The dependency backport must
contain only the upstream nested element-count validation. An installed-consumer
regression check must reject the published malformed-signature vector, accept
valid signatures, and reject altered messages. The completed review and exact
security-gate treatment are recorded below. The raw audit finding remains visible;
it must not be silently excluded.

### Reviewed JavaScript audit findings

The security gate must retain the unmodified package-audit JSON in
`.bin/pnpm-audit.json` and print each reviewed finding. It may classify only these
exact findings separately from unresolved vulnerabilities:

- `GHSA-hp3w-g68c-fv3c`, package `sprintf-js`, versions 1.0.3 or 1.1.3: rejected
  CVE, with the immutable authority record linked above.
- `GHSA-86w9-cpqp-85rv`, package `node-forge`, version 1.4.0: reviewed upstream
  backport. The patch SHA-256 must equal
  `2798686e4488058ad81c3b8e32eb763c0feff21f4c717ce4d13b6ef2432cd5b8`, every locked
  consumer must select that patch, and the installed-consumer regression must pass.

A read-only review on 2026-10-18 confirmed the RSA patch matches the upstream
executable change, independently verified the public malicious-signature fixture,
and checked all six lockfile consumer references. The installed Expo consumer
regression also passed. Older unused package-store entries are not proof of active
resolution; frozen installs and the actual consumer resolver remain authoritative.

The gate must reject malformed audit output, audit execution failures, altered or
missing backport evidence, mismatched versions or package names, and all other
advisories. The active `braces` finding must fail unless every condition of the narrowly
approved temporary exception below is satisfied. This is not a general advisory
allowlist.

### Approved temporary braces build-tool exception

On 2026-10-18, the iOS export at the source state of `858f87f` produced a Hermes
source map with 1,071 mapped sources. Neither `braces` nor `micromatch` appeared.
The production web dependency deployment, produced with the Dockerfile's
`pnpm --filter @simple-strike/web deploy --legacy --prod` command, contained 71
packages and neither package. These checks do not prove native rendering or a
clean production image scan. The Go API does not execute JavaScript dependencies.

The lockfile introduces `braces@3.0.3` through `micromatch@4.0.8`, used by Metro,
Jest, and file-globbing build tools. The raw audit still reports
`GHSA-vfj7-8cjw-p6xm`, and the authority still publishes `CVE-2026-93687`.
The maintainer disputes the issue, but that does not withdraw the advisory.
No upstream fixed release has been verified.

The user approved this exception on 2026-10-18. It covers only
`GHSA-vfj7-8cjw-p6xm` in `braces@3.0.3`, in development/build tooling. It expires
at 00:00 UTC on 2026-11-17. The raw finding must remain visible. New advisories,
other versions, runtime inclusion, and arbitrary untrusted glob patterns are not
approved. Build and development services must use trusted repository inputs.

Each security-gate run that applies the exception must create a fresh iOS export
with source maps and a fresh production web build and dependency deployment. It
must inspect the iOS mapped sources, web bundle mapped sources, and deployed
package manifests. Empty web source maps may cover only empty chunks or static
import/re-export shims; executable code requires mapped sources or an exact
reviewed generated-helper fingerprint. Neither `braces` nor `micromatch` may appear. Missing, malformed,
or unsupported evidence must fail closed. A previous scan or a manually supplied
success marker must not enable the exception. Expiry must use the current UTC date.
The check must still fail on any other unresolved finding. This exception does
not waive native acceptance, image review, or any other merge requirement.

### Native demo verification artifact

An affected successful hosted iOS build must publish its ad hoc signed simulator app
and mechanically derived Git revision as a short-lived CI artifact. The archive
must preserve the application bundle structure. It must not include signing
material, build caches, or backend credentials. This development build requires
Metro and the demo backend. Artifact availability does not prove launch, map
interaction, device signing, or CarPlay acceptance.

An affected iOS build must also install and launch its exact simulator app in a
fresh, task-owned simulator. The check must load the development bundle from a
local Metro process, capture a screenshot, and verify the signed-out backend
setup screen by recognized text. A living process or a splash screen alone must
not pass. The screenshot and recognized text must be retained for inspection.
The simulator build must retain Xcode's application identity for Keychain access.
It must not require a developer certificate or provisioning profile. A fresh
installation showing a connection-storage error must fail the startup check.
The setup screen must finish storage initialization before the check passes;
visible loading text is not readiness.
The Metro readiness probe must use the IPv4 loopback address requested by the
native development bundle loader. A successful IPv6 localhost probe alone must
not establish readiness. The hosted test may bind Metro to all interfaces on
its isolated CI runner to support both loopback address families.
Installation into a fresh hosted simulator may take up to three minutes. An
installation timeout must fail the check, retain diagnostics, and must not count
as successful application launch.
The check must clean up only its own simulator and Metro process. This smoke
check does not establish CarPlay, authenticated map behavior, or route guidance.

The temporary production-dependency deployment used by the audit gate must run
in an isolated workspace copy. It must not change the installed development
dependency graph used by contract generation and subsequent checks.

### API runtime certificate refresh

The API runtime uses `hi/static:latest-1790234989` at multi-platform digest
`sha256:08d039e8b4f70c0b22118acfff9ada93fc7f9d349e5c5ac991fbdf6b876eea91`.
This September 24, 2026 build exceeds the fourteen-day observation period.
It replaces the older image whose certificate package triggered CVE-2023-32803.
The reviewed amd64 vendor SBOM contains
`ca-certificates-bundle 2026.2.90_v9.0.317-1.hum1` and timezone data `2026c-2.hum1`.
On October 18, Grype 0.111.1 found no vulnerabilities in direct scans of the
amd64 and arm64 image manifests with its October 17 database. The index signature verified with Red Hat's
`63405576` public key, using the vendor-documented verification command.
The image retains the minimal static-runtime role. This base-image check does
not establish a clean final application image or replace exact-candidate
production-image and live acceptance checks. The web runtime review remains open.
