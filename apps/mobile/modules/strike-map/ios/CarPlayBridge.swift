import ExpoModulesCore

/// In-memory presentation boundary. No identity or provider credentials cross it.
public final class CarPlayBridge {
  public static let shared = CarPlayBridge()
  public var startRuntime: (() -> Void)?
  var snapshot = CarPlaySnapshotRecord()
  var active = false
  private var snapshotObservers: [UUID: (CarPlaySnapshotRecord) -> Void] = [:]
  var emit: ((String, [String: Any]) -> Void)?
  private var owner: UUID?
  private var generation = 0
  private var sessionOpen = false
  private init() {}

  func observe(_ id: UUID, receive: @escaping (CarPlaySnapshotRecord) -> Void) {
    snapshotObservers[id] = receive
    receive(snapshot)
  }

  func removeObserver(_ id: UUID) { snapshotObservers.removeValue(forKey: id) }

  func attach(owner: UUID, emit: @escaping (String, [String: Any]) -> Void) {
    self.owner = owner
    self.emit = emit
    generation += 1
    sessionOpen = false
    clear()
  }

  func detach(owner: UUID) {
    guard self.owner == owner else { return }
    self.owner = nil
    emit = nil
    generation += 1
    sessionOpen = false
    clear()
  }

  func beginSession() -> Int {
    generation += 1
    sessionOpen = true
    clear()
    return generation
  }

  func publish(_ value: CarPlaySnapshotRecord, generation candidate: Int) {
    guard sessionOpen, candidate == generation else { return }
    apply(value)
  }

  func endSession(generation candidate: Int) {
    guard candidate == generation else { return }
    sessionOpen = false
    generation += 1
    clear()
  }

  private func apply(_ value: CarPlaySnapshotRecord) {
    var safe = value
    if !safe.authorized {
      safe = CarPlaySnapshotRecord()
      safe.labels = value.labels
    }
    snapshot = safe
    for observer in Array(snapshotObservers.values) { observer(safe) }
  }

  func setActive(_ value: Bool) {
    active = value
    emit?("carPlayActivity", ["active": value])
  }

  func command(_ name: String, values: [String: Any] = [:]) {
    guard snapshot.authorized else { return }
    emit?("carPlayCommand", ["name": name, "values": values])
  }

  private func clear() {
    var empty = CarPlaySnapshotRecord()
    empty.labels = snapshot.labels
    apply(empty)
  }
}

struct CarPlaySnapshotRecord: Record {
  @Field var authorized: Bool = false
  @Field var labels: [String: String] = [:]
  @Field var vehicleAvailable: Bool = false
  @Field var vehicle: CoordinateRecord = CoordinateRecord()
  @Field var center: CoordinateRecord = CoordinateRecord()
  @Field var radiusMeters: Double = 32186.88
  @Field var strikes: [StrikeRecord] = []
  @Field var rings: [RingRecord] = []
  @Field var route: [CoordinateRecord] = []
  @Field var routeId: String = ""
  @Field var routeSummary: String = ""
  @Field var maneuverDistanceMeters: Double = 0
  @Field var instructionId: String = ""
  @Field var navigationError: String = ""
  @Field var navigationRetry: Bool = false
  @Field var guidanceStatus: String = ""
  @Field var guidancePhase: String = "idle"
  @Field var destinationName: String = ""
  @Field var instruction: String = ""
  @Field var distanceRemainingMeters: Double = 0
  @Field var expectedTravelSeconds: Double = 0
  @Field var sourceMode: String = ""
  @Field var closestText: String = ""
}
