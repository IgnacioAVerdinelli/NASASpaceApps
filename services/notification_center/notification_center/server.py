"""Local-only demo API. No external broker, authentication or medical inference."""
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .core import NotificationCenter
from .fixtures import CREW, SCENARIOS, make_scenario


def make_server(center, port=3002):
    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass

        def do_GET(self):
            url = urlparse(self.path)
            if url.path == "/api/v1/health":
                self.reply(200, {"status": "ok", "mode": "synthetic-local"})
            elif url.path == "/api/v1/notifications":
                crew = parse_qs(url.query).get("crew", [""])[0]
                if crew not in center.crew():
                    self.reply(400, {"error": "unknown demo crew"})
                    return
                self.reply(200, {"notifications": center.inbox(crew)})
            elif url.path == "/api/v1/deliveries":
                self.reply(200, {"deliveries": center.deliveries()})
            elif url.path == '/api/v1/rejected':
                with center.lock:
                    exists = center.db.execute("SELECT name FROM sqlite_master WHERE name='rejected_messages'").fetchone()
                    rows = [dict(row) for row in center.db.execute('SELECT * FROM rejected_messages')] if exists else []
                self.reply(200, {'rejected': rows})
            elif url.path == "/api/v1/demo/outputs":
                query = parse_qs(url.query)
                try:
                    outputs = center.outputs(query.get("channel", [""])[0], query.get("recipient", [""])[0])
                    self.reply(200, {"outputs": outputs})
                except ValueError as exc:
                    self.reply(400, {"error": str(exc)})
            elif url.path.startswith('/api/v1/outputs/'):
                try:
                    parts = url.path.split('/')
                    self.reply(200, center.result(parts[-2], int(parts[-1])))
                except ValueError as exc:
                    self.reply(404, {'error': str(exc)})
            elif url.path == "/api/v1/demo/state":
                with center.lock:
                    links = dict(center.channel_available)
                self.reply(200, {"crew": center.crew(), "scenarios": SCENARIOS, "channels": links})
            else:
                self.reply(404, {"error": "not found"})

        def do_POST(self):
            # Demo mutating API is local; block cross-site form submissions and requests.
            if self.headers.get("Sec-Fetch-Site") == "cross-site":
                self.reply(403, {"error": "cross-site request blocked"})
                return
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                self.reply(415, {"error": "application/json required"})
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 1_048_576:
                    raise ValueError("body must be 1 byte–1 MiB")
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict):
                    raise ValueError("body must be an object")
                path = urlparse(self.path).path
                if path == "/api/v1/messages":
                    self.reply(202, center.publish(body))
                elif path == "/api/v1/demo/scenarios":
                    self.reply(202, center.publish(make_scenario(body.get("scenario"), body.get("crew_id"), center.crew())))
                elif path == "/api/v1/demo/channels":
                    center.set_channel(body.get("channel"), body.get("available"))
                    self.reply(200, {"status": "updated"})
                elif path.startswith("/api/v1/deliveries/") and path.endswith("/ack"):
                    crew = body.get("crew_id")
                    if crew not in center.crew():
                        raise ValueError("unknown demo crew")
                    center.acknowledge(int(path.split("/")[-2]), crew)
                    self.reply(200, {"status": "acknowledged"})
                else:
                    self.reply(404, {"error": "not found"})
            except (ValueError, TypeError, OverflowError) as exc:
                self.reply(400, {"error": str(exc)})

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=3002)
    parser.add_argument("--db", default=".local/notifications.sqlite3")
    parser.add_argument('--queue', default=os.environ.get('NASA_QUEUE'), help='Shared gravsim SQLite queue (separate from --db)')
    parser.add_argument('--data-url', default='http://localhost:8000', help='DataService for scheduler payload enrichment')
    args = parser.parse_args()
    Path(args.db).parent.mkdir(parents=True, exist_ok=True)
    from .latency import HorizonsLatency
    if args.queue and Path(args.queue).resolve() == Path(args.db).resolve():
        parser.error('--queue and --db must be separate SQLite files')
    center = NotificationCenter(args.db, latency=HorizonsLatency())
    bridge = None
    if args.queue:
        from gravsim.queue import Queue
        from healthservice.sources import DataServiceSource
        from .bridge import QueueBridge
        bridge = QueueBridge(center, Queue(args.queue), DataServiceSource(args.data_url))
        bridge.start()
    server = make_server(center, args.port)
    center.start()
    print(f"Notification Center (demo) http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if bridge:
            bridge.close()
        center.close()


if __name__ == "__main__":
    main()
