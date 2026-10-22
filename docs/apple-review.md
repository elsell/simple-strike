# Apple review preparation

Status: draft preparation, not a submission or approval. Native interaction
acceptance, signed-device testing, reachable review infrastructure, privacy
answers, and production-image verification are incomplete.

## Draft product explanation

Simple Strike is a map and optional driving-navigation client for a backend that
the user operates. Each backend has one configured lightning data adapter. The
app does not sell data subscriptions or select a provider. The operator keeps
provider credentials on the backend and is responsible for authorized data use.

The app uses MapKit for maps, destination search, and driving routes. The driver
may use location following without starting a route. Starting a route enables
maneuver guidance; End Route returns to location following. CarPlay uses native
map, search, trip, and guidance templates with the same application session.

Recent observations appear as markers and estimated thunder propagation rings.
The nearest received observation within 50 miles is calculated from observations
in the last five minutes. This is not a completeness claim about nearby lightning.
Routes do not avoid storms. The rings estimate sound propagation, not safe areas.

The review backend will run the public simulated-data adapter. Its data is
visibly labeled as simulated. The same documented API accepts live observations
from an operator-authorized adapter. Both modes must be described during review;
review access must not depend on an undisclosed account-specific feature switch.

## Review access to prepare

| Item | Current state |
| --- | --- |
| App identifier | `com.elsell.simplestrike` |
| OIDC callback | `simplestrike://callback` |
| Public HTTPS demo backend | `https://demo.simplestrike.online`, selected; deployment and reachability verification pending |
| Public HTTPS Dex issuer | Not provisioned; configure its exact issuer and redirect URI |
| Published demo account | `demo@example.com`, password `password`, for isolated demo data only |
| Review contact and support URL | Owner must supply these before submission |
| Privacy policy URL | Must reflect the actual hosted demo and client data handling |
| CarPlay capability | Request through Apple Developer; not yet granted |

Do not put signing certificates, private keys, production credentials, or private
account details in this document. The published demo password is intentional and
must never be reused for a real-data deployment.

## Reviewer walkthrough to verify before submission

1. Enter the review backend URL on the phone and sign in using the demo account.
2. Confirm the simulated-data label. The rolling demo uses fixed locations near
   Tampa, Florida. Map browsing works elsewhere; do not expect simulated strikes
   to move to the reviewer's location.
3. Grant location permission, follow movement, drag the map, zoom, and recenter.
   Inspect nearby-strike distance and relative age where demo observations exist.
4. Search for a destination, preview a driving route, start guidance, and end it.
   Verify spoken instructions and a reroute with a controlled location sequence.
5. Connect CarPlay and repeat the map and navigation operations. Check cold car
   launch, later phone attachment, phone lock, disconnection, and reconnection.
6. Sign out. Both displays must clear account-specific map and route state. Change
   the backend and confirm that the previous session is not used for the new one.

Record the tested revision, device or simulator version, results, and recordings.
The detailed procedures in [mobile verification](mobile.md) and
[navigation](navigation.md) remain authoritative. An unsigned build or setup-screen
screenshot does not establish these walkthrough results.

## Data-handling inventory for privacy review

| Data | Implemented use and destination | Remaining verification |
| --- | --- | --- |
| Device location | Follow-me, nearest-strike distance, route origin, and native maps; MapKit receives search/route inputs | Inspect signed-build traffic and platform disclosures |
| Search and destination | MapKit search and route calculation; application route state is in memory | Confirm no unexpected SDK persistence or telemetry |
| Lightning observations | Read from the configured backend; recent observations cached in memory | Verify expiry and disposal on both displays |
| Backend and issuer settings | Persisted on the device to restore the selected connection | Confirm release storage and backup behavior |
| Application session | Opaque credential in secure storage; sent to the configured backend | Verify signed-device Keychain behavior and logout |
| Account identity and profile | OIDC issuer/subject identify the account; server stores profile data | Confirm operator retention and account-deletion process |
| Audit events | Backend records actor, action, target, outcome, and time; retention is operator-configured | Review the demo operator's retention and support process |

The lightning API does not receive the driver's location, destination, or route.
The audit contract excludes credentials, request bodies, IP addresses, and user
agents. That contract does not establish what the deployment's proxy, identity
provider, or telemetry system records. Inspect those systems before completing
App Store privacy answers. Do not claim that no data is collected from this table.

## Signing and submission sequence

After native acceptance and release gates pass, register the app identifier under
the owner's Apple Developer team, request the CarPlay navigation capability, and
create the corresponding provisioning configuration. The source entitlement alone
does not grant that capability. Configure release HTTPS endpoints and build with
`make mobile-release-ios` using the owner's authorized signing environment. Verify
the resulting signed app on a physical device and CarPlay before submitting it.

Keep the demo backend reachable throughout review. Supply the complete walkthrough
and intended live-data behavior. Verify active-route guidance with both displays inactive before claiming tested
background operation. Follow-me without a route must stop background tracking.

Apple references, checked 2026-10-18:
[CarPlay program](https://developer.apple.com/carplay/),
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
and [App privacy details](https://developer.apple.com/app-store/app-privacy-details/).
