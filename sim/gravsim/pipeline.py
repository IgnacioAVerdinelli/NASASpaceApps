"""The ingestion pipeline. Every reading passes through clean() on its way into the DataService,
whether gravsim made it or a real sensor sent it.

A record is a Reading or a plain dict with the same keys. It needs crew_id, measure, timestamp, value
and unit; the other Reading fields are optional and kept, unknown keys are ignored. The rules:

1. Records without a crew member, a known measure or a readable time are dropped, with a logged warning.
2. Times become UTC ISO text, "2027-03-01T12:00:00Z". Any offset is accepted; no offset means UTC.
3. A missing or unreadable value becomes None, with quality "missing".
4. Values are converted to their measure's canonical unit (units.py). An unknown unit, or one of
   the wrong kind, keeps the value and unit as sent, with quality "bad_unit".
5. Values outside LIMITS get quality "out_of_range" and are kept unrounded, as evidence of what went
   wrong. The rest are rounded to their measure's decimals.
6. Of several readings with the same crew member, measure, time, instrument and side, the last one
   wins. The result is sorted by time.

Flagged readings are kept, so nothing a sensor sent is lost; the HealthService only uses quality "ok".

Crew context goes through clean_context(), with the same rules where they apply: records without a crew
member, a known activity or a readable start and end, or that end before they start, are dropped; times
become UTC ISO text; of several records with the same crew member, source and start, the last one wins.
"""
from __future__ import annotations

import logging
import math
from dataclasses import fields
from datetime import datetime, timezone
from typing import Iterable

from .core import GROUPS, MEASURES, TIME_FORMAT
from .reading import ACTIVITIES, ContextRecord, Reading
from .units import convert

log = logging.getLogger(__name__)
FIELDS = {f.name for f in fields(Reading)}
CONTEXT_FIELDS = {f.name for f in fields(ContextRecord)}

# Values no living crew member produces at rest, in canonical units: the hard physiological and device limits.
# Wide on purpose: they catch sensor and unit errors (a resting heart rate of 1.2 is beats per second sent
# as bpm), not unusual but real values. gravsim clamps every reading to these same limits, faults included,
# so the generator and the DataService share one table.
LIMITS = {
    **{m: (1, 1000) for m in GROUPS["strength"]},                           # peak torque, ft-lb
    **{m: (0.1, 2.5) for m in GROUPS["bone"]},                              # g/cm²
    **{m: (300, 80_000) for m in ("lean_legs", "lean_arms", "lean_trunk")},   # g of lean mass in one region
    "vo2peak": (5, 100),         # ml/kg/min; the highest ever recorded is just under 100
    "resting_hr": (30, 220),     # bpm; awake and under 30 needs a medical review (OCHMO-STD-100.1A Rev A, App. A)
    "resting_sbp": (60, 250),    # mmHg
    "resting_dbp": (30, 150),    # mmHg
    "spo2": (70, 100),           # %; a saturation can't pass 100, and pulse oximeters are not accurate under 70
    "hrv_rmssd": (1, 300),       # ms
    "heart_rate": (30, 220),     # bpm, the spacesuit's heart rate during a spacewalk
}


def clean(records: Iterable[Reading | dict]) -> list[Reading]:
    """Run records through the rules above and return clean Readings, sorted by time."""
    kept: dict[tuple, Reading] = {}
    dropped = 0
    for record in records:
        data = vars(record) if isinstance(record, Reading) else record
        try:
            timestamp = utc_iso(data.get("timestamp"))
        except (TypeError, ValueError, OverflowError, OSError):
            timestamp = None
        if not data.get("crew_id") or data.get("measure") not in MEASURES or timestamp is None:
            dropped += 1
            continue
        value, unit, quality = check_value(data["measure"], data.get("value"), data.get("unit"))
        known = {k: v for k, v in data.items() if k in FIELDS}
        r = Reading(**{**known, "timestamp": timestamp, "value": value, "unit": unit, "quality": quality})
        kept[key(r)] = r
    if dropped:
        log.warning("dropped %d records without a crew member, a known measure or a readable time", dropped)
    return sorted(kept.values(), key=order)


def clean_context(records: Iterable[ContextRecord | dict]) -> list[ContextRecord]:
    """Run context records through the context rules (module docstring) and return them sorted by start."""
    kept: dict[tuple, ContextRecord] = {}
    dropped = 0
    for record in records:
        data = vars(record) if isinstance(record, ContextRecord) else record
        try:
            start, end = utc_iso(data.get("start")), utc_iso(data.get("end"))
        except (TypeError, ValueError, OverflowError, OSError):
            start = end = None
        if not data.get("crew_id") or data.get("activity") not in ACTIVITIES or start is None or end <= start:
            dropped += 1
            continue
        known = {k: v for k, v in data.items() if k in CONTEXT_FIELDS}
        c = ContextRecord(**{**known, "start": start, "end": end})
        kept[context_key(c)] = c
    if dropped:
        log.warning("dropped %d context records without a crew member, a known activity or a readable start "
                    "before the end", dropped)
    return sorted(kept.values(), key=context_order)


def check_value(measure: str, value, unit: str | None) -> tuple[float | None, str | None, str]:
    """Rules 3 to 5 for one value: (value in the canonical unit, its unit, quality)."""
    m = MEASURES[measure]
    try:
        value = float(value)
    except (TypeError, ValueError):
        value = math.nan
    if not math.isfinite(value):
        return None, m["unit"], "missing"
    try:
        value = convert(value, unit, m["unit"])
    except ValueError:
        return value, unit, "bad_unit"
    lo, hi = LIMITS.get(measure, (-math.inf, math.inf))
    if not lo <= value <= hi:
        return value, m["unit"], "out_of_range"
    return round(value, m["decimals"]), m["unit"], "ok"


def utc_iso(t) -> str:
    """A time as UTC ISO text, "2027-03-01T12:00:00Z". Takes ISO text, a datetime or Unix seconds."""
    if isinstance(t, (int, float)):
        t = datetime.fromtimestamp(t, timezone.utc)
    elif isinstance(t, str):
        t = datetime.fromisoformat(t.strip().replace("Z", "+00:00"))     # Python 3.10 can't read "Z"
    elif not isinstance(t, datetime):
        raise TypeError(f"can't read a time from {t!r}")
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return t.astimezone(timezone.utc).strftime(TIME_FORMAT)


def key(r: Reading) -> tuple:
    """What makes two readings the same reading (rule 6)."""
    return r.crew_id, r.measure, r.timestamp, r.instrument, r.side


def order(r: Reading) -> tuple:
    return r.timestamp, r.crew_id, r.instrument, r.measure, r.side or ""


def context_key(c: ContextRecord) -> tuple:
    """What makes two context records the same record: a source reports one record per crew member and start."""
    return c.crew_id, c.source, c.start


def context_order(c: ContextRecord) -> tuple:
    return c.start, c.crew_id, c.source
