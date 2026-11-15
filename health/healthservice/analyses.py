"""The JSON of the flight-measurement page (src/front/sketch/vuelo.html): strength and aerobic capacity, test by test.

GET /api/v1/analyses serves it; the contract is in docs/frontend-backend.md ("Mediciones en vuelo"), with checks
in src/front/sketch/data/contract.js (validateAnalyses) and contract.py. The page only turns levels into colours:
every number, level and alert comes from here, the same ones the HealthService saves and sends to the queue.

- Strength: the dynamometer tests the HealthService processes (processing.ITEMS). Trunk flexion stays out, as on
  the dashboard: its bed-rest data runs the wrong way in Campaign 11.
- Aerobic capacity: VO2peak from the cycle test.
- Each test: its value, % change against the pre-flight reference, level (levels.py), whether the change is
  within the test's noise and, for VO2peak, whether it is below NASA's minimum. A test the DataService flagged
  keeps its place with no value and its quality.
- Upcoming tests: the tests the Planner booked (its plan, kind "plan" in the DataService), routine or a retest
  after a finding. Without the Planner running there are none.
- The cycle test's own data (peak heart rate, RER, Borg, why it stopped, measured or estimated) is not recorded
  by the DataService yet, so `test` is null.
"""
from __future__ import annotations

from collections import defaultdict

from .alerts import STANDARD_LOSS_PCT, Alert
from .levels import LEVELS, level_of, noise_band, within_noise
from .models import CrewInfo, MissionInfo, Reading
from .processing import ITEMS, MeasureResult, reference_readings
from .reference import Reference

AEROBIC = "vo2peak"
REGIONS = {
    "quadriceps": "Front of the thigh",
    "hamstrings": "Back of the thigh",
    "calves": "Soleus and gastrocnemius",
    "shins": "Front of the lower leg",
    "back": "Back of the trunk",
}
# Studies the scheduler records (healthservice.demo.STUDIES) and the analysis they belong to.
STUDY_ANALYSIS = {"strength": "strength", "aerobic_capacity": "aerobic"}


def strength_items(reference: Reference) -> list[tuple[str, str, str]]:
    """(group key, measure, name) of the dynamometer tests the HealthService processes."""
    return [(key, mid, title) for key, mid, title, _ in ITEMS if reference.measure(mid).get("instrument") == "dynamometer"]


