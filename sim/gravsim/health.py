"""HealthService: turns the readings in the DataService into what the 3D page shows.

dashboard() builds the dashboard JSON, version 1 of the contract in docs/frontend-backend.md on the
design-body branch. validate_dashboard() runs the same checks as the page (src/front/sketch/data/contract.js).
Everything dashboard() computes is saved back through the DataService as processed results: kind
"dashboard" (the JSON it returns) and kind "measure_change" (for each measure shown: the pre-flight
reference, the % change and the time of the latest reading).
In the team's sketch the HealthService also feeds a queue and a notification system (ship, crew, Earth);
those are out of scope for the challenge.

Only what a monitoring system would see is used: readings with quality "ok", never gravsim's hidden truth.
The reference for each measure is the mean of that person's pre-flight readings.

Score (0-100, colour intensity on the body): how far the measured loss has gone towards the plateau
that bed-rest subjects reached without exercise. 0 = at the pre-flight reference, 100 = as much loss
as no exercise at all. It is a visual scale, not a clinical grade.
"""
from __future__ import annotations

import math
import re
from collections import defaultdict
from datetime import datetime

from .core import MEASURES, MODEL_VERSION, CrewMember
from .dataservice import DataService

MUSCLE_KEYS = {
    "abdominal_muscles", "back_muscles_l", "back_muscles_r", "calf_l", "calf_r", "chest_muscles_l", "chest_muscles_r",
    "deltoid_l", "deltoid_r", "diaphragm", "foot_muscles_l", "foot_muscles_r", "forearm_muscles_l", "forearm_muscles_r",
    "gluteal_l", "gluteal_r", "hamstrings_l", "hamstrings_r", "hand_muscles_l", "hand_muscles_r", "iliopsoas_l",
    "iliopsoas_r", "adductors_l", "adductors_r", "intercostals_l", "intercostals_r", "neck_muscles_l", "neck_muscles_r",
    "pelvic_floor", "quadriceps_l", "quadriceps_r", "rotator_cuff_l", "rotator_cuff_r", "shin_muscles_l", "shin_muscles_r",
    "shoulder_muscles_l", "shoulder_muscles_r", "trapezius_l", "trapezius_r", "upper_arm_muscles_l", "upper_arm_muscles_r",
}

# Body regions: (item id, measure, title, what was measured). Trunk flexion (abdominals) is left out: its data
# runs the wrong way in Campaign 11, so it would colour the body with noise.
REGIONS = [
    ("quadriceps", "knee_extension_60", "Quadriceps", "Knee extension strength at 60°/s (dynamometer)"),
    ("hamstrings", "knee_flexion_60", "Hamstrings", "Knee flexion strength at 60°/s (dynamometer)"),
    ("calves", "ankle_plantarflexion_30", "Calves", "Ankle plantarflexion strength at 30°/s (dynamometer)"),
    ("shins", "ankle_dorsiflexion_30", "Shins", "Ankle dorsiflexion strength at 30°/s (dynamometer)"),
    ("back", "trunk_extension_60", "Back", "Trunk extension strength at 60°/s (dynamometer)"),
    ("arms", "lean_arms", "Arms", "Arm lean mass (DXA)"),
]
# Whole-body measures, shown as charts only: (measure, title, what was measured)
WHOLE_BODY = [
    ("vo2peak", "Aerobic capacity (VO2peak)", "Peak oxygen uptake on the cycle test"),
    ("hip_bmd", "Hip bone density", "Total hip bone density (DXA)"),
]
SHOWN = [mid for _, mid, _, _ in REGIONS] + [mid for mid, _, _ in WHOLE_BODY]


