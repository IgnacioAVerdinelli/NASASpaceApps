"""Simulated instruments. Each one reads a CrewMember on a mission day and returns Readings.

measure(crew, day, measure)  -> one Reading: the headline value a report shows
measure_all(crew, day)       -> one Reading per measure the instrument takes
session(crew, day)           -> the whole session as the instrument records it (reps, scan sites, test stages,
                                a 24-hour trace), with the headline Readings inside

How a reading is made, in order:
1. the true value (the person's baseline and true % change, inside the hard limits);
2. the person's day-to-day variation (bio_cv, the same for every reading of that measure that day) and the
   instrument's own noise (device_cv), together never more than 2.5 times the fitted test-retest CV;
3. clipped to the data range (CrewMember.reading_range): a fault-free reading inside the data's coverage
   never shows a value no bed-rest subject produced;
4. the instrument's faults (offset, drift, dropout, spike, stuck) active that day, listed in truth["faults"];
   they may push a reading outside the data range;
5. clamped to the hard limits (pipeline.LIMITS, the same table the DataService checks), faults or not.
The `truth` field holds the noise-free value and the active faults, so a monitoring system can be scored against it.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np

from .core import MEASURES, MODEL, MODEL_VERSION, CrewMember
from .pipeline import LIMITS
from .reading import ContextRecord, Reading


@dataclass
class Fault:
    """An instrument fault, active from `start` to `end` (mission days; None = always).

    kind:
      offset   every reading off by `pct` percent (e.g. the 2006 DXA tube fault: pct=-1.1)
      drift    error grows by `pct_per_day` percent per day since `start`
      dropout  reading missing with probability `prob`
      spike    reading off by +/- `pct` percent with probability `prob`
      stuck    repeats the last value it produced
    """
    kind: str
    start: float | None = None
    end: float | None = None
    pct: float = 0.0
    pct_per_day: float = 0.0
    prob: float = 0.0

    def __post_init__(self):
        if self.kind not in ("offset", "drift", "dropout", "spike", "stuck"):
            raise ValueError(f"unknown fault kind {self.kind!r}")

    def active(self, day: float) -> bool:
        return (self.start is None or day >= self.start) and (self.end is None or day < self.end)


def hr_max_tanaka(age: float) -> float:
    """Maximum heart rate from age (Tanaka 2001). A textbook formula, not fitted to our data."""
    return 208 - 0.7 * age


# Heart rate above rest, as a share of the way from resting to maximum heart rate (assumed, not fitted)
EXERCISE_EFFORT = 0.55            # an exercise block
EVA_EFFORT = (0.2, 0.5)           # a spacewalk: long, moderate work, one task after another, 0.35 on average
EVA_TASK_MINUTES = (20, 40)       # how long the effort of one spacewalk task lasts
EVA_STREAM = 2                    # the random stream of spacewalk effort, next to routine.ROUTINE_STREAM


def eva_heart_rate(crew: CrewMember, eva: ContextRecord) -> np.ndarray:
    """True heart rate, minute by minute, through a spacewalk (an "eva" context record): the person's resting
    heart rate that day plus an effort that changes from task to task. The Wearable's trace and the
    Spacesuit's readings both use it, so they agree."""
    ms = crew.mission
    start = ms.day_of(eva.start)
    minutes = int(round((ms.day_of(eva.end) - start) * 1440))
    rng = np.random.default_rng([crew._day_key, EVA_STREAM, int(eva.start[:10].replace("-", ""))])
    effort = np.empty(minutes)
    i = 0
    while i < minutes:
        n = int(rng.integers(EVA_TASK_MINUTES[0], EVA_TASK_MINUTES[1] + 1))
        effort[i:i + n] = rng.uniform(*EVA_EFFORT)
        i += n
    rest = crew.true_value("resting_hr", start)
    return rest + effort * (hr_max_tanaka(crew.age) - rest)


