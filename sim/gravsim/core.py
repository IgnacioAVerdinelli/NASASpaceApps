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
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable, Sequence

import numpy as np

PARAMS: dict = json.loads(Path(__file__).with_name("params.json").read_text(encoding="utf-8"))
MEASURES: dict = PARAMS["measures"]
MODEL_VERSION: str = PARAMS["model_version"]
MAX_DATA_DAYS: float = PARAMS["max_unloading_days_in_data"]
TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"    # UTC to the second: sorts correctly as text, and the frontend accepts it
Z90 = 1.2816                          # 90th percentile of the standard normal

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


PRESETS = {
    "iss_180": [Phase("preflight", -180, 0, 1.0), Phase("flight", 0, 180, 0.0), Phase("postflight", 180, 545, 1.0)],
    "artemis_30": [Phase("preflight", -180, 0, 1.0), Phase("transit", 0, 12, 0.0), Phase("lunar_surface", 12, 18, 0.166),
                   Phase("transit_return", 18, 30, 0.0), Phase("postflight", 30, 395, 1.0)],
    "mars": [Phase("preflight", -180, 0, 1.0), Phase("transit", 0, 180, 0.0), Phase("mars_surface", 180, 680, 0.38),
             Phase("transit_return", 680, 860, 0.0), Phase("postflight", 860, 1225, 1.0)],
}


