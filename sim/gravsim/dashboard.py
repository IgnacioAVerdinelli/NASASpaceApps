"""Turn simulated readings into the dashboard JSON the 3D page reads (version 1 of the contract in
docs/frontend-backend.md on the design-body branch).

Only what the monitoring system would see is used: the instrument readings, not the hidden truth.
The reference for each measure is the mean of that person's pre-flight readings.

Score (0-100, colour intensity on the body): how far the measured loss has gone towards the plateau
that bed-rest subjects reached without exercise. 0 = at the pre-flight reference, 100 = as much loss
as no exercise at all. It is a visual scale, not a clinical grade.
"""
from __future__ import annotations

import math
import re
from collections import defaultdict
from datetime import datetime, timezone

from .core import MEASURES, MODEL_VERSION, CrewMember, Mission
from .reading import Reading
from .schedule import timeline

MUSCLE_KEYS = {
    "abdominal_muscles", "back_muscles_l", "back_muscles_r", "calf_l", "calf_r", "chest_muscles_l", "chest_muscles_r",
    "deltoid_l", "deltoid_r", "diaphragm", "foot_muscles_l", "foot_muscles_r", "forearm_muscles_l", "forearm_muscles_r",
    "gluteal_l", "gluteal_r", "hamstrings_l", "hamstrings_r", "hand_muscles_l", "hand_muscles_r", "iliopsoas_l",
    "iliopsoas_r", "adductors_l", "adductors_r", "intercostals_l", "intercostals_r", "neck_muscles_l", "neck_muscles_r",
    "pelvic_floor", "quadriceps_l", "quadriceps_r", "rotator_cuff_l", "rotator_cuff_r", "shin_muscles_l", "shin_muscles_r",
    "shoulder_muscles_l", "shoulder_muscles_r", "trapezius_l", "trapezius_r", "upper_arm_muscles_l", "upper_arm_muscles_r",
}

# (item id, measure, title, what was measured). Trunk flexion (abdominals) is left out: its data runs the
# wrong way in Campaign 11, so it would colour the body with noise.
ITEMS = [
    ("quadriceps", "knee_extension_60", "Quadriceps", "Knee extension strength at 60°/s (dynamometer)"),
    ("hamstrings", "knee_flexion_60", "Hamstrings", "Knee flexion strength at 60°/s (dynamometer)"),
    ("calves", "ankle_plantarflexion_30", "Calves", "Ankle plantarflexion strength at 30°/s (dynamometer)"),
    ("shins", "ankle_dorsiflexion_30", "Shins", "Ankle dorsiflexion strength at 30°/s (dynamometer)"),
    ("back", "trunk_extension_60", "Back", "Trunk extension strength at 60°/s (dynamometer)"),
    ("arms", "lean_arms", "Arms", "Arm lean mass (DXA)"),
]
WHOLE_BODY = [
    ("vo2peak", "Aerobic capacity (VO2peak)", "Peak oxygen uptake on the cycle test"),
    ("hip_bmd", "Hip bone density", "Total hip bone density (DXA)"),
]


def _typical(measure: str, unloaded_days: float, adherence: float) -> float | None:
    """Group-typical % change after this many unloaded days, as fitted from the bed-rest data."""
    m = MEASURES[measure]
    k = 1 - (m.get("exercise_effect") or 0) * adherence
    if m["model"] == "saturating":
        return m["loss_pct"] * k * (1 - math.exp(-unloaded_days / m["tau_days"]))
    if m["model"] == "linear":
        return m["rate_pct_per_day"] * k * unloaded_days
    return None


