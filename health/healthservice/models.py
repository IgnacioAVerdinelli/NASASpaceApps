"""What the HealthService knows about a mission, a crew member and a reading.

These are the shapes the DataService sends (GET /api/v1/mission and /api/v1/readings). A reading keeps only
what a real monitoring system would see: the simulator's `truth` and `status` fields are dropped on the way in.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


def parse_time(text: str) -> datetime:
    """A UTC ISO time as the DataService writes them ("2027-01-01T12:00:00Z"); without a zone it is taken as UTC."""
    t = datetime.fromisoformat(text.replace("Z", "+00:00"))
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


@dataclass(frozen=True)
class Phase:
    name: str
    start: float          # mission day (0 = launch)
    end: float
    gravity_g: float      # 1.0 Earth, 0 free fall


@dataclass
class MissionInfo:
    launch_date: datetime
    phases: list[Phase]
    name: str = ""
    _cum: list[float] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self):
        self.phases = sorted(self.phases, key=lambda p: p.start)
        if self.launch_date.tzinfo is None:
            self.launch_date = self.launch_date.replace(tzinfo=timezone.utc)

    @property
    def start(self) -> float:
        return self.phases[0].start

    @property
    def end(self) -> float:
        return self.phases[-1].end

    @property
    def landing(self) -> float:
        """First day back in Earth gravity after the last unloaded phase."""
        flight = [p for p in self.phases if p.gravity_g < 1.0]
        return max(p.end for p in flight) if flight else 0.0

    def phase(self, day: float) -> Phase:
        """The phase under way on mission `day`; before the first phase the first one, after the last the last."""
        for p in self.phases:
            if p.start <= day < p.end:
                return p
        return self.phases[0] if day < self.start else self.phases[-1]

    def gravity(self, day: float) -> float:
        return self.phase(day).gravity_g

    def timestamp(self, day: float) -> str:
        t = self.launch_date + timedelta(days=float(day))
        return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def day_of(self, timestamp: str) -> float:
        """The mission day of a UTC ISO time such as "2027-04-06T12:00:00Z" (the inverse of timestamp)."""
        return (parse_time(timestamp) - self.launch_date) / timedelta(days=1)

    def label(self, day: float) -> str:
        """NASA-style day label: L-30 before launch, FD12 in flight, R+5 after landing."""
        if day < 0:
            return f"L{int(math.floor(day))}"
        if day < self.landing:
            return f"FD{int(math.floor(day)) + 1}"
        return f"R+{int(math.floor(day - self.landing))}"

    def unloaded_days(self, day: float) -> float:
        """Equivalent days of full unloading (1 - g per day) from the start of the timeline up to `day`."""
        start = int(math.floor(self.start))
        if not self._cum:
            total = 0.0
            self._cum.append(total)
            for d in range(start, int(math.floor(self.end))):
                total += min(1.0, max(0.0, 1.0 - self.gravity(d)))
                self._cum.append(total)
        pos = day - start
        if pos <= 0:
            return self._cum[0]
        if pos >= len(self._cum) - 1:
            return self._cum[-1]
        i = int(math.floor(pos))
        return self._cum[i] + (pos - i) * (self._cum[i + 1] - self._cum[i])


@dataclass(frozen=True)
class CrewInfo:
    id: str
    sex: str              # "F" or "M"


@dataclass(frozen=True)
class Reading:
    crew_id: str
    measure: str
    mission_day: float
    timestamp: str
    value: float | None
    unit: str
    quality: str = "ok"
    synthetic: bool = False
    extrapolated: bool = False

    @classmethod
    def from_record(cls, r: dict, mission: MissionInfo | None = None) -> "Reading":
        """Build from a DataService record, ignoring any other field (truth, status, ...).

        A real sensor may send no mission day; it is then worked out from the timestamp and the mission's launch.
        """
        day = r.get("mission_day")
        if day is None:
            if mission is None:
                raise ValueError(f"a reading without mission_day needs the mission to place it: {r.get('timestamp')}")
            day = mission.day_of(r["timestamp"])
        return cls(crew_id=r["crew_id"], measure=r["measure"], mission_day=float(day),
                   timestamp=r["timestamp"], value=r.get("value"), unit=r.get("unit", ""),
                   quality=r.get("quality", "ok"), synthetic=bool(r.get("synthetic", False)),
                   extrapolated=bool(r.get("extrapolated", False)))
