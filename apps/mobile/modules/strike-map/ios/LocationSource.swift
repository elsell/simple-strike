import CoreLocation

/// One in-memory location source serves both native map surfaces.
final class LocationSource: NSObject, CLLocationManagerDelegate {
  static let shared = LocationSource()
  private struct Observer {
    let fix: ([String: Any]) -> Void
    let state: (String) -> Void
  }
  private let manager = CLLocationManager()
  private var navigationOwners = Set<UUID>()
  private var observers: [UUID: Observer] = [:]
  private override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    manager.activityType = .automotiveNavigation
  }
  func observe(_ id: UUID, fix: @escaping ([String: Any]) -> Void, state: @escaping (String) -> Void) {
    observers[id] = Observer(fix: fix, state: state)
    if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
    updateActivity()
  }
  func navigation(_ id: UUID, fix: @escaping ([String: Any]) -> Void, state: @escaping (String) -> Void) {
    navigationOwners.insert(id)
    observe(id, fix: fix, state: state)
  }
  func remove(_ id: UUID) {
    navigationOwners.remove(id)
    observers.removeValue(forKey: id)
    updateActivity()
  }
  private func updateActivity() {
    let state: String
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse: state = "authorized"
    case .denied: state = "denied"
    case .restricted: state = "restricted"
    case .notDetermined: state = "undetermined"
    @unknown default: state = "unavailable"
    }
    for observer in Array(observers.values) { observer.state(state) }
    let navigating = !navigationOwners.isEmpty && state == "authorized"
    manager.allowsBackgroundLocationUpdates = navigating
    manager.showsBackgroundLocationIndicator = navigating
    manager.pausesLocationUpdatesAutomatically = !navigating
    if !observers.isEmpty && state == "authorized" { manager.startUpdatingLocation() }
    else { manager.stopUpdatingLocation() }
  }
  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { updateActivity() }
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last, location.horizontalAccuracy >= 0 else { return }
    let value: [String: Any] = ["latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude, "accuracyMeters": location.horizontalAccuracy, "timestampMs": location.timestamp.timeIntervalSince1970 * 1000]
    for observer in Array(observers.values) { observer.fix(value) }
  }
  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    for observer in Array(observers.values) { observer.state("unavailable") }
  }
}
