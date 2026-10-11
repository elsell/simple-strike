# Bootstrap

Generated with make-app v0.5.14 from public commit
f33a4132e0c697a3146b609c72945c66b63458b0 at https://github.com/elsell/make-app.

```sh
make-app new "Simple Strike" --module github.com/elsell/simple-strike \
  --bundle-prefix com.elsell --without-example
```

The foundation includes API, web, mobile, identity, authorization, audit,
localization, and tests. Lightning maps and car interfaces are not implemented.

Generic engineering guidance was rewritten without private host notes. Reviewed
delivery checks were adapted for this repository. No private application code,
history, production configuration, or machine-specific infrastructure was copied.

## Delivery

CI classifies changes once and retains five stable fail-closed checks. Use:

```sh
SIMPLE_STRIKE_REPOSITORY=elsell/simple-strike \
  scripts/merge-checked-pr.sh PR_NUMBER EXPECTED_HEAD_SHA
```

The helper uses local gh by default. SIMPLE_STRIKE_GH_HOST optionally selects an
operator-configured SSH host; no host is built in. Protected delivery changes need
the helper's exact-head approval evidence. Only the first root commit seeds main.

## Verification

On 2026-10-11, client type checks, client tests, mobile configuration validation,
CI-routing tests, checked-merge adversarial tests, and structural checks passed.
Go tests passed in an isolated remote temporary workspace with Go 1.25.13.
Go formatting and generated OpenAPI consistency also passed. Client checks used
Node 22.17.0 and pnpm 11.0.7. The initial local Go test attempt exhausted disk
space; compilation was moved to a temporary environment and completed there.

A read-only critic found no confirmed P0/P1 blockers. Public-content inspection
found no private host details, personal contact addresses, or credential signatures.
Generated local development fixture credentials remain labeled in the scaffold.

The initial root commit is published with the documented bootstrap exception to
local commit/push hooks. Future commits retain the normal hooks and checked PR
merge policy. Full hosted CI runs on the initial commit. Native compilation,
Docker acceptance, and release readiness are not claimed by these bootstrap checks.
