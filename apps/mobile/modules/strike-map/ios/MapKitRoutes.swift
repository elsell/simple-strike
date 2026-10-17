import MapKit

/// Framework adapter only. Guidance state and presentation are separate concerns.
enum MapKitRoutes {
  enum Failure: Error { case invalidCoordinate; case noRoute }

  static func calculate(origin: CoordinateRecord, destination: CoordinateRecord) async throws -> [String: Any] {
    let from = CLLocationCoordinate2D(latitude: origin.latitude, longitude: origin.longitude)
    let to = CLLocationCoordinate2D(latitude: destination.latitude, longitude: destination.longitude)
    guard CLLocationCoordinate2DIsValid(from), CLLocationCoordinate2DIsValid(to) else { throw Failure.invalidCoordinate }
    let request = MKDirections.Request()
    request.source = MKMapItem(placemark: MKPlacemark(coordinate: from))
    request.destination = MKMapItem(placemark: MKPlacemark(coordinate: to))
    request.transportType = .automobile
    request.requestsAlternateRoutes = false
    let directions = MKDirections(request: request)
    let response = try await directions.calculate()
    guard let route = response.routes.first else { throw Failure.noRoute }
    return [
      "id": UUID().uuidString,
      "distanceMeters": route.distance,
      "expectedTravelSeconds": route.expectedTravelTime,
      "coordinates": coordinates(route.polyline),
      "steps": route.steps.map { step in
        return ["instructions": step.instructions, "distanceMeters": step.distance, "coordinates": coordinates(step.polyline)] as [String: Any]
      }
    ]
  }

  private static func coordinates(_ line: MKPolyline) -> [[String: Double]] {
    var values = Array(repeating: CLLocationCoordinate2D(), count: line.pointCount)
    line.getCoordinates(&values, range: NSRange(location: 0, length: values.count))
    return values.map { ["latitude": $0.latitude, "longitude": $0.longitude] }
  }
}
