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

What keeps a person consistent with the data:
* Baselines are drawn from the subjects' own pre-bed-rest values (empirical quantiles in params.json),
  never outside the smallest and largest of them, through a Gaussian copula: one shared size factor
  ties strength, lean mass, body mass and VO2peak together, another ties systolic and diastolic pressure.
* Each measure has a direction (-1 falls, +1 rises when the body deconditions). A person's loss never
  crosses zero into improvement while unloaded, exercise never makes it worse, and events only push the
  worse way.
* A person's response sits at most z_max (2) SD from the group median; within the data's coverage
  (90 unloaded days at 0 or 1 g) the true change is clipped to the change range the subjects showed.
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
MODEL: dict = PARAMS["model"]
TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"    # UTC to the second: sorts correctly as text, and the frontend accepts it
Z_MAX: float = MODEL["z_max"]         # responses further than this many SD from the median are not generated
Z90, Z_FAST_MAX = MODEL["fast_z"]     # a fast responder sits between the 90th percentile and Z_MAX
QUANTILES = np.arange(0, 101, 5)      # the percentiles at which params.json stores each baseline distribution
# measure (or "mass_kg") -> (shared factor, loading): the Gaussian copula behind a person's baselines
LOADINGS = {mid: (factor, lam) for factor, f in PARAMS["baseline_factors"].items() for mid, lam in f["loadings"].items()}

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
        # unloading on each day of a one-day grid, and its running total, read by unloaded_days() and the curves
        self._grid = np.arange(self.start, self.end + 1.0, 1.0)
        self._u = np.array([self.unloading(self.gravity(d)) for d in self._grid])
        self._unloaded = np.concatenate([[0.0], np.cumsum(self._u[:-1])])

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

    def __post_init__(self):
        if not 0 <= self.severity_pct < 100:
            raise ValueError(f"severity_pct is the size of the change in % of baseline, 0 to 99, not {self.severity_pct}")

    def extra(self, measure: str, day: float) -> float:
        if measure not in self.measures or day < self.day:
            return 0.0
        return _direction(measure) * self.severity_pct * math.exp(-(day - self.day) / max(self.recovery_days, 0.1))


def _direction(measure: str) -> int:
    """+1 if the measure goes up when the body deconditions (resting heart rate, pressure), -1 if it goes down
    (strength, lean mass, bone, VO2peak). Set per measure in params.json, from physiology, not from the fit."""
    return MEASURES[measure]["direction"]


