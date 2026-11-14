"""A Python copy of the page's dashboard checks (src/front/sketch/data/contract.js, contract version 1 of
docs/frontend-backend.md), so the tests can check every dashboard the HealthService builds as the page would.

It follows contract.js check by check. Started from the copy gravsim had up to version 0.1.0 (by CookieD). The
page checks muscle keys against the 3D model's full list (open-anatomy-3d); this copy knows the keys of that
list a dashboard is likely to use, so a key outside them fails here even if the page might take it.
"""
from __future__ import annotations

import math
import re
from datetime import datetime

MUSCLE_KEYS = {
    "abdominal_muscles", "back_muscles_l", "back_muscles_r", "calf_l", "calf_r", "chest_muscles_l", "chest_muscles_r",
    "deltoid_l", "deltoid_r", "diaphragm", "foot_muscles_l", "foot_muscles_r", "forearm_muscles_l", "forearm_muscles_r",
    "gluteal_l", "gluteal_r", "hamstrings_l", "hamstrings_r", "hand_muscles_l", "hand_muscles_r", "iliopsoas_l",
    "iliopsoas_r", "adductors_l", "adductors_r", "intercostals_l", "intercostals_r", "neck_muscles_l", "neck_muscles_r",
    "pelvic_floor", "quadriceps_l", "quadriceps_r", "rotator_cuff_l", "rotator_cuff_r", "shin_muscles_l", "shin_muscles_r",
    "shoulder_muscles_l", "shoulder_muscles_r", "trapezius_l", "trapezius_r", "upper_arm_muscles_l", "upper_arm_muscles_r",
}
TIMESTAMP = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$")


def _object(v) -> bool:
    return isinstance(v, dict)


def _text(v) -> bool:
    return isinstance(v, str) and len(v) <= 1000


def _number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _optional_number(v) -> bool:
    return v is None or _number(v)


def _timestamp(v) -> bool:
    if not isinstance(v, str) or not TIMESTAMP.match(v):
        return False
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _muscle_keys(v) -> bool:
    return isinstance(v, list) and all(k in MUSCLE_KEYS for k in v)


def validate_dashboard(data) -> dict:
    """Raise ValueError("Invalid dashboard: ...") where contract.js would throw; return the data otherwise."""
    def fail(message):
        raise ValueError(f"Invalid dashboard: {message}")

    if (not _object(data) or not _number(data.get("version")) or data["version"] != 1
            or not _timestamp(data.get("updatedAt")) or not isinstance(data.get("simulated"), bool)):
        fail("version or metadata")
    b = data.get("body")
    if (not _object(b) or b.get("body") not in ("male", "female") or b.get("layer") not in ("surface", "muscles", "skeleton")
            or not (b.get("selected") is None or b.get("selected") in MUSCLE_KEYS) or not _object(b.get("scores"))):
        fail("body")
    for key, value in b["scores"].items():
        if key not in MUSCLE_KEYS or not (value is None or (_number(value) and 0 <= value <= 100)):
            fail("scores")
    view = b.get("viewRequest")
    if not (view is None or (_object(view) and view.get("direction") in ("front", "back")
                             and isinstance(view.get("request"), int) and not isinstance(view.get("request"), bool)
                             and 0 <= view["request"] <= 2 ** 53 - 1)):
        fail("viewRequest")
    s = data.get("summary")
    if (not _object(s) or not _text(s.get("title")) or not _text(s.get("description")) or not _text(s.get("notice"))
            or not isinstance(s.get("items"), list)):
        fail("summary")
    if len(s["items"]) > 100 or any(
            not _object(i) or not _text(i.get("id")) or not i["id"] or not _muscle_keys(i.get("muscleKeys"))
            or not _text(i.get("title")) or not _text(i.get("description")) or not _optional_number(i.get("changePercent"))
            for i in s["items"]):
        fail("summary items")
    charts = data.get("charts")
    if not isinstance(charts, list) or len(charts) > 100 or any(
            not _object(c) or not _text(c.get("id")) or not c["id"] or not _muscle_keys(c.get("muscleKeys"))
            or not _text(c.get("title")) or not _text(c.get("description")) or not _text(c.get("unit"))
            or not _optional_number(c.get("reference")) or not (c.get("insight") is None or _text(c.get("insight")))
            or not isinstance(c.get("points"), list) or len(c["points"]) > 10000
            or any(not _object(p) or not _timestamp(p.get("at")) or not _optional_number(p.get("value")) for p in c["points"])
            for c in charts):
        fail("charts")
    if len({i["id"] for i in s["items"]}) != len(s["items"]) or len({c["id"] for c in charts}) != len(charts):
        fail("duplicate ids")
    return data
