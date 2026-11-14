"""MOCK of the HealthService's dashboard API, for the 3D page demo. Run it from sim/:

    python -m mocks.healthservice.serve --preset iss_180 --day 95 --speed 20 --port 3000
    VITE_DASHBOARD_URL=http://localhost:3000/api/v1/dashboard npm run dev     (in src/front/sketch)

At start-up gravsim generates the whole mission and sends it through a DataService in this process; the mock
HealthService builds each dashboard from it.

GET /api/v1/dashboard    dashboard JSON (contract version 1) for one crew member

Query parameters, all optional: crew=CM-2 (default: the first), day=120 (mission day; default: the clock).
With --speed N the mission clock advances N days per real minute, so the page (which polls every 3 seconds)
shows the mission unfolding.
"""
from __future__ import annotations

from gravsim import DataService, Mission
from gravsim.serve import NotFound, make_server, mission_clock, mission_parser

from .health import HealthService


def dashboard_routes(mission: Mission, health: HealthService, clock) -> dict:
    def dashboard(q, _):
        crew = next((c for c in mission.crew if c.id == q.get("crew", mission.crew[0].id)), None)
        if crew is None:
            raise NotFound({"error": f"no crew member {q['crew']}", "crew": [c.id for c in mission.crew]})
        return 200, health.dashboard(crew, float(q["day"]) if "day" in q else clock())

    return {("GET", "/api/v1/dashboard"): dashboard}


def main(argv=None):
    args = mission_parser(__doc__, port=3000).parse_args(argv)
    mission = Mission.random(args.preset, n_crew=args.crew, seed=args.seed)
    data = DataService()
    data.ingest(mission.timeline(seed=args.seed))
    server = make_server(dashboard_routes(mission, HealthService(data), mission_clock(mission, args.day, args.speed)),
                         args.port, args.origin)
    print(f"HealthService MOCK: {args.preset}, crew {[c.id for c in mission.crew]}, day {args.day}"
          f"{f' +{args.speed} d/min' if args.speed else ''} on http://localhost:{args.port}/api/v1/dashboard", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