def _phi(x: float) -> float:
    """Standard normal cumulative distribution."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


Adherence = float | Sequence[tuple[float, float]] | Callable[[float], float]


class CrewMember:
    """One person: a pre-flight baseline per measure and a personal response, kept for every reading.

    sex: "F" or "M" (random if None). responder: "typical" (random within the spread seen in the data, cut
    at 2 SD), "fast" (losing faster than 9 in 10 subjects: between 1.28 and 2 SD) or a number of standard
    deviations on every measure (positive = worse, 0 = the group median; cut to -2..2).
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
        # shared standard-normal factors behind the baselines (Gaussian copula): body size, blood pressure
        self.factors = {name: float(self.rng.normal()) for name in PARAMS["baseline_factors"]}
        w = cycle["weight_kg"]["all"]
        mean_mass = w["mean"] * (0.85 if self.sex == "F" else 1.0)
        u_mass = self._latent("mass_kg")
        self.mass_kg = mass_kg if mass_kg is not None else float(np.clip(mean_mass + w["sd"] * 0.8 * u_mass, 50, 100))
        self.responder = responder
        self.events: list[Event] = []
        self._cache: dict[str, tuple[np.ndarray, np.ndarray]] = {}
        self._day_var: dict[str, np.ndarray] = {}
        self.set_adherence(adherence)

        # Personal response, in SDs towards worse: 0.7 of a tendency shared by every measure plus an own part
        # weighted sqrt(1 - 0.49), so each z stays standard normal and measures correlate at 0.49. Cut at
        # Z_MAX: the generator does not make people further out than the data's spread supports.
        shared = MODEL["shared_response"]
        z_shared = self.rng.normal()
        if responder == "fast":
            z_shared = Z90 + abs(self.rng.normal(0, 0.5))
        self.z = {}
        for mid in MEASURES:
            z = shared * z_shared + math.sqrt(1 - shared ** 2) * self.rng.normal()
            if responder == "fast":
                z = min(max(z, Z90), Z_FAST_MAX)
            elif isinstance(responder, (int, float)):
                z = float(responder)              # exactly this many SD on every measure (0 = the group median)
            self.z[mid] = float(np.clip(z, -Z_MAX, Z_MAX))
        self.baseline = {mid: self._sample_baseline(mid) for mid in MEASURES}
        # a fixed left/right hip difference, as a fraction (0.01 = the left hip 1 % denser than the right)
        a_max = MODEL["hip_asymmetry_max_pct"] / 100
        self.hip_asymmetry = float(np.clip(self.rng.normal(0, MODEL["hip_asymmetry_sd_pct"] / 100), -a_max, a_max))
        self._day_key = int(self.rng.integers(2 ** 62))     # seeds this person's day-to-day variation

    def __repr__(self):
        return f"CrewMember({self.id!r}, sex={self.sex}, age={self.age:.0f}, responder={self.responder!r})"

    def _latent(self, name: str) -> float:
        """A standard normal for one baseline: loading x its shared factor + an own part (one draw each time)."""
        factor, lam = LOADINGS.get(name, (None, 0.0))
        own = self.rng.normal()
        return lam * self.factors[factor] + math.sqrt(1 - lam ** 2) * own if factor else own

    def _sample_baseline(self, mid: str) -> float:
        """A baseline from the subjects' own values: the empirical quantiles of this sex (or of everyone, when the
        data has fewer than 5 people of this sex), read at the copula's percentile. Never below the smallest or
        above the largest subject. Measures without data use their assumed normal range, cut at its limits."""
        b = MEASURES[mid]["baseline"]
        stats = b.get(self.sex)
        if not isinstance(stats, dict) or (stats.get("n") or 0) < 5:
            stats = b["all"]
        u = self._latent(mid)
        if "q" in stats:
            return float(np.interp(100 * _phi(u), QUANTILES, stats["q"]))
        return float(np.clip(stats["mean"] + stats["sd"] * u, stats["min"], stats["max"]))

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
        self._adh_grid = None
        return self

    def adherence(self, day: float) -> float:
        return min(1.0, max(0.0, float(self._adh(day))))

    def add_event(self, day: float, measures: str | Iterable[str] = "legs", severity_pct: float = 10.0,
                  recovery_days: float = 21.0, label: str = "event") -> Event:
        """An injury or illness on `day`: the measures move severity_pct % of baseline the worse way, then decay back."""
        ev = Event(float(day), expand(measures), float(severity_pct), float(recovery_days), label)
        self.events.append(ev)
        return ev

    # ---- physiology
    def _amplitude(self, mid: str, k: float) -> float:
        """This person's plateau (saturating) or daily rate (linear) when exercise leaves a share k of the loss
        (k = 1 - exercise_effect x adherence): the group value times k, moved z SDs the worse way. The spread
        between people shrinks with exercise, but not below the spread floor. The result never crosses zero
        into improvement, so more exercise is never worse and a fast responder never gains."""
        m = MEASURES[mid]
        direction = m["direction"]
        group = m["loss_pct"] if m["model"] == "saturating" else m["rate_pct_per_day"]
        worse = max(0.0, direction * group) * k + self.z[mid] * (m.get("responder_sd") or 0.0) * max(k, MODEL["spread_floor"])
        return direction * max(0.0, worse)

    def _curve(self, mid: str) -> tuple[np.ndarray, np.ndarray]:
        """% change on every day of the mission, stepping the model one day at a time (cached)."""
        if mid in self._cache:
            return self._cache[mid]
        m, ms = MEASURES[mid], self.mission
        days = ms._grid
        s = np.zeros_like(days)
        if m["model"] in ("saturating", "linear"):
            if self._adh_grid is None:
                self._adh_grid = [self.adherence(d) for d in days]
            e = min(m.get("exercise_effect") or 0.0, MODEL["exercise_effect_cap"])
            rec = m.get("recovery_tau_days") or 30.0
            saturating = m["model"] == "saturating"
            if saturating:
                loss_step, rec_step = math.exp(-1.0 / m["tau_days"]), math.exp(-1.0 / rec)
            amp, last_k, prev = 0.0, None, 0.0
            first = int(np.argmax(ms._u > 0)) if ms._u.any() else len(days)     # nothing moves before the first unloaded day
            for i in range(first + 1, len(days)):
                u = ms._u[i - 1]
                k = 1.0 - e * self._adh_grid[i - 1]
                if k != last_k:
                    amp, last_k = self._amplitude(mid, k), k
                if saturating:
                    target = amp * u
                    # moving away from 0 (losing) uses the loss time constant, moving back the recovery one
                    step = loss_step if abs(target) > abs(prev) else rec_step
                    prev = target + (prev - target) * step
                else:
                    prev = prev + amp * u - (1.0 - u) * prev / rec
                s[i] = prev
        self._cache[mid] = (days, s)
        return days, s

    def change(self, measure: str, day: float, events: bool = True) -> float:
        """True % change from this person's baseline (no measurement noise). Within the data's coverage it stays
        inside the change range the bed-rest subjects showed; events come on top."""
        days, s = self._curve(measure)
        v = float(np.interp(day, days, s))
        r = MEASURES[measure].get("data_range")
        if r and not self.extrapolated(measure, day):
            v = min(max(v, r["change_pct_min"]), r["change_pct_max"])
        if events:
            v += sum(ev.extra(measure, day) for ev in self.events)
        return v

    def true_value(self, measure: str, day: float) -> float:
        return max(0.0, self.baseline[measure] * (1.0 + self.change(measure, day) / 100.0))

    def day_variation(self, measure: str, day: float) -> float:
        """This person's day-to-day variation on `measure` that calendar day, in SDs (standard normal, cut at
        day_variation_clip_sd). The same for every reading of the measure that day, whatever the instrument."""
        ms = self.mission
        arr = self._day_var.get(measure)
        if arr is None:
            rng = np.random.default_rng([self._day_key, list(MEASURES).index(measure)])
            c = MODEL["day_variation_clip_sd"]
            arr = self._day_var[measure] = np.clip(rng.standard_normal(int(ms.end - ms.start) + 2), -c, c)
        i = min(max(int(math.floor(day - ms.start)), 0), len(arr) - 1)
        return float(arr[i])

    def reading_range(self, measure: str, day: float) -> tuple[float, float]:
        """The values a fault-free reading may take: what the bed-rest subjects produced. Before any unloading,
        the baseline range; after it, the baseline range combined with the % change range. Unbounded where
        the reading is extrapolated (past the data's coverage, or a measure with no data)."""
        r = MEASURES[measure].get("data_range")
        if not r or self.extrapolated(measure, day):
            return -math.inf, math.inf
        lo, hi = r["baseline_min"], r["baseline_max"]
        if self.mission.unloaded_days(day) <= 0:
            return lo, hi
        return lo * (1 + min(r["change_pct_min"], 0) / 100), hi * (1 + max(r["change_pct_max"], 0) / 100)

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
