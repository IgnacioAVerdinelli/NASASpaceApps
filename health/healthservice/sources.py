"""Where the HealthService gets its data from.

`DataSource` is what the HealthService needs from the DataService. Its real API is still to be agreed
(docs/health-service.md, question 1); until it exists, `GravsimSource` stands in for it by running gravsim
in the same process.
"""
from __future__ import annotations

import time
from typing import Callable, Protocol

from .models import CrewInfo, MissionInfo, Phase, Reading
from .processing import MeasureResult


class DataSource(Protocol):
    def mission(self) -> MissionInfo: ...
    def crew(self) -> list[CrewInfo]: ...
    def current_day(self) -> float: ...
    def readings(self, crew_id: str, until_day: float) -> list[Reading]: ...
    def save_results(self, results: list[MeasureResult]) -> None: ...


def mission_info(sim_mission) -> MissionInfo:
    """A gravsim Mission as the HealthService sees a mission."""
    return MissionInfo(launch_date=sim_mission.launch_date,
                       phases=[Phase(p.name, p.start, p.end, p.gravity_g) for p in sim_mission.phases])


class GravsimSource:
    """Stand-in for the DataService: gravsim readings for a random crew, revealed as the mission clock advances.

    The clock works like gravsim's serve.py: it starts at `day` and, with `speed`, advances that many mission
    days per real minute. Readings go through `Reading.from_record`, so the simulator's `truth` and `status`
    never reach the HealthService. Saved results are kept in memory.
    """

    def __init__(self, preset: str = "iss_180", n_crew: int = 4, seed: int = 7, day: float = 95.0,
                 speed: float = 0.0, clock: Callable[[], float] = time.monotonic, mission=None):
        """mission: a gravsim Mission with its crew already set (to choose who skips exercise, for example);
        by default gravsim's Mission.random(preset, n_crew, seed)."""
        import gravsim as gs
        from gravsim.schedule import default_instruments, timeline

        self.sim_mission = mission or gs.Mission.random(preset, n_crew=n_crew, seed=seed)
        self.sim_readings = timeline(self.sim_mission, "nasa", instruments=default_instruments(seed))
        m = self.sim_mission
        self._mission = mission_info(m)
        self._crew = [CrewInfo(c.id, c.sex) for c in m.crew]
        self._readings = [Reading.from_record(r.to_dict()) for r in self.sim_readings]
        self._day, self._speed, self._clock = day, speed, clock
        self._started = clock()
        self.saved_results: list[MeasureResult] = []

    def mission(self) -> MissionInfo:
        return self._mission

    def crew(self) -> list[CrewInfo]:
        return list(self._crew)

    def current_day(self) -> float:
        return min(self._mission.end, self._day + self._speed * (self._clock() - self._started) / 60.0)

    def readings(self, crew_id: str, until_day: float) -> list[Reading]:
        return [r for r in self._readings if r.crew_id == crew_id and r.mission_day <= until_day]

    def save_results(self, results: list[MeasureResult]) -> None:
        self.saved_results.extend(results)
