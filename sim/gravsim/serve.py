"""A small local API for the 3D page, standard library only.

    python -m gravsim.serve --preset iss_180 --day 95 --port 3000
    VITE_DASHBOARD_URL=http://localhost:3000/api/v1/dashboard npm run dev     (in src/front/sketch)

At start-up gravsim generates the whole mission and sends it through the DataService, as sensors would.

GET /api/v1/dashboard    dashboard JSON (contract version 1) for one crew member
GET /api/v1/readings     every reading so far for that crew member
GET /api/v1/latest       the newest usable reading of each measure

Query parameters, all optional: crew=CM-2 (default: the first), day=120 (mission day; default: the
clock below), measures=bone,vo2peak (ids or groups; /readings and /latest only).

With --speed N the mission clock advances N days per real minute, so the page (which polls every
3 seconds) shows the mission unfolding.
"""
from __future__ import annotations

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .core import PRESETS, Mission
from .dataservice import DataService
from .health import HealthService


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preset", default="iss_180", choices=list(PRESETS))
    ap.add_argument("--crew", type=int, default=4, help="number of random crew members")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--day", type=float, default=95.0, help="mission day shown (0 = launch)")
    ap.add_argument("--speed", type=float, default=0.0, help="mission days per real minute (0 = fixed day)")
    ap.add_argument("--port", type=int, default=3000)
    ap.add_argument("--origin", default="*", help="value for Access-Control-Allow-Origin")
    args = ap.parse_args(argv)

    mission = Mission.random(args.preset, n_crew=args.crew, seed=args.seed)
    data = DataService()
    data.ingest(mission.timeline(seed=args.seed))
    health = HealthService(data)
    started = time.time()

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, body):
            payload = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", args.origin)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", args.origin)
            self.send_header("Access-Control-Allow-Headers", "Accept, Content-Type")
            self.end_headers()

        def do_GET(self):
            url = urlparse(self.path)
            q = {k: v[0] for k, v in parse_qs(url.query).items()}
            crew = next((c for c in mission.crew if c.id == q.get("crew", mission.crew[0].id)), None)
            if crew is None:
                return self._send(404, {"error": f"no crew member {q['crew']}", "crew": [c.id for c in mission.crew]})
            try:
                day = float(q["day"]) if "day" in q else min(mission.end, args.day + args.speed * (time.time() - started) / 60)
                now = mission.timestamp(day)
                measures = q["measures"].split(",") if "measures" in q else None
                if url.path == "/api/v1/dashboard":
                    return self._send(200, health.dashboard(crew, day))
                if url.path == "/api/v1/readings":
                    return self._send(200, [r.to_dict() for r in data.readings(crew.id, measures, end=now)])
                if url.path == "/api/v1/latest":
                    return self._send(200, {m: r.to_dict() for m, r in data.latest(crew.id, measures, at=now).items()})
            except (KeyError, ValueError) as e:            # a bad day or measure in the query
                return self._send(400, {"error": e.args[0] if e.args else str(e)})
            return self._send(404, {"error": "use /api/v1/dashboard, /api/v1/readings or /api/v1/latest"})

        def log_message(self, *a):
            pass

    print(f"gravsim: {args.preset}, crew {[c.id for c in mission.crew]}, day {args.day}"
          f"{f' +{args.speed} d/min' if args.speed else ''} on http://localhost:{args.port}/api/v1/dashboard", flush=True)
    ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