class Instrument:
    name = "instrument"
    device = "generic"
    measures: tuple[str, ...] = ()

    def __init__(self, seed: int | None = None, faults: Iterable[Fault] = (), noise: float = 1.0):
        """noise: scale on the measurement noise fitted from the data (1 = realistic, 0 = none)."""
        self.rng = np.random.default_rng(seed)
        self.faults = list(faults)
        self.noise = float(noise)
        self._last: dict[tuple[str, str], float] = {}

    def __repr__(self):
        return f"{type(self).__name__}(faults={self.faults})"

    def _read(self, crew: CrewMember, day: float, measure: str, side: str | None = None,
              true_value: float | None = None) -> Reading:
        m = MEASURES[measure]
        ms = crew.mission
        hard_lo, hard_hi = LIMITS[measure]
        true = crew.true_value(measure, day) if true_value is None else true_value
        true = min(max(true, hard_lo), hard_hi)
        # the person's day-to-day variation and the device's noise; larger outliers come from the "spike" fault
        c = MODEL["device_noise_clip_sd"]
        bio = crew.day_variation(measure, day) * m.get("bio_cv", 0.0)
        dev = float(np.clip(self.rng.normal(), -c, c)) * m.get("device_cv", m["noise_cv"])
        cap = c * m["noise_cv"]
        value = true * (1.0 + float(np.clip(((1 + bio) * (1 + dev) - 1), -cap, cap)) * self.noise)
        lo, hi = crew.reading_range(measure, day)
        value = min(max(value, lo), hi)
        active, quality = [], "ok"
        for f in self.faults:
            if not f.active(day):
                continue
            if f.kind == "offset":
                value *= 1 + f.pct / 100
                active.append(f"offset {f.pct:+g}%")
            elif f.kind == "drift":
                err = f.pct_per_day * (day - (f.start or 0.0))
                value *= 1 + err / 100
                active.append(f"drift {err:+.2f}%")
            elif f.kind == "spike" and self.rng.random() < f.prob:
                value *= 1 + self.rng.choice([-1, 1]) * f.pct / 100
                active.append(f"spike {f.pct:g}%")
            elif f.kind == "stuck" and (crew.id, measure) in self._last:
                value = self._last[(crew.id, measure)]
                active.append("stuck")
            elif f.kind == "dropout" and self.rng.random() < f.prob:
                value, quality = None, "missing"
                active.append("dropout")
                break                         # nothing left for later faults to act on
        if value is not None:
            value = round(min(max(float(value), hard_lo), hard_hi), m["decimals"])
            self._last[(crew.id, measure)] = value
        phase = ms.phase(day)
        return Reading(
            crew_id=crew.id, mission_day=round(float(day), 3), day_label=ms.label(day), timestamp=ms.timestamp(day),
            phase=phase.name, gravity_g=phase.gravity_g, instrument=self.name, device=self.device,
            measure=measure, value=value, unit=m["unit"], side=side, quality=quality, synthetic=True,
            extrapolated=crew.extrapolated(measure, day), model_version=MODEL_VERSION, status=crew.status(day),
            truth={"value": round(true, m["decimals"] + 2), "change_pct": round(crew.change(measure, day), 3),
                   "faults": active},
        )

    def measure(self, crew: CrewMember, day: float, measure: str | None = None) -> Reading:
        """One reading of `measure` (default: the instrument's first measure)."""
        measure = measure or self.measures[0]
        if measure not in self.measures:
            raise KeyError(f"{self.name} measures {self.measures}, not {measure!r}")
        return self._read(crew, day, measure)

    def measure_all(self, crew: CrewMember, day: float) -> list[Reading]:
        return [self._read(crew, day, mid) for mid in self.measures]


class Dynamometer(Instrument):
    """Isokinetic dynamometer: peak torque (ft-lb) for knee, ankle and trunk tests (MR079G)."""
    name = "dynamometer"
    device = "isokinetic dynamometer (Biodex-type)"
    measures = ("knee_extension_60", "knee_flexion_60", "ankle_plantarflexion_30", "ankle_dorsiflexion_30",
                "trunk_extension_60", "trunk_flexion_60")

    def session(self, crew: CrewMember, day: float, reps: int = 3) -> dict:
        """Every test with its repetitions; the reported value is the best repetition, as on the device."""
        tests = []
        for mid in self.measures:
            r = self._read(crew, day, mid)
            if r.value is None:
                tests.append({"measure": mid, "reps": [], "reading": r.to_dict()})
                continue
            # the other repetitions fall a few percent short of the best one
            rep_vals = [r.value] + [round(r.value * (1 - abs(self.rng.normal(0, 0.04))), 1) for _ in range(reps - 1)]
            self.rng.shuffle(rep_vals)
            tests.append({"measure": mid, "reps": [{"rep": i + 1, "peak_torque": v} for i, v in enumerate(rep_vals)],
                          "reading": r.to_dict()})
        return {"instrument": self.name, "crew_id": crew.id, "mission_day": day, "tests": tests}


