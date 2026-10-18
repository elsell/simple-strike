import ExpoModulesCore
import MapKit

final class StrikeMapView: ExpoView, MKMapViewDelegate, CLLocationManagerDelegate {
  private let map = MKMapView()
  private var radius = 32186.88
  private var mapCenter = CLLocationCoordinate2D(latitude: 27.95, longitude: -82.46)
  private var annotations: [String: MKPointAnnotation] = [:]
  private var rings: [String: ThunderOverlay] = [:]
  let onExplore = EventDispatcher()
  let onLocation = EventDispatcher()
  let onLocationState = EventDispatcher()
  private let locationManager = CLLocationManager()
  private var locationEnabled = false
  private var explorationActive = false

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    map.delegate = self
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
    map.showsUserLocation = false
    addSubview(map)
    applyRegion()
  }

  func setLocationEnabled(_ enabled: Bool) {
    locationEnabled = enabled
    if enabled { locationManager.requestWhenInUseAuthorization() }
    locationManagerDidChangeAuthorization(locationManager)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateLocationActivity()
  }

  private func updateLocationActivity() {
    let tracking = locationEnabled && window != nil && (locationManager.authorizationStatus == .authorizedWhenInUse || locationManager.authorizationStatus == .authorizedAlways)
    map.showsUserLocation = tracking
    if tracking { locationManager.startUpdatingLocation() }
    else { locationManager.stopUpdatingLocation() }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let state: String
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse: state = "authorized"
    case .denied: state = "denied"
    case .restricted: state = "restricted"
    case .notDetermined: state = "undetermined"
    @unknown default: state = "unavailable"
    }
    onLocationState(["state": state])
    updateLocationActivity()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last, location.horizontalAccuracy >= 0 else { return }
    onLocation(["latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude])
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    onLocationState(["state": "unavailable"])
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    map.frame = bounds
  }

  func updateCenter(_ value: CoordinateRecord) {
    let coordinate = CLLocationCoordinate2D(latitude: value.latitude, longitude: value.longitude)
    guard CLLocationCoordinate2DIsValid(coordinate) else { return }
    guard mapCenter.latitude != coordinate.latitude || mapCenter.longitude != coordinate.longitude else { return }
    mapCenter = coordinate
    map.setCenter(mapCenter, animated: true)
  }

  func updateRadius(_ value: Double) {
    guard value.isFinite, value > 0, value != radius else { return }
    radius = value
    applyRegion()
  }

  private func applyRegion() {
    map.setRegion(MKCoordinateRegion(center: mapCenter, latitudinalMeters: radius * 2, longitudinalMeters: radius * 2), animated: false)
  }

  func updateStrikes(_ values: [StrikeRecord]) {
    let retained = Set(values.map { $0.id })
    for id in Array(annotations.keys) where !retained.contains(id) {
      if let old = annotations.removeValue(forKey: id) { map.removeAnnotation(old) }
    }
    for value in values {
      let coordinate = CLLocationCoordinate2D(latitude: value.latitude, longitude: value.longitude)
      guard !value.id.isEmpty, CLLocationCoordinate2DIsValid(coordinate) else { continue }
      if let existing = annotations[value.id] { existing.coordinate = coordinate }
      else {
        let point = MKPointAnnotation()
        point.coordinate = coordinate
        annotations[value.id] = point
        map.addAnnotation(point)
      }
    }
  }

  func updateRings(_ values: [RingRecord]) {
    let retained = Set(values.map { $0.id })
    for id in Array(rings.keys) where !retained.contains(id) {
      if let overlay = rings.removeValue(forKey: id) { map.removeOverlay(overlay) }
    }
    for value in values {
      let coordinate = CLLocationCoordinate2D(latitude: value.latitude, longitude: value.longitude)
      guard !value.id.isEmpty, CLLocationCoordinate2DIsValid(coordinate), value.radiusMeters.isFinite, value.radiusMeters > 0 else { continue }
      if let existing = rings[value.id], existing.coordinate.latitude == coordinate.latitude, existing.coordinate.longitude == coordinate.longitude {
        existing.style = value
        if let renderer = map.renderer(for: existing) as? ThunderRenderer { renderer.refresh() }
      } else {
        if let old = rings.removeValue(forKey: value.id) { map.removeOverlay(old) }
        let overlay = ThunderOverlay(style: value)
        rings[value.id] = overlay
        map.addOverlay(overlay, level: .aboveRoads)
      }
    }
  }

  func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
    guard let thunder = overlay as? ThunderOverlay else { return MKOverlayRenderer(overlay: overlay) }
    let renderer = ThunderRenderer(overlay: thunder)
    renderer.refresh()
    return renderer
  }

  func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
    guard !(annotation is MKUserLocation) else { return nil }
    let view = mapView.dequeueReusableAnnotationView(withIdentifier: "strike") ?? MKAnnotationView(annotation: annotation, reuseIdentifier: "strike")
    view.annotation = annotation
    view.frame = CGRect(x: 0, y: 0, width: 8, height: 8)
    view.backgroundColor = .systemYellow
    view.layer.cornerRadius = 4
    view.layer.borderWidth = 1
    view.layer.borderColor = UIColor.brown.cgColor
    return view
  }

  func mapView(_ mapView: MKMapView, regionWillChangeAnimated animated: Bool) {
    var interacting = false
    for subview in mapView.subviews {
      for recognizer in subview.gestureRecognizers ?? [] {
        if recognizer.state == .began || recognizer.state == .changed {
          interacting = true
        }
      }
    }
    if interacting {
      explorationActive = true
      onExplore(["latitude": mapView.centerCoordinate.latitude, "longitude": mapView.centerCoordinate.longitude, "radiusMeters": radius])
    }
  }

  func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
    guard explorationActive else { return }
    explorationActive = false
    mapCenter = mapView.centerCoordinate
    let visible = mapView.visibleMapRect
    let visibleRadius = min(visible.size.width, visible.size.height) * MKMetersPerMapPointAtLatitude(mapCenter.latitude) / 2
    if visibleRadius.isFinite && visibleRadius > 0 { radius = visibleRadius }
    onExplore(["latitude": mapCenter.latitude, "longitude": mapCenter.longitude, "radiusMeters": radius])
  }
}

private final class ThunderOverlay: NSObject, MKOverlay {
  var style: RingRecord
  let coordinate: CLLocationCoordinate2D
  let boundingMapRect = MKMapRect.world
  init(style: RingRecord) {
    self.style = style
    coordinate = CLLocationCoordinate2D(latitude: style.latitude, longitude: style.longitude)
    super.init()
  }
}

private final class ThunderRenderer: MKOverlayPathRenderer {
  func refresh() {
    guard let thunder = overlay as? ThunderOverlay else { return }
    strokeColor = UIColor.white.withAlphaComponent(CGFloat(max(0, min(1, thunder.style.opacity))))
    fillColor = UIColor.black.withAlphaComponent(CGFloat(max(0, min(1, thunder.style.fillOpacity))))
    lineWidth = CGFloat(max(0, thunder.style.lineWidth))
    invalidatePath()
    setNeedsDisplay()
  }
  override func createPath() {
    guard let thunder = overlay as? ThunderOverlay else { return }
    let circle = MKCircle(center: thunder.coordinate, radius: thunder.style.radiusMeters)
    path = CGPath(ellipseIn: rect(for: circle.boundingMapRect), transform: nil)
  }
}
