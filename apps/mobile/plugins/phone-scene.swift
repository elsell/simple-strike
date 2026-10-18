@objc(SimpleStrikePhoneSceneDelegate)
final class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene,
          let app = UIApplication.shared.delegate as? AppDelegate else { return }
    let alreadyStarted = app.runtimeStarted
    var options: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let context = connectionOptions.urlContexts.first { options[.url] = context.url }
    if let activity = connectionOptions.userActivities.first {
      options[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }
    let phoneWindow = UIWindow(windowScene: windowScene)
    phoneWindow.rootViewController = app.ensureRuntime(launchOptions: options)
    window = phoneWindow
    app.window = phoneWindow
    phoneWindow.makeKeyAndVisible()
    if alreadyStarted {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
      for activity in connectionOptions.userActivities { self.scene(scene, continue: activity) }
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let app = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
      if let source = context.options.sourceApplication { options[.sourceApplication] = source }
      if let annotation = context.options.annotation { options[.annotation] = annotation }
      _ = app.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let app = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = app.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    // The shared controller remains alive for CarPlay and later phone attachment.
    window?.rootViewController = nil
    if let app = UIApplication.shared.delegate as? AppDelegate, app.window === window { app.window = nil }
    window = nil
  }
}