class Mission:
    """A mission timeline (phases with a gravity level) plus its crew.

    >>> m = Mission("iss_180", launch_date="2027-03-01")
    >>> cm = m.add_crew("CM-1", adherence=1.0, seed=1)
    """

    def __init__(self, phases: str | Sequence[Phase] = "iss_180", launch_date: str | datetime = "2027-01-01",
                 unloading: Callable[[float], float] | None = None, name: str | None = None):
        if isinstance(phases, str) and phases not in PRESETS:
            raise KeyError(f"unknown preset {phases!r}; use one of {list(PRESETS)}")
        self.name = name or (phases if isinstance(phases, str) else "custom")
        self.phases = sorted(PRESETS[phases] if isinstance(phases, str) else phases, key=lambda p: p.start)
        if isinstance(launch_date, str):
            if len(launch_date) == 10:          # a bare date means noon UTC, the same calendar day in most time zones
                launch_date += "T12:00"
            launch_date = datetime.fromisoformat(launch_date)
        if launch_date.tzinfo is None:
            launch_date = launch_date.replace(tzinfo=timezone.utc)
        self.launch_date = launch_date
        self.unloading = unloading or (lambda g: min(1.0, max(0.0, 1.0 - g)))
        self.crew: list[CrewMember] = []
        # cumulative days of full unloading on a one-day grid, read by unloaded_days()
        self._grid = np.arange(self.start, self.end + 1.0, 1.0)
        self._unloaded = np.concatenate([[0.0], np.cumsum([self.unloading(self.gravity(d)) for d in self._grid[:-1]])])

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
        """The UTC time of a mission day, e.g. '2027-03-01T12:00:00Z'."""
        return (self.launch_date + timedelta(days=float(day))).astimezone(timezone.utc).strftime(TIME_FORMAT)

    def day_of(self, timestamp: str) -> float:
        """The mission day of a timestamp written like timestamp() writes them (the inverse of timestamp)."""
        t = datetime.strptime(timestamp, TIME_FORMAT).replace(tzinfo=timezone.utc)
        return (t - self.launch_date) / timedelta(days=1)

    def label(self, day: float) -> str:
        """NASA-style day label: L-30 before launch, FD12 in flight, R+5 after landing."""
        if day < 0:
            return f"L{int(math.floor(day))}"
        if day < self.landing:
            return f"FD{int(math.floor(day)) + 1}"
        return f"R+{int(math.floor(day - self.landing))}"

    def unloaded_days(self, day: float) -> float:
        """Equivalent days of full unloading from the start of the timeline up to `day`."""
        return float(np.interp(day, self._grid, self._unloaded))

    # crew
    def add_crew(self, crew_id: str | None = None, **kwargs) -> CrewMember:
        cm = CrewMember(self, crew_id or f"CM-{len(self.crew) + 1}", **kwargs)
        self.crew.append(cm)
        return cm

    def timeline(self, *args, **kwargs):
        """Shortcut for schedule.timeline(mission, ...)."""
        from .schedule import timeline       # imported here: schedule imports this module
        return timeline(self, *args, **kwargs)

    @classmethod
    def random(cls, preset: str = "iss_180", n_crew: int = 4, seed: int | None = None, **kwargs) -> Mission:
        """A mission with randomly varied crew: mostly on the exercise routine, some slipping,
        the odd fast responder or injury."""
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
    "fast" (losing faster than 9 in 10 subjects) or a number of standard deviations on every measure
    (positive = worse, 0 = the group median).
    adherence: exercise adherence, 1 = full routine (Campaign 11 exercise group), 0 = none (control
    groups). A number, a list of (day, value) steps, or a function of the day.
    """

    def __init__(self, mission: Mission, crew_id: str, sex: str | None = None, age: float | None = None,
                 mass_kg: float | None = None, adherence: Adherence = 1.0, responder: str | float = "typical",
                 seed: int | None = None):
        if responder not in ("typical", "fast") and not isinstance(responder, (int, float)):
            raise ValueError(f"responder must be 'typical', 'fast' or a number of SD, not {responder!r}")
        self.mission = mission
        self.id = crew_id
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.sex = sex or ("F" if self.rng.random() < 0.35 else "M")
        cycle = PARAMS["instruments"]["cycle"]
        self.age = age if age is not None else float(np.clip(self.rng.normal(cycle["age"]["mean"], cycle["age"]["sd"]), 26, 55))
        w = cycle["weight_kg"]["all"]
        mean_mass = w["mean"] * (0.85 if self.sex == "F" else 1.0)
        self.mass_kg = mass_kg if mass_kg is not None else float(np.clip(self.rng.normal(mean_mass, w["sd"] * 0.8), 50, 100))
        self.responder = responder
        self.events: list[Event] = []
        self._cache: dict[str, tuple[np.ndarray, np.ndarray]] = {}
        self.set_adherence(adherence)

        # Personal response, in SDs towards worse: 0.7 of a tendency shared by every measure plus an own part
        # weighted sqrt(1 - 0.49), so each z stays standard normal and measures correlate at 0.49.
        z_shared = self.rng.normal()
        if responder == "fast":
            z_shared = Z90 + abs(self.rng.normal(0, 0.5))
        self.z = {}
        for mid in MEASURES:
            z = 0.7 * z_shared + math.sqrt(1 - 0.49) * self.rng.normal()
            if responder == "fast":
                z = max(z, Z90)
            elif isinstance(responder, (int, float)):
                z = float(responder)              # exactly this many SD on every measure (0 = the group median)
            self.z[mid] = z
        self.baseline = {mid: self._sample_baseline(mid) for mid in MEASURES}

    def __repr__(self):
        return f"CrewMember({self.id!r}, sex={self.sex}, age={self.age:.0f}, responder={self.responder!r})"

    def _sample_baseline(self, mid: str) -> float:
        b = MEASURES[mid]["baseline"]
        stats = b.get(self.sex)
        if not stats or (stats.get("n") or 0) < 5 or not stats.get("sd"):
            stats = b["all"]                      # too few people of this sex in the data
        sd = stats.get("sd") or 0.1 * stats["mean"]
        lo = stats.get("p5", stats["mean"] - 2 * sd)
        hi = stats.get("p95", stats["mean"] + 2 * sd)
        v = self.rng.normal(stats["mean"], sd)
        return float(np.clip(v, lo - 0.25 * (hi - lo), hi + 0.25 * (hi - lo)))

    # ---- status controls
    def set_adherence(self, adherence: Adherence) -> CrewMember:
        """1.0 = full exercise routine, 0.0 = none. A number, [(day, value), ...] steps, or f(day)."""
        if callable(adherence):
            self._adh = adherence
        elif isinstance(adherence, (int, float)):
            self._adh = lambda d, a=float(adherence): a
        else:
            steps = sorted((float(d), float(v)) for d, v in adherence)

            def step(d):            # the value of the last step that has started; the first value before any
                started = [v for day, v in steps if day <= d]
                return started[-1] if started else steps[0][1]
            self._adh = step
        self.adherence_plan = adherence          # as given, to copy this person onto another mission
        self._cache = {}
        return self

    def adherence(self, day: float) -> float:
        return float(np.clip(self._adh(day), 0.0, 1.0))

    def add_event(self, day: float, measures: str | Iterable[str] = "legs", severity_pct: float = 10.0,
                  recovery_days: float = 21.0, label: str = "event") -> Event:
        ev = Event(float(day), expand(measures), float(severity_pct), float(recovery_days), label)
        self.events.append(ev)
        return ev

    # ---- physiology
    def _personal(self, mid: str) -> float:
        """This person's plateau (saturating) or daily rate (linear): the group value moved z SDs towards worse."""
        m = MEASURES[mid]
        group = m["loss_pct"] if m["model"] == "saturating" else m["rate_pct_per_day"]
        return group + math.copysign(1.0, group or -1.0) * self.z[mid] * (m.get("responder_sd") or 0.0)

    def _curve(self, mid: str) -> tuple[np.ndarray, np.ndarray]:
        """% change on every day of the mission, stepping the model one day at a time (cached)."""
        if mid in self._cache:
            return self._cache[mid]
        m, ms = MEASURES[mid], self.mission
        days = np.arange(ms.start, ms.end + 1.0, 1.0)
        s = np.zeros_like(days)
        if m["model"] in ("saturating", "linear"):
            own = self._personal(mid)
            e = m.get("exercise_effect") or 0.0
            rec = m.get("recovery_tau_days") or 30.0
            for i in range(1, len(days)):
                d = days[i - 1]
                u = ms.unloading(ms.gravity(d))
                k = 1.0 - e * self.adherence(d)
                prev = s[i - 1]
                if m["model"] == "saturating":
                    target = own * k * u
                    # moving away from 0 (losing) uses the loss time constant, moving back the recovery one
                    tau = m["tau_days"] if abs(target) > abs(prev) or target * prev < 0 else rec
                    s[i] = target + (prev - target) * math.exp(-1.0 / tau)
                else:
                    s[i] = prev + own * k * u - (1.0 - u) * prev / rec
        self._cache[mid] = (days, s)
        return days, s

    def change(self, measure: str, day: float, events: bool = True) -> float:
        """True % change from this person's baseline (no measurement noise)."""
        days, s = self._curve(measure)
        v = float(np.interp(day, days, s))
        if events:
            v += sum(ev.extra(measure, day) for ev in self.events)
        return v

    def true_value(self, measure: str, day: float) -> float:
        return self.baseline[measure] * (1.0 + self.change(measure, day) / 100.0)

    def extrapolated(self, measure: str, day: float) -> bool:
        """True when the reading is outside what the bed-rest data covers."""
        if MEASURES[measure]["model"] == "constant":
            return True
        if self.mission.unloaded_days(day) > MAX_DATA_DAYS:
            return True
        return any(0.0 < p.gravity_g < 1.0 and p.start <= day for p in self.mission.phases)

    def status(self, day: float) -> dict:
        return {
            "adherence": round(self.adherence(day), 2),
            "responder": self.responder if isinstance(self.responder, str) else f"z={self.responder}",
            "events": [ev.label for ev in self.events if ev.day <= day and day - ev.day < 3 * ev.recovery_days],
        }
