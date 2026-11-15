"""The mission as the Planner sees it: launch date, phases and the mission-day <-> time conversion.

Built from the DataService's GET /api/v1/mission. Mission day 0 is launch; landing is the end of the last phase
with less than Earth gravity. Same conventions as the HealthService (health/healthservice/models.py).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def parse_time(text: str) -> datetime:
    t = datetime.fromisoformat(text.replace("Z", "+00:00"))
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


@dataclass(frozen=True)
class Phase:
    name: str
    start: float
    end: float
    gravity_g: float


@dataclass
class Mission:
    launch_date: datetime
    phases: list[Phase]
    name: str = ""

    def __post_init__(self):
        self.phases = sorted(self.phases, key=lambda p: p.start)
        if self.launch_date.tzinfo is None:
            self.launch_date = self.launch_date.replace(tzinfo=timezone.utc)

    @classmethod
    def from_api(cls, m: dict) -> "Mission":
        return cls(launch_date=parse_time(m["launch_date"]), name=m.get("name", ""),
                   phases=[Phase(p["name"], p["start"], p["end"], p["gravity_g"]) for p in m["phases"]])

    @property
    def start(self) -> float:
        return self.phases[0].start

    @property
    def end(self) -> float:
        return self.phases[-1].end

    @property
    def landing(self) -> float:
        flight = [p for p in self.phases if p.gravity_g < 1.0]
        return max(p.end for p in flight) if flight else 0.0

    def timestamp(self, day: float) -> str:
        return (self.launch_date + timedelta(days=float(day))).astimezone(timezone.utc).strftime(TIME_FORMAT)

    def day_of(self, timestamp: str) -> float:
        return (parse_time(timestamp) - self.launch_date) / timedelta(days=1)

    def label(self, day: float) -> str:
        """NASA-style day label: L-30 before launch, FD12 in flight, R+5 after landing."""
        if day < 0:
            return f"L{int(math.floor(day))}"
        if day < self.landing:
            return f"FD{int(math.floor(day)) + 1}"
        return f"R+{int(math.floor(day - self.landing))}"
