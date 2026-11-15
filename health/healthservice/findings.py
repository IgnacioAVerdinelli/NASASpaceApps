"""Findings for the Planner: what the HealthService concludes about each measure, with a state.

A finding goes on the event queue (topic `health.finding`, channel `events`). The Planner reads it and books the
next step; people are told through notices instead (notices.py). Shape and states: docs/architecture.md, "Messages
the Planner depends on", and docs/planner.md, section 6.

- `suspected`, basis `one test`: the last test alone goes past what noise explains. The rules are the alert's
  (alerts.check) applied to one test: beyond the typical change without exercise by more than CONFIDENCE times the
  noise of one test, or, for VO2peak, past NASA's in-mission standard. The Planner books a retest; nobody is told.
- `confirmed`, basis `mean of two`: the alert itself (the mean of the last two tests). The Planner books a review.
- `cleared`: a measure that had a suspected or confirmed finding meets neither now. The Planner cancels what it
  booked for it.

A finding is published once per test and state: the same test processed again adds nothing to the queue. The last
finding of each measure is kept in the DataService (results of kind "finding") so `cleared` survives a restart.
"""
from __future__ import annotations

from .alerts import CONFIDENCE, Alert, beyond_standard_one, can_alert, excess, noise
from .levels import level_of
from .models import MissionInfo
from .processing import MeasureResult
from .reference import Reference

TOPIC = "health.finding"
KIND = "finding"
VERSION = "findings-1"
OPEN = ("suspected", "confirmed")


def beyond_noise(reference: Reference, mission: MissionInfo, res: MeasureResult, tests: int) -> float | None:
    """How far past the noise line of the "faster loss than expected" rule the last `tests` tests go, as a
    multiple of that line (CONFIDENCE times the noise): above 1 is more than noise explains. None without data."""
    if res.change_pct is None or not res.reference_n:
        return None
    if tests == 2:
        if res.previous_change_pct is None:
            return None
        beyond = (excess(reference, mission, res.measure, res.change_pct, res.last_mission_day)
                  + excess(reference, mission, res.measure, res.previous_change_pct, res.previous_mission_day)) / 2
    else:
        beyond = excess(reference, mission, res.measure, res.change_pct, res.last_mission_day)
    return round(beyond / (CONFIDENCE * noise(reference, res.measure, res.reference_n, tests=tests)), 2)


def suspect(reference: Reference, mission: MissionInfo, res: MeasureResult) -> str | None:
    """The rule the last test alone meets ("nasa_standard" first, then "beyond_typical"), or None."""
    if res.change_pct is None or not res.reference_n:
        return None
    if beyond_standard_one(reference, res):
        return "nasa_standard"
    if can_alert(reference, mission, res.measure, res.reference_n) and \
            (beyond_noise(reference, mission, res, tests=1) or 0) > 1:
        return "beyond_typical"
    return None


def _finding(reference, mission, res: MeasureResult, state: str, basis: str, rule: str | None) -> dict:
    return {
        "type": "finding", "crew_id": res.crew_id, "measure": res.measure,
        "state": state, "basis": basis, "rule": rule,
        "level": level_of(reference, res.measure, res.change_pct, res.last_value),
        "change_pct": None if res.change_pct is None else round(res.change_pct, 1),
        "typical_no_exercise_pct": None if res.typical_no_exercise_pct is None else round(res.typical_no_exercise_pct, 1),
        "beyond_noise": beyond_noise(reference, mission, res, tests=2 if basis == "mean of two" else 1),
        "mission_day": res.last_mission_day, "last_reading_at": res.last_reading_at,
        "synthetic": res.synthetic,
    }


def evaluate(reference: Reference, mission: MissionInfo, results: list[MeasureResult],
             alerts: dict[str, Alert]) -> dict[str, dict]:
    """The open findings right now, by measure: `confirmed` where an alert is raised, else `suspected` where the
    last test alone goes past the noise."""
    out = {}
    for res in results:
        if res.measure in alerts:
            out[res.measure] = _finding(reference, mission, res, "confirmed", "mean of two", alerts[res.measure].rule)
        elif rule := suspect(reference, mission, res):
            out[res.measure] = _finding(reference, mission, res, "suspected", "one test", rule)
    return out


def changes(reference: Reference, mission: MissionInfo, results: list[MeasureResult], alerts: dict[str, Alert],
            previous: dict[str, dict]) -> list[dict]:
    """The findings to publish after processing one crew member's readings: every open finding (the queue drops
    the ones already published for the same test and state) and a `cleared` one for each measure whose last
    finding was open and is not any more."""
    current = evaluate(reference, mission, results, alerts)
    out = list(current.values())
    for res in results:
        last = previous.get(res.measure)
        if res.measure not in current and last and last["state"] in OPEN and res.change_pct is not None:
            out.append(_finding(reference, mission, res, "cleared", last["basis"], last["rule"]))
    return out


def dedupe(finding: dict) -> str:
    return f"finding:{finding['crew_id']}:{finding['measure']}:{finding['last_reading_at']}:{finding['state']}"


class FindingStore:
    """The last finding published for each measure, kept in the DataService: one result of kind "finding" per crew
    member, dated at the mission start, that every save replaces."""

    def __init__(self, source):
        self.source = source

    def latest(self, crew_id: str) -> dict[str, dict]:
        records = self.source._request("GET", "/api/v1/results", {"crew": crew_id, "kind": KIND})
        return next((dict(r["payload"]["measures"]) for r in records if r["model_version"] == VERSION), {})

    def save(self, crew_id: str, measures: dict[str, dict]) -> None:
        mission = self.source.mission()
        self.source._request("POST", "/api/v1/results", body={
            "crew_id": crew_id, "kind": KIND, "timestamp": mission.timestamp(mission.start),
            "model_version": VERSION, "payload": {"measures": measures}})


def publish(queue, store: FindingStore, crew_id: str, published: list[dict], previous: dict[str, dict]) -> None:
    """Put the findings on the event queue and remember the last one of each measure."""
    for finding in published:
        queue.publish(TOPIC, finding, dedupe=dedupe(finding))
    latest = dict(previous) | {f["measure"]: f for f in published}
    if latest != previous:
        store.save(crew_id, latest)
