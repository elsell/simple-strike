const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const { transformAppDelegate, sceneManifest } = require('./carplay-config.cjs');
const fixture = readFileSync(`${__dirname}/fixtures/AppDelegate.swift`, 'utf8');

test('scene conversion retains URL handlers and builds one shared root on demand', () => {
  const result = transformAppDelegate(fixture);
  assert.ok(!result.includes('factory.startReactNative('));
  assert.equal((result.match(/rootViewFactory\.view\(/g) ?? []).length, 1);
  assert.ok(result.includes('if let root = sharedRoot { return root }'));
  assert.ok(result.includes('CarPlayBridge.shared.startRuntime'));
  assert.ok(result.includes('UIWindow(windowScene: windowScene)'));
  assert.ok(result.includes('app.ensureRuntime(launchOptions: options)'));
  assert.ok(result.includes('openURLContexts URLContexts'));
  assert.ok(result.includes('continue userActivity: NSUserActivity'));
  const originalLinks = fixture.slice(fixture.indexOf('  // Linking API'), fixture.indexOf('\nclass ReactNativeDelegate'));
  assert.ok(result.includes(originalLinks));
  assert.equal(transformAppDelegate(result), result);
});

test('an unexpected generated startup fails instead of creating a second runtime', () => {
  assert.throws(() => transformAppDelegate(fixture.replace('factory.startReactNative(', 'factory.startSomethingElse(')), /startup/);
  assert.throws(() => transformAppDelegate(fixture + fixture), /exactly once/);
});

test('manifest registers both phone and navigation scenes without multiple phone windows', () => {
  const result = sceneManifest();
  assert.equal(result.UIApplicationSupportsMultipleScenes, false);
  const scenes = result.UISceneConfigurations;
  assert.equal(scenes.UIWindowSceneSessionRoleApplication[0].UISceneDelegateClassName, 'SimpleStrikePhoneSceneDelegate');
  assert.equal(scenes.CPTemplateApplicationSceneSessionRoleApplication[0].UISceneDelegateClassName, 'SimpleStrikeCarPlaySceneDelegate');
  assert.equal(scenes.CPTemplateApplicationSceneSessionRoleApplication[0].UISceneClassName, 'CPTemplateApplicationScene');
});
