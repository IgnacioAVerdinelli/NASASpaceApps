"""What the Planner needs from the DataService (HTTP API of `python -m gravsim.serve`, port 8000).

Only facts: the mission and its clock, the crew, which instrument readings arrived, the spacewalks in the crew
timeline, and somewhere to keep the plan (results of kind "plan"). The Planner never judges a reading's value.
"""
from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .catalog import Eva
from .mission import Mission

PLAN_KIND = "plan"
PLAN_VERSION = "planner-1"


class DataServiceError(RuntimeError):
    """The DataService could not be reached, or answered with an error."""


class DataServiceSource:
    def __init__(self, url: str = "http://127.0.0.1:8000", timeout: float = 10.0):
        self.url = url.rstrip("/")
        self.timeout = timeout
        m = self._request("GET", "/api/v1/mission")
        self._mission = Mission.from_api(m)
        self._crew = [c["id"] for c in m["crew"]]

    # ------------------------------------------------------------------ facts
    def mission(self) -> Mission:
        return self._mission

    def crew(self) -> list[str]:
        return list(self._crew)

    def current_day(self) -> float:
        return float(self._request("GET", "/api/v1/mission")["now_day"])

    def readings(self, crew_id: str, measures: list[str], day: float) -> list[dict]:
        """Readings of `measures` up to mission `day`, as the DataService sends them."""
        if not measures:
            return []
        return self._request("GET", "/api/v1/readings",
                             {"crew": crew_id, "measures": ",".join(measures), "day": repr(float(day))})

    def evas(self, crew_id: str) -> list[Eva]:
        """The crew member's spacewalks in the crew timeline, launch to landing."""
        m = self._mission
        records = self._request("GET", "/api/v1/context", {"crew": crew_id, "start": m.timestamp(0),
                                                            "end": m.timestamp(m.landing)})
        return [Eva(m.day_of(r["start"]), m.day_of(r["end"])) for r in records if r.get("activity") == "eva"]

    # ------------------------------------------------------------------ the plan
    def load_plan(self, crew_id: str) -> list[dict] | None:
        records = self._request("GET", "/api/v1/results", {"crew": crew_id, "kind": PLAN_KIND})
        mine = [r for r in records if r.get("model_version") == PLAN_VERSION]
        return mine[-1]["payload"].get("items", []) if mine else None

    def save_plan(self, crew_id: str, items: list[dict], generated_at: str) -> None:
        self._request("POST", "/api/v1/results", body={
            "crew_id": crew_id, "kind": PLAN_KIND, "timestamp": self._mission.timestamp(self._mission.start),
            "model_version": PLAN_VERSION, "payload": {"generated_at": generated_at, "items": items}})

    def _request(self, method: str, path: str, query: dict | None = None, body: dict | None = None):
        url = self.url + path + (f"?{urlencode(query)}" if query else "")
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
        try:
            with urlopen(Request(url, data=data, headers=headers, method=method), timeout=self.timeout) as resp:
                return json.loads(resp.read())
        except HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:300]
            raise DataServiceError(f"{method} {url} answered {e.code}: {detail}") from e
        except (URLError, OSError, ValueError) as e:
            raise DataServiceError(f"{method} {url} failed: {e}") from e


class RoutesSource(DataServiceSource):
    """The same API answered in this process by gravsim's route table (gravsim.serve.data_routes), for the tests
    and a demo with no other server."""

    def __init__(self, routes: dict):
        self.routes = routes
        m = self._request("GET", "/api/v1/mission")
        self._mission = Mission.from_api(m)
        self._crew = [c["id"] for c in m["crew"]]

    def _request(self, method, path, query=None, body=None):
        code, answer = self.routes[method, path](query or {}, body)
        if code >= 400:
            raise DataServiceError(f"{method} {path} answered {code}: {answer}")
        return answer
