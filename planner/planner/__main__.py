"""Run the Planner on port 3001.

    python -m gravsim.serve --day 95 --speed 20 --queue /tmp/nasa-queue.sqlite     # DataService, port 8000
    python -m planner --queue /tmp/nasa-queue.sqlite --simulate-crew               # Planner, port 3001

A background loop handles the event queue (findings, new readings) and brings every crew member's plan up to the
mission clock every few seconds, so plans are saved and reminders sent even if nobody opens the page.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import threading
import time

import uvicorn

from .api import create_app
from .service import Planner
from .sources import DataServiceError, DataServiceSource


def worker(planner: Planner, interval: float) -> None:
    last = 0.0
    while True:
        try:
            planner.drain()
            if time.monotonic() - last >= interval:
                planner.refresh_all()
                last = time.monotonic()
        except Exception:
            logging.exception("Planner loop failed; retrying")
        time.sleep(0.5)


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-url", default="http://127.0.0.1:8000",
                        help="DataService URL (127.0.0.1, not localhost: on Windows localhost tries IPv6 first, 2 s per request)")
    parser.add_argument("--queue", default=os.environ.get("NASA_QUEUE"),
                        help="SQLite queue file shared with the other services (default: $NASA_QUEUE); "
                             "without it, no findings are received and no reminders sent")
    parser.add_argument("--port", type=int, default=3001)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--origin", default="*", help="allowed CORS origin")
    parser.add_argument("--interval", type=float, default=5.0, help="seconds between plan refreshes")
    parser.add_argument("--simulate-crew", action="store_true",
                        help="demo only: mark every crew-closed item done in the middle of its window")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO)

    try:
        source = DataServiceSource(args.data_url)
    except DataServiceError as e:
        sys.exit(f"Cannot reach the DataService: {e}")
    queue = None
    if args.queue:
        from gravsim.queue import Queue
        queue = Queue(args.queue)
    planner = Planner(source, queue=queue, simulate_crew=args.simulate_crew)
    threading.Thread(target=worker, args=(planner, args.interval), daemon=True).start()
    uvicorn.run(create_app(planner, args.origin), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