def build_analyses(reference: Reference, mission: MissionInfo, crew: CrewInfo, readings: list[Reading],
                   results: list[MeasureResult], alerts: dict[str, Alert], studies: list[dict], day: float) -> dict:
    mine = sorted((r for r in readings if r.crew_id == crew.id and r.mission_day <= day), key=lambda r: r.mission_day)
    by_measure: dict[str, list[Reading]] = defaultdict(list)
    for r in mine:
        by_measure[r.measure].append(r)
    res = {r.measure: r for r in results}
    simulated = any(r.synthetic for r in mine)
    items = strength_items(reference)

    def usable(rs):
        return [r for r in rs if r.value is not None and r.quality == "ok"]

    def empty(quality: str) -> dict:
        return {"value": None, "changePct": None, "level": None, "withinNoise": None, "belowMinimum": None,
                "quality": quality}

    def below(mid: str, value: float) -> bool | None:
        floor = reference.minimum(mid)
        return None if floor is None else value < floor

    def point(mid: str, r: Reading | None, ref: float | None, n_ref: int) -> dict:
        if r is None:
            return empty("not measured")
        if r.value is None or r.quality != "ok" or not ref:
            return empty(r.quality if r.quality != "ok" else "no reference")
        change = round(100 * (r.value / ref - 1), 1)
        return {"value": round(r.value, 1), "changePct": change, "level": level_of(reference, mid, change, r.value),
                "withinNoise": within_noise(reference, mid, change, n_ref), "belowMinimum": below(mid, r.value),
                "quality": "ok"}

    def pre_point(mid: str, ref: float | None, n_ref: int) -> dict:
        if ref is None:
            return empty("not measured")
        return {"value": round(ref, 1), "changePct": 0.0, "level": level_of(reference, mid, 0.0, ref),
                "withinNoise": True, "belowMinimum": below(mid, ref), "quality": "ok"}

    def evaluation(eid: str, d: float, phase: str) -> dict:
        return {"id": eid, "day": round(d, 2), "label": "Pre-flight" if phase == "pre" else mission.label(d), "phase": phase}

    def flight_days(mids) -> list[float]:
        return sorted({r.mission_day for m in mids for r in by_measure.get(m, []) if r.mission_day >= 0})

    def pre_day(mids) -> float:
        pre = [r.mission_day for m in mids for r in by_measure.get(m, []) if r.mission_day < 0]
        return max(pre) if pre else 0.0

    def eid_of(d: float) -> str:
        return f"d{d:g}"

    def phase_of(d: float) -> str:
        return "flight" if d < mission.landing else "post"

    def alert_of(mid: str) -> dict | None:
        a = alerts.get(mid)
        return None if a is None else {"severity": a.severity, "rule": a.rule, "message": a.message}

    # ---- strength: one evaluation per dynamometer session
    mids = [mid for _, mid, _ in items]
    days = flight_days(mids)
    evaluations = [evaluation("pre", pre_day(mids), "pre")] + [evaluation(eid_of(d), d, phase_of(d)) for d in days]
    groups = []
    for key, mid, name in items:
        m = reference.measure(mid)
        rs = by_measure.get(mid, [])
        ok = usable(rs)
        n_ref = len(reference_readings(ok))
        ref = res[mid].reference_value if mid in res else None
        at = {r.mission_day: r for r in rs if r.mission_day >= 0}
        groups.append({
            "key": key, "measure": mid, "name": name, "test": m["label"], "region": REGIONS.get(key, m.get("region") or ""),
            "muscleKeys": m["muscle_keys"], "unit": rs[0].unit if rs else "", "baseline": None if ref is None else round(ref, 1),
            "referenceTests": n_ref, "noiseBandPct": noise_band(reference, mid, n_ref),
            "points": [{"evaluation": "pre", **pre_point(mid, ref, n_ref)}]
                      + [{"evaluation": eid_of(d), **point(mid, at.get(d), ref, n_ref)} for d in days],
            "alert": alert_of(mid),
        })

    # ---- aerobic capacity: one evaluation per cycle test
    rs = by_measure.get(AEROBIC, [])
    ok = usable(rs)
    n_ref = len(reference_readings(ok))
    ref = res[AEROBIC].reference_value if AEROBIC in res else None
    aerobic_evals = [{**evaluation("pre", pre_day([AEROBIC]), "pre"), **pre_point(AEROBIC, ref, n_ref), "test": None}]
    for r in rs:
        if r.mission_day >= 0:
            aerobic_evals.append({**evaluation(eid_of(r.mission_day), r.mission_day, phase_of(r.mission_day)),
                                  **point(AEROBIC, r, ref, n_ref), "test": None})
    a = reference.measure(AEROBIC)

    upcoming = upcoming_tests(mission, studies, day, {mid: "strength" for mid in mids} | {AEROBIC: "aerobic"})
    notice = "Not a health assessment."
    if simulated:
        notice = f"Synthetic data, built on NASA bed-rest studies (reference curves {reference.model_version}). " + notice
    return {
        "version": 1,
        "updatedAt": mission.timestamp(day),
        "simulated": simulated,
        "notice": notice,
        "crew": {"id": crew.id, "body": "female" if crew.sex == "F" else "male"},
        "mission": {"name": mission.name, "today": round(day, 2), "todayLabel": mission.label(day),
                    "landing": mission.landing},
        "levels": LEVELS,
        "strength": {"evaluations": evaluations, "groups": groups, "upcoming": upcoming["strength"]},
        "aerobic": {
            "measure": AEROBIC, "name": "Aerobic capacity (VO2peak)", "test": "Peak oxygen uptake on the cycle test",
            "unit": rs[0].unit if rs else a.get("unit", ""), "baseline": None if ref is None else round(ref, 1),
            "referenceTests": n_ref, "noiseBandPct": noise_band(reference, AEROBIC, n_ref),
            "minimum": reference.minimum(AEROBIC), "standardLossPct": STANDARD_LOSS_PCT,
            "evaluations": aerobic_evals, "alert": alert_of(AEROBIC), "upcoming": upcoming["aerobic"],
        },
    }


def upcoming_tests(mission: MissionInfo, studies: list[dict], day: float, measure_analysis: dict[str, str]) -> dict:
    """Tests still to come per analysis, from the scheduler's study records: [{day, label, reason}]."""
    out: dict[str, dict] = {"strength": {}, "aerobic": {}}
    for s in studies:
        if s["day"] <= day:
            continue
        analysis = STUDY_ANALYSIS.get(s.get("study")) or measure_analysis.get(s.get("measure"))
        if analysis is None:
            continue
        reason = "retest" if s.get("reason") == "finding" else "routine"
        key = (round(s["day"], 2), reason)
        out[analysis][key] = {"day": round(s["day"], 2), "label": mission.label(s["day"]), "reason": reason}
    return {k: sorted(v.values(), key=lambda u: (u["day"], u["reason"])) for k, v in out.items()}
