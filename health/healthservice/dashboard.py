"""Turn processed results into the dashboard JSON the 3D page reads.

Contract version 1, defined by Enzo in docs/frontend-backend.md (branch design-body), with an executable
validator in src/front/sketch/data/contract.js.
"""
from __future__ import annotations

from .models import CrewInfo, MissionInfo, Reading
from .processing import ITEMS, WHOLE_BODY, MeasureResult, series_by_measure
from .reference import Reference


def build_dashboard(reference: Reference, mission: MissionInfo, crew: CrewInfo, readings: list[Reading],
                    results: list[MeasureResult], day: float, body_layer: str = "surface",
                    selected: str | None = None) -> dict:
    by_measure = {r.measure: r for r in results}
    series = series_by_measure(readings, crew.id, day)
    simulated = any(r.synthetic for rs in series.values() for r in rs)
    scores, items, charts = {}, [], []

    for item_id, mid, title, what in ITEMS:
        m, res = reference.measure(mid), by_measure[mid]
        if res.score is not None:
            for key in m["muscle_keys"]:
                scores[key] = res.score
        when = mission.label(res.last_mission_day) if res.last_mission_day is not None else "no reading yet"
        items.append({"id": item_id, "muscleKeys": m["muscle_keys"], "title": title,
                      "description": f"{what}, latest {when}, compared with the pre-flight reference.",
                      "changePercent": res.change_pct})
        charts.append(_chart(f"{item_id}-trend", m["muscle_keys"], f"{title} over time", what,
                             res, series.get(mid, []), simulated))
    for mid, title, what in WHOLE_BODY:
        charts.append(_chart(f"{mid}-trend", [], title, what, by_measure[mid], series.get(mid, []), simulated))

    notice = "Not a health assessment."
    if simulated:
        notice = (f"Synthetic data, built on NASA bed-rest studies (reference curves {reference.model_version}). "
                  + notice)
    return {
        "version": 1,
        "updatedAt": mission.timestamp(day),
        "simulated": simulated,
        "body": {"body": "female" if crew.sex == "F" else "male", "layer": body_layer,
                 "selected": selected, "scores": scores, "viewRequest": None},
        "summary": {
            "title": f"{crew.id} · {mission.label(day)}",
            "description": "Latest measurements compared with this crew member's pre-flight reference.",
            "notice": notice,
            "items": items,
        },
        "charts": charts,
    }


def _chart(cid: str, keys: list[str], title: str, what: str, res: MeasureResult, rs: list[Reading],
           simulated: bool) -> dict:
    ref = res.reference_value
    points = [{"at": r.timestamp, "value": round(100 * r.value / ref, 1)} for r in rs] if ref else []
    insight = None
    if rs and rs[-1].mission_day >= 0 and ref:
        change = 100 * (rs[-1].value / ref - 1)
        insight = f"{change:+.0f}% since pre-flight."
        no_ex, ex = res.typical_no_exercise_pct, res.typical_exercise_pct
        if no_ex is not None:
            insight += (f" After {res.unloaded_days:.0f} days without gravity, bed-rest subjects changed about {no_ex:+.0f}%"
                        f" without exercise and {ex:+.0f}% with it.")
    description = f"{what}, as % of the pre-flight reference."
    if simulated:
        description += " Synthetic data."
    return {"id": cid, "muscleKeys": keys, "title": title, "description": description,
            "unit": "% of pre-flight", "reference": 100, "insight": insight, "points": points}
