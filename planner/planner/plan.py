"""The plan engine: plan items from the catalog, their statuses, and what findings book. No I/O here.

A plan item is one thing one crew member has to do in one window (docs/planner.md, section 5). Items are plain
dicts, as they are stored in the DataService and served by the API.
"""
from __future__ import annotations

import copy
import math

from .catalog import Catalog, Eva, Occurrence, fmt
from .mission import Mission

STATUSES = ("booked", "done", "missed", "cancelled")
RETEST_DAYS = 7          # a retest is booked in the 7 days that start tomorrow (our assumption, as in the architecture)
REVIEW_DAYS = 7          # a review by the flight surgeon is due within 7 days (ours)
RETEST_COOLDOWN = 14     # a retest done in the last 14 days turns a new suspected finding into a review (ours)
NOTIFY_MISSED = ("study", "retest", "review")    # missed routines and treatments do not page the ship center
# Plain names for the measures a finding can name, so titles never show a raw id.
MEASURE_NAMES = {
    "knee_extension_60": "knee extension strength", "knee_flexion_60": "knee flexion strength",
    "ankle_plantarflexion_30": "ankle plantarflexion strength", "ankle_dorsiflexion_30": "ankle dorsiflexion strength",
    "trunk_extension_60": "trunk extension strength", "trunk_flexion_60": "trunk flexion strength",
    "vo2peak": "aerobic capacity (VO2peak)", "hip_bmd": "hip bone density", "spine_bmd": "spine bone density",
    "heel_bmd": "heel bone density", "lean_legs": "leg lean mass", "lean_arms": "arm lean mass",
    "lean_trunk": "trunk lean mass", "resting_hr": "resting heart rate", "resting_sbp": "systolic blood pressure",
    "resting_dbp": "diastolic blood pressure", "spo2": "blood oxygen", "hrv_rmssd": "heart rate variability",
    "sleep_hours": "sleep", "sleep_quality": "sleep quality", "watch_hr": "heart rate",
    "eyes": "eyes (SANS)",
}


def measure_name(measure: str) -> str:
    return MEASURE_NAMES.get(measure, measure.replace("_", " "))


def _window(mission: Mission, day_from: float, day_to: float, label: str, day: float | None = None) -> dict:
    """day: the date the standard names (L+30 -> 30), inside [day_from, day_to]; the window start by default."""
    return {"from": mission.timestamp(day_from), "to": mission.timestamp(day_to),
            "day_from": round(day_from, 3), "day_to": round(day_to, 3),
            "day": round(day_from if day is None else min(max(day, day_from), day_to), 3), "label": label}


def _item(*, item_id: str, crew_id: str, item_type: str, routine: dict | None, title: str, mission: Mission,
          day_from: float, day_to: float, label: str, reason: str, completion: str, measure: str | None = None,
          finding: dict | None = None, eva: Eva | None = None, eva_part: str | None = None,
          synthetic: bool = True, nominal: float | None = None) -> dict:
    return {
        "id": item_id, "crew_id": crew_id, "type": item_type,
        "routine_id": routine["id"] if routine else None, "ref": routine["ref"] if routine else None,
        "title": title, "category": routine["category"] if routine else "review",
        "measure": measure, "measures": list(routine.get("measures", [])) if routine else [],
        "instrument": routine.get("instrument") if routine and item_type != "review" else None,
        "window": _window(mission, day_from, day_to, label, nominal),
        "reason": reason, "status": "booked", "completion": completion,
        "done_at": None, "done_by": None, "note": None,
        "finding": finding,
        "eva": None if eva is None else {"day": round(eva.start, 3), "start": mission.timestamp(eva.start),
                                         "end": mission.timestamp(eva.end), "part": eva_part},
        "synthetic": synthetic,
    }


def item_id(routine_id: str, o: Occurrence) -> str:
    if o.eva is not None:
        return f"{routine_id}:eva:{fmt(round(o.eva.start, 3))}:{o.eva_part}"
    return f"{routine_id}:{fmt(round(o.nominal, 3))}"


