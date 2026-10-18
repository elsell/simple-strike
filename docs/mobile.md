# Native mobile development and delivery

The generated Expo application targets iOS and Android. Its checks intentionally
separate JavaScript export, native project generation, native compilation, a
development client, and a signed store build.

## First development build

Run `make dev`, then create and launch an unsigned development client in another
terminal:

```sh
make mobile-dev-ios      # macOS with Xcode
make mobile-dev-android  # macOS or Linux with Android Studio/SDK
```

The app includes `expo-dev-client`. Later JavaScript-only changes can normally use
`make mobile`, which starts Metro for that installed client. Expo Go is not a
supported authentication target because it does not reliably own the generated
custom callback scheme.

`apps/mobile/eas.json` defines an internal `development` profile. EAS is optional;
local `expo run:ios` and `expo run:android` remain first-class paths. If you use
EAS, use the locked `eas-cli 21.0.2` tooling workspace through the checked package
scripts rather than a floating global CLI or `pnpm dlx`.
The wrapper verifies that EAS runs from `apps/mobile`, so it discovers this
application's `app.json` and `eas.json`.

## Device-reachable development URLs

The root `.env` is loaded by the Make targets. Set all three values together:

```sh
SIMPLE_STRIKE_API_URL=http://localhost:8080
SIMPLE_STRIKE_OIDC_ISSUER=http://localhost:5556/dex
SIMPLE_STRIKE_MOBILE_OIDC_CLIENT_ID=simple-strike-mobile
```

- An iOS simulator normally reaches host services through `localhost`.
- The Android emulator normally uses `10.0.2.2` instead of `localhost`.
- A physical device needs the development computer's LAN address and services
  intentionally bound to that interface. Never expose bundled development
  credentials on an untrusted network.

Register `simplestrike://callback` on the provider's public native client.
Validation proves this scheme, the iOS bundle identifier, and Android package
share the same generated native identity. When changing a LAN issuer, change the
provider issuer and API issuer together. Plain HTTP is development-only.

## What each check proves

```sh
make mobile-validate       # Expo Doctor, dependency compatibility, config identity
make mobile-export         # iOS and Android Metro/Expo bundles only
make mobile-prebuild       # clean generated iOS and Android native projects
make mobile-build-android  # unsigned Android debug APK through Gradle
make mobile-build-ios      # unsigned iOS simulator app through Xcode
```

Bundle export is useful but is not a native build. Generated CI compiles Android
on Linux. Affected pull requests and main-branch changes compile iOS on macOS without
signing access. Native compilation is separate from signed device acceptance.

## Release configuration

Before the first store build:

1. Replace the neutral files under `apps/mobile/assets/` with product artwork.
2. Set `expo.version`, `ios.buildNumber`, and `android.versionCode` deliberately.
3. Review every native permission emitted by clean prebuild. Add only permissions
   justified by a product spec and store disclosure.
4. Decide whether to enable Expo Updates. It is disabled by default; runtime
   version follows application version for an explicit compatibility boundary.
5. Configure production HTTPS endpoints, callback URIs, Expo ownership, store
   metadata, signing credentials, and access controls outside Git. Never commit
   signing keys or provider client secrets.

The guarded commands refuse missing, local, or non-HTTPS production endpoints:

```sh
make mobile-release-ios
make mobile-release-android
```

These invoke the checked production EAS profile. Store publication is not
automatic; review and submit signed artifacts deliberately.
The Expo SDK 55 profile selects the reviewed
`ubuntu-24.04-jdk-17-ndk-r27b-sdk-55` Android image and
`macos-sequoia-15.6-xcode-26.2` iOS image. Local iOS builds install the exact
CocoaPods 1.16.2 graph from `Gemfile.lock`; hosted iOS CI selects Ruby 3.4 and the Android job pins the
JDK patch. The dependency-age and OSV gates inspect every locked Ruby
gem, and `make-app doctor` checks the Ruby/Bundler versions used by local builds.
Hosted iOS compilation uses GitHub's `macos-26` runner to satisfy Expo SDK 55's
Xcode 26 requirement.

The production profile selects the EAS environment named `production`. Configure
`SIMPLE_STRIKE_API_URL`, `SIMPLE_STRIKE_OIDC_ISSUER`, and
`SIMPLE_STRIKE_MOBILE_OIDC_CLIENT_ID` in that EAS environment before building. They are
public application configuration, not secrets, but the API and issuer must use
HTTPS. The generated application sets `SIMPLE_STRIKE_APP_ENV=production` in the
profile and deliberately fails bundling if any production endpoint is absent;
it cannot silently fall back to localhost.

