"""The jugular vein ultrasound (OCHMO-STD-100.1A [6041]): each scan of both internal jugular veins against the
person's own pre-flight scan, with a level for the crew member (docs/investigacion-yugular.md, section 6).

No I/O here. The inputs are DataService reading records (dicts, as GET /api/v1/readings sends them); the output is
the JSON of GET /api/v1/veins and the findings the scan raises for the Planner.

Levels (ours: there is no expert consensus with classes, as there is for SANS; they follow the reason of [6041] and
Pavela 2022, "abnormal flow characteristics ... may signal an increased risk for thrombus formation"):
- normal: flow grade 1 or 2, the vein collapses when pressed, slow-blood echoes none or mild;
- check: stagnant flow (grade 3), retrograde flow (grade 4) or moderate echoes, in either vein;
- alarm: a vein that does not collapse when pressed (a possible clot).
Each vein is judged on its own and the person takes the worse vein's level. The area is not judged: in flight the
vein is always fuller, as when lying down on Earth (Marshall-Goebel 2019); it is shown as the fluid shift's context.
The pre-flight reference is the scan lying down, which is how a vein looks in flight; the seated vein is nearly empty.
A check or alarm scan is a finding for the Planner, which books a flight-surgeon review (same day for an alarm).
"""
from __future__ import annotations

from statistics import fmean

from .models import MissionInfo

TOPIC, SOURCE, MEASURE = "health.finding", "vascular", "veins"

# measure, name, unit, decimals, kind, what it shows
SCAN = [
    ("ijv_flow_grade", "Blood flow", "grade", 0, "grade",
     "1 flows to the heart, 2 in pulses, 3 standing still, 4 back toward the head"),
    ("ijv_compressible", "Collapses when pressed", "flag", 0, "flag",
     "A healthy vein flattens under the probe; one with a clot does not"),
    ("ijv_echogenicity", "Slow-blood echoes", "grade", 0, "grade",
     "'Smoke' inside the vein when the blood moves slowly: none, mild or moderate"),
    ("ijv_csa", "Area of the vein", "mm²", 0, "value",
     "How full the vein is. In flight it is always fuller, as when lying down on Earth"),
    ("ijv_peak_velocity", "Peak blood speed", "cm/s", 1, "value",
     "Toward the heart; below zero, the blood goes back toward the head"),
]
MEASURES = [s[0] for s in SCAN]
SIDES = ("right", "left")
SIDE_NAMES = {"right": "Right vein", "left": "Left vein"}
LEVEL_ORDER = ["normal", "check", "alarm"]
LEVEL_TEXT = {
    "normal": "Blood flows normally in both jugular veins.",
    "check": "Slow or reversed blood in a jugular vein, a known risk for clots in flight. "
             "The flight surgeon reviews it and the next scans follow it.",
    "alarm": "A jugular vein does not collapse when pressed: a possible clot. Talk to the flight surgeon today.",
}
GRADES = {1: "Continuous, toward the heart", 2: "Pulsatile, toward the heart", 3: "Standing still", 4: "Back toward the head"}
ECHO = {0: "None", 1: "Mild", 2: "Moderate"}
# Marshall-Goebel 2019, left vein, mean area (mm²) and pressure context for the chart
REFERENCE = {"seated": 9.8, "supine": 80.7, "head_down": 107.7, "flight_50": 70.3, "flight_150": 60.0,
             "source": "Marshall-Goebel 2019 (JAMA Netw Open), 11 ISS astronauts, left internal jugular vein"}


def scans(mission: MissionInfo, records: list[dict]) -> list[dict]:
    """The scan sessions, oldest first: one day's readings grouped by vein, {day, label, at, values: {side: {...}}}.
    A reading without a side counts for both veins."""
    by_day: dict[float, dict] = {}
    for r in records:
        if r.get("quality", "ok") != "ok" or r.get("value") is None or r["measure"] not in MEASURES:
            continue
        day = mission.day_of(r["timestamp"])
        s = by_day.setdefault(round(day, 1), {"day": round(day, 3), "label": r.get("day_label") or mission.label(day),
                                              "at": r["timestamp"], "values": {side: {} for side in SIDES}})
        for side in ([r["side"]] if r.get("side") in SIDES else SIDES):
            s["values"][side][r["measure"]] = r["value"]
    return [by_day[k] for k in sorted(by_day)]


def baseline(sessions: list[dict]) -> dict[str, dict[str, float]]:
    """The pre-flight reference of each vein: the mean of the scans before launch (the first scan when there is none)."""
    pre = [s for s in sessions if s["day"] < 0] or sessions[:1]
    out = {}
    for side in SIDES:
        out[side] = {}
        for m in MEASURES:
            vals = [s["values"][side][m] for s in pre if m in s["values"][side]]
            if vals:
                out[side][m] = fmean(vals)
    return out


def judge(values: dict[str, float]) -> tuple[str, list[dict]]:
    """The level of one vein at one scan and the signs behind it."""
    signs = []
    if values.get("ijv_compressible", 1) < 1:
        signs.append({"sign": "not_compressible", "level": "alarm",
                      "text": "does not collapse when pressed: a possible clot"})
    grade = values.get("ijv_flow_grade")
    if grade is not None and grade >= 4:
        signs.append({"sign": "retrograde", "level": "check", "text": "blood flows back toward the head (grade 4)"})
    elif grade is not None and grade >= 3 and not signs:      # a clot also stops the flow; say it once
        signs.append({"sign": "stagnant", "level": "check", "text": "blood is standing still (grade 3)"})
    if values.get("ijv_echogenicity", 0) >= 2 and not any(s["sign"] == "not_compressible" for s in signs):
        signs.append({"sign": "echogenicity", "level": "check", "text": "moderate slow-blood echoes"})
    return worst(s["level"] for s in signs), signs


