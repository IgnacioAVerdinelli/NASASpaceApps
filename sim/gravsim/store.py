"""The database behind the DataService: where real sensor data and imported historical data would live.

For the challenge it is inert on purpose. The schema exists and is created, but save() writes nothing
and query() finds nothing; the demo's readings come from gravsim and stay in the DataService's memory.
To make it real, insert in save() and select in query(); the table is ready.
"""
from __future__ import annotations

import sqlite3
from typing import Iterable

from .reading import Reading

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    crew_id     TEXT NOT NULL,
    measure     TEXT NOT NULL,              -- a measure id from params.json
    timestamp   TEXT NOT NULL,              -- UTC, 'YYYY-MM-DDTHH:MM:SSZ', so text order is time order
    instrument  TEXT NOT NULL,
    side        TEXT NOT NULL DEFAULT '',   -- '' rather than NULL: NULLs never count as duplicates in a key
    value       REAL,                       -- in the measure's canonical unit; NULL when missing
    unit        TEXT,
    quality     TEXT NOT NULL,              -- ok | missing | out_of_range | bad_unit
    synthetic   INTEGER NOT NULL,           -- 1 for gravsim output, 0 for real sensors and imports
    extra       TEXT,                       -- JSON with the other Reading fields (mission day, device, ...)
    PRIMARY KEY (crew_id, measure, timestamp, instrument, side)
);
"""


class SqliteStore:
    def __init__(self, path: str = ":memory:"):
        # check_same_thread=False: serve.py answers each request in its own thread
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.executescript(SCHEMA)

    def save(self, readings: Iterable[Reading]) -> None:
        """Does nothing yet. A real store would INSERT OR REPLACE each reading into `readings`."""

    def query(self, crew_id: str, measures: list[str] | None = None, start: str | None = None,
              end: str | None = None) -> list[Reading]:
        """Finds nothing yet: always []. Same arguments as DataService.readings()."""
        return []
