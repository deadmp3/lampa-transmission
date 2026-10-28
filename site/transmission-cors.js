/* Browser CORS transport and downloaded-file playback for LME Torrent Manager.
 * Requires a Transmission server allowing the current Lampa Origin.
 * Loads the original manager from its author; no copied manager source.
 */
/* Lampa Transmission native transport compatibility patch, v2.0-cors.
 * Only targets http://192.168.0.193:9191/transmission/rpc and loopback equivalents.
 * No external services, no torrent operations on installation.
 * Remove this extension and restart Lampa to undo.
 */
(function () {
    'use strict';
    function install() {
        if (!window.Lampa || !Lampa.Reguest) return false;
        if (window.transmissionCorsInstalled) return true;
        var Original = Lampa.Reguest;
        var sessions = {};
        var torrents = {};
        var fullCard = null;
        function target(url) {
            return /^http:\/\/(192\.168\.0\.193|127\.0\.0\.1|localhost):9191\/transmission\/rpc\/?$/i.test(url);
        }
        function parse(value) {
            if (typeof value !== 'string') return value;
            try { return JSON.parse(value); } catch (_) { return value; }
        }
        function token(value) {
            if (!value) return '';
            if (typeof value.getResponseHeader === 'function') {
                var header = value.getResponseHeader('X-Transmission-Session-Id');
                if (header) return header;
            }
            var headers = value.headers || value.responseHeaders;
            if (headers && typeof headers === 'object') {
                for (var key in headers) {
                    if (key.toLowerCase() === 'x-transmission-session-id') return String(headers[key]);
                }
            }
            var text = typeof value === 'string' ? value : JSON.stringify(value);
            var match = text.match(/X-Transmission-Session-Id[^A-Za-z0-9]+([A-Za-z0-9]{16,})/i);
            return match ? match[1] : '';
        }
        function Wrapped() {
            var instance = new Original();
            var quiet = instance.quiet;
            var nativeRequest = quiet; // CORS: use the browser transport, no native bridge.
            if (typeof nativeRequest !== 'function') return instance;
            instance.quiet = function (url, success, failure, body, options) {
                if (!target(url)) return quiet.apply(instance, arguments);
                var rpc = parse(body);
                if (rpc && rpc.method === 'torrent-get' && rpc.arguments && Array.isArray(rpc.arguments.fields)) {
                    rpc.arguments.fields = rpc.arguments.fields.slice();
                    if (rpc.arguments.fields.indexOf('hashString') < 0) rpc.arguments.fields.push('hashString');
                    body = JSON.stringify(rpc);
                }
                var attempt = 0;
                var done = false;
                function fail(error) {
                    if (done) return;
                    done = true;
                    var detail = String(error.responseText || error.statusText || '')
                        .replace(/X-Transmission-Session-Id[^A-Za-z0-9]+[A-Za-z0-9]+/gi, 'Session-Id: [hidden]')
                        .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [hidden]')
                        .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 280);
                    window.transmissionCorsLastError = {status: error.status, detail: detail};
                    if (Lampa.Noty) Lampa.Noty.show('CORS RPC v2.0-cors HTTP ' + error.status + ': ' + detail);
                    if (failure) failure(error);
                }
                function send() {
                    var params = {};
                    var original = options || {};
                    for (var name in original) params[name] = original[name];
                    params.headers = {};
                    for (var key in (original.headers || {})) params.headers[key] = original.headers[key];
                    if (sessions[url]) params.headers['X-Transmission-Session-Id'] = sessions[url];
                    params.type = 'POST';
                    params.dataType = 'text';
                    params.returnHeaders = true;
                    function receive(raw, isError) {
                        if (done) return;
                        var envelope = parse(raw);
                        var payload = envelope && typeof envelope === 'object' && typeof envelope.body !== 'undefined'
                            ? parse(envelope.body) : envelope;
                        if (payload && typeof payload === 'object' && typeof payload.result === 'string') {
                            if (payload.arguments && Array.isArray(payload.arguments.torrents)) {
                                payload.arguments.torrents.forEach(function (torrent) {
                                    if (typeof torrent.id === 'undefined') return;
                                    var entry = torrents[torrent.id] || {};
                                    for (var field in torrent) entry[field] = torrent[field];
                                    torrents[torrent.id] = entry;
                                });
                            }
                            done = true;
                            if (success) success(payload);
                            return;
                        }
                        var session = token(envelope) || token(payload);
                        if (session && attempt < 2) {
                            sessions[url] = session;
                            attempt++;
                            send();
                            return;
                        }
                        var status = Number(envelope && (envelope.status || envelope.statusCode || envelope.code)) || 0;
                        fail({
                            status: status,
                            statusText: session ? 'Transmission session retry failed' :
                                (isError ? 'Browser HTTP request failed' : 'RPC did not return JSON'),
                            responseText: typeof raw === 'string' ? raw : JSON.stringify(raw)
                        });
                    }
                    nativeRequest.call(instance, url, function (raw) { receive(raw, false); },
                        function (error) { receive(error, true); }, body, params);
                }
                send();
            };
            return instance;
        }
        Wrapped.prototype = Original.prototype;
        for (var property in Original) Wrapped[property] = Original[property];
        Lampa.Reguest = Wrapped;
        installPlayback();
        window.transmissionCorsInstalled = true;
        if (Lampa.Noty) Lampa.Noty.show('Transmission: CORS extension v2.0 loaded');
        return true;

        function notice(message) {
            if (Lampa.Noty) Lampa.Noty.show(message);
        }
        function mediaBase() {
            var value = Lampa.Storage.get('transmission_native_media_url', 'http://127.0.0.1:9192');
            return String(value || 'http://127.0.0.1:9192').replace(/\/+$/, '');
        }
        function playDownloaded(id) {
            var base = String(Lampa.Storage.get('lmetorrenttransmissionUrl', 'http://127.0.0.1:9191') || 'http://127.0.0.1:9191').replace(/\/+$/, '');
            var rpcUrl = base + '/transmission/rpc';
            if (!target(rpcUrl)) {
                notice('Для этого патча адрес Transmission должен быть 127.0.0.1:9191 или 192.168.0.193:9191');
                return;
            }
            var request = new Lampa.Reguest();
            request.timeout(10000);
            request.quiet(rpcUrl, function (response) {
                var list = response && response.arguments && response.arguments.torrents;
                if (response.result !== 'success' || !list || !list.length) {
                    notice('Не удалось получить файлы раздачи');
                    return;
                }
                var torrent = list[0];
                if (!/^[a-f0-9]{40}$/i.test(torrent.hashString || '')) {
                    notice('Transmission не вернул хеш раздачи');
                    return;
                }
                var files = [];
                (torrent.files || []).forEach(function (file, index) {
                    if (!/\.(mkv|mp4|m4v|avi|mov|webm|ts|m2ts|mts|mpg|mpeg|wmv|vob|ogv)$/i.test(file.name || '')) return;
                    if (!Number(file.length) || !(Number(file.bytesCompleted) >= Number(file.length))) return;
                    files.push({file: file, index: index});
                });
                files.sort(function (a, b) {return a.file.name.localeCompare(b.file.name, undefined, {numeric: true});});
                if (!files.length) {
                    notice('В раздаче нет полностью скачанных видеофайлов');
                    return;
                }
                var server = mediaBase();
                if (!/^http:\/\/(127\.0\.0\.1|localhost|192\.168\.0\.193):\d+$/i.test(server)) {
                    notice('Укажите адрес видео вида http://127.0.0.1:9192');
                    return;
                }
                    var items = files.map(function (entry) {
                        var extension = entry.file.name.split('.').pop().toLowerCase();
                        return {
                            title: entry.file.name.split('/').pop(),
                            url: server + '/torrent/' + torrent.hashString + '/' + entry.index + '.' + extension,
                            timeline: false
                        };
                    });
                    function start(index) {
                        Lampa.Player.play(items[index]);
                        if (items.length > 1 && Lampa.Player.playlist) Lampa.Player.playlist(items);
                    }
                    if (items.length === 1) start(0);
                    else Lampa.Select.show({
                        title: 'Скачанные видеофайлы',
                        items: items.map(function (item, index) {return {title: item.title, index: index};}),
                        onSelect: function (item) {start(item.index);},
                        onBack: function () {Lampa.Controller.toggle('content');}
                    });
            }, function () {notice('Не удалось запросить файлы через RPC');},
                JSON.stringify({method: 'torrent-get', arguments: {ids: [id], fields: ['id', 'name', 'hashString', 'files']}}),
                {type: 'POST', headers: {'Content-Type': 'application/json'}});
        }
        function installPlayback() {
            if (Lampa.SettingsApi && Lampa.SettingsApi.addParam) {
                Lampa.SettingsApi.addParam({component: 'lmetorrent',
                    param: {name: 'transmission_native_media_url', type: 'input',
                        values: 'http://127.0.0.1:9192', 'default': 'http://127.0.0.1:9192'},
                    field: {name: 'Transmission BTC: адрес видео', description: 'HTTP-сервер UPnP MediaServer, обычно http://127.0.0.1:9192'}
                });
            }
            if (Lampa.Listener && Lampa.Listener.follow) {
                Lampa.Listener.follow('full', function (event) {
                    if (event.type === 'complite') fullCard = event.object || null;
                });
            }
            if (!Lampa.Select || !Lampa.Select.show) return;
            var originalShow = Lampa.Select.show;
            Lampa.Select.show = function (options) {
                var actions = (options.items || []).map(function (item) {return item.action;});
                var client = Lampa.Storage.field('lmetorrentSelect');
                var found = null;
                if (client === 'transmission' && actions.indexOf('resume') >= 0 && actions.indexOf('pause') >= 0 && actions.indexOf('delete') >= 0) {
                    var title = String(options.title || '');
                    for (var id in torrents) {
                        if (torrents[id].name === title) {found = torrents[id]; break;}
                    }
                    if (!found && fullCard && /%/.test(title)) {
                        var label = String(fullCard.method || '') + '/' + String(fullCard.id || '');
                        for (var torrentId in torrents) {
                            if (Array.isArray(torrents[torrentId].labels) && torrents[torrentId].labels.indexOf(label) >= 0) {
                                found = torrents[torrentId]; break;
                            }
                        }
                    }
                }
                if (!found) return originalShow.apply(this, arguments);
                var enhanced = {};
                for (var key in options) enhanced[key] = options[key];
                enhanced.items = [{title: 'Смотреть скачанное', action: 'native-btc-play', torrentId: found.id}].concat(options.items);
                enhanced.onSelect = function (item) {
                    if (item.action === 'native-btc-play') playDownloaded(item.torrentId);
                    else if (options.onSelect) options.onSelect.apply(this, arguments);
                };
                return originalShow.call(this, enhanced);
            };
        }
    }
    if (!install()) {
        var tries = 0;
        var timer = setInterval(function () {
            if (install() || ++tries >= 120) clearInterval(timer);
        }, 500);
    }
}());

(function loadManager() {
    var attempts = 0;
    function load() {
        if (!window.Lampa || !window.transmissionCorsInstalled) return false;
        if (window.transmissionCorsManagerRequested) return true;
        window.transmissionCorsManagerRequested = true;
        var script = document.createElement('script');
        script.src = 'https://lampame.github.io/main/torrentmanager/torrentmanager.js';
        script.async = true;
        script.onerror = function () {
            if (Lampa.Noty) Lampa.Noty.show('Не удалось загрузить LME Torrent Manager с сайта автора');
        };
        document.head.appendChild(script);
        return true;
    }
    if (!load()) {
        var timer = setInterval(function () {
            if (load() || ++attempts >= 120) clearInterval(timer);
        }, 500);
    }
}());
