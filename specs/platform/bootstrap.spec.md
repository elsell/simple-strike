# Bootstrap Specification

## Purpose

Create a public Simple Strike repository with make-app v0.5.14 and no example
product. Preserve generic engineering policies without private operational data.

## Requirements

- Preserve the generated platform, license, and exact dependency pins.
- Keep specification-first work, TDD with fakes, and explicit product approval.
- CI must classify changes once and retain five stable, fail-closed checks:
  changes, verify, acceptance, android-native, and ios-native.
- PR merges must use the checked merge helper from trusted main, bound to the
  exact head and complete checks. Protected policy changes require review evidence.
- GitHub access must work locally, without any built-in private SSH host.
- The first root commit may seed main. Later changes must use checked PRs.
- Public files must not contain real credentials, private hosts, personal contact
  data, machine paths, production configuration, or private repository history.
- Development credentials must remain explicit local-only fixtures.
- Provider permission and platform approval must remain open until confirmed.

## Acceptance

The manifest must identify Simple Strike with no product domains. Structural,
CI-routing, and merge-policy tests must pass. Public-content inspection must find
no private configuration. Report native builds and live acceptance separately.
