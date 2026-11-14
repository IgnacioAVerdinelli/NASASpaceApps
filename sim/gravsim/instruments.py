"""Simulated instruments. Each one reads a CrewMember on a mission day and returns Readings.

measure(crew, day, ...)  -> one Reading (or a list for the wearable): the headline value a report shows
session(crew, day)       -> the whole session as the instrument records it (reps, scan sites, test stages,
                            a 24-hour trace), with the headline Readings inside

Every reading carries measurement noise fitted from repeat tests in the data, and the instrument's
faults (offset, drift, dropout, spike, stuck) if any are active that day. The `truth` field holds the
noise-free value and the active faults, so a monitoring system can be scored against it.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Iterable

import numpy as np

from .core import MEASURES, MODEL_VERSION, CrewMember, expand


@dataclass
class Reading:
    crew_id: str
    mission_day: float
    day_label: str
    timestamp: str
    phase: str
    gravity_g: float
    instrument: str
    device: str
    measure: str
    label: str
    value: float | None
    unit: str
    region: str | None = None
    muscle_keys: list[str] = field(default_factory=list)
    side: str | None = None
    quality: str = "ok"                      # ok | missing
    synthetic: bool = True
    extrapolated: bool = False
    model_version: str = MODEL_VERSION
    status: dict = field(default_factory=dict)
    truth: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


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

    def active(self, day: float) -> bool:
        return (self.start is None or day >= self.start) and (self.end is None or day < self.end)


class Instrument:
    name = "instrument"
    device = "generic"
    measures: tuple[str, ...] = ()

    def __init__(self, seed: int | None = None, faults: Iterable[Fault] = (), noise: float | bool = 1.0):
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
        true = crew.true_value(measure, day) if true_value is None else true_value
        # normal noise cut at 2.5 SD; larger outliers come from the "spike" fault
        value = true * (1.0 + float(np.clip(self.rng.normal(), -2.5, 2.5)) * m["noise_cv"] * self.noise)
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
        if value is not None:
            value = round(float(value), m["decimals"])
            self._last[(crew.id, measure)] = value
        phase = ms.phase(day)
        return Reading(
            crew_id=crew.id, mission_day=round(float(day), 3), day_label=ms.label(day), timestamp=ms.timestamp(day),
            phase=phase.name, gravity_g=phase.gravity_g, instrument=self.name, device=self.device,
            measure=measure, label=m["label"], value=value, unit=m["unit"], region=m.get("region"),
            muscle_keys=list(m.get("muscle_keys") or []), side=side, quality=quality,
            extrapolated=crew.extrapolated(measure, day), status=crew.status(day),
            truth={"value": round(true, m["decimals"] + 2), "change_pct": round(crew.change(measure, day), 3),
                   "faults": active},
        )

    def measure(self, crew: CrewMember, day: float, measure: str | None = None) -> Reading:
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
        side_diff = 0.01 * crew.z["hip_bmd"]          # a fixed small left/right asymmetry per person
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
    """
    name = "cycle"
    device = "cycle ergometer + metabolic gas analyser"
    measures = ("vo2peak",)

    def session(self, crew: CrewMember, day: float, step_watts: int = 25, stage_minutes: float = 2.0) -> dict:
        peak = self._read(crew, day, "vo2peak")
        vo2peak = crew.true_value("vo2peak", day)
        hr_rest = crew.true_value("resting_hr", day)
        hr_max = 208 - 0.7 * crew.age
        vo2_rest = 3.5
        stages, watts, t = [], 0, 0.0
        while True:
            vo2 = vo2_rest if watts == 0 else 7 + 10.8 * watts / crew.mass_kg
            frac = (vo2 - vo2_rest) / max(vo2peak - vo2_rest, 1.0)
            if watts and frac > 1.0:
                break
            hr = hr_rest + (hr_max - hr_rest) * max(frac, 0.0)
            noise = self.rng.normal(0, 3 * self.noise)
            stages.append({"stage": len(stages), "minute": round(t, 1), "watts": watts,
                           "hr_bpm": round(hr + noise), "vo2_ml_kg_min": round(vo2 * (1 + self.rng.normal(0, 0.03 * self.noise)), 1),
                           "rpe_borg": int(round(6 + 14 * max(frac, 0.0)))})
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

    def measure(self, crew: CrewMember, day: float, measure: str | None = None):
        """One measure, or the daily summary (every measure) when `measure` is None."""
        if measure is None:
            return self.measure_all(crew, day)
        return super().measure(crew, day, measure)

    def session(self, crew: CrewMember, day: float, minutes: int = 1440) -> dict:
        """Minute-by-minute heart rate over a day: resting level, a daily rhythm, sleep dip and two exercise
        sessions when the crew member is exercising. The shape is assumed; the resting level comes from the model."""
        rest = crew.true_value("resting_hr", day)
        t = np.arange(minutes)
        hours = (t / 60.0) % 24
        hr = rest + 6 * np.sin(2 * np.pi * (hours - 10) / 24)          # daily rhythm, low at night
        hr -= np.where((hours < 6) | (hours >= 22.5), 6, 0)            # sleep
        adh = crew.adherence(day)
        if adh > 0:
            for start_h, dur in ((9.0, 60), (16.0, 60)):                # exercise blocks (~2 h/day on the ISS)
                if self.rng.random() < adh:
                    s = int(start_h * 60)
                    hr[s:s + dur] += (208 - 0.7 * crew.age - rest) * 0.55
        hr = hr + self.rng.normal(0, 2.5 * self.noise, size=minutes)
        trace = [{"minute": int(i), "hr_bpm": int(round(v))} for i, v in zip(t, hr)]
        for f in self.faults:
            if f.kind == "dropout" and f.active(day):
                for p in trace:
                    if self.rng.random() < f.prob:
                        p["hr_bpm"] = None
        return {"instrument": self.name, "crew_id": crew.id, "mission_day": day, "daily": [r.to_dict() for r in self.measure_all(crew, day)],
                "trace": trace, "assumed": ["daily rhythm, sleep dip and exercise blocks"]}


INSTRUMENTS = {cls.name: cls for cls in (Dynamometer, DxaScanner, CycleErgometer, Wearable)}


def instrument_for(measure: str) -> str:
    return MEASURES[measure]["instrument"]
