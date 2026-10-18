# Uses xcodeproj from the existing locked CocoaPods bundle.
require 'xcodeproj'
root = File.expand_path('..', __dir__)
projects = Dir[File.join(root, 'apps/mobile/ios/*.xcodeproj')]
abort 'Expected one application project' unless projects.length == 1
project = Xcodeproj::Project.open(projects.first)
app = project.targets.find { |target| target.product_type == 'com.apple.product-type.application' }
abort 'Application target missing' unless app
name = 'SimpleStrikeAcceptance'
abort 'Acceptance target already exists' if project.targets.any? { |target| target.name == name }
target = project.new_target(:ui_test_bundle, name, :ios, '15.1')
target.add_dependency(app)
reference = project.main_group.new_file(File.join(root, 'scripts/ios-ui-tests/ConnectionTests.swift'))
target.source_build_phase.add_file_reference(reference)
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.elsell.simplestrike.acceptance',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'TEST_TARGET_NAME' => app.name,
    'TARGETED_DEVICE_FAMILY' => '1,2',
    'CODE_SIGN_IDENTITY' => '-',
    'CODE_SIGNING_ALLOWED' => 'YES'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.test_action.build_configuration = 'Release'
scheme.save_as(project.path, name, true)
