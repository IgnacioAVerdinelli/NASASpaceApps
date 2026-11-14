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


@dataclass(frozen=True)
class Alert:
    crew_id: str
    measure: str
    severity: str
    message: str
    mission_day: float
    created_at: str
    synthetic: bool

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


def check(reference: Reference, mission: MissionInfo, results: list[MeasureResult],
          confidence: float = CONFIDENCE) -> dict[str, Alert]:
    """The measures that meet the alert rule right now, by measure id."""
    out = {}
    for res in results:
        if res.change_pct is None or res.previous_change_pct is None or not res.reference_n:
            continue
        if not can_alert(reference, mission, res.measure, res.reference_n):
            continue
        beyond = (excess(reference, mission, res.measure, res.change_pct, res.last_mission_day)
                  + excess(reference, mission, res.measure, res.previous_change_pct, res.previous_mission_day)) / 2
        if beyond <= confidence * noise(reference, res.measure, res.reference_n, tests=2):
            continue
        label = reference.measure(res.measure)["label"]
        unloaded = mission.unloaded_days(res.last_mission_day)
        typical = reference.typical_change(res.measure, unloaded, 0.0)
        out[res.measure] = Alert(
            crew_id=res.crew_id, measure=res.measure, severity="warning",
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