class HealthService:
    def __init__(self, data: DataService):
        self.data = data

    def dashboard(self, crew: CrewMember, day: float, layer: str = "surface", selected: str | None = None) -> dict:
        """The dashboard JSON for one crew member on a mission day, from the readings taken up to then.
        It is also saved, with the per-measure changes behind it, as processed results."""
        mission = crew.mission
        launch = mission.timestamp(0)
        unloaded = mission.unloaded_days(day)
        series = defaultdict(list)          # measure -> usable readings up to `day`, oldest first
        for r in self.data.readings(crew.id, SHOWN, end=mission.timestamp(day)):
            if r.quality == "ok":
                series[r.measure].append(r)
        trend = {mid: _trend(series[mid], launch) for mid in SHOWN}

        def chart(chart_id, keys, title, what, mid):
            ref, change = trend[mid]
            insight = None
            if change is not None:
                insight = f"{change:+.0f}% since pre-flight."
                no_ex, ex = _typical(mid, unloaded, 0.0), _typical(mid, unloaded, 1.0)
                if no_ex is not None and unloaded > 0:
                    insight += (f" After {unloaded:.0f} days without gravity, bed-rest subjects changed about {no_ex:+.0f}%"
                                f" without exercise and {ex:+.0f}% with it.")
            return {"id": chart_id, "muscleKeys": keys, "title": title,
                    "description": f"{what}, as % of the pre-flight reference. Synthetic data.",
                    "unit": "% of pre-flight", "reference": 100, "insight": insight,
                    "points": [{"at": r.timestamp, "value": round(100 * r.value / ref, 1)} for r in series[mid]]}

        scores, items, charts = {}, [], []
        for item_id, mid, title, what in REGIONS:
            m = MEASURES[mid]
            change = trend[mid][1]
            change = None if change is None else round(change, 1)
            if change is not None:
                # "worse" is a fall for most measures and a rise for those that go up (direction +1)
                worse = max(0.0, m["direction"] * change)
                # at least 10%, so a measure that barely moves in the data doesn't turn its noise into a red body part
                plateau = max(abs(m.get("loss_pct") or 0.0), 10.0)
                for key in m["muscle_keys"]:
                    scores[key] = round(min(100.0, 100.0 * worse / plateau), 1)
            last = series[mid][-1] if series[mid] else None
            when = mission.label(mission.day_of(last.timestamp)) if last else "no reading yet"
            items.append({"id": item_id, "muscleKeys": m["muscle_keys"], "title": title,
                          "description": f"{what}, latest {when}, compared with the pre-flight reference.",
                          "changePercent": change})
            charts.append(chart(f"{item_id}-trend", m["muscle_keys"], f"{title} over time", what, mid))
        for mid, title, what in WHOLE_BODY:
            charts.append(chart(f"{mid}-trend", [], title, what, mid))

        dashboard = {
            "version": 1,
            "updatedAt": mission.timestamp(day),
            "simulated": True,
            "body": {"body": "female" if crew.sex == "F" else "male", "layer": layer,
                     "selected": selected if selected in MUSCLE_KEYS else None, "scores": scores, "viewRequest": None},
            "summary": {
                "title": f"{crew.id} · {mission.label(day)}",
                "description": "Latest measurements compared with this crew member's pre-flight reference.",
                "notice": f"Synthetic data from gravsim {MODEL_VERSION}, built on NASA bed-rest studies. Not a health assessment.",
                "items": items,
            },
            "charts": charts,
        }
        changes = {mid: {"reference": ref, "change_pct": change,
                         "latest_at": series[mid][-1].timestamp if series[mid] else None}
                   for mid, (ref, change) in trend.items()}
        self.data.save_result(crew.id, "dashboard", mission.timestamp(day), dashboard)
        self.data.save_result(crew.id, "measure_change", mission.timestamp(day), changes)
        return dashboard


def _trend(readings: list, launch: str) -> tuple[float | None, float | None]:
    """(reference, change) for one measure's readings, oldest first. reference: the mean of the readings
    before launch, or the first reading if none came before. change: % change of the latest reading from
    the reference, None until there is a reading from launch on."""
    if not readings:
        return None, None
    pre = [r.value for r in readings if r.timestamp < launch] or [readings[0].value]
    ref = sum(pre) / len(pre)
    last = readings[-1]
    return ref, (100 * (last.value / ref - 1) if last.timestamp >= launch else None)


