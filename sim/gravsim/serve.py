"""The DataService's HTTP API, standard library only.

    python -m gravsim.serve --preset iss_180 --day 95 --speed 20 --port 8000

At start-up gravsim generates the whole mission, readings and crew context, and sends it through the
DataService, as the sensors would. Requests then see the data up to the mission clock ("now").

GET  /api/v1/mission           the mission: name, launch date, phases with their gravity, the clock ("now") and the crew
GET  /api/v1/readings          every reading so far
GET  /api/v1/latest            the newest usable reading of each measure
GET  /api/v1/context           context records under way between start and end (default: the 24 hours up to now)
GET  /api/v1/context/current   the context record under way at `at` (default: now), or null
GET  /api/v1/results           processed results saved so far
POST /api/v1/results           save a processed result: a JSON object with crew_id, kind, timestamp and payload
                               (model_version optional), as DataService.save_result() takes them

Query parameters, all optional: crew=CM-2 (default: the first), day=120 (the mission day used as now;
default: the mission clock), measures=bone,vo2peak (ids or groups; /readings and /latest), start and end
(ISO times; /context and /results), at (an ISO time; /context/current), kind=study (/results),
truth=1 (/readings and /latest: also send each reading's `truth` and `status`, the simulator's hidden state,
which a real monitor would never see; only for scoring a detector).

With --speed N the mission clock advances N days per real minute, so a client that polls sees the
mission unfold.
"""
from __future__ import annotations

import argparse
import json
import time
import threading
import logging
import zlib
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable
from urllib.parse import parse_qs, urlparse

from .core import PRESETS, Mission
from .instruments import INSTRUMENTS
from .measures import MEASURES, TIME_FORMAT
from .dataservice import DataService
from .pipeline import utc_iso
from .queue import Queue
from .store import SqliteStore


class NotFound(Exception):
    """Raised by a route to answer 404; its argument is the JSON body."""


def make_server(routes: dict, port: int = 0, origin: str = "*") -> ThreadingHTTPServer:
    """A small JSON API. routes maps (method, path) to fn(query, body) -> (status, JSON-able body); query is
    a dict of the query parameters, body the parsed JSON of a POST (None for GET). A KeyError, ValueError or
    TypeError raised by a route becomes a 400, NotFound a 404. port=0 picks a free port."""

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, body):
            payload = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Accept, Content-Type")
            self.end_headers()

        def _answer(self, method):
            url = urlparse(self.path)
            route = routes.get((method, url.path))
            if route is None:
                return self._send(404, {"error": f"no {method} {url.path}",
                                        "paths": sorted(f"{m} {p}" for m, p in routes)})
            query = {k: v[0] for k, v in parse_qs(url.query).items()}
            try:
                body = None
                if method == "POST":
                    body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"null")
                return self._send(*route(query, body))
            except NotFound as e:
                return self._send(404, e.args[0])
            except (KeyError, ValueError, TypeError) as e:     # a bad parameter or body (JSON errors are ValueErrors)
                return self._send(400, {"error": str(e.args[0]) if e.args else type(e).__name__})

        def do_GET(self):
            self._answer("GET")

        def do_POST(self):
            self._answer("POST")

        def do_PUT(self):                   # PUT, PATCH and DELETE are not part of the API
            self._send(405, {"error": "this API only answers GET and POST"})

        do_PATCH = do_DELETE = do_PUT

        def log_message(self, *a):
            pass

    return ThreadingHTTPServer(("0.0.0.0", port), Handler)


