"""What the DataService announces on the team's event queue (publish/subscribe), so other services react to
new data instead of polling for it: the HealthService recomputes when readings or context arrive, the
analysis scheduler reacts to saved results and recorded studies.

The DataService takes any publisher: an object with publish(topic, message), where message is a small
JSON-ready dict. Subscribers then ask the DataService for the data itself. Three topics:

  data.readings_stored   one message per crew member per ingest() call that stored readings
      {"crew_id": "CM-1", "count": 5, "measures": ["resting_hr", "spo2", ...],
       "start": "2027-06-04T12:00:00Z", "end": "2027-06-04T12:00:00Z"}
  data.context_updated   one message per crew member per ingest_context() call that stored records
      {"crew_id": "CM-1", "count": 17, "activities": ["eva", "meal", "sleep", "work"],
       "start": "2027-06-04T00:00:00Z", "end": "2027-06-05T00:00:00Z"}
  data.result_saved      one message per save_result() call
      {"crew_id": "CM-1", "kind": "study", "timestamp": "2027-06-10T12:00:00Z",
       "computed_at": "2026-11-15T10:00:00Z", "model_version": "0.2.0"}

start and end are the earliest and latest time in what was stored (for context, the earliest start and the
latest end). Lists are sorted. A call that stores nothing publishes nothing.

MockPublisher stands in for the queue until the team builds it: it logs each message and keeps it.
"""
from __future__ import annotations

import json
import logging
from collections import defaultdict, deque
from typing import Iterable, Protocol

from .reading import ContextRecord, Reading, Result

log = logging.getLogger(__name__)

READINGS_STORED = "data.readings_stored"
CONTEXT_UPDATED = "data.context_updated"
RESULT_SAVED = "data.result_saved"
TOPICS = (READINGS_STORED, CONTEXT_UPDATED, RESULT_SAVED)


class Publisher(Protocol):
    """What the DataService needs from the event queue."""
    def publish(self, topic: str, message: dict) -> None: ...


class MockPublisher:
    """A stand-in for the event queue: logs every message (logger "gravsim.events", level INFO) and keeps the
    latest `keep` of them in .messages as {"topic": ..., "message": ...}, oldest first."""

    def __init__(self, keep: int = 10_000):
        self.messages: deque[dict] = deque(maxlen=keep)     # bounded, so a long-running server doesn't grow

    def publish(self, topic: str, message: dict) -> None:
        log.info("%s %s", topic, json.dumps(message))       # also fails early on anything JSON can't carry
        self.messages.append({"topic": topic, "message": message})


def readings_stored(readings: Iterable[Reading]) -> list[dict]:
    """One data.readings_stored message per crew member in `readings` (sorted by time, as clean() returns them)."""
    by_crew = defaultdict(list)
    for r in readings:
        by_crew[r.crew_id].append(r)
    return [{"crew_id": crew_id, "count": len(rs), "measures": sorted({r.measure for r in rs}),
             "start": min(r.timestamp for r in rs), "end": max(r.timestamp for r in rs)}
            for crew_id, rs in by_crew.items()]


def context_updated(records: Iterable[ContextRecord]) -> list[dict]:
    """One data.context_updated message per crew member in `records`."""
    by_crew = defaultdict(list)
    for c in records:
        by_crew[c.crew_id].append(c)
    return [{"crew_id": crew_id, "count": len(cs), "activities": sorted({c.activity for c in cs}),
             "start": min(c.start for c in cs), "end": max(c.end for c in cs)}
            for crew_id, cs in by_crew.items()]


def result_saved(result: Result) -> dict:
    """The data.result_saved message for one saved result."""
    return {"crew_id": result.crew_id, "kind": result.kind, "timestamp": result.timestamp,
            "computed_at": result.computed_at, "model_version": result.model_version}