def _typical(measure: str, unloaded_days: float, adherence: float) -> float | None:
    """Group-typical % change after this many unloaded days, as fitted from the bed-rest data."""
    m = MEASURES[measure]
    k = 1 - (m.get("exercise_effect") or 0) * adherence
    if m["model"] == "saturating":
        return m["loss_pct"] * k * (1 - math.exp(-unloaded_days / m["tau_days"]))
    if m["model"] == "linear":
        return m["rate_pct_per_day"] * k * unloaded_days
    return None


# ---- the frontend's checks, mirrored from src/front/sketch/data/contract.js

TIMESTAMP = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)")


def _text(v) -> bool:
    return isinstance(v, str) and len(v) <= 1000


def _number(v) -> bool:
    """A finite number or None (JSON has no NaN; the page's JSON parser would fail first)."""
    return v is None or (isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v))


def _keys(v) -> bool:
    return isinstance(v, list) and all(k in MUSCLE_KEYS for k in v)


def _time(v) -> bool:
    if not (isinstance(v, str) and TIMESTAMP.fullmatch(v)):
        return False
    try:
        datetime.strptime(v[:19], "%Y-%m-%dT%H:%M:%S")        # a real date, as Date.parse requires
        return True
    except ValueError:
        return False


def validate_dashboard(d: dict) -> dict:
    """Raise ValueError where the page would reject the response; return d when it passes.
    A missing key that may be null reads as "" here, so it fails as `undefined` does in JavaScript."""
    def check(ok, what):
        if not ok:
            raise ValueError(f"Invalid dashboard: {what}")

    check(isinstance(d, dict) and d.get("version") == 1 and _time(d.get("updatedAt"))
          and isinstance(d.get("simulated"), bool), "version or metadata")
    b = d.get("body")
    check(isinstance(b, dict) and b.get("body") in ("male", "female") and b.get("layer") in ("surface", "muscles", "skeleton")
          and (b.get("selected", "") is None or b.get("selected") in MUSCLE_KEYS) and isinstance(b.get("scores"), dict), "body")
    check(all(k in MUSCLE_KEYS and (v is None or (_number(v) and 0 <= v <= 100)) for k, v in b["scores"].items()), "scores")
    view = b.get("viewRequest", "")
    check(view is None or (isinstance(view, dict) and view.get("direction") in ("front", "back")
                           and isinstance(view.get("request"), int) and not isinstance(view.get("request"), bool)
                           and view["request"] >= 0), "viewRequest")
    s = d.get("summary")
    check(isinstance(s, dict) and _text(s.get("title")) and _text(s.get("description")) and _text(s.get("notice"))
          and isinstance(s.get("items"), list), "summary")
    check(len(s["items"]) <= 100 and all(
        isinstance(it, dict) and _text(it.get("id")) and it["id"] and _keys(it.get("muscleKeys")) and _text(it.get("title"))
        and _text(it.get("description")) and _number(it.get("changePercent", "")) for it in s["items"]), "summary items")
    charts = d.get("charts")
    check(isinstance(charts, list) and len(charts) <= 100 and all(
        isinstance(c, dict) and _text(c.get("id")) and c["id"] and _keys(c.get("muscleKeys")) and _text(c.get("title"))
        and _text(c.get("description")) and _text(c.get("unit")) and _number(c.get("reference", ""))
        and (c.get("insight", "") is None or _text(c.get("insight"))) and isinstance(c.get("points"), list)
        and len(c["points"]) <= 10_000
        and all(isinstance(p, dict) and _time(p.get("at")) and _number(p.get("value", "")) for p in c["points"])
        for c in charts), "charts")
    check(len({it["id"] for it in s["items"]}) == len(s["items"]) and len({c["id"] for c in charts}) == len(charts),
          "duplicate ids")
    return d
