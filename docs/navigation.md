# Driving navigation

Status: foreground iOS implementation. Native interaction verification and
CarPlay integration are not complete.

Select Navigate on the map. Search for an address or place, then select a result.
A current, accurate location is required to calculate and start the driving route.
The preview shows distance and estimated duration. Close the sheet to see its
route line on the map. Select Start Route to begin guidance.

Guidance shows the current instruction and remaining distance. Spoken maneuvers
come from MapKit. A sustained departure requests a new route to the selected
destination. Failed recalculations retry at least 30 seconds apart, up to three
attempts. Retry Route permits another attempt on a new location update.

End Route stops speech, removes the route, and returns the map to follow-me mode.
Sign-out and changing servers also end guidance. In this foreground implementation,
leaving the phone scene pauses speech and pending route work. A fresh location is
required after returning. Background guidance is not yet implemented or verified.

Locations, searches, and routes remain in memory. MapKit receives the inputs for
its search and route services. The lightning backend receives no trip data.
Routes do not avoid lightning and are not storm-safety recommendations.

Behavioral tests exercise matching, maneuver progress, arrival, GPS quality,
rerouting, bounded retries, and cancellation with controlled ports and clocks.
The iOS JavaScript export passes. Neither result establishes a native driving
experience, speech playback, or CarPlay acceptance.

## CarPlay implementation status

The native scene now has a MapKit surface, zoom and recenter buttons, a pan
control, and a native list for lightning status. The presentation bridge uses
session generations to reject late snapshots after disposal. Phone and car maps
use one location source. A localized setup message sends sign-in to the phone.

The Expo plugin registers phone and CarPlay scenes. It replaces eager phone-window
startup with one retained React Native root. Either scene can start the runtime.
Phone URL callbacks are forwarded to the original application handlers. Tests
check the generated configuration and reject an unexpected startup template.
These are configuration checks, not native lifecycle tests.

CarPlay now has destination search, trip preview, and maneuver template code.
Search calls the shared MapKit adapter. Destination selection and route commands
enter the phone's application controllers. Trip time estimates decrease in
proportion to the remaining route distance. They are estimates, not traffic updates.
The latest scene and startup code still needs a clean Xcode build and native
interaction checks. Cold car launch, phone attachment, phone lock, reconnection,
and sign-out must pass before this integration can be called complete. The
navigation entitlement declaration does not grant Apple's capability or approval.
