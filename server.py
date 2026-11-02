import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import config
from comments_engine import get_comments_lock, load_comments, upsert_comment, delete_comment


def make_handler(get_html_bytes):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, body, ctype="application/json; charset=utf-8"):
            if isinstance(body, (dict, list)):
                body = json.dumps(body, ensure_ascii=False).encode("utf-8")
            elif isinstance(body, str):
                body = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self._send(200, {"ok": True})

        def do_GET(self):
            path = self.path.split("?")[0]
            try:
                if path in ("/", "/index.html"):
                    self._send(200, get_html_bytes(), "text/html; charset=utf-8")
                elif path == "/api/comments":
                    with get_comments_lock():
                        data = load_comments()
                    self._send(200, data)
                elif path == "/api/info":
                    self._send(200, {"file": config.COMMENTS_XLSX_INPUT})
                else:
                    self._send(404, {"error": "Not found"})
            except Exception as ex:
                self._send(500, {"error": str(ex)})

        def do_POST(self):
            path = self.path.split("?")[0]
            try:
                length = int(self.headers.get("Content-Length", 0))
                payload = json.loads(self.rfile.read(length) or b"{}")
                if path == "/api/comments":
                    self._send(200, {"ok": True, "comments": upsert_comment(payload)})
                elif path == "/api/comments/delete":
                    self._send(200, {"ok": True, "comments": delete_comment(payload.get("id", ""))})
                else:
                    self._send(404, {"error": "Not found"})
            except PermissionError:
                self._send(423, {"error": "Critical_FG_Comments_Log.xlsx is open in Excel! Close it and click Save again."})
            except Exception as ex:
                self._send(500, {"error": str(ex)})

        def log_message(self, *args):
            pass

    return Handler


def create_local_server(get_html_bytes, candidate_ports=(8765, 8766, 8767, 0)):
    server = None
    for candidate_port in candidate_ports:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", candidate_port), make_handler(get_html_bytes))
            break
        except OSError:
            continue
    if server is None:
        raise RuntimeError("Could not bind a local port for the Excel Auto-Save server.")
    return server
