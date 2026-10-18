  private var initialLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?
  private var sharedRoot: UIViewController?
  var runtimeStarted: Bool { sharedRoot != nil }

  func ensureRuntime(launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]) -> UIViewController {
    if let root = sharedRoot { return root }
    guard let factory = reactNativeFactory else { preconditionFailure("react_factory_not_initialized") }
    let options = (initialLaunchOptions ?? [:]).merging(launchOptions) { _, incoming in incoming }
    let view = factory.rootViewFactory.view(withModuleName: "main", initialProperties: nil, launchOptions: options)
    view.frame = UIScreen.main.bounds
    let root = UIViewController()
    root.view = view
    sharedRoot = root
    return root
  }