def build_dashboard(mission: Mission, crew: CrewMember, day: float, readings: list[Reading] | None = None,
                    schedule: str | int = "nasa", body_layer: str = "surface", selected: str | None = None,
                    seed: int | None = None) -> dict:
    if readings is None:
        readings = timeline(mission, schedule, crew=crew, until=day, seed=seed)
    series: dict[str, list[Reading]] = defaultdict(list)
    for r in readings:
        if r.crew_id == crew.id and r.mission_day <= day and r.value is not None:
            series[r.measure].append(r)

    def ref_latest(measure):
        rs = sorted(series.get(measure, []), key=lambda r: r.mission_day)
        if not rs:
            return None, None, []
        pre = [r.value for r in rs if r.mission_day < 0] or [rs[0].value]
        ref = sum(pre) / len(pre)
        return ref, rs[-1], rs

    unloaded = mission.unloaded_days(day)
    scores, items, charts = {}, [], []
    for item_id, mid, title, what in ITEMS:
        m = MEASURES[mid]
        ref, last, rs = ref_latest(mid)
        change = None if last is None or last.mission_day < 0 else round(100 * (last.value / ref - 1), 1)
        if change is not None:
            worse = max(0.0, -change if (m.get("loss_pct") or -1) < 0 else change)
            plateau = max(abs(m.get("loss_pct") or 0.0), 10.0)
            for key in m["muscle_keys"]:
                scores[key] = round(min(100.0, 100.0 * worse / plateau), 1)
        when = f"{mission.label(last.mission_day)}" if last is not None else "no reading yet"
        items.append({"id": item_id, "muscleKeys": m["muscle_keys"], "title": title,
                      "description": f"{what}, latest {when}, compared with the pre-flight reference.",
                      "changePercent": change})
        charts.append(_chart(f"{item_id}-trend", m["muscle_keys"], f"{title} over time", what, mid, ref, rs, unloaded))
    for mid, title, what in WHOLE_BODY:
        ref, last, rs = ref_latest(mid)
        charts.append(_chart(f"{mid}-trend", [], title, what, mid, ref, rs, unloaded))

    return {
        "version": 1,
        "updatedAt": mission.timestamp(day),
        "simulated": True,
        "body": {"body": "female" if crew.sex == "F" else "male", "layer": body_layer,
                 "selected": selected if selected in MUSCLE_KEYS else None, "scores": scores, "viewRequest": None},
        "summary": {
            "title": f"{crew.id} · {mission.label(day)}",
            "description": "Latest measurements compared with this crew member's pre-flight reference.",
            "notice": f"Synthetic data from gravsim {MODEL_VERSION}, built on NASA bed-rest studies. Not a health assessment.",
            "items": items,
        },
        "charts": charts,
    }


def _chart(cid, keys, title, what, mid, ref, rs, unloaded):
    m = MEASURES[mid]
    points = [{"at": r.timestamp, "value": round(100 * r.value / ref, 1)} for r in rs] if ref else []
    insight = None
    if rs and rs[-1].mission_day >= 0 and ref:
        change = 100 * (rs[-1].value / ref - 1)
        no_ex, ex = _typical(mid, unloaded, 0.0), _typical(mid, unloaded, 1.0)
        insight = f"{change:+.0f}% since pre-flight."
        if no_ex is not None and unloaded > 0:
            insight += (f" After {unloaded:.0f} days without gravity, bed-rest subjects changed about {no_ex:+.0f}%"
                        f" without exercise and {ex:+.0f}% with it.")
    return {"id": cid, "muscleKeys": keys, "title": title,
            "description": f"{what}, as % of the pre-flight reference. Synthetic data.",
            "unit": "% of pre-flight", "reference": 100, "insight": insight, "points": points}


def validate(d: dict) -> None:
    """A Python mirror of the checks in src/front/sketch/data/contract.js. Raises ValueError."""
    def fail(msg):
        raise ValueError(f"Invalid dashboard: {msg}")
    if d.get("version") != 1 or not isinstance(d.get("simulated"), bool):
        fail("version or metadata")
    ts = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$")
    if not ts.match(d["updatedAt"]):
        fail("updatedAt")
    b = d["body"]
    if b["body"] not in ("male", "female") or b["layer"] not in ("surface", "muscles", "skeleton"):
        fail("body")
    if not (b["selected"] is None or b["selected"] in MUSCLE_KEYS):
        fail("selected")
    for k, v in b["scores"].items():
        if k not in MUSCLE_KEYS or not (v is None or (isinstance(v, (int, float)) and 0 <= v <= 100)):
            fail(f"score {k}={v}")
    for it in d["summary"]["items"]:
        if not it["id"] or any(k not in MUSCLE_KEYS for k in it["muscleKeys"]):
            fail(f"item {it['id']}")
    ids = [c["id"] for c in d["charts"]]
    if len(set(ids)) != len(ids) or len({i["id"] for i in d["summary"]["items"]}) != len(d["summary"]["items"]):
        fail("duplicate ids")
    for c in d["charts"]:
        if any(k not in MUSCLE_KEYS for k in c["muscleKeys"]) or len(c["points"]) > 10000:
            fail(f"chart {c['id']}")
        for p in c["points"]:
            if not ts.match(p["at"]):
                fail(f"point time {p['at']}")
    for s in [d["summary"]["title"], d["summary"]["description"], d["summary"]["notice"]]:
        if len(s) > 1000:
            fail("text too long")