def routine_items(catalog: Catalog, mission: Mission, crew_id: str, evas: list[Eva] = (),
                  synthetic: bool = True) -> list[dict]:
    """Every routine occurrence for one crew member on this mission, as booked plan items."""
    out: dict[str, dict] = {}
    for routine in catalog.routines.values():
        for o in catalog.occurrences(routine, mission, evas):
            iid = item_id(routine["id"], o)
            if iid in out:
                continue
            out[iid] = _item(item_id=iid, crew_id=crew_id, item_type=routine["item_type"], routine=routine,
                             title=routine["title"], mission=mission, day_from=o.day_from, day_to=o.day_to,
                             label=o.label, reason="routine", completion=routine["completion"],
                             eva=o.eva, eva_part=o.eva_part, synthetic=synthetic, nominal=o.nominal)
    return sort_items(out.values())


def sort_items(items) -> list[dict]:
    return sorted(items, key=lambda i: (i["window"]["day_from"], i["window"]["day_to"], i["id"]))


def merge(stored: list[dict], fresh: list[dict]) -> list[dict]:
    """The stored plan with today's routine: stored items keep their status; new routine items are added; a
    routine item still booked that the routine no longer has (a spacewalk was moved, say) is cancelled."""
    by_id = {i["id"]: i for i in stored}
    fresh_ids = {i["id"] for i in fresh}
    out = []
    for f in fresh:
        s = by_id.get(f["id"])
        if s is None:
            out.append(f)
        elif s["status"] == "booked":           # the routine may have moved the window (a spacewalk changed)
            out.append(s | {k: f[k] for k in ("window", "eva", "title", "ref", "measures", "instrument")})
        else:
            out.append(s)
    for s in stored:
        if s["id"] in fresh_ids:
            continue
        if s["reason"] == "routine" and s["status"] == "booked":
            s = s | {"status": "cancelled", "note": "no longer in the routine"}
        out.append(s)
    return sort_items(out)


def update(items: list[dict], mission: Mission, today: float, readings: dict[str, list[tuple[float, str]]],
           simulate_crew: bool = False) -> list[tuple[str, dict]]:
    """Close what the clock and the readings close, in place. Returns the transitions as (status, item).

    readings: instrument -> [(mission_day, timestamp)] of usable readings up to `today`.
    An `auto` item is done when one of its instrument's readings falls in its window. With simulate_crew, a
    `crew` item is done in the middle of its window (the demo stands in for the crew). A booked item whose window
    has ended is missed.
    """
    changes = []
    for item in items:
        if item["status"] != "booked":
            continue
        w = item["window"]
        if item["completion"] == "auto" and item["instrument"]:
            hit = next(((d, t) for d, t in readings.get(item["instrument"], [])
                        if w["day_from"] <= d <= w["day_to"] and d <= today), None)
            if hit:
                item.update(status="done", done_at=hit[1], done_by="instrument")
                changes.append(("done", item))
                continue
        if simulate_crew and item["completion"] == "crew":
            mid = (w["day_from"] + w["day_to"]) / 2
            if today >= mid:
                item.update(status="done", done_at=mission.timestamp(mid), done_by=item["crew_id"],
                            completion="simulated")
                changes.append(("done", item))
                continue
        if today > w["day_to"]:
            item.update(status="missed")
            changes.append(("missed", item))
    return changes


def set_status(items: list[dict], iid: str, status: str, by: str | None, note: str | None,
               mission: Mission, today: float) -> dict:
    """A status set through the API. Raises KeyError for an unknown id and ValueError for a done item or a
    status that is not done, missed or cancelled."""
    if status not in ("done", "missed", "cancelled"):
        raise ValueError(f"status must be done, missed or cancelled, not {status!r}")
    item = next((i for i in items if i["id"] == iid), None)
    if item is None:
        raise KeyError(iid)
    if item["status"] == "done":
        raise ValueError(f"{iid} is already done")
    item.update(status=status, note=note, done_by=by)
    if status == "done":
        item.update(done_at=mission.timestamp(today), completion="crew" if item["completion"] != "auto" else "auto")
    return item


def _first_free_day(day: float, evas: list[Eva]) -> float:
    d = math.floor(day) + 1.0
    while any(math.floor(ev.start) <= d < math.floor(ev.start) + 1 or ev.start <= d <= ev.end for ev in evas):
        d += 1.0
    return d


