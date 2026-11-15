"""Alerts for the queue that the notification system reads.

Rule (docs/health-service.md, question 9; scored against gravsim's truth in evaluation/alert_rule.py):
a measure is flagged when its last two tests from launch on, on average, have gone further in the harmful
direction than the typical change bed-rest subjects had without exercise after the same days without
gravity, and by more than CONFIDENCE times the measurement noise of that average.

Noise, in percentage points: one test against a reference averaged from n pre-flight tests has a standard
deviation of 100 * noise_cv * sqrt(1 + 1/n); the mean of two tests, 100 * noise_cv * sqrt(1/2 + 1/n), since
both share the reference. noise_cv is the test-retest variability fitted from the bed-rest data.

Only measures whose typical loss without exercise over the mission is bigger than the noise of one test can
alert. On the ISS schedule that leaves out ankle dorsiflexion (about -7% against 12% noise) and arm lean mass
(it does not change in bed rest): they are still shown on the page.

A second rule covers NASA's in-mission standard for aerobic capacity: VO2peak is flagged, as "critical", when
its last two tests from launch on, on average, are 20% or more below pre-flight (a loss of performance) or below
32.9 ml/kg/min (the in-mission minimum, NASA-STD-3001 Vol 1 [V1 4001]). It applies whether or not the loss is
typical for bed rest: the standard is about what the crew member can still do. Strength has no such rule: with
8 to 12% noise per dynamometer test, "20% below pre-flight" on the mean of two tests was false for 53 of 57
quadriceps alerts in 200 random gravsim crew members, against 22 of 65 for VO2peak (docs/health-service.md).

The queue is in memory for now; its real form is up to whoever builds the notification system
(docs/health-service.md, question 5).
"""
from __future__ import annotations

import math
import threading
from dataclasses import asdict, dataclass

from .models import MissionInfo
from .processing import MeasureResult
from .reference import Reference

CONFIDENCE = 1.645          # one-sided 95%: noise alone goes this far once in 20 times
STANDARD_LOSS_PCT = 20.0    # a VO2peak this many % below pre-flight is a loss of performance (OCHMO-TB-031)
STANDARD_MEASURES = ("vo2peak",)


@dataclass(frozen=True)
class Alert:
    crew_id: str
    measure: str
    severity: str               # "warning" (faster loss than expected) or "critical" (NASA standard crossed)
    message: str
    mission_day: float
    created_at: str
    synthetic: bool
    rule: str = "beyond_typical"    # or "nasa_standard"

    def to_dict(self) -> dict:
        return asdict(self)


def excess(reference: Reference, mission: MissionInfo, measure: str, change_pct: float, day: float) -> float:
    """Points by which a change goes beyond the typical change without exercise on that day (+ = worse)."""
    typical = reference.typical_change(measure, mission.unloaded_days(day), 0.0) or 0.0
    return reference.worse_by(measure, change_pct) - reference.worse_by(measure, typical)


def noise(reference: Reference, measure: str, n_ref: int, tests: int = 1) -> float:
    """Standard deviation, in points, of the mean change of `tests` tests against an n_ref-test reference."""
    return 100 * reference.measure(measure)["noise_cv"] * math.sqrt(1 / tests + 1 / n_ref)


def can_alert(reference: Reference, mission: MissionInfo, measure: str, n_ref: int) -> bool:
    """Whether the typical loss without exercise over this mission is bigger than the noise of one test."""
    typical = reference.typical_change(measure, mission.unloaded_days(mission.landing), 0.0)
    return typical is not None and reference.worse_by(measure, typical) >= noise(reference, measure, n_ref)


def beyond_standard(reference: Reference, res: MeasureResult) -> str | None:
    """Why the last two tests, on average, cross NASA's in-mission standard for this measure (None if they don't)."""
    if res.measure not in STANDARD_MEASURES or res.change_pct is None or res.previous_change_pct is None:
        return None
    worse = (reference.worse_by(res.measure, res.change_pct) + reference.worse_by(res.measure, res.previous_change_pct)) / 2
    floor = reference.minimum(res.measure)
    unit = reference.measure(res.measure).get("unit", "")
    if floor is not None and res.last_value is not None and res.previous_value is not None:
        mean = (res.last_value + res.previous_value) / 2
        if mean < floor:
            return f"the last two tests average {mean:.1f} {unit}, below NASA's in-mission minimum of {floor:g} {unit}"
    if worse >= STANDARD_LOSS_PCT:
        return (f"the last two tests average {worse:.1f}% below pre-flight, past the {STANDARD_LOSS_PCT:g}% loss NASA "
                "counts as a loss of performance")
    return None


RULES = ("nasa_standard", "beyond_typical")


def check(reference: Reference, mission: MissionInfo, results: list[MeasureResult],
          confidence: float = CONFIDENCE, rules: tuple[str, ...] = RULES) -> dict[str, Alert]:
    """The measures that meet an alert rule right now, by measure id. A measure meeting both rules gets the
    critical one (NASA standard). `rules` picks which rules to apply (the evaluation scores them one by one)."""
    out = {}
    for res in results:
        if res.change_pct is None or res.previous_change_pct is None or not res.reference_n:
            continue
        label = reference.measure(res.measure)["label"]
        reason = beyond_standard(reference, res) if "nasa_standard" in rules else None
        if reason:
            out[res.measure] = Alert(
                crew_id=res.crew_id, measure=res.measure, severity="critical", rule="nasa_standard",
                message=f"{label}: {res.change_pct:+.1f}% since pre-flight; {reason}.",
                mission_day=res.mission_day, created_at=mission.timestamp(res.mission_day), synthetic=res.synthetic)
            continue
        if "beyond_typical" not in rules or not can_alert(reference, mission, res.measure, res.reference_n):
            continue
        beyond = (excess(reference, mission, res.measure, res.change_pct, res.last_mission_day)
                  + excess(reference, mission, res.measure, res.previous_change_pct, res.previous_mission_day)) / 2
        if beyond <= confidence * noise(reference, res.measure, res.reference_n, tests=2):
            continue
        unloaded = mission.unloaded_days(res.last_mission_day)
        typical = reference.typical_change(res.measure, unloaded, 0.0)
        out[res.measure] = Alert(
            crew_id=res.crew_id, measure=res.measure, severity="warning", rule="beyond_typical",
            message=(f"{label}: {res.change_pct:+.1f}% since pre-flight. Over the last two tests it averages "
                     f"{beyond:.1f} points beyond the typical change without exercise in bed-rest studies "
                     f"({typical:+.1f}% after {unloaded:.0f} days without gravity), more than measurement noise "
                     f"explains."),
            mission_day=res.mission_day, created_at=mission.timestamp(res.mission_day),
            synthetic=res.synthetic)
    return out


class AlertQueue:
    """In-memory stand-in for the queue."""

    def __init__(self, max_items: int = 1000):
        self._items: list[Alert] = []
        self._max = max_items
        self._lock = threading.Lock()

    def publish(self, alert: Alert) -> None:
        with self._lock:
            self._items.append(alert)
            del self._items[:-self._max]

    def items(self) -> list[Alert]:
        with self._lock:
            return list(self._items)
