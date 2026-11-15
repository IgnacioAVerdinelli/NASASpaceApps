"""A Python copy of the page's checks (src/front/sketch/data/contract.js: validateDashboard, contract version 1 of
docs/frontend-backend.md, and validateAnalyses, the flight-measurement page), so the tests can check every JSON the
HealthService builds as the page would.

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


# --------------------------------------------------------------------------- flight-measurement page (validateAnalyses)

def _non_empty(v) -> bool:
    return _text(v) and len(v) > 0


def _optional_bool(v) -> bool:
    return v is None or isinstance(v, bool)


def _level(v) -> bool:
    return v is None or (isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 4)


def _int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _alert(v) -> bool:
    return v is None or (_object(v) and v.get("severity") in ("warning", "critical") and _non_empty(v.get("rule"))
                         and _non_empty(v.get("message")))


def _upcoming(v) -> bool:
    return isinstance(v, list) and len(v) <= 100 and all(
        _object(u) and _number(u.get("day")) and _non_empty(u.get("label")) and u.get("reason") in ("routine", "retest")
        for u in v)


def _test_point(v) -> bool:
    return (_object(v) and _optional_number(v.get("value")) and _optional_number(v.get("changePct"))
            and _level(v.get("level")) and _optional_bool(v.get("withinNoise")) and _optional_bool(v.get("belowMinimum"))
            and _non_empty(v.get("quality")))


def _evaluation(v) -> bool:
    return (_object(v) and _non_empty(v.get("id")) and _number(v.get("day")) and _non_empty(v.get("label"))
            and v.get("phase") in ("pre", "flight", "post"))


def validate_analyses(data) -> dict:
    """Raise ValueError("Invalid analyses: ...") where contract.js's validateAnalyses would throw."""
    def fail(message):
        raise ValueError(f"Invalid analyses: {message}")

    if (not _object(data) or not _number(data.get("version")) or data["version"] != 1 or not _timestamp(data.get("updatedAt"))
            or not isinstance(data.get("simulated"), bool) or not _text(data.get("notice"))):
        fail("version or metadata")
    crew = data.get("crew")
    if not _object(crew) or not _non_empty(crew.get("id")) or crew.get("body") not in ("male", "female"):
        fail("crew")
    m = data.get("mission")
    if (not _object(m) or not _text(m.get("name")) or not _number(m.get("today")) or not _non_empty(m.get("todayLabel"))
            or not _number(m.get("landing"))):
        fail("mission")
    levels = data.get("levels")
    if not isinstance(levels, list) or len(levels) != 4 or any(
            not _object(item) or item.get("level") != i + 1 or not _non_empty(item.get("label")) or not _non_empty(item.get("range"))
            for i, item in enumerate(levels)):
        fail("levels")
    s = data.get("strength")
    if (not _object(s) or not isinstance(s.get("evaluations"), list) or len(s["evaluations"]) > 100
            or not all(_evaluation(e) for e in s["evaluations"]) or not isinstance(s.get("groups"), list)
            or len(s["groups"]) > 50 or not _upcoming(s.get("upcoming"))):
        fail("strength")
    ids = [e["id"] for e in s["evaluations"]]
    if len(set(ids)) != len(ids):
        fail("duplicate evaluations")
    for g in s["groups"]:
        if (not _object(g) or not _non_empty(g.get("key")) or not _non_empty(g.get("measure")) or not _non_empty(g.get("name"))
                or not _non_empty(g.get("test")) or not _text(g.get("region")) or not _muscle_keys(g.get("muscleKeys"))
                or not g["muscleKeys"] or not _text(g.get("unit")) or not _optional_number(g.get("baseline"))
                or not _int(g.get("referenceTests")) or g["referenceTests"] < 0 or not _number(g.get("noiseBandPct"))
                or not _alert(g.get("alert")) or not isinstance(g.get("points"), list) or len(g["points"]) != len(ids)
                or any(not _test_point(p) or p.get("evaluation") != ids[i] for i, p in enumerate(g["points"]))):
            fail("strength groups")
    if len({g["key"] for g in s["groups"]}) != len(s["groups"]):
        fail("duplicate groups")
    a = data.get("aerobic")
    if (not _object(a) or not _non_empty(a.get("measure")) or not _non_empty(a.get("name")) or not _non_empty(a.get("test"))
            or not _text(a.get("unit")) or not _optional_number(a.get("baseline")) or not _int(a.get("referenceTests"))
            or a["referenceTests"] < 0 or not _number(a.get("noiseBandPct")) or not _optional_number(a.get("minimum"))
            or not _number(a.get("standardLossPct")) or not _alert(a.get("alert")) or not _upcoming(a.get("upcoming"))):
        fail("aerobic")
    evs = a.get("evaluations")
    if not isinstance(evs, list) or len(evs) > 100 or any(
            not _evaluation(e) or not _test_point(e) or not (e.get("test") is None or _object(e.get("test"))) for e in evs):
        fail("aerobic evaluations")
    if len({e["id"] for e in evs}) != len(evs):
        fail("duplicate evaluations")
    return data