def worst(levels) -> str:
    return max(levels, key=LEVEL_ORDER.index, default="normal")


def build_veins(mission: MissionInfo, crew_id: str, day: float, records: list[dict], simulated: bool = True) -> dict:
    """GET /api/v1/veins: every scan up to `day`, each vein against its own pre-flight scan; the level of the person
    is the worse vein's."""
    sessions = [s for s in scans(mission, records) if s["day"] <= day + 1e-9]
    base = baseline(sessions)
    for s in sessions:
        s["changes"], s["sides"] = {}, {}
        for side in SIDES:
            vals, b = s["values"][side], base[side]
            s["changes"][side] = {m: round(v - b[m], 3) for m, v in vals.items() if m in b}
            level, signs = judge(vals) if s["day"] >= 0 else ("normal", [])
            s["sides"][side] = {"level": level, "signs": [g | {"side": side} for g in signs]}
        s["level"] = worst(s["sides"][side]["level"] for side in SIDES)
        s["signs"] = [g for side in SIDES for g in s["sides"][side]["signs"]]
    flight = [s for s in sessions if s["day"] >= 0]
    latest = sessions[-1] if sessions else None
    current = flight[-1] if flight else None
    level = current["level"] if current else "normal"
    measures = []
    for mid, name, unit, decimals, kind, about in SCAN:
        per_side = {}
        for side in SIDES:
            series = [{"day": s["day"], "label": s["label"], "value": s["values"][side][mid],
                       "change": s["changes"][side].get(mid)} for s in sessions if mid in s["values"][side]]
            per_side[side] = {"baseline": base[side].get(mid), "latest": series[-1] if series else None, "series": series}
        measures.append({"measure": mid, "name": name, "unit": unit, "decimals": decimals, "kind": kind,
                         "about": about, "sides": per_side})
    peak = max(flight, key=lambda s: LEVEL_ORDER.index(s["level"]), default=None)
    return {
        "version": 1, "crew": {"id": crew_id}, "simulated": simulated, "sideOrder": list(SIDES),
        "mission": {"today": round(day, 3), "todayLabel": mission.label(day), "landing": mission.landing},
        "status": {"level": level, "text": LEVEL_TEXT[level],
                   "sides": {side: current["sides"][side]["level"] if current else "normal" for side in SIDES},
                   "signs": [g | {"text": f"{SIDE_NAMES[g['side']]}: {g['text']}"} for g in current["signs"]] if current else [],
                   "scanLabel": current["label"] if current else None,
                   "worstLevel": peak["level"] if peak else "normal", "worstLabel": peak["label"] if peak else None},
        "grades": {str(k): v for k, v in GRADES.items()}, "echo": {str(k): v for k, v in ECHO.items()},
        "reference": REFERENCE,
        "scans": sessions, "latest": latest, "measures": measures,
        "notice": ("Synthetic data, modelled on published NASA results. " if simulated else "")
                  + "Each vein is compared with its own pre-flight scan lying down; the level is the worse vein's. "
                    "The levels are this project's, not a NASA rule. Not a medical assessment.",
    }


# --------------------------------------------------------------------------- findings for the Planner

def findings(crew_id: str, veins: dict, previous: dict[str, dict]) -> list[dict]:
    """The scan's finding to publish: `suspected` when the level becomes check, `confirmed` when it becomes alarm,
    `cleared` when an open one is back to normal. `previous`: the last finding by measure."""
    st, latest = veins["status"], veins["latest"]
    if latest is None or latest["day"] < 0:
        return []
    last = previous.get(MEASURE)
    open_level = last.get("level") if last and last.get("source") == SOURCE and last["state"] != "cleared" else "normal"
    if open_level not in LEVEL_ORDER:
        open_level = "normal"
    level = st["level"]
    if LEVEL_ORDER.index(level) > LEVEL_ORDER.index(open_level):
        return [_finding(crew_id, veins, "confirmed" if level == "alarm" else "suspected")]
    if level == "normal" and open_level != "normal":
        return [_finding(crew_id, veins, "cleared")]
    return []


def _finding(crew_id: str, veins: dict, state: str) -> dict:
    st, latest = veins["status"], veins["latest"]
    basis = "; ".join(s["text"] for s in st["signs"]) or "normal flow at the last scan"
    return {"type": "finding", "source": SOURCE, "crew_id": crew_id, "measure": MEASURE, "state": state,
            "level": st["level"], "basis": basis, "rule": "jugular_flow_levels",
            "urgent": st["level"] == "alarm",
            "mission_day": latest["day"], "last_reading_at": latest["at"], "episode_day": latest["day"],
            "text": f"Neck veins ({st['level']}): {basis}" if state != "cleared" else "Neck veins: normal flow again",
            "synthetic": True}


def dedupe(f: dict) -> str:
    return f"finding:{f['crew_id']}:{MEASURE}:{f['last_reading_at']}:{f['state']}"