class DxaScanner(Instrument):
    """DXA scanner: bone density (g/cm²) and lean mass by region (g) (MR035G). There is none on the ISS."""
    name = "dxa"
    device = "DXA scanner (Hologic Discovery-type)"
    measures = ("hip_bmd", "spine_bmd", "heel_bmd", "lean_legs", "lean_arms", "lean_trunk")

    def session(self, crew: CrewMember, day: float) -> dict:
        """A full scan report: both hips, spine, heel, whole-body lean mass by region."""
        side_diff = crew.hip_asymmetry / 2           # the person's fixed left/right difference, split around the mean
        hip_true = crew.true_value("hip_bmd", day)
        report = {
            "hip_left": self._read(crew, day, "hip_bmd", side="left", true_value=hip_true * (1 + side_diff)).to_dict(),
            "hip_right": self._read(crew, day, "hip_bmd", side="right", true_value=hip_true * (1 - side_diff)).to_dict(),
        }
        for mid in ("spine_bmd", "heel_bmd", "lean_legs", "lean_arms", "lean_trunk"):
            report[mid] = self._read(crew, day, mid).to_dict()
        return {"instrument": self.name, "crew_id": crew.id, "mission_day": day, "report": report}


class CycleErgometer(Instrument):
    """Cycle ergometer with gas analyser: VO2peak (ml/kg/min) from a graded test (MR080G).

    session() returns the stage-by-stage test. Stage values use two textbook formulas, not the data:
    VO2 = 7 + 10.8 * watts / mass (ACSM leg-cycling equation) and HRmax = 208 - 0.7 * age (Tanaka 2001).
    Heart rate rises with the share of VO2peak used, so after deconditioning the same workload costs
    more beats. The data check: Campaign 3 subjects needed a median 27.5 bpm more per workload.
    The test ends part-way through a stage: the last row (partial=True) is the workload at which the person
    reaches VO2peak, with the minutes of that stage they managed.
    """
    name = "cycle"
    device = "cycle ergometer + metabolic gas analyser"
    measures = ("vo2peak",)

    def session(self, crew: CrewMember, day: float, step_watts: int = 25, stage_minutes: float = 2.0) -> dict:
        peak = self._read(crew, day, "vo2peak")
        vo2peak = crew.true_value("vo2peak", day)
        hr_rest = crew.true_value("resting_hr", day)
        hr_max = hr_max_tanaka(crew.age)
        vo2_rest = 3.5
        stages, watts, t = [], 0, 0.0
        while True:
            vo2 = vo2_rest if watts == 0 else 7 + 10.8 * watts / crew.mass_kg
            frac = (vo2 - vo2_rest) / max(vo2peak - vo2_rest, 1.0)
            if watts and frac > 1.0:
                # the stage the person can't finish: they stop where the ACSM equation reaches their VO2peak
                peak_w = (vo2peak - 7) * crew.mass_kg / 10.8
                done = (peak_w - (watts - step_watts)) / step_watts
                if done > 0:
                    stages.append({"stage": len(stages), "minute": round(t, 1), "watts": int(round(peak_w)),
                                   "hr_bpm": round(hr_max + self.rng.normal(0, 3 * self.noise)),
                                   "vo2_ml_kg_min": round(vo2peak * (1 + self.rng.normal(0, 0.03 * self.noise)), 1),
                                   "rpe_borg": 20, "partial": True, "stage_minutes": round(done * stage_minutes, 1)})
                break
            hr = hr_rest + (hr_max - hr_rest) * max(frac, 0.0)
            noise = self.rng.normal(0, 3 * self.noise)
            stages.append({"stage": len(stages), "minute": round(t, 1), "watts": watts,
                           "hr_bpm": round(hr + noise), "vo2_ml_kg_min": round(vo2 * (1 + self.rng.normal(0, 0.03 * self.noise)), 1),
                           "rpe_borg": int(round(6 + 14 * max(frac, 0.0))), "partial": False, "stage_minutes": stage_minutes})
            watts += step_watts
            t += stage_minutes
            if watts > 600:
                break
        return {"instrument": self.name, "crew_id": crew.id, "mission_day": day, "protocol": f"{step_watts} W every {stage_minutes:g} min",
                "stages": stages, "peak_watts": stages[-1]["watts"], "reading": peak.to_dict(),
                "assumed": ["stage VO2 (ACSM equation)", "HRmax (Tanaka 2001)", "linear heart-rate response"]}


