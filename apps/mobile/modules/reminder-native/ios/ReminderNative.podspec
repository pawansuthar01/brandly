Pod::Spec.new do |s|
  s.name = 'ReminderNative'
  s.version = '1.0.0'
  s.summary = 'Native reminder actions and permission checks'
  s.description = s.summary
  s.author = 'Brandly'
  s.homepage = 'https://brandly.app'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '16.4' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoNotifications'
  s.source_files = '**/*.{h,m,mm,swift}'
end
