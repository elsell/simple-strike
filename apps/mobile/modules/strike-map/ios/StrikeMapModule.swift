import ExpoModulesCore

public class StrikeMapModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StrikeMap")
    AsyncFunction("calculateDrivingRoute") { (origin: CoordinateRecord, destination: CoordinateRecord) async throws -> [String: Any] in
      return try await MapKitRoutes.calculate(origin: origin, destination: destination)
    }
    View(StrikeMapView.self) {
      Events("onExplore", "onLocation", "onLocationState")
      Prop("locationEnabled") { (view: StrikeMapView, value: Bool) in view.setLocationEnabled(value) }
      Prop("center") { (view: StrikeMapView, value: CoordinateRecord) in view.updateCenter(value) }
      Prop("radiusMeters") { (view: StrikeMapView, value: Double) in view.updateRadius(value) }
      Prop("strikes") { (view: StrikeMapView, value: [StrikeRecord]) in view.updateStrikes(value) }
      Prop("rings") { (view: StrikeMapView, value: [RingRecord]) in view.updateRings(value) }
    }
  }
}
struct CoordinateRecord: Record {
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
}
struct StrikeRecord: Record {
  @Field var id: String = ""
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
}
struct RingRecord: Record {
  @Field var id: String = ""
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
  @Field var radiusMeters: Double = 0
  @Field var opacity: Double = 0
  @Field var lineWidth: Double = 1
  @Field var fillOpacity: Double = 0
}