def _finding_summary(f: dict) -> dict:
    keep = ("measure", "state", "basis", "level", "change_pct", "typical_no_exercise_pct", "beyond_noise",
            "mission_day", "source", "text")
    return {k: f[k] for k in keep if k in f}


def apply_finding(items: list[dict], finding: dict, catalog: Catalog, mission: Mission, today: float,
                  evas: list[Eva] = ()) -> list[tuple[str, dict]]:
    """What a HealthService finding books (docs/planner.md, "Finding rules"), in place. Returns the transitions
    as (status, item): ("booked", new item) or ("cancelled", item)."""
    crew_id, measure = finding["crew_id"], finding["measure"]
    state = finding.get("state") or "suspected"     # findings from before health/healthservice/findings.py carry none
    day = float(finding.get("mission_day", today))
    synthetic = bool(finding.get("synthetic", True))
    ids = {i["id"] for i in items}

    def open_(kind):
        return [i for i in items if i["type"] == kind and i.get("measure") == measure and i["status"] == "booked"]

    if state == "cleared":
        changes = []
        for i in open_("retest") + open_("review"):
            i.update(status="cancelled", note="finding cleared")
            changes.append(("cancelled", i))
        return changes

    routine = catalog.routine_for_measure(measure)

    def review(why: str):
        if open_("review"):
            return []
        iid = f"review:{measure}:{fmt(round(day, 2))}"
        if iid in ids:
            return []
        start = max(today, day)
        item = _item(item_id=iid, crew_id=crew_id, item_type="review", routine=routine,
                     title=f"Review by the flight surgeon: {measure_name(measure)}", mission=mission, day_from=start,
                     day_to=start + REVIEW_DAYS, label=mission.label(start), reason="finding", completion="crew",
                     measure=measure, finding=_finding_summary(finding) | {"why": why}, synthetic=synthetic)
        items.append(item)
        return [("booked", item)]

    if state == "confirmed":
        return review("confirmed finding")
    if finding.get("source") == "watch":     # docs/wearable.md: no test repeats a watch reading; a person looks at it
        return review(finding.get("text") or f"the watch: {finding.get('basis', 'beyond the personal band')}")
    if finding.get("source") == "ocular":    # docs/investigacion-ojos.md: a SANS sign goes to the flight surgeon
        return review(finding.get("text") or f"the eye exam: {finding.get('basis', 'a sign of SANS')}")
    if open_("retest"):
        return []
    recent = [i for i in items if i["type"] == "retest" and i.get("measure") == measure and i["status"] == "done"
              and i["done_at"] and mission.day_of(i["done_at"]) >= today - RETEST_COOLDOWN]
    if recent:
        return review(f"still suspected after a retest in the last {RETEST_COOLDOWN} days")
    if routine is None:
        return review("no instrument in the routine retests this measure")
    start = _first_free_day(today, evas)
    end = start + RETEST_DAYS
    if today < mission.landing:
        end = min(end, mission.landing - 1e-3)
    if end <= start:
        return review("no time left before landing for a retest")
    iid = f"retest:{measure}:{fmt(round(day, 2))}"
    if iid in ids:
        return []
    item = _item(item_id=iid, crew_id=crew_id, item_type="retest", routine=routine,
                 title=f"Retest: {routine['title']}", mission=mission, day_from=start, day_to=end,
                 label=mission.label(start), reason="finding", completion="auto", measure=measure,
                 finding=_finding_summary(finding), synthetic=synthetic)
    items.append(item)
    return [("booked", item)]


def view(items: list[dict], today: float, *, from_day=None, to_day=None, status=None, item_type=None,
         routine=None) -> list[dict]:
    """Items as the API serves them: filtered, with `open` and `overdue` worked out for `today`."""
    out = []
    for i in items:
        w = i["window"]
        if from_day is not None and w["day_to"] < from_day:
            continue
        if to_day is not None and w["day_from"] > to_day:
            continue
        if status and i["status"] not in status.split(","):
            continue
        if item_type and i["type"] not in item_type.split(","):
            continue
        if routine and i["routine_id"] not in routine.split(","):
            continue
        booked = i["status"] == "booked"
        out.append(i | {"open": booked and w["day_from"] <= today <= w["day_to"],
                        "overdue": booked and today > w["day_to"]})
    return out


def snapshot(items: list[dict]) -> list[dict]:
    return copy.deepcopy(items)
