"""DataService: holds all the data, raw readings, crew context and processed results, and answers requests for it.

Sensors send readings to ingest() and crew context to ingest_context(); for the challenge, gravsim stands in
for them. Everything goes through the pipeline (pipeline.py) on the way in. The HealthService and the API
then ask for:

    readings(crew_id, measures, start, end)   every reading of a crew member in a time range
    latest(crew_id, measures, at)             the newest usable reading of each measure
    context(crew_id, start, end)              where the crew member was and what they were doing
    current_context(crew_id, at)              where they are and what they are doing at one time

The HealthService saves what it computes with save_result(), and results() reads it back.

Everything is kept in memory. The SQLite store (store.py) is wired in but inert: it saves nothing and
finds nothing, so for now memory holds the whole data set.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Iterable

from .core import MODEL_VERSION, expand
from .pipeline import clean, clean_context, context_key, context_order, key, order, utc_iso
from .reading import ContextRecord, Reading, Result
from .store import SqliteStore

# When context records overlap (a planned work block and a room sensor's toilet visit), observed beats planned:
# the suit, then a room sensor, then the timeline, then any other source; within one source, the newest record.
SOURCE_PRIORITY = {"suit": 3, "room_sensor": 2, "timeline": 1}


class DataService:
    def __init__(self, store: SqliteStore | None = None):
        self.store = store or SqliteStore()
        self._readings: dict[tuple, Reading] = {}
        self._context: dict[tuple, ContextRecord] = {}
        self._results: dict[tuple, Result] = {}

    # ---- raw data
    def ingest(self, records: Iterable[Reading | dict]) -> list[Reading]:
        """Clean the records, keep them and return them as kept. A reading sent again replaces the old one."""
        readings = clean(records)
        self.store.save(readings)
        for r in readings:
            self._readings[key(r)] = r
        return readings

    def readings(self, crew_id: str, measures: str | Iterable[str] | None = None,
                 start=None, end=None) -> list[Reading]:
        """Every reading of a crew member, oldest first, whatever its quality.

        measures: ids or group names ("bone"), None for all. start, end: times in any form the pipeline
        reads (ISO text, datetime, Unix seconds), both included; None leaves that end open.
        """
        wanted = set(expand(measures))
        start, end = _utc_range(start, end)
        found = {key(r): r for r in self.store.query(crew_id, sorted(wanted), start, end)}   # [] for now
        for r in self._readings.values():
            if r.crew_id == crew_id and r.measure in wanted and _between(r.timestamp, start, end):
                found[key(r)] = r          # memory holds the newest copy, so it wins over the store
        return sorted(found.values(), key=order)

    def latest(self, crew_id: str, measures: str | Iterable[str] | None = None, at=None) -> dict[str, Reading]:
        """The newest reading with quality "ok" of each measure, up to `at` (None: no limit)."""
        # readings() is oldest first, so the newest of each measure is written last
        return {r.measure: r for r in self.readings(crew_id, measures, end=at) if r.quality == "ok"}

    # ---- crew context
    def ingest_context(self, records: Iterable[ContextRecord | dict]) -> list[ContextRecord]:
        """Clean context records (pipeline.clean_context), keep them and return them as kept. A record sent
        again by the same source, for the same crew member and start, replaces the old one."""
        records = clean_context(records)
        self.store.save_context(records)
        for c in records:
            self._context[context_key(c)] = c
        return records

    def context(self, crew_id: str, start=None, end=None) -> list[ContextRecord]:
        """A crew member's context records under way at any time from start to end (both included; None
        leaves that end open), oldest first. Times in any form readings() takes."""
        start, end = _utc_range(start, end)
        found = {context_key(c): c for c in self.store.query_context(crew_id, start, end)}   # [] for now
        for c in self._context.values():
            if c.crew_id == crew_id and (start is None or c.end > start) and (end is None or c.start <= end):
                found[context_key(c)] = c
        return sorted(found.values(), key=context_order)

    def current_context(self, crew_id: str, at) -> ContextRecord | None:
        """Where the crew member is and what they are doing at `at`: the record with start <= at < end. If
        several cover it, observed beats planned (SOURCE_PRIORITY: suit, room sensor, timeline), and within
        one source the one that started last wins. None if nothing covers `at`, as before launch."""
        at = utc_iso(at)
        return max(self.context(crew_id, at, at), key=lambda c: (SOURCE_PRIORITY.get(c.source, 0), c.start), default=None)

    # ---- processed data
    def save_result(self, crew_id: str, kind: str, timestamp, payload: dict,
                    model_version: str = MODEL_VERSION) -> Result:
        """Keep something computed for a crew member at a mission time. There is one result per crew
        member, kind, time and model version: computing it again replaces it."""
        result = Result(crew_id=crew_id, kind=kind, timestamp=utc_iso(timestamp),
                        computed_at=utc_iso(datetime.now(timezone.utc)), model_version=model_version,
                        payload=json.loads(json.dumps(payload)))     # a copy, as a database would keep it
        self.store.save_results([result])
        self._results[_result_key(result)] = result
        return result

    def results(self, crew_id: str, kind: str | None = None, start=None, end=None) -> list[Result]:
        """A crew member's processed results, oldest first. kind: one kind, None for all. start, end:
        the mission times the results are for, as in readings()."""
        start, end = _utc_range(start, end)
        found = {_result_key(r): r for r in self.store.query_results(crew_id, kind, start, end)}   # [] for now
        for r in self._results.values():
            if r.crew_id == crew_id and kind in (None, r.kind) and _between(r.timestamp, start, end):
                found[_result_key(r)] = r
        return sorted(found.values(), key=lambda r: (r.timestamp, r.kind, r.model_version))


def _utc_range(start, end) -> tuple[str | None, str | None]:
    return (None if start is None else utc_iso(start)), (None if end is None else utc_iso(end))


def _between(timestamp: str, start: str | None, end: str | None) -> bool:
    """Both ends included, None leaves that end open. Text comparison works because times are UTC ISO."""
    return (start is None or timestamp >= start) and (end is None or timestamp <= end)


def _result_key(r: Result) -> tuple:
    """What makes two results the same result (the primary key of the `processed` table)."""
    return r.crew_id, r.kind, r.timestamp, r.model_version
