'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || 'lampa-source');
function edit(relative, transform) {
  const file = path.join(root, relative);
  fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')));
}
function replace(source, before, after, expected = 1) {
  const count = source.split(before).length - 1;
  if (count !== expected) throw Error('Source changed: expected ' + expected + ' matches, found ' + count + ' for ' + before);
  return source.split(before).join(after);
}
edit('app/src/main/java/top/rootu/lampa/net/Http.java', source => replace(source,
  'Response response = client.newCall(rb.build()).execute();\n        return getJsonFromResponse(response, dataType);',
  'try (Response response = TransmissionRpc.execute(client, rb.build())) {\n            return getJsonFromResponse(response, dataType);\n        }', 2));
fs.copyFileSync(path.join(__dirname, 'android/TransmissionRpc.java'), path.join(root, 'app/src/main/java/top/rootu/lampa/net/TransmissionRpc.java'));
const tests = path.join(root, 'app/src/test/java/top/rootu/lampa/net');
fs.mkdirSync(tests, {recursive:true});
fs.copyFileSync(path.join(__dirname, 'android/TransmissionRpcTest.java'), path.join(tests, 'TransmissionRpcTest.java'));
edit('app/build.gradle', source => {
  source = replace(source, 'applicationId "top.rootu.lampa"', 'applicationId "top.rootu.lampa.transmission"');
  source = replace(source, 'versionCode getVersionCode()', 'versionCode 581');
  source = replace(source, 'versionName getVersionName()', 'versionName "1.13.5-transmission1"');
  source = replace(source, 'buildConfigField "boolean", "enableUpdate", "true"', 'buildConfigField "boolean", "enableUpdate", "false"');
  return source + '\n' + "dependencies { testImplementation 'com.squareup.okhttp3:mockwebserver:3.12.13' }\n";
});
edit('app/src/main/res/values/strings.xml', source => {
  source = replace(source, '>LAMPA</string>', '>Lampa Transmission</string>');
  return replace(source, '>top.rootu.lampa</string>', '>top.rootu.lampa.transmission</string>');
});
console.log('Patched Lampa v1.13.5: bounded RPC session retry; separate app package; playback extension remains in site/.');