## Session behavior

Native sessions live in platform secure storage. The shared state machine
distinguishes authenticated online, authenticated temporarily offline,
authentication required, and unreadable local storage. Network loss, rate limits,
and server outages retain an otherwise valid credential. Expiry, explicit 401
rejection, revocation, or malformed secure storage removes it. Product-specific
offline data and mutation synchronization remain application concerns. Cold
launch reads secure storage before OIDC discovery succeeds, so an existing valid
application session can enter offline mode without provider connectivity.

## Simple Strike iOS and CarPlay verification

Simple Strike uses a local Expo module under `apps/mobile/modules/strike-map`.
It exposes MapKit map rendering, location events, and driving-route calculation.
After native source changes, rebuild the development client. A Metro reload does
not compile Swift changes. The module is not available in Expo Go.

The signed-in iOS screen now mounts the map and reads the authenticated feed.
It includes location following, zoom and recenter, estimated thunder rings, and
closest-strike information. Disconnected observations expire at five minutes.
This integration still requires native simulator and device verification.
Complete route guidance and the CarPlay scene remain unfinished. MapKit route
calculation alone does not provide verified turn-by-turn navigation. Do not
describe the current adapter as a finished CarPlay app.

### Demo map acceptance on an iOS simulator

Run this procedure on macOS against an isolated local demo deployment. Record the
Git revision and simulator/iOS version with the results. These steps are a test
procedure, not evidence that the checks have passed.

1. Configure the root `.env` with the local API and issuer URLs above. Start the
   demo stack with `docker compose -f compose.yaml -f compose.demo.yaml up -d --build`.
2. Run `make mobile-dev-ios`. Sign in through the browser with the published Dex
   demo account (`demo@example.com`, password `password`). Confirm the callback
   returns to the app and the map shows a simulated-data label.
3. Supply a simulated location near latitude 27.95, longitude -82.46 using the
   simulator location controls. Grant location permission. Verify that the map
   follows position updates and the nearest received strike shows distance and age.
4. Drag the map, then update the simulated location. The viewport must stay where
   it was dragged, while distance still uses the vehicle position. Recenter must
   restore following. Pinch, use each zoom button, and recenter again. Buttons must
   scale the visible zoom level, and recenter must preserve it.
5. Observe rings over several updates. Check continuous expansion, fading white
   outlines, and translucent dark interiors. Record a screen capture to assess
   smoothness. Compilation and screenshots alone do not prove smooth animation.
6. Stop only the API in this isolated stack. Confirm the disconnected label,
   retained recent strikes, and expiry at five minutes from occurrence. Restart
   the API and confirm automatic recovery without duplicate markers or sign-out.
7. Deny location permission and relaunch. The map must remain browsable, hide
   vehicle-relative distance, and disable recenter. Restore permission and verify
   recovery after location updates resume.
8. Background and foreground the app. Verify that reads pause and resume, expired
   observations disappear, and current location following recovers. Sign out and
   confirm that the map and its cached observations disappear.

Record failures separately from passed cases. CarPlay, turn-by-turn guidance,
physical-device behavior, and Apple approval require their own verification.

Before requesting Apple review:

1. Demonstrate destination entry, route progress, spoken maneuvers, rerouting,
   and End Route. Verify that End Route returns to location following.
2. Verify CarPlay connection, disconnection, and cold launch. Test the map controls,
   location following, and guidance with the phone locked as permitted by iOS.
3. Request the navigation capability through the
   [Apple CarPlay developer program](https://developer.apple.com/carplay/).
   Provisioning and device tests require the developer account and granted access.
4. Supply a reachable HTTPS demo backend and OIDC issuer with the published demo
   credentials. Keep simulated observations visibly labeled in every client.
5. Explain that operators host one backend with one configured data adapter.
   Describe both demo and real-data connections. A reviewer must be able to test
   the intended functions; demo mode must not conceal live-data functionality.
6. Complete privacy disclosures from the implemented network and storage behavior.
   Verify that provider credentials remain on the backend and location coordinates
   are not sent in lightning-feed requests.
7. Produce and test a signed build, then submit the entitlement and store materials.
   A local build, TestFlight upload, or unsigned simulator test is not evidence of
   Apple approval.

Apple supplies the navigation map surface through
[CPWindow](https://developer.apple.com/documentation/carplay/cpwindow) and the
control layer through
[CPMapTemplate](https://developer.apple.com/documentation/carplay/cpmaptemplate).
Keep native CarPlay verification separate from the earlier browser prototype.
