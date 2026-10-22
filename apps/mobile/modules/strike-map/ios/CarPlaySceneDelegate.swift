import CarPlay
import UIKit

/// CarPlay owns templates and a map surface. Application commands stay in the shared runtime.
@objc(SimpleStrikeCarPlaySceneDelegate)
public final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate, CPMapTemplateDelegate {
  private let observerID = UUID()
  private let bridge = CarPlayBridge.shared
  private var controller: CPInterfaceController?
  private var map: StrikeMapView?
  private var mapTemplate: CPMapTemplate?
  private var authorized: Bool?
  private var sceneActive = false
  private var previousTranslation = CGPoint.zero
  private var lastLabels: [String: String] = [:]
  private var search: CarPlaySearch?
  private var guidance: CarPlayGuidance?
  private var lastGuidancePhase = ""
  private var lastRouteID = ""
  private var lastRetry = false
  private var lastError = ""
  private var errorAlert: CPAlertTemplate?

  public func templateApplicationScene(_ scene: CPTemplateApplicationScene, didConnect interfaceController: CPInterfaceController, to window: CPWindow) {
    bridge.startRuntime?()
    controller = interfaceController
    let view = StrikeMapView(appContext: nil)
    view.nativeLocation = { [weak self] value in self?.bridge.command("location", values: value) }
    view.nativeLocationState = { [weak self] state in self?.bridge.command("locationState", values: ["state": state]) }
    view.nativeExplore = { [weak self] value in self?.bridge.command("pan", values: value) }
    map = view
    let root = UIViewController()
    root.view = view
    window.rootViewController = root
    let template = CPMapTemplate()
    template.mapDelegate = self
    template.mapButtons = [
      button("plus", command: "zoomIn"),
      button("minus", command: "zoomOut"),
      button("location.fill", command: "recenter"),
    ]
    mapTemplate = template
    guidance = CarPlayGuidance(template: template)
    // Install a root synchronously during connection, before saved state is available.
    interfaceController.setRootTemplate(template, animated: false) { _, _ in }
    bridge.observe(observerID) { [weak self] snapshot in self?.render(snapshot) }
  }

  public func templateApplicationScene(_ scene: CPTemplateApplicationScene, didDisconnect interfaceController: CPInterfaceController, from window: CPWindow) {
    bridge.removeObserver(observerID)
    search?.cancel()
    search = nil
    guidance?.clear()
    guidance = nil
    sceneActive = false
    bridge.setActive(false)
    map?.setLocationEnabled(false)
    map?.nativeLocation = nil
    map?.nativeLocationState = nil
    map?.nativeExplore = nil
    window.rootViewController = nil
    mapTemplate?.mapDelegate = nil
    controller = nil
    map = nil
    mapTemplate = nil
    errorAlert = nil
    lastError = ""
    lastRetry = false
    authorized = nil
    lastLabels = [:]
    lastGuidancePhase = ""
    lastRouteID = ""
  }

  public func sceneDidBecomeActive(_ scene: UIScene) {
    sceneActive = true
    bridge.setActive(true)
    render(bridge.snapshot)
  }

  public func sceneWillResignActive(_ scene: UIScene) {
    sceneActive = false
    map?.setLocationEnabled(false)
    bridge.setActive(false)
  }

  private func button(_ symbol: String, command: String) -> CPMapButton {
    let result = CPMapButton { [weak self] _ in self?.bridge.command(command) }
    result.image = UIImage(systemName: symbol)
    return result
  }

  private func updateBarButtons(_ snapshot: CarPlaySnapshotRecord) {
    guard let template = mapTemplate else { return }
    guard snapshot.authorized else {
      template.leadingNavigationBarButtons = []
      template.trailingNavigationBarButtons = []
      return
    }
    var buttons: [CPBarButton] = []
    if let source = snapshot.labels["source"] {
      buttons.append(CPBarButton(title: source) { [weak self] _ in self?.showStatus() })
    }
    if let pan = snapshot.labels["pan"] {
      buttons.append(CPBarButton(title: pan) { [weak self, weak template] _ in
        guard self?.bridge.snapshot.authorized == true else { return }
        template?.showPanningInterface(animated: true)
      })
    }
    template.leadingNavigationBarButtons = buttons
    if !snapshot.routeId.isEmpty, let end = snapshot.labels["end"] {
      var actions = [CPBarButton(title: end) { [weak self] _ in self?.bridge.command("endRoute") }]
      if snapshot.navigationRetry, let retry = snapshot.labels["retry"] {
        actions.append(CPBarButton(title: retry) { [weak self] _ in self?.bridge.command("retryRoute") })
      }
      template.trailingNavigationBarButtons = actions
    } else if let navigate = snapshot.labels["navigate"] {
      template.trailingNavigationBarButtons = [CPBarButton(title: navigate) { [weak self] _ in self?.showSearch() }]
    }
  }

  private func showSearch() {
    guard bridge.snapshot.authorized else { return }
    search?.cancel()
    let next = CarPlaySearch(bridge: bridge) { [weak self] in
      self?.controller?.popToRootTemplate(animated: true) { _, _ in }
    }
    search = next
    controller?.pushTemplate(next.template, animated: true) { [weak self, weak next] success, _ in
      if !success, self?.search === next { next?.cancel(); self?.search = nil }
    }
  }

  private func showStatus() {
    let snapshot = bridge.snapshot
    guard snapshot.authorized else { return }
    let messages = [snapshot.closestText, snapshot.labels["estimatedThunder"] ?? ""]
    let items = messages.filter { !$0.isEmpty }.map { message in
      let item = CPListItem(text: message, detailText: nil)
      item.isEnabled = false
      return item
    }
    let status = CPListTemplate(title: snapshot.labels["source"], sections: [CPListSection(items: items)])
    controller?.pushTemplate(status, animated: true) { _, _ in }
  }

  private func renderError(_ snapshot: CarPlaySnapshotRecord) {
    guard let controller else { return }
    if !snapshot.authorized || snapshot.navigationError.isEmpty {
      lastError = ""
      if let alert = errorAlert, controller.presentedTemplate === alert {
        controller.dismissTemplate(animated: false) { _, _ in }
      }
      errorAlert = nil
      return
    }
    guard sceneActive, snapshot.navigationError != lastError,
          controller.presentedTemplate == nil, let close = snapshot.labels["close"] else { return }
    lastError = snapshot.navigationError
    let action = CPAlertAction(title: close, style: .cancel) { [weak self, weak controller] _ in
      controller?.dismissTemplate(animated: true) { _, _ in }
      self?.errorAlert = nil
    }
    let alert = CPAlertTemplate(titleVariants: [snapshot.navigationError], actions: [action])
    errorAlert = alert
    controller.presentTemplate(alert, animated: true) { [weak self, weak alert] success, _ in
      if !success, self?.errorAlert === alert { self?.errorAlert = nil }
    }
  }

  private func render(_ snapshot: CarPlaySnapshotRecord) {
    guard let controller, let map, let mapTemplate else { return }
    map.setLocationEnabled(sceneActive && snapshot.authorized)
    map.updateStrikes(snapshot.strikes)
    map.updateRings(snapshot.rings)
    map.updateRoute(snapshot.route)
    map.updateCenter(snapshot.center)
    map.updateRadius(snapshot.radiusMeters)
    guidance?.render(snapshot)
    renderError(snapshot)
    for button in mapTemplate.mapButtons { button.isEnabled = snapshot.authorized }
    let authorizationChanged = authorized != snapshot.authorized
    guard authorizationChanged || lastLabels != snapshot.labels || lastGuidancePhase != snapshot.guidancePhase || lastRouteID != snapshot.routeId || lastRetry != snapshot.navigationRetry else { return }
    authorized = snapshot.authorized
    lastLabels = snapshot.labels
    lastGuidancePhase = snapshot.guidancePhase
    lastRouteID = snapshot.routeId
    lastRetry = snapshot.navigationRetry
    updateBarButtons(snapshot)
    if snapshot.authorized {
      if authorizationChanged { controller.setRootTemplate(mapTemplate, animated: false) { _, _ in } }
    } else {
      search?.cancel()
      search = nil
      let sections: [CPListSection]
      if let message = snapshot.labels["phoneSignIn"] {
        let item = CPListItem(text: message, detailText: nil)
        item.isEnabled = false
        sections = [CPListSection(items: [item])]
      } else { sections = [] }
      let setup = CPListTemplate(title: "Simple Strike", sections: sections)
      controller.setRootTemplate(mapTemplate, animated: false) { [weak self, weak controller] success, _ in
        guard success, let self, let controller, self.controller === controller, !self.bridge.snapshot.authorized else { return }
        controller.pushTemplate(setup, animated: false) { _, _ in }
      }
    }
  }

  public func mapTemplate(_ mapTemplate: CPMapTemplate, panWith direction: CPMapTemplate.PanDirection) {
    guard bridge.snapshot.authorized else { return }
    let horizontal = (direction.contains(.right) ? 0.15 : 0) - (direction.contains(.left) ? 0.15 : 0)
    let vertical = (direction.contains(.down) ? 0.15 : 0) - (direction.contains(.up) ? 0.15 : 0)
    map?.pan(horizontal: horizontal, vertical: vertical)
  }

  public func mapTemplateDidBeginPanGesture(_ mapTemplate: CPMapTemplate) { previousTranslation = .zero }

  public func mapTemplate(_ mapTemplate: CPMapTemplate, startedTrip trip: CPTrip, using routeChoice: CPRouteChoice) {
    bridge.command("startRoute")
  }

  public func mapTemplateDidCancelNavigation(_ mapTemplate: CPMapTemplate) {
    if guidance?.applying != true { bridge.command("endRoute") }
  }

  public func mapTemplateDidShowPanningInterface(_ mapTemplate: CPMapTemplate) {
    guard let close = bridge.snapshot.labels["close"] else { return }
    mapTemplate.leadingNavigationBarButtons = [CPBarButton(title: close) { [weak mapTemplate] _ in
      mapTemplate?.dismissPanningInterface(animated: true)
    }]
  }

  public func mapTemplateDidDismissPanningInterface(_ mapTemplate: CPMapTemplate) { updateBarButtons(bridge.snapshot) }

  public func mapTemplate(_ mapTemplate: CPMapTemplate, didUpdatePanGestureWithTranslation translation: CGPoint, velocity: CGPoint) {
    guard bridge.snapshot.authorized, let map, map.bounds.width > 0, map.bounds.height > 0 else { return }
    let delta = CGPoint(x: translation.x - previousTranslation.x, y: translation.y - previousTranslation.y)
    previousTranslation = translation
    map.pan(horizontal: -Double(delta.x / map.bounds.width), vertical: -Double(delta.y / map.bounds.height))
  }
}
