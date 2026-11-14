"""The HealthService's own calculation: reference, change, score and comparison with the bed-rest studies.

Ported from the dashboard builder gravsim had up to version 0.1.0 (by CookieD), so that it works on DataService
readings instead of simulator objects. Same rules:

- Only readings with a value and quality "ok" count; the DataService keeps flagged ones (missing, out_of_range,
  bad_unit) as evidence, but they are not measurements.
- Reference: mean of the person's pre-flight readings (or the first reading if there are none).
- Change: % of the latest reading against that reference, only once the mission has started.
- Score (0-100): how far the measured loss has gone towards the plateau bed-rest subjects reached without
  exercise. A visual scale, not a clinical grade.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass

from .models import CrewInfo, MissionInfo, Reading
from .reference import Reference

# (item id, measure, title, what was measured): shown per muscle group on the body.
# Trunk flexion is left out, as in gravsim: its data runs the wrong way in Campaign 11.
ITEMS = [
    ("quadriceps", "knee_extension_60", "Quadriceps", "Knee extension strength at 60°/s (dynamometer)"),
    ("hamstrings", "knee_flexion_60", "Hamstrings", "Knee flexion strength at 60°/s (dynamometer)"),
    ("calves", "ankle_plantarflexion_30", "Calves", "Ankle plantarflexion strength at 30°/s (dynamometer)"),
    ("shins", "ankle_dorsiflexion_30", "Shins", "Ankle dorsiflexion strength at 30°/s (dynamometer)"),
    ("back", "trunk_extension_60", "Back", "Trunk extension strength at 60°/s (dynamometer)"),
    ("arms", "lean_arms", "Arms", "Arm lean mass (DXA)"),
]
# (measure, title, what was measured): whole-body charts, no colour on the body.
WHOLE_BODY = [
    ("vo2peak", "Aerobic capacity (VO2peak)", "Peak oxygen uptake on the cycle test"),
    ("hip_bmd", "Hip bone density", "Total hip bone density (DXA)"),
]
# Every measure the HealthService reads, in the order results are listed.
MEASURES = [m for _, m, _, _ in ITEMS] + [m for m, _, _ in WHOLE_BODY]


@dataclass
class MeasureResult:
    """One processed result, as it is saved through the DataService."""
    crew_id: str
    measure: str
    mission_day: float                    # day the result was computed for
    unloaded_days: float                  # equivalent days without gravity up to that day
    reference_value: float | None
    last_value: float | None
    last_reading_at: str | None
    last_mission_day: float | None
    change_pct: float | None
    reference_n: int                      # readings averaged into the reference
    previous_change_pct: float | None     # change at the reading before the last one, from launch on
    previous_mission_day: float | None
    previous_value: float | None
    score: float | None                   # only for measures coloured on the body
    typical_no_exercise_pct: float | None
    typical_exercise_pct: float | None
    extrapolated: bool
    synthetic: bool
    model_version: str

    def to_dict(self) -> dict:
        return asdict(self)


def series_by_measure(readings: list[Reading], crew_id: str, day: float) -> dict[str, list[Reading]]:
    """Usable readings (a value, quality "ok") of one crew member up to `day`, by measure and sorted by day."""
    series: dict[str, list[Reading]] = defaultdict(list)
    for r in readings:
        if r.crew_id == crew_id and r.mission_day <= day and r.value is not None and r.quality == "ok":
            series[r.measure].append(r)
    for rs in series.values():
        rs.sort(key=lambda r: r.mission_day)
    return series


def reference_readings(rs: list[Reading]) -> list[float]:
    """Values averaged into the reference: the pre-flight readings, or the first reading if there are none."""
    if not rs:
        return []
    return [r.value for r in rs if r.mission_day < 0] or [rs[0].value]


def reference_value(rs: list[Reading]) -> float | None:
    pre = reference_readings(rs)
    return sum(pre) / len(pre) if pre else None


def compute_results(reference: Reference, mission: MissionInfo, crew: CrewInfo, readings: list[Reading],
                    day: float) -> list[MeasureResult]:
    series = series_by_measure(readings, crew.id, day)
    unloaded = mission.unloaded_days(day)
    scored = {mid for _, mid, _, _ in ITEMS}
    results = []
    for mid in MEASURES:
        rs = series.get(mid, [])
        ref = reference_value(rs)
        last = rs[-1] if rs else None
        change = None if last is None or last.mission_day < 0 else round(100 * (last.value / ref - 1), 1)
        flight = [r for r in rs if r.mission_day >= 0]
        prev = flight[-2] if len(flight) >= 2 else None
        score = None
        if change is not None and mid in scored:
            score = round(min(100.0, 100.0 * reference.worse_by(mid, change) / reference.plateau(mid)), 1)
        no_ex = ex = None
        if unloaded > 0:
            no_ex = reference.typical_change(mid, unloaded, 0.0)
            ex = reference.typical_change(mid, unloaded, 1.0)
        results.append(MeasureResult(
            crew_id=crew.id, measure=mid, mission_day=day, unloaded_days=unloaded, reference_value=ref,
            last_value=last.value if last else None, last_reading_at=last.timestamp if last else None,
            last_mission_day=last.mission_day if last else None, change_pct=change,
            reference_n=len(reference_readings(rs)),
            previous_change_pct=round(100 * (prev.value / ref - 1), 1) if prev else None,
            previous_mission_day=prev.mission_day if prev else None,
            previous_value=prev.value if prev else None, score=score,
            typical_no_exercise_pct=no_ex, typical_exercise_pct=ex,
            extrapolated=any(r.extrapolated for r in rs), synthetic=any(r.synthetic for r in rs),
            model_version=reference.model_version))
    return results
