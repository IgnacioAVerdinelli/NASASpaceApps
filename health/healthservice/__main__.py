"""Run the HealthService on port 3000, for the 3D page.

By default it reads from the DataService's HTTP API. Start the DataService first, in another terminal:

    python -m gravsim.serve --day 95 --speed 20                   # port 8000
    python -m healthservice                                       # port 3000
    VITE_DASHBOARD_URL=http://localhost:3000/api/v1/dashboard npm run dev     # in src/front/sketch

With --gravsim it runs gravsim's DataService in its own process instead, with no other server:

    python -m healthservice --gravsim --day 95 --speed 20
"""
from __future__ import annotations

import argparse
import sys

import uvicorn

from .api import create_app
from .service import HealthService
from .sources import DataServiceError, DataServiceSource, GravsimSource


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-url", default="http://localhost:8000", help="DataService API (default %(default)s)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=3000)
    ap.add_argument("--origin", default="*", help="origin allowed by CORS")
    sim = ap.add_argument_group("with --gravsim (the same options as gravsim.serve)")
    sim.add_argument("--gravsim", action="store_true", help="run gravsim's DataService in this process")
    sim.add_argument("--preset", default="iss_180", choices=["iss_180", "artemis_30", "mars"])
    sim.add_argument("--crew", type=int, default=4, help="number of random crew members")
    sim.add_argument("--seed", type=int, default=7)
    sim.add_argument("--day", type=float, default=95.0, help="mission day to start at (0 = launch)")
    sim.add_argument("--speed", type=float, default=0.0, help="mission days per real minute (0 = fixed day)")
    args = ap.parse_args(argv)

    if args.gravsim:
        source = GravsimSource(args.preset, n_crew=args.crew, seed=args.seed, day=args.day, speed=args.speed)
        data = (f"gravsim {args.preset} in this process, day {args.day}"
                f"{f' +{args.speed} d/min' if args.speed else ''}")
    else:
        try:
            source = DataServiceSource(args.data_url)
        except DataServiceError as e:
            sys.exit(f"{e}\nStart the DataService first (python -m gravsim.serve), or run with --gravsim.")
        data = f"DataService {args.data_url}, mission {source.mission().name}"
    app = create_app(HealthService(source), allow_origin=args.origin)
    print(f"HealthService on http://localhost:{args.port}/api/v1/dashboard "
          f"({data}, crew {[c.id for c in source.crew()]})", flush=True)
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
