# Driving Navigation Specification

## Purpose and scope

A driver may use genuine driving directions while viewing lightning observations.
Navigation is optional. Opening the app must not require a destination or route.
The approved map authority is [map behavior](../lightning/map.spec.md).

A destination is a selected place and coordinate. A route is the driving geometry,
distance, estimated travel time, and maneuver instructions returned by MapKit.
A preview is a calculated route that the driver has not started.

## Workflow

- Navigate must let the driver search for an address or place through MapKit.
- Search must use the visible region as a hint, not fabricate a destination from
  text. The driver must select a result before calculating a route.
- A current vehicle location is required to calculate and start a driving route.
  Missing permission or location must leave the map usable and show feedback.
- The preview must show the selected destination, route line, total distance,
  estimated duration, and a Start Route action. Calculation must not start guidance.
- Starting a route must provide maneuver progress, rerouting, and spoken guidance.
  A route line or list of instructions alone does not satisfy this requirement.
- End Route must stop guidance and speech, remove the route, and restore follow-me.
- Search and route failure must permit retry without signing out or clearing
  lightning observations. Failure must not substitute a straight line for a route.
- Canceling or replacing a search or route must prevent a late result from
  replacing the current choice. Ending a route must prevent pending work from
  restoring it.
- Account sign-out and server changes must end the current navigation session.

## Routine implementation and privacy choices

These choices implement the approved MapKit direction and the user's instruction
that routine decisions use established platform practice.

- Place search and route calculation use separate injected ports. MapKit is the
  native adapter. Network access for maps remains within that adapter.
- Driving mode is automobile. The first returned driving route is the initial
  preview. This app must not claim a route avoids lightning or is safe from storms.
- Locations, search text, and routes stay in process memory and are not sent to
  the lightning backend or written to application audit records. Apple receives
  the inputs needed for its map services. No trip history is added.
- Application labels use the shared locale catalog. Names and instructions from
  MapKit are external data and retain the provider's localized text.
- Failed and canceled work must not trigger automatic unbounded retries.

## Acceptance scenarios

1. Search a destination, select a result, and preview the calculated driving route.
   The map and lightning continue to function before guidance starts.
2. Select B while calculation for A is pending. A's late success or failure must
   not replace B's preview or error state.
3. End Route while a recalculation is pending. The late result must not restore
   route guidance or speak instructions.
4. Revoke location access. The app must not use the demo center as a vehicle fix.
5. A simulated drive must advance maneuvers, issue appropriate speech, reroute
   after a sustained deviation, and return to follow-me when ended.
6. The same approved route behavior must be demonstrable through native CarPlay.

## Remaining decisions and evidence

Background/locked-phone location behavior during active guidance still requires
an answer to the pending product question. Foreground route work may proceed,
but it does not establish background navigation or CarPlay completion. Maneuver
matching, deviation thresholds, and speech timing must be specified with their
behavioral tests before implementation. Native interaction evidence and Apple
entitlement remain required. No approval outcome is assumed.

## Route geometry matching

Route progress must be measured along the returned driving polyline, not by
straight-line distance to the destination. Matching must project a location onto
route segments and report distance from the route and distance along the route.
Longitude wrap at the date line must use the shorter arc. Duplicate points must
not produce division by zero or non-finite progress.

The progress controller must restrict matching to its plausible progress window.
At a crossing or nearby return leg, geometry outside that window must not advance
the maneuver. The geometry port must support a closed distance-along-route
interval and clip projection to that interval. Invalid coordinates, empty paths,
and invalid intervals must fail explicitly rather than fabricate a match.
These numerical rules implement the approved route-progress behavior. They do
not establish road-level matching accuracy or replace native driving tests.

## Progress and location quality

The initial progress controller uses these explicit, testable defaults. Native
and road testing must validate them before release.

- Location fixes must be finite, no more than 10 seconds old, not future-dated,
  and have horizontal accuracy from zero through 50 meters. Duplicate or older
  fix timestamps must not count as new observations. An invalid fix must
  pause progress and suppress maneuver advancement.
- Progress matching must allow 30 meters behind the previous match and at most
  100 meters plus 60 meters per elapsed second ahead. Elapsed time is capped at
  10 seconds. The first fix may match the first 250 meters.
- A matched location within the greater of 75 meters or twice its accuracy is
  on-route. Accepted progress must not move backward because of GPS noise.
- An off-route fix must not advance progress or declare arrival. Continuous
  off-route observations spanning at least eight seconds request recalculation.
  An on-route or invalid fix resets that deviation interval.
- Distance remaining must use the route's distance scaled by matched geometry
  progress. Maneuver progression follows cumulative step distances.
- Arrival requires at most 25 meters of remaining geometry and a fix within
  40 meters of its endpoint, with accuracy at most 30 meters. It must not be
  inferred solely from straight-line proximity to the destination.

## Guidance lifecycle and speech

- Guidance must start only from a selected route and a valid current location.
- The controller must emit the current maneuver instruction when entering a new
  step. It may announce the next maneuver once within 150 meters, at least five
  seconds after the last announcement. It must not announce both on the same fix. Repeated GPS
  updates must not repeat the same announcement. External instruction text must
  not be concatenated into untranslated application sentences.
- Arrival must stop maneuver speech and announce a localized arrival message once.
  End Route must clear all guidance state and stop speech immediately.
- Off-route, unavailable-location, and rerouting states must suppress old maneuver
  announcements. Speech failure must not stop visual guidance.
- A sustained departure must calculate a new route from the latest accepted fix
  to the same selected destination through the route port. Only one recalculation
  may be pending per guidance session.
- Failed recalculations may retry on new valid fixes, at least 30 seconds apart,
  for at most three attempts before explicit retry. Successful recalculation or
  returning to the route resets the failed-attempt count.
- Ending or replacing a route must invalidate pending recalculations. A late
  result must not restart guidance, change the route, or speak.
- A replacement route must be validated before it replaces the previous geometry.
  A missing current location after calculation must suppress guidance until a
  usable fix arrives. It must not invent vehicle progress.

During foreground-only implementation, an inactive phone scene must stop speech
and invalidate pending route work while retaining the selected route in memory.
It must not advance guidance until a new valid location arrives after activation.
This interim behavior does not resolve the open background-navigation decision.

The phone must show search results in a dismissible sheet. Route preview must
remain visible on the map when the sheet closes. A driver may reopen the sheet
or clear the preview. Starting guidance must recenter on the current vehicle.
