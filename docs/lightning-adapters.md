# Lightning provider adapters

Status: the source interface, demo adapter, protected HTTP read, and demo runtime
composition are implemented. Full deployment and native client verification are
still pending. This guide does not claim an operational demo service.

## One source per backend

Each backend receives one `ports.Source` at bootstrap. A source normalizes
observations from the operator's configured provider. Clients receive the standard
backend API and do not select providers or receive provider credentials.

The extension packages are public Go packages:

- `github.com/elsell/simple-strike/apps/api/pkg/lightning/domain`
- `github.com/elsell/simple-strike/apps/api/pkg/lightning/ports`

A separately maintained module may import these packages. It must not import
`internal` implementation packages. Keep provider credentials and transport code
inside that module's adapter. Do not fork client or domain behavior to add a source.
Pin the API module revision when packaging a private adapter.

## Source contract

Implement `Read(context.Context, ports.Window) (domain.Batch, error)`.

- Return source-local stable observation IDs, WGS84 coordinates, and occurrence
  timestamps. Do not substitute reception time for occurrence time.
- The time window includes `From` and excludes `Until`.
- Label batches `domain.Demo` or `domain.Live` accurately, including empty batches.
- Honor context cancellation. Do not return observations with a successful result
  after a canceled read.
- Return errors through the port. Do not translate errors into HTTP responses.
- Never return subscription credentials in observations or error descriptions.

The standard server enforces session and feed-view permissions as described below.
Implementing this port does not authorize access to an upstream source. Provider
health metadata beyond request failure remains an open decision.

## Demo scenario

`adapters/demo.New` takes an injected clock, a scenario start, and a finite list of
events. Each event has an ID, time offset, and position. Reads return events that
have occurred according to the injected clock and fall inside the requested window.
Repeated reads preserve IDs and occurrence times. The adapter does not use a network.

This finite scenario is useful for controlled tests. It does not loop, relocate
strikes to a user's position, or silently reset the clock. The runnable demo server
uses the separate rolling scenario described below. Both label results as simulated.

## Verify the extension boundary

Run `bash scripts/verify-lightning-extension.sh` with Go on PATH. The check creates
an independent temporary module and compiles a conforming source against the local
API module. It cleans up that temporary module when it finishes. Run the real demo
adapter tests with `cd apps/api && go test -race ./pkg/lightning/...`.

## Standard server demo mode

Set `SIMPLE_STRIKE_LIGHTNING_SOURCE=demo` to select the rolling demo scenario.
The default is `disabled`; unsupported names fail configuration validation.
The rolling scenario uses fixed positions near Tampa, emits one simulated event
every ten seconds, and preserves event IDs and timestamps across repeated reads.
It never uses the driver's location to manufacture observations.

The demo Compose overlay selects this source and sets
`SIMPLE_STRIKE_FEED_ACCESS=authenticated` on the privileged schema bootstrap.
That setting grants the configured feed's viewer relation to authenticated users.
The API still requires an active application session and checks SpiceDB on each
read. Omitting the bootstrap setting removes the wildcard grant on the next schema
bootstrap run. It does not remove separately provisioned individual grants.

`GET /v1/lightning/strikes` returns the last five minutes through the generated
OpenAPI contract. Access decisions and successful reads are audited. A source,
authorization, or audit failure does not return a successful observation response.

## Demo backend verification

Run the loopback-only check against an isolated running demo deployment:

```sh
python3 scripts/verify-demo-feed.py --api http://127.0.0.1:8080 --issuer http://127.0.0.1:5556/dex
```

The check uses the published Dex demo account, exchanges an OIDC identity token for
an application session, reads labeled observations, and verifies the persisted audit
record. It also checks rejection of missing sessions, malformed sessions, and raw
OIDC identity tokens at the lightning endpoint. It does not print credentials.

This is a backend protocol test using Dex's password grant. It does not verify the
mobile authorization-code/PKCE browser flow, native rendering, or CarPlay approval.
Those remain separate acceptance requirements.

## Build a private server entrypoint

A private executable can import `github.com/elsell/simple-strike/apps/api/bootstrap`
and call `bootstrap.Run(factory)`. The factory receives a cancellation context and
clock and returns one `ports.Source`. Its entrypoint or bootstrap package reads
provider configuration and constructs the private adapter.

Select `SIMPLE_STRIKE_LIGHTNING_SOURCE=external` for that executable. The standard
server rejects `external` because it has no private factory. Demo mode always
selects the built-in simulated source and does not invoke a private factory.
The public bootstrap retains all session, permission, rate-limit, and audit checks.
Pin the API module revision and build the private executable into an operator-owned
image. Do not include provider keys in image layers or source control.
