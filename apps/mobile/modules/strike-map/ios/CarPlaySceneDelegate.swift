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
    // Install a root synchronously during connection, before saved state is available.
    interfaceController.setRootTemplate(CPListTemplate(title: "Simple Strike", sections: []), animated: false) { _, _ in }
    bridge.observe(observerID) { [weak self] snapshot in self?.render(snapshot) }
  }

  public func templateApplicationScene(_ scene: CPTemplateApplicationScene, didDisconnect interfaceController: CPInterfaceController, from window: CPWindow) {
    bridge.removeObserver(observerID)
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
    authorized = nil
    lastLabels = [:]
  }

  public func sceneDidBecomeActive(_ scene: UIScene) {
    sceneActive = true
    bridge.setActive(true)
    map?.setLocationEnabled(bridge.snapshot.authorized)
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
    guard snapshot.authorized else { template.leadingNavigationBarButtons = []; return }
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

  private func render(_ snapshot: CarPlaySnapshotRecord) {
    guard let controller, let map, let mapTemplate else { return }
    map.setLocationEnabled(sceneActive && snapshot.authorized)
    map.updateStrikes(snapshot.strikes)
    map.updateRings(snapshot.rings)
    map.updateRoute(snapshot.route)
    map.updateCenter(snapshot.center)
    map.updateRadius(snapshot.radiusMeters)
    for button in mapTemplate.mapButtons { button.isEnabled = snapshot.authorized }
    let authorizationChanged = authorized != snapshot.authorized
    guard authorizationChanged || lastLabels != snapshot.labels else { return }
    authorized = snapshot.authorized
    lastLabels = snapshot.labels
    updateBarButtons(snapshot)
    if snapshot.authorized {
      if authorizationChanged { controller.setRootTemplate(mapTemplate, animated: false) { _, _ in } }
    } else {
      let sections: [CPListSection]
      if let message = snapshot.labels["phoneSignIn"] {
        let item = CPListItem(text: message, detailText: nil)
        item.isEnabled = false
        sections = [CPListSection(items: [item])]
      } else { sections = [] }
      controller.setRootTemplate(CPListTemplate(title: "Simple Strike", sections: sections), animated: false) { _, _ in }
    }
  }

  public func mapTemplate(_ mapTemplate: CPMapTemplate, panWith direction: CPMapTemplate.PanDirection) {
    guard bridge.snapshot.authorized else { return }
    let horizontal = (direction.contains(.right) ? 0.15 : 0) - (direction.contains(.left) ? 0.15 : 0)
    let vertical = (direction.contains(.down) ? 0.15 : 0) - (direction.contains(.up) ? 0.15 : 0)
    map?.pan(horizontal: horizontal, vertical: vertical)
  }

  public func mapTemplateDidBeginPanGesture(_ mapTemplate: CPMapTemplate) { previousTranslation = .zero }

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
