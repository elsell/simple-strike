# Runtime image review

Status on 2026-10-18: API base refresh verified. Web runtime review remains open.
This is evidence for the demo-map delivery blocker, not a release approval.

## Verified API base

The API now pins `hi/static:latest-1790234989` at index digest
`sha256:08d039e8b4f70c0b22118acfff9ada93fc7f9d349e5c5ac991fbdf6b876eea91`.
Direct registry scans of its amd64 and arm64 manifests found zero matches with
Grype 0.111.1 and the database built on 2026-10-17. Red Hat signature verification
passed. The September 24 image exceeds the fourteen-day observation period.
The vendor SBOM includes the updated certificate bundle. See the
[testing specification](../specs/platform/testing.spec.md#api-runtime-certificate-refresh).
Final application-image scans and acceptance still apply.

## Web runtime investigation

The currently pinned Node runtime is
`sha256:c0fd66cf088af1c6f122bcdbbf5d701ffea303fe84ebb23575ac75edde625113`.
Its direct amd64 registry scan reports 432 package/advisory matches, including
3 critical and 140 high matches. Counts are not counts of distinct vulnerabilities.
Several matches have fixed versions, including Node and OpenSSL packages.

The evaluated Node 24.21.0 candidate has index digest
`sha256:350619398195a0441541a6d201af0d56cc3c685bd5d3b83b594e1a3267221df6`.
Its amd64 scan reports 59 matches: 26 high, 32 medium, and one low. This candidate
has not been adopted. A newer image alone does not clear the release gate.
Remaining high matches include Node's bundled Undici and npm's dependencies.

The upstream [Undici TLS advisory](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx)
requires a custom function-valued TLS option for the reported bypass. That
condition must be assessed against actual runtime use before claiming impact.
Other findings, including the
[content-encoding denial of service](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c),
need separate assessment. No finding is waived by this document.

Next: verify a fixed vendor runtime, or establish exact remediation and runtime
reachability for each remaining high finding. Review the candidate's signatures
and SBOM, test the application, and scan the complete final image before release.
Do not apply the approved JavaScript build-tool exception to runtime images.

## Builder scan limitation

The Go builder's vendor SBOM produced 264 matches, while a direct scan of its
actual amd64 image produced 66. The SBOM includes entries with both upstream
versions and complete RPM release versions. Therefore, an SBOM match count alone
must not be treated as a count of vulnerable installed packages. The direct scan
still reports high findings; this observation does not clear them.
