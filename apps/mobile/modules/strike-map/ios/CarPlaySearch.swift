import CarPlay

/// Template search uses the same native MapKit adapter as the phone.
/// Route selection returns to the shared application controller.
final class CarPlaySearch: NSObject, CPSearchTemplateDelegate {
  let template = CPSearchTemplate()
  private let bridge: CarPlayBridge
  private let selected: () -> Void
  private var work: Task<Void, Never>?
  private var completion: (([CPListItem]) -> Void)?
  private var generation = 0

  init(bridge: CarPlayBridge, selected: @escaping () -> Void) {
    self.bridge = bridge
    self.selected = selected
    super.init()
    template.delegate = self
  }

  func cancel() {
    generation += 1
    work?.cancel()
    work = nil
    let finish = completion
    completion = nil
    finish?([])
  }

  func searchTemplate(_ searchTemplate: CPSearchTemplate, updatedSearchText searchText: String, completionHandler: @escaping ([CPListItem]) -> Void) {
    cancel()
    guard bridge.snapshot.authorized, !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      completionHandler([])
      return
    }
    completion = completionHandler
    let candidate = generation
    let center = bridge.snapshot.center
    work = Task { @MainActor [weak self] in
      do {
        try await Task.sleep(nanoseconds: 300_000_000)
        let places = try await MapKitRoutes.search(query: searchText, near: center)
        guard let self, !Task.isCancelled, candidate == self.generation, self.bridge.snapshot.authorized else { return }
        let items = places.map { place in
          let item = CPListItem(text: place["name"] as? String, detailText: nil)
          item.userInfo = place
          return item
        }
        self.finish(items.isEmpty ? self.message("noResults") : items)
      } catch {
        guard let self, candidate == self.generation else { return }
        self.finish(self.message("searchFailed"))
      }
    }
  }

  private func message(_ key: String) -> [CPListItem] {
    guard let text = bridge.snapshot.labels[key] else { return [] }
    let item = CPListItem(text: text, detailText: nil)
    item.isEnabled = false
    return [item]
  }

  private func finish(_ items: [CPListItem]) {
    let callback = completion
    completion = nil
    work = nil
    callback?(items)
  }

  func searchTemplate(_ searchTemplate: CPSearchTemplate, selectedResult item: CPListItem, completionHandler: @escaping () -> Void) {
    defer { completionHandler() }
    guard bridge.snapshot.authorized, let place = item.userInfo as? [String: Any] else { return }
    cancel()
    bridge.command("select", values: place)
    selected()
  }
}
