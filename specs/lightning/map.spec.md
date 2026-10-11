# Lightning Map Concept Specification

Status: user-approved intent. Detailed behavior is open. Not implemented.

## Purpose and actors

Simple Strike is a personal, noncommercial hobby app. Initially its developer is
its only user. A strike is a provider observation with a location and time. A
thunder circle shows estimated sound propagation, not an exact arrival prediction.

## Approved intent

- Show current location and recent lightning strikes on a map.
- Support following the user, panning, zooming, and recentering.
- Show expanding circles that estimate thunder propagation.
- Include no advertisements or subscriptions.
- Explore CarPlay and Android Auto, subject to approval and driving-display rules.
- Publish the code repository. This does not grant permission to provider data.

## Preconditions and visibility

Live observations require confirmed provider permission. Bootstrap must not access
or scrape a lightning feed. Access is pending in the public request:
https://forum.blitzortung.org/mybb/showthread.php?tid=4319
The app is for personal interest, not storm warnings or safety decisions.
Location storage, sharing, account requirements, and offline behavior are open.
Generated identity infrastructure does not settle the product login policy.

## Open questions

- Provider permission, feed, coverage, latency, attribution, and retention.
- Map provider, tile license, and cost.
- Sound model, uncertainty, strike age, and display limits.
- Location-denied, stale-data, offline, and network-failure behavior.
- Location processing and storage privacy.
- First supported client and whether to begin with simulated strikes.
- CarPlay entitlement and whether actual route guidance is desired.
- Parked versus driving displays and animation rules.

## Acceptance planning

After detailed approval, test follow/recenter, pan/zoom, observation age,
injected-clock circle progression, and failure states through the chosen client.
No map behavior is claimed complete by this bootstrap.
