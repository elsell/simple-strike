import ExpoModulesCore

public class StrikeMapModule: Module {
  private let speech = NavigationSpeech()
  private let carOwner = UUID()
  private var locationGeneration = 0
  public func definition() -> ModuleDefinition {
    Name("StrikeMap")
    Events("carPlayCommand", "carPlayActivity", "navigationLocation", "navigationLocationState")
    OnCreate {
      DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        CarPlayBridge.shared.attach(owner: self.carOwner) { [weak self] event, values in
          self?.sendEvent(event, values)
        }
      }
    }
    OnDestroy {
      let owner = self.carOwner
      DispatchQueue.main.async {
        CarPlayBridge.shared.detach(owner: owner)
        LocationSource.shared.remove(owner)
      }
    }
    AsyncFunction("beginNavigationLocation") { () -> Int in
      self.locationGeneration += 1
      LocationSource.shared.navigation(self.carOwner,
        fix: { [weak self] value in self?.sendEvent("navigationLocation", value) },
        state: { [weak self] value in self?.sendEvent("navigationLocationState", ["state": value]) })
      return self.locationGeneration
    }.runOnQueue(.main)
    AsyncFunction("endNavigationLocation") { (generation: Int) in
      if generation == self.locationGeneration { LocationSource.shared.remove(self.carOwner) }
    }.runOnQueue(.main)
    AsyncFunction("beginCarPresentation") { () -> Int in
      CarPlayBridge.shared.beginSession()
    }.runOnQueue(.main)
    AsyncFunction("publishCarPresentation") { (generation: Int, snapshot: CarPlaySnapshotRecord) in
      CarPlayBridge.shared.publish(snapshot, generation: generation)
    }.runOnQueue(.main)
    AsyncFunction("endCarPresentation") { (generation: Int) in
      CarPlayBridge.shared.endSession(generation: generation)
    }.runOnQueue(.main)
    AsyncFunction("carPlayIsActive") { () -> Bool in
      CarPlayBridge.shared.active
    }.runOnQueue(.main)
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
