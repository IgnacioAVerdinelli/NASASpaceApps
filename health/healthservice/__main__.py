"""Run the HealthService with gravsim standing in for the DataService.

    python -m healthservice --preset iss_180 --day 95 --speed 20 --port 3000
    VITE_DASHBOARD_URL=http://localhost:3000/api/v1/dashboard npm run dev     (in src/front/sketch, design-body)
"""
from __future__ import annotations

import argparse

import uvicorn

from .api import create_app
from .service import HealthService
from .sources import GravsimSource


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preset", default="iss_180", choices=["iss_180", "artemis_30", "mars"])
    ap.add_argument("--crew", type=int, default=4, help="number of random crew members")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--day", type=float, default=95.0, help="mission day to start at (0 = launch)")
    ap.add_argument("--speed", type=float, default=0.0, help="mission days per real minute (0 = fixed day)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=3000)
    ap.add_argument("--origin", default="*", help="origin allowed by CORS")
    args = ap.parse_args(argv)

    source = GravsimSource(args.preset, n_crew=args.crew, seed=args.seed, day=args.day, speed=args.speed)
    app = create_app(HealthService(source), allow_origin=args.origin)
    print(f"HealthService on http://localhost:{args.port}/api/v1/dashboard "
          f"(gravsim {args.preset}, crew {[c.id for c in source.crew()]}, day {args.day}"
          f"{f' +{args.speed} d/min' if args.speed else ''})")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
