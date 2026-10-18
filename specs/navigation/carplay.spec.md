# Native CarPlay Specification

## Purpose and actors

The signed-in driver uses the same map and optional navigation session on the
phone and CarPlay. CarPlay is a native scene, not a browser or phone-screen mirror.
The navigation entitlement and Apple's approval remain external requirements.

## Native presentation and shared application state

- A CarPlay scene must own a native MapKit map in its CarPlay window. Buttons,
  search, trip previews, guidance, and messages must use CarPlay templates.
- The scene must support zoom, pan, recenter, destination selection, route preview,
  Start Route, and End Route. End Route must restore follow-me on both displays.
- The phone and car must share one application session, backend connection,
  observation cache, route planner, and guidance controller. Connecting a second
  display must not create another provider connection or independent route.
- A typed native presentation adapter must receive map and guidance snapshots and
  emit user commands. It must not receive backend or identity-provider credentials.
- Native callbacks must enter the existing application controllers. They must not
  bypass authentication, issue provider requests, or fabricate strikes or location.
- Labels must come from the shared locale catalog. Native startup may show the
  product name while labels and saved-session state load.
- Before authentication restores, CarPlay must not display cached observations,
  start navigation, or ask for credentials. It must direct setup and sign-in to
  the phone after localized labels become available.
- Sign-out, access rejection, and server changes must immediately clear the car's
  observation and route state. A late snapshot from a disposed session must not
  restore it.

## Scene lifecycle

- One React Native runtime must support both scenes. Launching from CarPlay before
  opening the phone must initialize that runtime and restore the saved connection.
- Attaching the phone scene later must reuse the runtime and preserve the route.
  Phone URL callbacks and universal links must continue to reach OIDC sign-in.
- An active CarPlay scene counts as an active app surface for feed and guidance
  work. Inactive phone UI must not pause an active car session.
- When neither scene is active, the current foreground-only policy pauses work.
  This does not settle the open decision about background navigation when all
  scenes are inactive.
- Scene disconnection must release its map and template observers. It must not
  sign out the phone or create a second location or speech session.
- Generated native startup changes must fail explicitly if the expected Expo
  startup no longer matches. The configuration must retain the original phone
  URL handlers and must not create a second React Native root.

## Acceptance and limits

Verify cold CarPlay launch, phone attachment, phone lock with an active car scene,
scene switches, sign-out, backend changes, feed expiry, and End Route on a native
simulator or device. A Swift build, JavaScript export, or contract test alone does
not establish these behaviors. Verify template and animation policy before
claiming Apple review readiness.

Sources: Apple's [CarPlay scene guide](https://developer.apple.com/documentation/carplay/displaying-content-in-carplay),
[CarPlay window](https://developer.apple.com/documentation/carplay/cpwindow), and
[application state](https://developer.apple.com/documentation/uikit/uiapplication/applicationstate).

## Snapshot delivery

A presentation session must receive a generation from the native adapter. Every
snapshot and close operation must carry that generation. The native adapter must
ignore generations from disposed sessions. Opening a new session clears previous
presentation state before it accepts new snapshots.

The client publisher must keep at most one pending snapshot while a native write
is in flight. New state replaces that pending snapshot. Closing must discard
pending state and close its own native generation even when opening completes
late. Delivery errors must be reported to the presentation owner without retrying
the same snapshot indefinitely. This boundary carries no account or provider keys.
