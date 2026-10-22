Pod::Spec.new do |s|
  s.name = 'StrikeMap'
  s.version = '0.1.0'
  s.summary = 'Native MapKit presentation for Simple Strike'
  s.description = 'Provider-independent native map presentation.'
  s.license = { :type => 'Apache-2.0' }
  s.author = 'Simple Strike contributors'
  s.homepage = 'https://github.com/elsell/simple-strike'
  s.platform = :ios, '15.1'
  s.source = { :git => 'https://github.com/elsell/simple-strike.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
  s.frameworks = 'MapKit', 'CoreLocation'
end
