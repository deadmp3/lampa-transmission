'use strict';
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(process.argv[2]);
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
function replace(before, after) {
  if (source.split(before).length !== 2) throw Error('Unexpected Transmission source: ' + before);
  source = source.replace(before, after);
}
if (!source.includes('// LAMPA_CORS_COMPAT')) {
  replace('static void handle_request(struct evhttp_request* req, void* arg)',
    '#include "LampaCorsPolicy.h"\n\nstatic void handle_request(struct evhttp_request* req, void* arg)');
  replace('        auth = evhttp_find_header(req->input_headers, "Authorization");', `        // LAMPA_CORS_COMPAT: only approved origins can read the CSRF handshake.
        char const* origin = evhttp_find_header(req->input_headers, "Origin");
        if (origin != nullptr)
        {
            char const* host = evhttp_find_header(req->input_headers, "Host");
            std::string const same_origin = std::string("http://") + (host != nullptr ? host : "");
            if (!lampaCorsOriginAllowed(origin) && same_origin != origin)
            {
                send_simple_response(req, 403, "<p>Origin is not allowed by the Lampa CORS policy.</p>");
                return;
            }
            evhttp_add_header(req->output_headers, "Access-Control-Allow-Origin", origin);
            evhttp_add_header(req->output_headers, "Vary", "Origin");
            evhttp_add_header(req->output_headers, "Access-Control-Expose-Headers", "X-Transmission-Session-Id");
            evhttp_add_header(req->output_headers, "Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            evhttp_add_header(req->output_headers, "Access-Control-Allow-Headers", "Authorization, Content-Type, X-Transmission-Session-Id");
            char const* private_network = evhttp_find_header(req->input_headers, "Access-Control-Request-Private-Network");
            if (private_network != nullptr && strcmp(private_network, "true") == 0)
                evhttp_add_header(req->output_headers, "Access-Control-Allow-Private-Network", "true");
        }
        if (req->type == EVHTTP_REQ_OPTIONS)
        {
            send_simple_response(req, HTTP_OK, "");
            return;
        }

        auth = evhttp_find_header(req->input_headers, "Authorization");`);
  replace('    struct evhttp* httpd = evhttp_new(server->session->event_base);',
    '    struct evhttp* httpd = evhttp_new(server->session->event_base);\n    evhttp_set_allowed_methods(httpd, EVHTTP_REQ_GET | EVHTTP_REQ_POST | EVHTTP_REQ_OPTIONS);');
  fs.writeFileSync(file, source);
}
fs.copyFileSync(path.join(__dirname, 'LampaCorsPolicy.h'), path.join(path.dirname(file), 'LampaCorsPolicy.h'));
console.log('Applied exact-origin CORS policy; RPC authentication and CSRF checks retained.');
