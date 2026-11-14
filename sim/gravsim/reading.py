"""Reading: one value from one instrument. Every part of the system passes these around.

gravsim's instruments create Readings. A real sensor can send a plain dict with the same keys; it needs
crew_id, measure, timestamp, value and unit, and the DataService's pipeline turns it into a Reading.
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
