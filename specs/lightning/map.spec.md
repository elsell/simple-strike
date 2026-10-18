# Lightning Map Specification

Status: product direction approved. Implementation in progress. Open decisions
below remain unresolved and must not be silently selected.

## Purpose, terms, and actors

Simple Strike is a bring-your-own-lightning-data application. A driver uses the
iOS app or its CarPlay interface. An operator hosts a backend with one configured
provider adapter. A strike is an observation with a location and occurrence time.
A thunder ring estimates sound propagation; it is not a safety boundary or an
exact prediction of audible thunder. A demo strike is simulated data.

## Approved behavior

- The app must follow the vehicle location by default.
- The map must support zoom, exploration, and recentering. Manual exploration
  must suspend following until the driver selects recenter.
- The initial view must cover approximately a 20-mile radius.
- Vehicle movement and expanding thunder rings must animate smoothly between
  source updates. Animation must not invent new observations.
- Rings must have white outlines and translucent dark interiors. Their outlines
  must widen and fade as they expand. Their interiors must fade with distance.
- The app must show the closest received strike within 50 miles of the vehicle
  from the last five minutes, including distance and relative age.
- The closest-strike indicator must use vehicle location, not the panned map center.
- Simulated results must be clearly labeled. The app must not present demo data
  as live observations or claim that received data is a complete regional feed.
- Apple MapKit must supply native maps and route calculation.
- iOS and native CarPlay are required clients. CarPlay use depends on Apple
  entitlement and approval. A browser prototype is not native verification.
- Turn-by-turn navigation must be a real optional feature. The app must expose
  Navigate and End Route. Ending a route must return to follow-me mode.
- No advertisement or subscription sales are part of the approved app scope.

## Data and access boundaries

All lightning data must come through the configured backend. See
[Data sources](data-source.spec.md). The app must not contain provider credentials.
The demo server must use the same client contract as real data backends.
OIDC sign-in is required. The demo uses Dex with published shared credentials.
See [identity access](../identity-access/identity-access.spec.md).
The app is for personal interest, not storm warnings or safety decisions.

## Acceptance scenarios

- Given following mode, when the vehicle moves, the map remains centered on it.
- Given following mode, when the driver explores the map, vehicle tracking
  continues but map centering stops. Recenter restores following.
- Given a nearby older strike and a farther newer strike, the indicator selects
  the nearer eligible strike and reports its relative age.
- Given a panned map, closest-strike distance remains relative to the vehicle.
- Given demo mode, map and closest-strike results identify their simulated source.
- Given active route guidance, End Route ends guidance and restores following.

## Open questions

- Background location behavior during active navigation.
- Location processing and storage privacy.
- Route progress, rerouting, and spoken guidance implementation.
- Native animation performance and CarPlay display limits.
- Further accessibility and localization refinement after native verification.
- CarPlay animation rules, parked/driving layouts, and entitlement outcome.
- Android Auto remains a future consideration, not the current implementation slice.

## Recent observations and routine client behavior

On backend disconnection, the client must retain received strikes until five
minutes after their occurrence time and display a disconnected label. It must
continue to expire observations while disconnected. Reconnection must deduplicate
observations by identifier. Source-mode changes must clear the previous cache.
Sign-out, backend changes, and explicit access rejection must clear cached data.
A transient feed failure must not remove a valid application session.

Routine defaults follow the user's authorization to make trivial decisions:
- The age interval is zero through less than five minutes. Future timestamps are
  excluded. Distance eligibility includes exactly 50 statute miles.
- If location is unavailable, the map remains browsable and vehicle-relative
  distance is hidden. Recenter requires a current location fix. No location is
  fabricated or sent in lightning requests.
- Foreground snapshot reads start three seconds apart after successful reads,
  with exponential failure backoff capped at 30 seconds. Backgrounding cancels
  reads. Foregrounding resumes reads and expires old observations.
- Cached observations remain in memory only. Initial viewport is the demo region
  until a real location is available; that initial center is not a vehicle fix.
- Estimated thunder rings use a constant 343 meters per second, with no claim
  of local atmospheric accuracy. They expire with their observations.

Acceptance: a strike received at age 290 seconds remains visible after a network
failure, then disappears at age 300 seconds without a successful network read.
A duplicate received after reconnect creates one marker. An access rejection
clears the cache immediately.

After a pinch gesture, zoom buttons must scale the visible map radius. Recenter
must preserve that radius instead of restoring the radius before the gesture.

The signed-in phone screen should give the map the available screen area. Account
identity and sign-out controls may use a dismissible account sheet. Opening or
closing this sheet must not discard recent observations or reset the viewport.
Session errors must remain visible without opening the account sheet.
