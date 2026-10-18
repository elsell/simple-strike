const { withAppDelegate, withInfoPlist, withEntitlementsPlist } = require('expo/config-plugins');
const { transformAppDelegate, sceneManifest } = require('./carplay-config.cjs');

module.exports = function withCarPlay(config) {
  config = withAppDelegate(config, next => {
    if (next.modResults.language !== 'swift') throw new Error('CarPlay requires the Swift application delegate');
    next.modResults.contents = transformAppDelegate(next.modResults.contents);
    return next;
  });
  config = withInfoPlist(config, next => {
    next.modResults.UIApplicationSceneManifest = sceneManifest();
    return next;
  });
  return withEntitlementsPlist(config, next => {
    // Signing still requires the navigation capability granted by Apple.
    next.modResults['com.apple.developer.carplay-maps'] = true;
    return next;
  });
};
