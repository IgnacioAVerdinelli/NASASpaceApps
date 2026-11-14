"""The database behind the DataService: where real sensor data, imported historical data, crew context and
the HealthService's processed results would live, in three tables, `readings`, `context` and `processed`.

Records are stored in SQLite and survive restarts when a file path is supplied.
"""
from __future__ import annotations

import sqlite3
import json
import threading
from typing import Iterable

from .reading import ContextRecord, Reading, Result

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    crew_id     TEXT NOT NULL,
    measure     TEXT NOT NULL,              -- a measure id from params.json
    timestamp   TEXT NOT NULL,              -- UTC, 'YYYY-MM-DDTHH:MM:SSZ', so text order is time order
    instrument  TEXT NOT NULL,
    side        TEXT NOT NULL DEFAULT '',   -- '' rather than NULL: NULLs never count as duplicates in a key
    value       REAL,                       -- in the measure's stored unit (STORED_UNITS); NULL when missing
    unit        TEXT,
    quality     TEXT NOT NULL,              -- ok | missing | out_of_range | bad_unit
    synthetic   INTEGER NOT NULL,           -- 1 for gravsim output, 0 for real sensors and imports
    extra       TEXT,                       -- JSON with the other Reading fields (mission day, device, ...)
    PRIMARY KEY (crew_id, measure, timestamp, instrument, side)
);

CREATE TABLE IF NOT EXISTS context (
    crew_id    TEXT NOT NULL,
    start      TEXT NOT NULL,               -- UTC like readings.timestamp; the record starts here
    "end"      TEXT NOT NULL,               -- UTC, where the next record starts; quoted: END is an SQL keyword
    activity   TEXT NOT NULL,               -- sleep | exercise | work | meal | hygiene | eva
    location   TEXT,                        -- an ISS module, 'outside' on a spacewalk; NULL if unknown
    source     TEXT NOT NULL,               -- timeline | room_sensor | suit (any text from a real source)
    synthetic  INTEGER NOT NULL,            -- 1 for gravsim output
    PRIMARY KEY (crew_id, source, start)    -- a source sending a record again replaces it
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
        self.lock = threading.RLock()
        self.db.executescript(SCHEMA)

    def close(self) -> None:
        with self.lock:
            self.db.close()

    def save(self, readings: Iterable[Reading]) -> None:
        with self.lock, self.db:
            self.db.executemany("INSERT OR REPLACE INTO readings VALUES (?,?,?,?,?,?,?,?,?,?)", [
                (r.crew_id, r.measure, r.timestamp, r.instrument, r.side or '', r.value, r.unit,
                 r.quality, int(r.synthetic), json.dumps(r.to_dict())) for r in readings])

    def query(self, crew_id: str, measures: list[str] | None = None, start: str | None = None,
              end: str | None = None) -> list[Reading]:
        with self.lock:
            rows = self.db.execute("SELECT extra FROM readings WHERE crew_id=? AND (? IS NULL OR timestamp>=?) AND (? IS NULL OR timestamp<=?) ORDER BY timestamp", (crew_id, start, start, end, end)).fetchall()
        return [r for r in (Reading(**json.loads(row[0])) for row in rows) if measures is None or r.measure in measures]

    def save_context(self, records: Iterable[ContextRecord]) -> None:
        with self.lock, self.db:
            self.db.executemany('INSERT OR REPLACE INTO context VALUES (?,?,?,?,?,?,?)', [
                (c.crew_id, c.start, c.end, c.activity, c.location, c.source, int(c.synthetic)) for c in records])

    def query_context(self, crew_id: str, start: str | None = None, end: str | None = None) -> list[ContextRecord]:
        with self.lock:
            rows = self.db.execute('SELECT crew_id,start,"end",activity,location,source,synthetic FROM context WHERE crew_id=? AND (? IS NULL OR "end">?) AND (? IS NULL OR start<=?) ORDER BY start', (crew_id, start, start, end, end)).fetchall()
        return [ContextRecord(crew_id=r[0], start=r[1], end=r[2], activity=r[3], location=r[4], source=r[5], synthetic=bool(r[6])) for r in rows]

    def save_results(self, results: Iterable[Result]) -> None:
        with self.lock, self.db:
            self.db.executemany('INSERT OR REPLACE INTO processed VALUES (?,?,?,?,?,?)', [
                (r.crew_id, r.kind, r.timestamp, r.computed_at, r.model_version, json.dumps(r.payload)) for r in results])

    def query_results(self, crew_id: str, kind: str | None = None, start: str | None = None,
                      end: str | None = None) -> list[Result]:
        with self.lock:
            rows = self.db.execute('SELECT crew_id,kind,timestamp,computed_at,model_version,payload FROM processed WHERE crew_id=? AND (? IS NULL OR kind=?) AND (? IS NULL OR timestamp>=?) AND (? IS NULL OR timestamp<=?) ORDER BY timestamp', (crew_id, kind, kind, start, start, end, end)).fetchall()
        return [Result(crew_id=r[0], kind=r[1], timestamp=r[2], computed_at=r[3], model_version=r[4], payload=json.loads(r[5])) for r in rows]
