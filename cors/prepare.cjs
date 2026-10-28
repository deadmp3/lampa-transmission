'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || 'transmission-source');
function edit(file, action) {
  const full = path.join(root, file);
  fs.writeFileSync(full, action(fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n')));
}
function replace(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Unexpected source: ' + before);
  return source.replace(before, after);
}
fs.mkdirSync(path.join(root, 'cors'), {recursive:true});
for (const name of ['patch-rpc.cjs','LampaCorsPolicy.h']) fs.copyFileSync(path.join(__dirname,name),path.join(root,'cors',name));
edit('cmake/Transmission.cmake', source => {
  source = replace(source, 'GIT_TAG "transmissionbtc"', 'GIT_TAG "838482bf36875977151ccb8e242e92ebc5ebf91f"');
  source = replace(source, 'GIT_SHALLOW 1', 'GIT_SHALLOW 0');
  source = replace(source, '        CONFIGURE_COMMAND ${CMAKE_COMMAND} ${TR_SRC_DIR} ${TR_CMAKE_ARGS}',
    '        PATCH_COMMAND node "${CMAKE_CURRENT_SOURCE_DIR}/cors/patch-rpc.cjs" "<SOURCE_DIR>/libtransmission/rpc-server.cc"\n        CONFIGURE_COMMAND ${CMAKE_COMMAND} ${TR_SRC_DIR} ${TR_CMAKE_ARGS}');
  return source;
});
edit('cmake/OpenSSL.cmake', source => replace(source,
  'https://www.openssl.org/source/openssl-1.1.1l.tar.gz',
  'https://github.com/openssl/openssl/releases/download/OpenSSL_1_1_1l/openssl-1.1.1l.tar.gz'));
edit('build.gradle', source => {
  source = replace(source, "def version = '1.3.10'", "def version = '1.3.10-cors1'");
  source = replace(source, "applicationId 'com.ap.transmission.btc'", "applicationId 'com.ap.transmission.btc.cors'");
  source = replace(source, "applicationIdSuffix '.debug'", "versionNameSuffix '-test'");
  source = replace(source, "        debug {\n            debuggable true\n            versionNameSuffix '-test'\n            signingConfig signingConfigs.release",
    "        debug {\n            debuggable true\n            versionNameSuffix '-test'\n            signingConfig signingConfigs.debug");
  source = replace(source, 'signingConfig signingConfigs.release', 'signingConfig signingConfigs.debug');
  source = replace(source, "    externalNativeBuild.cmake.path 'CMakeLists.txt'",
    "    externalNativeBuild.cmake.path 'CMakeLists.txt'\n    externalNativeBuild.cmake.version '3.18.1'\n    ndkVersion '21.4.7075529'");
  return source;
});
edit('src/main/java/com/ap/transmission/btc/Prefs.java', source => {
  source = replace(source, 'RPC_PORT(9091)', 'RPC_PORT(9191)');
  return replace(source, 'HTTP_SERVER_PORT(9092)', 'HTTP_SERVER_PORT(9192)');
});
for (const dir of fs.readdirSync(path.join(root,'src/main/res'))) {
  const file = 'src/main/res/' + dir + '/strings.xml';
  if (fs.existsSync(path.join(root,file))) edit(file, source => source.replace(/(<string\s+name="app_name"[^>]*>)[^<]*(<\/string>)/g, '$1Transmission BTC CORS$2'));
}
console.log('Prepared separate Transmission BTC CORS APK; default RPC 9191, media 9192.');
