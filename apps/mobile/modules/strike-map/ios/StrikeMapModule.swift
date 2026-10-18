import ExpoModulesCore

public class StrikeMapModule: Module {
  private let speech = NavigationSpeech()
  public func definition() -> ModuleDefinition {
    Name("StrikeMap")
    AsyncFunction("speakInstruction") { (text: String, language: String) in
      try self.speech.speak(text, language: language)
    }.runOnQueue(.main)
    AsyncFunction("stopInstructions") {
      self.speech.stop()
    }.runOnQueue(.main)
    AsyncFunction("calculateDrivingRoute") { (origin: CoordinateRecord, destination: CoordinateRecord) async throws -> [String: Any] in
      return try await MapKitRoutes.calculate(origin: origin, destination: destination)
    }
    AsyncFunction("searchPlaces") { (query: String, near: CoordinateRecord) async throws -> [[String: Any]] in
      return try await MapKitRoutes.search(query: query, near: near)
    }
    View(StrikeMapView.self) {
      Events("onExplore", "onLocation", "onLocationState")
      Prop("locationEnabled") { (view: StrikeMapView, value: Bool) in view.setLocationEnabled(value) }
      Prop("center") { (view: StrikeMapView, value: CoordinateRecord) in view.updateCenter(value) }
      Prop("radiusMeters") { (view: StrikeMapView, value: Double) in view.updateRadius(value) }
      Prop("strikes") { (view: StrikeMapView, value: [StrikeRecord]) in view.updateStrikes(value) }
      Prop("route") { (view: StrikeMapView, value: [CoordinateRecord]) in view.updateRoute(value) }
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
