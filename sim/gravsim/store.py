"""The database behind the DataService: where real sensor data, imported historical data and the
HealthService's processed results would live, in two tables, `readings` and `processed`.

For the challenge it is inert on purpose. The schema exists and is created, but the save methods write
nothing and the query methods find nothing; the demo's data stays in the DataService's memory.
To make it real, insert in the save methods and select in the query methods; the tables are ready.
"""
from __future__ import annotations

import sqlite3
from typing import Iterable

from .reading import Reading, Result

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

CREATE TABLE IF NOT EXISTS processed (
    crew_id        TEXT NOT NULL,
    kind           TEXT NOT NULL,           -- what was computed: 'dashboard', 'measure_change', ...
    timestamp      TEXT NOT NULL,           -- the mission time the result is for, UTC like readings.timestamp
    computed_at    TEXT NOT NULL,           -- when the HealthService computed it, UTC
    model_version  TEXT NOT NULL,
    payload        TEXT NOT NULL,           -- the result as JSON
    -- computing a result again replaces it; a new model version adds a row, so versions can be compared
    PRIMARY KEY (crew_id, kind, timestamp, model_version)
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

    def save_results(self, results: Iterable[Result]) -> None:
        """Does nothing yet. A real store would INSERT OR REPLACE each result into `processed`."""

    def query_results(self, crew_id: str, kind: str | None = None, start: str | None = None,
                      end: str | None = None) -> list[Result]:
        """Finds nothing yet: always []. Same arguments as DataService.results()."""
        return []
