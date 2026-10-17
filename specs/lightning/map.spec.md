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

- Location permission denial, stale data, offline behavior, and reconnect behavior.
- Location processing and storage privacy.
- Route progress, rerouting, and spoken guidance implementation.
- Sound speed model, maximum ring distance, uncertainty, and animation limits.
- Exact age and distance cutoff boundaries, invalid/future observations, ties,
  rounding, and localization precision.
- CarPlay animation rules, parked/driving layouts, and entitlement outcome.
- Android Auto remains a future consideration, not the current implementation slice.
