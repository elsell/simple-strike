import CarPlay
import MapKit

/// Projects application guidance into CarPlay. It does not calculate routes or speak.
final class CarPlayGuidance {
  private let template: CPMapTemplate
  private var routeID = ""
  private var phase = "idle"
  private var trip: CPTrip?
  private var session: CPNavigationSession?
  private var maneuver: CPManeuver?
  private var instructionID = ""
  private var paused = false
  private(set) var applying = false

  init(template: CPMapTemplate) { self.template = template }

  func clear() {
    applying = true
    defer { applying = false }
    let previous = session
    session = nil
    previous?.cancelTrip()
    template.hideTripPreviews()
    routeID = ""; phase = "idle"; trip = nil; maneuver = nil; instructionID = ""; paused = false
  }

  func render(_ value: CarPlaySnapshotRecord) {
    guard value.authorized, !value.routeId.isEmpty, value.route.count >= 2 else {
      if trip != nil { clear() }
      return
    }
    if routeID != value.routeId {
      clear()
      let first = value.route[0]
      let last = value.route[value.route.count - 1]
      let origin = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: first.latitude, longitude: first.longitude)))
      let destination = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: last.latitude, longitude: last.longitude)))
      destination.name = value.destinationName
      let choice = CPRouteChoice(summaryVariants: [value.routeSummary], additionalInformationVariants: [], selectionSummaryVariants: [value.routeSummary])
      trip = CPTrip(origin: origin, destination: destination, routeChoices: [choice])
      routeID = value.routeId
      if value.guidancePhase == "idle", let trip {
        template.showTripPreviews([trip], textConfiguration: CPTripPreviewTextConfiguration(startButtonTitle: value.labels["start"], additionalRoutesButtonTitle: nil, overviewButtonTitle: nil))
      }
    }
    guard let trip else { return }
    let estimates = travel(distance: value.distanceRemainingMeters, seconds: value.expectedTravelSeconds)
    if value.guidancePhase == "idle" {
      template.updateEstimates(estimates, for: trip)
      return
    }
    template.hideTripPreviews()
    if value.guidancePhase == "arrived" {
      if phase != "arrived" { session?.finishTrip(); session = nil }
      phase = "arrived"
      return
    }
    phase = value.guidancePhase
    if session == nil { session = template.startNavigationSession(for: trip) }
    guard let session else { return }
    if value.instruction.isEmpty || value.guidancePhase == "rerouting" {
      if !paused {
        session.pauseTrip(for: value.guidancePhase == "rerouting" ? .rerouting : .locating, description: value.guidanceStatus)
        paused = true
      }
      return
    }
    let seconds = value.distanceRemainingMeters > 0 ? value.expectedTravelSeconds * min(1, value.maneuverDistanceMeters / value.distanceRemainingMeters) : 0
    let nextEstimate = travel(distance: value.maneuverDistanceMeters, seconds: seconds)
    if instructionID != value.instructionId || maneuver == nil || paused {
      let next = CPManeuver()
      next.instructionVariants = [value.instruction]
      next.initialTravelEstimates = nextEstimate
      maneuver = next
      instructionID = value.instructionId
      if paused {
        if #available(iOS 17.4, *) {
          session.resumeTrip(updatedRouteInformation: CPRouteInformation(maneuvers: [next], laneGuidances: [], currentManeuvers: [next], currentLaneGuidance: CPLaneGuidance(), trip: estimates, maneuverTravelEstimates: nextEstimate))
        } else {
          // Earlier systems resume guidance when the next maneuver set is supplied.
          session.upcomingManeuvers = [next]
        }
        paused = false
      } else { session.upcomingManeuvers = [next] }
    }
    template.updateEstimates(estimates, for: trip)
    if let maneuver { session.updateEstimates(nextEstimate, for: maneuver) }
  }

  private func travel(distance: Double, seconds: Double) -> CPTravelEstimates {
    CPTravelEstimates(distanceRemaining: Measurement(value: max(0, distance), unit: UnitLength.meters), timeRemaining: max(0, seconds))
  }
}