def mission_parser(description: str, port: int) -> argparse.ArgumentParser:
    """Command-line options shared by the servers that generate a mission at start-up."""
    ap = argparse.ArgumentParser(description=description, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preset", default="iss_180", choices=list(PRESETS))
    ap.add_argument("--crew", type=int, default=4, help="number of random crew members")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--day", type=float, default=95.0, help="mission day at start-up (0 = launch)")
    ap.add_argument("--speed", type=float, default=0.0, help="mission days per real minute (0 = fixed day)")
    ap.add_argument("--port", type=int, default=port)
    ap.add_argument("--origin", default="*", help="value for Access-Control-Allow-Origin")
    ap.add_argument("--fatigue", action="append", default=[], metavar="CREW:DAY[:DAYS]",
                    help="a fatigue spell the watch should catch, e.g. CM-3:132:6 (repeatable; CrewMember.add_fatigue)")
    ap.add_argument("--sans", action="append", default=[], metavar="CREW:Z",
                    help="a crew member's SANS susceptibility in SD, e.g. CM-1:1.5 (repeatable; gravsim.ocular.set_sans)")
    return ap


def apply_fatigue(mission: Mission, specs: list[str]) -> None:
    """--fatigue CREW:DAY[:DAYS] options onto the mission's crew."""
    crew = {c.id: c for c in mission.crew}
    for spec in specs:
        parts = spec.split(":")
        if len(parts) not in (2, 3) or parts[0] not in crew:
            raise SystemExit(f"--fatigue {spec!r}: expected CREW:DAY[:DAYS] with CREW one of {sorted(crew)}")
        crew[parts[0]].add_fatigue(float(parts[1]), float(parts[2]) if len(parts) == 3 else 6.0)


def apply_sans(mission: Mission, specs: list[str]) -> None:
    """--sans CREW:Z options onto the mission's crew (the eye exam, gravsim.ocular)."""
    from .ocular import set_sans
    crew = {c.id: c for c in mission.crew}
    for spec in specs:
        parts = spec.split(":")
        if len(parts) != 2 or parts[0] not in crew:
            raise SystemExit(f"--sans {spec!r}: expected CREW:Z with CREW one of {sorted(crew)}")
        set_sans(crew[parts[0]], float(parts[1]))


def mission_clock(mission: Mission, day: float, speed: float) -> Callable[[], float]:
    """The mission day now: `day` at start-up, moving `speed` days per real minute, stopping at the end."""
    started = time.time()
    return lambda: min(mission.end, day + speed * (time.time() - started) / 60)


def data_routes(mission: Mission, data: DataService, clock: Callable[[], float]) -> dict:
    """The DataService API (see the module docstring) for a generated mission."""
    crew_ids = [c.id for c in mission.crew]

    def who(q) -> str:
        crew_id = q.get("crew", crew_ids[0])
        if crew_id not in crew_ids:
            raise NotFound({"error": f"no crew member {crew_id}", "crew": crew_ids})
        return crew_id

    def now(q) -> str:
        return mission.timestamp(float(q["day"]) if "day" in q else clock())

    def measures(q):
        return q["measures"].split(",") if "measures" in q else None

    def sent(r, q) -> dict:
        """A reading as the API sends it: `truth` and `status` (the simulator's hidden state) only with truth=1."""
        d = r.to_dict()
        if q.get("truth") != "1":
            d.pop("truth", None)
            d.pop("status", None)
        return d

    def mission_info(q, _):
        day = float(q["day"]) if "day" in q else clock()
        return 200, {
            "name": mission.name,
            "launch_date": mission.timestamp(0),
            "now_day": round(day, 3),
            "now": mission.timestamp(day),
            "phases": [{"name": p.name, "start": p.start, "end": p.end, "gravity_g": p.gravity_g} for p in mission.phases],
            "crew": [{"id": c.id, "sex": c.sex} for c in mission.crew],
        }

    def readings(q, _):
        # start: only readings from that time on (the watch's 15-minute heart rate is ~100 readings a day)
        return 200, [sent(r, q) for r in data.readings(who(q), measures(q), start=q.get("start"), end=now(q))]

    def latest(q, _):
        return 200, {m: sent(r, q) for m, r in data.latest(who(q), measures(q), at=now(q)).items()}

    def context(q, _):
        end = utc_iso(q.get("end") or now(q))
        start = q.get("start") or (datetime.strptime(end, TIME_FORMAT) - timedelta(days=1)).strftime(TIME_FORMAT)
        return 200, [c.to_dict() for c in data.context(who(q), start, end)]

    def current_context(q, _):
        found = data.current_context(who(q), q.get("at") or now(q))
        return 200, None if found is None else found.to_dict()

    def results(q, _):
        # no default end: a study the scheduler has booked for a later day must still show up
        found = data.results(who(q), q.get("kind"), start=q.get("start"), end=q.get("end"))
        return 200, [r.to_dict() for r in found]

    def save_result(_, body):
        fields = {"crew_id", "kind", "timestamp", "payload"}
        if not isinstance(body, dict) or not fields <= body.keys():
            raise ValueError("send a JSON object with crew_id, kind, timestamp and payload")
        if set(body) - fields - {"model_version"}:
            raise ValueError(f"unknown fields: {sorted(set(body) - fields - {'model_version'})}")
        if not isinstance(body["payload"], dict):
            raise ValueError("payload must be a JSON object")
        who({"crew": body["crew_id"]})      # an unknown crew member answers 404, as on the GET endpoints
        return 201, data.save_result(**body).to_dict()

    return {("GET", "/api/v1/mission"): mission_info,
            ("GET", "/api/v1/readings"): readings, ("GET", "/api/v1/latest"): latest,
            ("GET", "/api/v1/context"): context, ("GET", "/api/v1/context/current"): current_context,
            ("GET", "/api/v1/results"): results, ("POST", "/api/v1/results"): save_result}


def run_booked_studies(mission: Mission, data: DataService, day: float, done: set[str]) -> int:
    """Stand in for the crew running the retests the Planner books (docs/planner.md): each retest item of the
    plan (a result of kind "plan") that is still booked and whose window has opened is measured on its
    measure's instrument at the start of its window, and ingested like any other reading. Routine studies are
    left alone, since the generator's own timeline already holds them. `done` keeps the retests run so far;
    readings already stored at that time (from before a restart) count as run. Returns how many it ran."""
    ran = 0
    for crew in mission.crew:
        for record in data.results(crew.id, kind="plan"):
            for item in record.payload.get("items", []):
                key = f"{crew.id}:{item.get('id')}"
                measure = item.get("measure")
                if (item.get("type") != "retest" or item.get("status") != "booked" or key in done
                        or measure not in MEASURES):
                    continue
                at = float(item["window"]["day_from"])
                if at > day:
                    continue
                done.add(key)
                instrument = INSTRUMENTS[MEASURES[measure]["instrument"]](seed=zlib.crc32(key.encode()))
                stamp = mission.timestamp(at)
                if data.readings(crew.id, instrument.measures, start=stamp, end=stamp):
                    continue
                data.ingest(instrument.measure_all(crew, at))
                ran += 1
    return ran


def main(argv=None):
    parser = mission_parser(__doc__, port=8000)
    parser.add_argument('--db', default=':memory:', help='SQLite data file')
    parser.add_argument('--queue', help='SQLite message queue file for the local demo')
    parser.add_argument('--run-booked', action='store_true',
                        help="run the retests the Planner books (the Planner turns a repeated finding into a review, not another retest)")
    args = parser.parse_args(argv)
    mission = Mission.random(args.preset, n_crew=args.crew, seed=args.seed)
    apply_fatigue(mission, args.fatigue)
    apply_sans(mission, args.sans)
    data = DataService(store=SqliteStore(args.db), publisher=Queue(args.queue) if args.queue else None)
    clock = mission_clock(mission, args.day, args.speed)
    pending = iter(mission.timeline(seed=args.seed))
    next_reading = next(pending, None)
    booked_done: set[str] = set()
    def advance():
        nonlocal next_reading
        while True:
            day = clock()
            if args.run_booked:
                try:
                    run_booked_studies(mission, data, day, booked_done)
                except Exception:
                    logging.exception('Could not run the booked studies; retrying')
            batch = []
            while next_reading is not None and next_reading.mission_day <= day:
                batch.append(next_reading)
                next_reading = next(pending, None)
            if batch:
                while True:
                    try:
                        data.ingest(batch)
                        break
                    except Exception:
                        logging.exception('Could not ingest simulated readings; retrying')
                        time.sleep(1)
            time.sleep(1)
    # Publish initial readings synchronously before the API starts.
    initial = []
    while next_reading is not None and next_reading.mission_day <= clock():
        initial.append(next_reading)
        next_reading = next(pending, None)
    data.ingest(initial)
    data.ingest_context(mission.context())
    threading.Thread(target=advance, daemon=True).start()
    server = make_server(data_routes(mission, data, clock), args.port, args.origin)
    print(f"DataService: {args.preset}, crew {[c.id for c in mission.crew]}, day {args.day}"
          f"{f' +{args.speed} d/min' if args.speed else ''} on http://localhost:{args.port}/api/v1/readings", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
