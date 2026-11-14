"""A small local API for the 3D page, standard library only.

    python -m gravsim.serve --preset iss_180 --day 95 --port 3000
    VITE_DASHBOARD_URL=http://localhost:3000/api/v1/dashboard npm run dev     (in src/front/sketch)

GET /api/v1/dashboard            dashboard JSON (contract version 1) for one crew member
    ?crew=CM-2&day=120           pick the crew member and mission day
GET /api/v1/readings?crew=CM-1   every reading so far for that crew member, as JSON records

With --speed N the mission clock advances N days per real minute, so the page (which polls every
3 seconds) shows the mission unfolding.
"""
from __future__ import annotations

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .core import Mission
from .dashboard import build_dashboard
from .schedule import default_instruments, timeline


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preset", default="iss_180", choices=["iss_180", "artemis_30", "mars"])
    ap.add_argument("--crew", type=int, default=4, help="number of random crew members")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--day", type=float, default=95.0, help="mission day shown (0 = launch)")
    ap.add_argument("--speed", type=float, default=0.0, help="mission days per real minute (0 = fixed day)")
    ap.add_argument("--port", type=int, default=3000)
    ap.add_argument("--origin", default="*", help="value for Access-Control-Allow-Origin")
    args = ap.parse_args(argv)

    mission = Mission.random(args.preset, n_crew=args.crew, seed=args.seed)
    readings = timeline(mission, "nasa", instruments=default_instruments(args.seed))
    started = time.time()

    def current_day(q):
        if "day" in q:
            return float(q["day"][0])
        return min(mission.end, args.day + args.speed * (time.time() - started) / 60.0)

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, body):
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", args.origin)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", args.origin)
            self.send_header("Access-Control-Allow-Headers", "Accept, Content-Type")
            self.end_headers()

        def do_GET(self):
            url = urlparse(self.path)
            q = parse_qs(url.query)
            crew_id = q.get("crew", [mission.crew[0].id])[0]
            crew = next((c for c in mission.crew if c.id == crew_id), None)
            if crew is None:
                return self._send(404, {"error": f"no crew member {crew_id}", "crew": [c.id for c in mission.crew]})
            day = current_day(q)
            if url.path == "/api/v1/dashboard":
                return self._send(200, build_dashboard(mission, crew, day, readings=readings))
            if url.path == "/api/v1/readings":
                return self._send(200, [r.to_dict() for r in readings if r.crew_id == crew.id and r.mission_day <= day])
            return self._send(404, {"error": "use /api/v1/dashboard or /api/v1/readings"})

        def log_message(self, *a):
            pass

    print(f"gravsim: {args.preset}, crew {[c.id for c in mission.crew]}, day {args.day}"
          f"{f' +{args.speed} d/min' if args.speed else ''} on http://localhost:{args.port}/api/v1/dashboard")
    ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
