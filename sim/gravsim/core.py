"""Mission timeline, crew members and the physiology model behind every reading.

The model works in "% change from the person's own pre-flight baseline" for each measure.
Two shapes, both fitted from the bed-rest data (see params.json):

* saturating (muscle strength, lean mass, VO2peak, resting heart rate and pressure):
  while unloaded the change moves towards a plateau with time constant tau; back in gravity it
  returns towards 0 with the recovery time constant.
* linear (bone density): a steady loss per unloaded day; back in gravity an exponential recovery.

Exercise adherence (0..1) scales the loss by (1 - exercise_effect * adherence). Gravity scales it by
the unloading factor, 1 - g by default (0 g = full unloading, 1 g = none); partial gravity is not
in the data, so readings taken after a partial-gravity phase are flagged as extrapolated.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable, Sequence

import numpy as np

PARAMS: dict = json.loads((Path(__file__).with_name("params.json")).read_text())
MEASURES: dict = PARAMS["measures"]
MODEL_VERSION: str = PARAMS["model_version"]
MAX_DATA_DAYS: float = PARAMS["max_unloading_days_in_data"]

# Handy groups for events and filters
GROUPS = {
    "legs": ["knee_extension_60", "knee_flexion_60", "ankle_plantarflexion_30", "ankle_dorsiflexion_30", "lean_legs"],
    "trunk": ["trunk_extension_60", "trunk_flexion_60", "lean_trunk"],
    "arms": ["lean_arms"],
    "bone": ["hip_bmd", "spine_bmd", "heel_bmd"],
    "cardio": ["vo2peak", "resting_hr", "resting_sbp", "resting_dbp"],
    "strength": ["knee_extension_60", "knee_flexion_60", "ankle_plantarflexion_30", "ankle_dorsiflexion_30",
                 "trunk_extension_60", "trunk_flexion_60"],
}


def expand(measures: str | Iterable[str] | None) -> list[str]:
    """Measure ids from ids and/or group names ("legs", "bone", ...). None means every measure."""
    if measures is None:
        return list(MEASURES)
    if isinstance(measures, str):
        measures = [measures]
    out: list[str] = []
    for m in measures:
        if m in GROUPS:
            out += GROUPS[m]
        elif m in MEASURES:
            out.append(m)
        else:
            raise KeyError(f"unknown measure or group {m!r}; measures: {sorted(MEASURES)}, groups: {sorted(GROUPS)}")
    return list(dict.fromkeys(out))


# --------------------------------------------------------------------------- mission

@dataclass(frozen=True)
class Phase:
    name: str
    start: float          # mission day (0 = launch)
    end: float
    gravity_g: float      # 1.0 Earth, 0.38 Mars, 0.166 Moon, 0 free fall


def _preset(name: str) -> list[Phase]:
    if name == "iss_180":
        return [Phase("preflight", -180, 0, 1.0), Phase("flight", 0, 180, 0.0), Phase("postflight", 180, 545, 1.0)]
    if name == "artemis_30":
        return [Phase("preflight", -180, 0, 1.0), Phase("transit", 0, 12, 0.0), Phase("lunar_surface", 12, 18, 0.166),
                Phase("transit_return", 18, 30, 0.0), Phase("postflight", 30, 395, 1.0)]
    if name == "mars":
        return [Phase("preflight", -180, 0, 1.0), Phase("transit", 0, 180, 0.0), Phase("mars_surface", 180, 680, 0.38),
                Phase("transit_return", 680, 860, 0.0), Phase("postflight", 860, 1225, 1.0)]
    raise KeyError(f"unknown preset {name!r}; use iss_180, artemis_30 or mars")


PRESETS = ("iss_180", "artemis_30", "mars")


class Mission:
    """A mission timeline (phases with a gravity level) plus its crew.

    >>> m = Mission("iss_180", launch_date="2027-03-01")
    >>> cm = m.add_crew("CM-1", adherence=1.0, seed=1)
    """

    def __init__(self, phases: str | Sequence[Phase] = "iss_180", launch_date: str | datetime | None = None,
                 unloading: Callable[[float], float] | None = None, name: str | None = None):
        self.name = name or (phases if isinstance(phases, str) else "custom")
        self.phases = _preset(phases) if isinstance(phases, str) else list(phases)
        self.phases.sort(key=lambda p: p.start)
        if launch_date is None:
            launch_date = datetime(2027, 1, 1, 12, tzinfo=timezone.utc)
        elif isinstance(launch_date, str):
            launch_date = datetime.fromisoformat(launch_date)
        if launch_date.tzinfo is None:
            launch_date = launch_date.replace(hour=12, tzinfo=timezone.utc)
        self.launch_date = launch_date
        self.unloading = unloading or (lambda g: min(1.0, max(0.0, 1.0 - g)))
        self.crew: list[CrewMember] = []

    # timeline facts
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
        for p in self.phases:
            if p.start <= day < p.end:
                return p
        return self.phases[0] if day < self.start else self.phases[-1]

    def gravity(self, day: float) -> float:
        return self.phase(day).gravity_g

    def timestamp(self, day: float) -> str:
        t = self.launch_date + timedelta(days=float(day))
        return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")      # the frontend accepts at most milliseconds

    def label(self, day: float) -> str:
        """NASA-style day label: L-30 before launch, FD12 in flight, R+5 after landing."""
        if day < 0:
            return f"L{int(math.floor(day))}"
        if day < self.landing:
            return f"FD{int(math.floor(day)) + 1}"
        return f"R+{int(math.floor(day - self.landing))}"

    def unloaded_days(self, day: float) -> float:
        """Equivalent days of full unloading from the start of the timeline up to `day`."""
        if not hasattr(self, "_unload"):
            grid = np.arange(self.start, self.end + 1.0, 1.0)
            self._unload = (grid, np.concatenate([[0.0], np.cumsum([self.unloading(self.gravity(d)) for d in grid[:-1]])]))
        grid, cum = self._unload
        return float(np.interp(day, grid, cum))

    # crew
    def add_crew(self, crew_id: str | None = None, **kwargs) -> "CrewMember":
        cm = CrewMember(self, crew_id or f"CM-{len(self.crew) + 1}", **kwargs)
        self.crew.append(cm)
        return cm

    def timeline(self, *args, **kwargs):
        from .schedule import timeline
        return timeline(self, *args, **kwargs)

    @classmethod
    def random(cls, preset: str = "iss_180", n_crew: int = 4, seed: int | None = None, **kwargs) -> "Mission":
        """A mission with randomly varied crew: mostly on the exercise routine, some slipping,
        the odd fast responder or injury. Instruments with faults come from schedule.default_instruments."""
        rng = np.random.default_rng(seed)
        m = cls(preset, **kwargs)
        flight_end = m.landing
        for i in range(n_crew):
            adherence: float | list = float(rng.uniform(0.75, 1.0))
            if rng.random() < 0.3 and flight_end > 40:          # a period of skipped exercise
                start = float(rng.uniform(20, max(21, flight_end - 40)))
                adherence = [(m.start, adherence), (start, float(rng.uniform(0.1, 0.5))),
                             (start + float(rng.uniform(20, 60)), adherence)]
            cm = m.add_crew(f"CM-{i + 1}", adherence=adherence,
                            responder="fast" if rng.random() < 0.15 else "typical",
                            seed=int(rng.integers(1 << 31)))
            if rng.random() < 0.15 and flight_end > 30:
                cm.add_event(day=float(rng.uniform(10, flight_end - 10)), measures="legs",
                             severity_pct=float(rng.uniform(5, 15)), recovery_days=float(rng.uniform(10, 40)),
                             label="lower-limb injury")
        return m


# --------------------------------------------------------------------------- crew

@dataclass
class Event:
    """An acute change on a given day (injury, illness): an extra change that decays back."""
    day: float
    measures: list[str]
    severity_pct: float = 10.0       # size of the extra change, in % of baseline, in the measure's worse direction
    recovery_days: float = 21.0      # time constant of the return
    label: str = "event"

    def extra(self, measure: str, day: float) -> float:
        if measure not in self.measures or day < self.day:
            return 0.0
        worse = math.copysign(1.0, _direction(measure))
        return worse * self.severity_pct * math.exp(-(day - self.day) / max(self.recovery_days, 0.1))


def _direction(measure: str) -> float:
    """+1 if the measure goes up when the body deconditions (resting heart rate), -1 if it goes down."""
    m = MEASURES[measure]
    v = m.get("loss_pct", m.get("rate_pct_per_day", -1.0)) or -1.0
    return 1.0 if v > 0 else -1.0


Adherence = float | Sequence[tuple[float, float]] | Callable[[float], float]


class CrewMember:
    """One person: a pre-flight baseline per measure and a personal response, kept for every reading.

    sex: "F" or "M" (random if None). responder: "typical" (random within the spread seen in the data),
    "fast" (losing faster than 9 in 10 subjects) or a number of standard deviations (positive = worse).
    adherence: exercise adherence, 1 = full routine (Campaign 11 exercise group), 0 = none (control
    groups). A number, a list of (day, value) steps, or a function of the day.
    """

    def __init__(self, mission: Mission, crew_id: str, sex: str | None = None, age: float | None = None,
                 mass_kg: float | None = None, adherence: Adherence = 1.0, responder: str | float = "typical",
                 seed: int | None = None):
        self.mission = mission
        self.id = crew_id
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.sex = sex or ("F" if self.rng.random() < 0.35 else "M")
        inst = PARAMS["instruments"]["cycle"]
        self.age = age if age is not None else float(np.clip(self.rng.normal(inst["age"]["mean"], inst["age"]["sd"]), 26, 55))
        w = inst["weight_kg"]["all"]
        default_mass = w["mean"] * (0.85 if self.sex == "F" else 1.0)
        self.mass_kg = mass_kg if mass_kg is not None else float(np.clip(self.rng.normal(default_mass, w["sd"] * 0.8), 50, 100))
        self.responder = responder
        self._events: list[Event] = []
        self.set_adherence(adherence)

        # personal response: one shared tendency plus a measure-specific part
        z_shared = self.rng.normal()
        if responder == "fast":
            z_shared = 1.2816 + abs(self.rng.normal(0, 0.5))      # above the 90th percentile
        elif isinstance(responder, (int, float)):
            z_shared = float(responder)
        self.z = {}
        for mid in MEASURES:
            z = 0.7 * z_shared + math.sqrt(1 - 0.49) * self.rng.normal()
            if responder == "fast":
                z = max(z, 1.2816)
            self.z[mid] = z
        self.baseline = {mid: self._sample_baseline(mid) for mid in MEASURES}
        self._cache: dict[str, tuple[np.ndarray, np.ndarray]] = {}

    def __repr__(self):
        return f"CrewMember({self.id!r}, sex={self.sex}, age={self.age:.0f}, responder={self.responder!r})"

    def _sample_baseline(self, mid: str) -> float:
        b = MEASURES[mid]["baseline"]
        stats = b.get(self.sex) or b["all"]
        sd = stats.get("sd") or 0.1 * stats["mean"]
        lo = stats.get("p5", stats["mean"] - 2 * sd)
        hi = stats.get("p95", stats["mean"] + 2 * sd)
        v = self.rng.normal(stats["mean"], sd)
        return float(np.clip(v, lo - 0.25 * (hi - lo), hi + 0.25 * (hi - lo)))

    # ---- status controls
    def set_adherence(self, adherence: Adherence) -> "CrewMember":
        """1.0 = full exercise routine, 0.0 = none. Number, [(day, value), ...] steps, or f(day)."""
        if callable(adherence):
            self._adh = adherence
        elif isinstance(adherence, (int, float)):
            a = float(adherence)
            self._adh = lambda d, a=a: a
        else:
            steps = sorted((float(d), float(v)) for d, v in adherence)

            def f(d, steps=steps):
                val = steps[0][1]
                for day, v in steps:
                    if d >= day:
                        val = v
                return val
            self._adh = f
        self._adherence_spec = adherence
        self._cache = {}
        return self

    def adherence(self, day: float) -> float:
        return float(np.clip(self._adh(day), 0.0, 1.0))

    def add_event(self, day: float, measures: str | Iterable[str] = "legs", severity_pct: float = 10.0,
                  recovery_days: float = 21.0, label: str = "event") -> Event:
        ev = Event(float(day), expand(measures), float(severity_pct), float(recovery_days), label)
        self._events.append(ev)
        return ev

    @property
    def events(self) -> list[Event]:
        return list(self._events)

    # ---- physiology
    def _personal(self, mid: str) -> dict:
        m = MEASURES[mid]
        z = self.z[mid]
        sd = m.get("responder_sd") or 0.0
        if m["model"] == "saturating":
            a = m["loss_pct"]
            return {"amp": a + math.copysign(1.0, a or -1.0) * z * sd}
        if m["model"] == "linear":
            r = m["rate_pct_per_day"]
            return {"rate": r + math.copysign(1.0, r or -1.0) * z * sd}
        return {}

    def _curve(self, mid: str) -> tuple[np.ndarray, np.ndarray]:
        if mid in self._cache:
            return self._cache[mid]
        m, ms = MEASURES[mid], self.mission
        days = np.arange(ms.start, ms.end + 1.0, 1.0)
        s = np.zeros_like(days)
        if m["model"] in ("saturating", "linear"):
            pers = self._personal(mid)
            e = m.get("exercise_effect") or 0.0
            rec = m.get("recovery_tau_days") or 30.0
            for i in range(1, len(days)):
                d = days[i - 1]
                u = ms.unloading(ms.gravity(d))
                k = 1.0 - e * self.adherence(d)
                prev = s[i - 1]
                if m["model"] == "saturating":
                    target = pers["amp"] * k * u
                    tau = m["tau_days"] if abs(target) > abs(prev) or target * prev < 0 else rec
                    s[i] = target + (prev - target) * math.exp(-1.0 / tau)
                else:
                    s[i] = prev + pers["rate"] * k * u - (1.0 - u) * prev / rec
        self._cache[mid] = (days, s)
        return days, s

    def change(self, measure: str, day: float, events: bool = True) -> float:
        """True % change from this person's baseline (no measurement noise)."""
        days, s = self._curve(measure)
        v = float(np.interp(day, days, s))
        if events:
            v += sum(ev.extra(measure, day) for ev in self._events)
        return v

    def true_value(self, measure: str, day: float) -> float:
        return self.baseline[measure] * (1.0 + self.change(measure, day) / 100.0)

    def unloaded_days(self, day: float) -> float:
        return self.mission.unloaded_days(day)

    def extrapolated(self, measure: str, day: float) -> bool:
        """True when the reading is outside what the bed-rest data covers."""
        m = MEASURES[measure]
        if m["model"] == "constant":
            return True
        if self.unloaded_days(day) > MAX_DATA_DAYS:
            return True
        return any(0.0 < p.gravity_g < 1.0 and p.start <= day for p in self.mission.phases)

    def status(self, day: float) -> dict:
        return {
            "adherence": round(self.adherence(day), 2),
            "responder": self.responder if isinstance(self.responder, str) else f"z={self.responder}",
            "events": [ev.label for ev in self._events if ev.day <= day and day - ev.day < 3 * ev.recovery_days],
        }
