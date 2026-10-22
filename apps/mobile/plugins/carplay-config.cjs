const { readFileSync } = require('node:fs');
const marker = '// Simple Strike shared scene runtime';
const startup = `    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)`;

function replaceOnce(source, before, after, name) {
  if (source.split(before).length !== 2) throw new Error(`CarPlay ${name} must occur exactly once`);
  return source.replace(before, after);
}
function transformAppDelegate(source) {
  if (source.includes(marker)) return source;
  let result = replaceOnce(source, startup, `    initialLaunchOptions = launchOptions
    CarPlayBridge.shared.startRuntime = { [weak self] in _ = self?.ensureRuntime() }`, 'startup');
  result = replaceOnce(result, 'import ReactAppDependencyProvider', 'import ReactAppDependencyProvider\ninternal import StrikeMap', 'imports');
  const runtime = readFileSync(`${__dirname}/shared-runtime.swift`, 'utf8');
  result = replaceOnce(result, '  var window: UIWindow?', `  var window: UIWindow?\n${marker}\n${runtime}`, 'application delegate');
  return `${result}\n${readFileSync(`${__dirname}/phone-scene.swift`, 'utf8')}`;
}
function sceneManifest() {
  return {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [{
        UISceneConfigurationName: 'Phone',
        UISceneDelegateClassName: 'SimpleStrikePhoneSceneDelegate',
      }],
      CPTemplateApplicationSceneSessionRoleApplication: [{
        UISceneConfigurationName: 'CarPlay',
        UISceneClassName: 'CPTemplateApplicationScene',
        UISceneDelegateClassName: 'SimpleStrikeCarPlaySceneDelegate',
      }],
    },
  };
}
module.exports = { transformAppDelegate, sceneManifest };
