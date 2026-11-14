"""Where the HealthService gets its data from.

`DataSource` is what the HealthService needs from the DataService:

- the mission (launch date, phases with their gravity) and the crew, with each member's sex;
- the mission day now, by the DataService's clock;
- a crew member's readings up to a mission day;
- somewhere to save what it computes.

`DataServiceSource` asks the DataService's HTTP API for them (`python -m gravsim.serve`, port 8000).
`GravsimSource` runs gravsim's DataService in this process instead, for the tests, the evaluation and a demo
with no other server. Both send the readings through the DataService's cleaning (stored units, quality flags),
and neither lets the simulator's `truth` and `status` reach the HealthService.
"""
from __future__ import annotations

import json
import time
from typing import Callable, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .models import CrewInfo, MissionInfo, Phase, Reading, parse_time
from .processing import MEASURES, MeasureResult

RESULT_KIND = "measure_results"
SHARED = ("crew_id", "measure", "mission_day", "model_version")     # fields every result of one save has in common


class DataSource(Protocol):
    def mission(self) -> MissionInfo: ...
    def crew(self) -> list[CrewInfo]: ...
    def current_day(self) -> float: ...
    def readings(self, crew_id: str, until_day: float) -> list[Reading]: ...
    def save_results(self, results: list[MeasureResult]) -> None: ...


def result_record(mission: MissionInfo, results: list[MeasureResult]) -> dict:
    """One crew member's results at one moment, as one DataService result (the body of POST /api/v1/results).

    All the measures go in one record: the DataService keeps one result per crew member, kind, time and model
    version, so one record per measure at the same time would overwrite each other.
    """
    first = results[0]
    measures = {r.measure: {k: v for k, v in r.to_dict().items() if k not in SHARED} for r in results}
    return {"crew_id": first.crew_id, "kind": RESULT_KIND, "timestamp": mission.timestamp(first.mission_day),
            "model_version": first.model_version,
            "payload": {"mission_day": first.mission_day, "measures": measures}}


# --------------------------------------------------------------------------- the DataService over HTTP

class DataServiceError(RuntimeError):
    """The DataService could not be reached, or answered with an error."""


class DataServiceSource:
    """The DataService's HTTP API: GET /api/v1/mission, GET /api/v1/readings and POST /api/v1/results.

    The mission and the crew are read once, at start-up; the mission day now is read on every request, so the
    HealthService follows the DataService's clock.
    """

    def __init__(self, url: str = "http://localhost:8000", timeout: float = 5.0):
        self.url = url.rstrip("/")
        self.timeout = timeout
        m = self._request("GET", "/api/v1/mission")
        self._mission = MissionInfo(
            launch_date=parse_time(m["launch_date"]), name=m.get("name", ""),
            phases=[Phase(p["name"], p["start"], p["end"], p["gravity_g"]) for p in m["phases"]])
        self._crew = [CrewInfo(c["id"], c["sex"]) for c in m["crew"]]

    def mission(self) -> MissionInfo:
        return self._mission

    def crew(self) -> list[CrewInfo]:
        return list(self._crew)

    def current_day(self) -> float:
        return float(self._request("GET", "/api/v1/mission")["now_day"])

    def readings(self, crew_id: str, until_day: float) -> list[Reading]:
        records = self._request("GET", "/api/v1/readings",
                                {"crew": crew_id, "day": repr(float(until_day)), "measures": ",".join(MEASURES)})
        return [Reading.from_record(r, self._mission) for r in records]

    def save_results(self, results: list[MeasureResult]) -> None:
        if results:
            self._request("POST", "/api/v1/results", body=result_record(self._mission, results))

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
        except (URLError, OSError, ValueError) as e:      # not reachable, timed out, or not JSON
            raise DataServiceError(f"{method} {url} failed: {e}") from e


# --------------------------------------------------------------------------- gravsim in this process

def mission_info(sim_mission) -> MissionInfo:
    """A gravsim Mission as the HealthService sees a mission (what GET /api/v1/mission sends)."""
    return MissionInfo(launch_date=sim_mission.launch_date, name=sim_mission.name,
                       phases=[Phase(p.name, p.start, p.end, p.gravity_g) for p in sim_mission.phases])


class GravsimSource:
    """gravsim's DataService in this process, fed with a gravsim crew, as `python -m gravsim.serve` does.

    The clock works like gravsim.serve's: it starts at `day` and, with `speed`, advances that many mission days
    per real minute. Readings go through the DataService's cleaning and then `Reading.from_record`, so the
    HealthService sees what DataServiceSource would get over HTTP. Results are saved in that DataService.
    """

    def __init__(self, preset: str = "iss_180", n_crew: int = 4, seed: int = 7, day: float = 95.0,
                 speed: float = 0.0, clock: Callable[[], float] = time.monotonic, mission=None):
        """mission: a gravsim Mission with its crew already set (to choose who skips exercise, for example);
        by default gravsim's Mission.random(preset, n_crew, seed), the crew gravsim.serve generates."""
        import gravsim as gs

        self.sim_mission = mission or gs.Mission.random(preset, n_crew=n_crew, seed=seed)
        self.data = gs.DataService()
        self.data.ingest(self.sim_mission.timeline(seed=seed))
        self._mission = mission_info(self.sim_mission)
        self._crew = [CrewInfo(c.id, c.sex) for c in self.sim_mission.crew]
        self._readings = {c.id: [Reading.from_record(r.to_dict(), self._mission)
                                 for r in self.data.readings(c.id, MEASURES)] for c in self._crew}
        self._day, self._speed, self._clock = day, speed, clock
        self._started = clock()

    def mission(self) -> MissionInfo:
        return self._mission

    def crew(self) -> list[CrewInfo]:
        return list(self._crew)

    def current_day(self) -> float:
        return min(self._mission.end, self._day + self._speed * (self._clock() - self._started) / 60.0)

    def readings(self, crew_id: str, until_day: float) -> list[Reading]:
        return [r for r in self._readings[crew_id] if r.mission_day <= until_day]

    def save_results(self, results: list[MeasureResult]) -> None:
        if results:
            self.data.save_result(**result_record(self._mission, results))

    @property
    def saved_results(self) -> list:
        """The results saved so far (gravsim Result records), every crew member."""
        return [r for c in self._crew for r in self.data.results(c.id, RESULT_KIND)]