class Wearable(Instrument):
    """Body-worn monitor: daily resting heart rate and blood pressure (from Campaign 11 supine rest values),
    SpO2 and heart-rate variability (assumed typical ranges, no data behind them)."""
    name = "wearable"
    device = "wearable monitor (garment or watch)"
    measures = ("resting_hr", "resting_sbp", "resting_dbp", "spo2", "hrv_rmssd")

    def session(self, crew: CrewMember, day: float, minutes: int = 1440) -> dict:
        """Minute-by-minute heart rate over the UTC date of `day` (minute 0 is 00:00 UTC), following the crew
        member's routine for that date (routine.py, returned as "context"): the resting level with a daily
        rhythm, a dip while asleep, a rise in each exercise block and through a spacewalk. The shape is
        assumed; the resting level comes from the model. Past 1440 minutes the same day repeats."""
        rest = crew.true_value("resting_hr", day)
        context = crew.routine(day)
        midnight = crew.mission.day_of(context[0].start)
        day_hr = rest + 6 * np.sin(2 * np.pi * (np.arange(1440) / 60 - 10) / 24)    # daily rhythm, low at night
        for c in context:
            s, e = (int(round((crew.mission.day_of(t) - midnight) * 1440)) for t in (c.start, c.end))
            if c.activity == "sleep":
                day_hr[s:e] -= 6
            elif c.activity == "exercise":
                day_hr[s:e] += (hr_max_tanaka(crew.age) - rest) * EXERCISE_EFFORT
            elif c.activity == "eva":
                day_hr[s:e] = eva_heart_rate(crew, c)
        t = np.arange(minutes)
        hr = day_hr[t % 1440] + self.rng.normal(0, 2.5 * self.noise, size=minutes)
        trace = [{"minute": int(i), "hr_bpm": int(round(v))} for i, v in zip(t, hr)]
        for f in self.faults:
            if f.kind == "dropout" and f.active(day):
                for p in trace:
                    if self.rng.random() < f.prob:
                        p["hr_bpm"] = None
        return {"instrument": self.name, "crew_id": crew.id, "mission_day": day, "daily": [r.to_dict() for r in self.measure_all(crew, day)],
                "trace": trace, "context": [c.to_dict() for c in context],
                "assumed": ["daily rhythm, sleep dip, effort of exercise blocks and spacewalks"]}


class Spacesuit(Instrument):
    """Spacesuit telemetry: heart rate every few minutes while the crew member is outside on a spacewalk
    (CrewMember.add_eva). Assumed: there is no spacewalk data behind it (instruments.eva_heart_rate)."""
    name = "suit"
    device = "spacesuit biomedical telemetry"
    measures = ("heart_rate",)
    every_minutes = 5

    def measure(self, crew: CrewMember, day: float, measure: str | None = None) -> Reading:
        """One heart-rate reading at mission time `day`, which must fall inside a spacewalk."""
        eva = next((c for c in crew.routine(day) if c.activity == "eva"), None)
        ms = crew.mission
        if eva is None or not eva.start <= ms.timestamp(day) < eva.end:
            raise ValueError(f"{crew.id} is not on a spacewalk at mission day {day:g}")
        hr = eva_heart_rate(crew, eva)
        minute = min(int((day - ms.day_of(eva.start)) * 1440), len(hr) - 1)
        return self._read(crew, day, "heart_rate", true_value=float(hr[minute]))

    def measure_all(self, crew: CrewMember, day: float) -> list[Reading]:
        """Every heart-rate reading of the spacewalk on the UTC date of `day`, one every `every_minutes`;
        [] if the crew member has no spacewalk that day."""
        if crew.eva_on(day) is None:
            return []
        eva = next(c for c in crew.routine(day) if c.activity == "eva")
        hr = eva_heart_rate(crew, eva)
        start = crew.mission.day_of(eva.start)
        return [self._read(crew, start + m / 1440, "heart_rate", true_value=float(hr[m]))
                for m in range(0, len(hr), self.every_minutes)]


INSTRUMENTS = {cls.name: cls for cls in (Dynamometer, DxaScanner, CycleErgometer, Wearable, Spacesuit)}
