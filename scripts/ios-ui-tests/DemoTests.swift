import XCTest

/// Runs only when the operator explicitly selects the public demo acceptance suite.
/// These credentials are the published demo login, never a personal account.
final class DemoTests: XCTestCase {
  private func capture(_ app: XCUIApplication, _ name: String) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  private func acceptPrompt(_ app: XCUIApplication, button: String) {
    for surface in [app, XCUIApplication(bundleIdentifier: "com.apple.springboard")] {
      let control = surface.alerts.buttons[button]
      if control.waitForExistence(timeout: 3) { control.tap(); return }
    }
  }

  func testDemoSignInMapAndSignOut() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.elsell.simplestrike")
    app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
    app.launch()
    let address = app.textFields["Backend URL"]
    XCTAssertTrue(address.waitForExistence(timeout: 120))
    address.tap()
    address.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue,
                            count: (address.value as? String ?? "").count))
    address.typeText("https://demo.simplestrike.online")
    app.buttons["Connect"].tap()
    let signIn = app.buttons["Sign in"]
    XCTAssertTrue(signIn.waitForExistence(timeout: 45), "Demo backend must be reachable")
    let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: signIn)
    XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 30), .completed)
    signIn.tap()
    acceptPrompt(app, button: "Continue")
    let browser = app.webViews.firstMatch
    XCTAssertTrue(browser.waitForExistence(timeout: 45), "OIDC must use the real browser login")
    let email = browser.textFields.firstMatch
    XCTAssertTrue(email.waitForExistence(timeout: 30))
    email.tap()
    email.typeText("demo@example.com")
    let password = browser.secureTextFields.firstMatch
    XCTAssertTrue(password.exists)
    password.tap()
    password.typeText("password")
    browser.buttons["Login"].tap()
    XCTAssertTrue(app.staticTexts["Simulated lightning"].waitForExistence(timeout: 60))
    acceptPrompt(app, button: "Allow While Using App")
    let map = app.maps.firstMatch
    XCTAssertTrue(map.waitForExistence(timeout: 15))
    XCTAssertTrue(app.staticTexts["Following vehicle"].waitForExistence(timeout: 30))
    XCTAssertTrue(app.staticTexts["Rings show estimated thunder travel."].exists)
    XCTAssertTrue(app.buttons["Navigate"].exists)
    app.buttons["Zoom in"].tap()
    app.buttons["Zoom out"].tap()
    map.swipeLeft()
    XCTAssertTrue(app.staticTexts["Exploring map"].waitForExistence(timeout: 15))
    app.buttons["Recenter"].tap()
    XCTAssertTrue(app.staticTexts["Following vehicle"].waitForExistence(timeout: 15))
    capture(app, "Authenticated demo map")

    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["Simulated lightning"].waitForExistence(timeout: 120))
    XCTAssertFalse(app.buttons["Sign in"].exists)
    capture(app, "Demo session after relaunch")
    app.buttons["Account"].tap()
    let signOut = app.buttons["Sign out"]
    XCTAssertTrue(signOut.waitForExistence(timeout: 15))
    signOut.tap()
    XCTAssertTrue(signIn.waitForExistence(timeout: 30))
    app.terminate()
    app.launch()
    XCTAssertTrue(signIn.waitForExistence(timeout: 120))
    XCTAssertFalse(app.maps.firstMatch.exists)
    capture(app, "Signed out after relaunch")
  }
}
