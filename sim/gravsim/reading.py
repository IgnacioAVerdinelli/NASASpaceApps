"""The three records the DataService holds: Reading (raw data), ContextRecord (crew context) and Result
(processed data).

gravsim's instruments create Readings. A real sensor can send a plain dict with the same keys; it needs
crew_id, measure, timestamp, value and unit, and the DataService's pipeline turns it into a Reading.
Context records say where a crew member is and what they are doing; gravsim's routine (routine.py) makes
them, and real sources (the crew timeline, room sensors, the spacesuit) can send dicts with the same keys.
The HealthService saves what it computes as Results.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Iterable

from .core import MEASURES


@dataclass(kw_only=True)
class Reading:
    crew_id: str
    mission_day: float | None = None      # gravsim fills the mission fields; a real sensor may not
    day_label: str | None = None
    timestamp: str                        # UTC, "2027-03-01T12:00:00Z"
    phase: str | None = None
    gravity_g: float | None = None
    instrument: str = "unknown"
    device: str | None = None
    measure: str                          # a key of MEASURES, e.g. "knee_extension_60"
    label: str | None = None              # label, region and muscle_keys are filled from MEASURES
    value: float | None                   # None when the instrument produced nothing
    unit: str
    region: str | None = None
    muscle_keys: list[str] = field(default_factory=list)
    side: str | None = None               # "left" or "right" for paired scan sites
    quality: str = "ok"                   # ok | missing | out_of_range | bad_unit (set by the pipeline)
    synthetic: bool = False               # True for everything gravsim makes
    extrapolated: bool = False            # True past what the bed-rest data covers
    model_version: str | None = None
    status: dict = field(default_factory=dict)     # gravsim: the crew member's adherence and events that day
    truth: dict = field(default_factory=dict)      # gravsim: noise-free value and active faults, to score a monitor

    def __post_init__(self):
        m = MEASURES.get(self.measure)
        if m and self.label is None:
            self.label, self.region, self.muscle_keys = m["label"], m.get("region"), list(m.get("muscle_keys") or [])

    def to_dict(self) -> dict:
        return asdict(self)


ACTIVITIES = ("sleep", "exercise", "work", "meal", "hygiene", "eva")     # "eva": a spacewalk, outside
SOURCES = ("timeline", "room_sensor", "suit")    # crew timeline (the plan), module presence sensors, spacesuit


@dataclass(kw_only=True)
class ContextRecord:
    """Where a crew member is and what they are doing, from `start` until `end`."""
    crew_id: str
    start: str                    # UTC, "2027-03-01T06:00:00Z"; the record starts here
    end: str                      # UTC; the record stops just before this, where the next one starts
    activity: str                 # one of ACTIVITIES
    location: str | None = None   # an ISS module ("Destiny", "Tranquility", ...), "outside" on a spacewalk, None if unknown
    source: str = "unknown"       # who reported it: one of SOURCES for gravsim; any text from a real sensor
    synthetic: bool = False       # True for everything gravsim makes

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(kw_only=True)
class Result:
    """Something the HealthService computed for a crew member at a mission time."""
    crew_id: str
    kind: str                 # what was computed: "dashboard", "measure_change", ...
    timestamp: str            # the mission time the result is for, UTC like Reading.timestamp
    computed_at: str          # when it was computed, UTC
    model_version: str
    payload: dict             # the result itself; anything JSON can hold

    def to_dict(self) -> dict:
        return asdict(self)


def to_dataframe(readings: Iterable[Reading]):
    """A pandas DataFrame, one row per reading, with `truth` and `status` flattened into columns. Needs pandas."""
    import pandas as pd
    rows = []
    for r in readings:
        d = r.to_dict()
        truth, status = d.pop("truth"), d.pop("status")
        d["muscle_keys"] = ",".join(d["muscle_keys"])
        d.update({"true_value": truth.get("value"), "true_change_pct": truth.get("change_pct"),
                  "faults": ";".join(truth.get("faults", [])), "adherence": status.get("adherence"),
                  "responder": status.get("responder"), "events": ";".join(status.get("events", []))})
        rows.append(d)
    return pd.DataFrame(rows)
