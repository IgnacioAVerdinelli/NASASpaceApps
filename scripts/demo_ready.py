"""Wait until the demo services are available and both event consumers have caught up."""
import json
import sqlite3
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen


def ready(queue_path, port, planner_port):
    try:
        for url in (f"http://127.0.0.1:{port}/api/v1/health", f"http://127.0.0.1:{planner_port}/api/v1/health"):
            with urlopen(url, timeout=3) as response:
                if len(json.load(response).get("crew", [])) != 5:
                    return False
        with sqlite3.connect(queue_path, timeout=3) as db:
            last = db.execute("SELECT MAX(id) FROM messages WHERE channel='events'").fetchone()[0]
            cursors = dict(db.execute("SELECT consumer, message_id FROM cursors WHERE consumer IN ('health', 'planner')"))
        return last is not None and all(cursors.get(name, 0) >= last for name in ("health", "planner"))
    except (OSError, ValueError, URLError, sqlite3.Error):
        return False


if __name__ == "__main__":
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        if ready(*sys.argv[1:]):
            time.sleep(1)
            if ready(*sys.argv[1:]):
                sys.exit(0)
        time.sleep(1)
    sys.exit("Tiempo de espera agotado al preparar la demo")
