"""DataService: holds every reading and answers requests for timeline data.

Sensors send readings to ingest(); for the challenge, gravsim stands in for them. Every reading goes
through the pipeline (pipeline.py) on the way in. The HealthService and the API then ask for:

    readings(crew_id, measures, start, end)   every reading of a crew member in a time range
    latest(crew_id, measures, at)             the newest usable reading of each measure

Readings are kept in memory. The SQLite store (store.py) is wired in but inert: it saves nothing and
finds nothing, so for now memory holds the whole data set.
"""
from __future__ import annotations

from typing import Iterable

from .core import expand
from .pipeline import clean, key, order, utc_iso
from .reading import Reading
from .store import SqliteStore


class DataService:
    def __init__(self, store: SqliteStore | None = None):
        self.store = store or SqliteStore()
        self._memory: dict[tuple, Reading] = {}

    def ingest(self, records: Iterable[Reading | dict]) -> list[Reading]:
        """Clean the records, keep them and return them as kept. A reading sent again replaces the old one."""
        readings = clean(records)
        self.store.save(readings)
        for r in readings:
            self._memory[key(r)] = r
        return readings

    def readings(self, crew_id: str, measures: str | Iterable[str] | None = None,
                 start=None, end=None) -> list[Reading]:
        """Every reading of a crew member, oldest first, whatever its quality.

        measures: ids or group names ("bone"), None for all. start, end: times in any form the pipeline
        reads (ISO text, datetime, Unix seconds), both included; None leaves that end open.
        """
        wanted = set(expand(measures))
        start = None if start is None else utc_iso(start)
        end = None if end is None else utc_iso(end)
        found = {key(r): r for r in self.store.query(crew_id, sorted(wanted), start, end)}   # [] for now
        for r in self._memory.values():
            in_range = (start is None or r.timestamp >= start) and (end is None or r.timestamp <= end)
            if r.crew_id == crew_id and r.measure in wanted and in_range:
                found[key(r)] = r          # memory holds the newest copy, so it wins over the store
        return sorted(found.values(), key=order)

    def latest(self, crew_id: str, measures: str | Iterable[str] | None = None, at=None) -> dict[str, Reading]:
        """The newest reading with quality "ok" of each measure, up to `at` (None: no limit)."""
        # readings() is oldest first, so the newest of each measure is written last
        return {r.measure: r for r in self.readings(crew_id, measures, end=at) if r.quality == "ok"}
