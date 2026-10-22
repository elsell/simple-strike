import XCTest

final class ConnectionTests: XCTestCase {
  func testConnectionValidationAndRelaunch() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.elsell.simplestrike")
    app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
    app.launch()
    let address = app.textFields["Backend URL"]
    XCTAssertTrue(address.waitForExistence(timeout: 120))
    XCTAssertFalse(app.staticTexts["Cannot read or save the connection. Try again."].exists)
    address.tap()
    let existing = address.value as? String ?? ""
    address.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
    let connect = app.buttons["Connect"]
    let disabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == false"), object: connect)
    XCTAssertEqual(XCTWaiter.wait(for: [disabled], timeout: 10), .completed)
    address.typeText("not-a-url")
    connect.tap()
    XCTAssertTrue(app.staticTexts["Cannot connect. Check the server address and try again."].waitForExistence(timeout: 15))
    let failure = XCTAttachment(screenshot: app.screenshot())
    failure.name = "Invalid address feedback"
    failure.lifetime = .keepAlways
    add(failure)
    app.terminate()
    app.launch()
    XCTAssertTrue(address.waitForExistence(timeout: 120))
    XCTAssertFalse(app.staticTexts["Cannot read or save the connection. Try again."].exists)
    XCTAssertTrue(connect.isEnabled)
    let restored = XCTAttachment(screenshot: app.screenshot())
    restored.name = "Setup after relaunch"
    restored.lifetime = .keepAlways
    add(restored)
  }
}
