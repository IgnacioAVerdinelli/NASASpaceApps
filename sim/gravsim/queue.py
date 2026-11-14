"""Small SQLite-backed pub/sub transport for the local demonstration."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager


class Queue:
    def __init__(self, path: str):
        self.path = path
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL,
                    topic TEXT NOT NULL, body TEXT NOT NULL, dedupe TEXT UNIQUE);
                CREATE TABLE IF NOT EXISTS cursors (consumer TEXT PRIMARY KEY, message_id INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS deliveries (
                    message_id INTEGER NOT NULL, recipient TEXT NOT NULL, body TEXT NOT NULL,
                    PRIMARY KEY(message_id, recipient));
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        try:
            db.execute('PRAGMA busy_timeout=30000')
            with db:
                yield db
        finally:
            db.close()

    def publish(self, topic, message, *, channel='events', dedupe=None):
        with self.connect() as db:
            db.execute('INSERT OR IGNORE INTO messages(channel,topic,body,dedupe) VALUES(?,?,?,?)',
                       (channel, topic, json.dumps(message), dedupe))

    def next(self, consumer, channel):
        with self.connect() as db:
            row = db.execute('SELECT id,topic,body FROM messages WHERE channel=? AND id>COALESCE((SELECT message_id FROM cursors WHERE consumer=?),0) ORDER BY id LIMIT 1', (channel, consumer)).fetchone()
        return None if row is None else (row[0], row[1], json.loads(row[2]))

    def ack(self, consumer, message_id):
        with self.connect() as db:
            db.execute('INSERT INTO cursors VALUES (?,?) ON CONFLICT(consumer) DO UPDATE SET message_id=MAX(message_id,excluded.message_id)', (consumer, message_id))

    def deliver(self, message_id, recipient, body):
        with self.connect() as db:
            db.execute('INSERT OR IGNORE INTO deliveries VALUES (?,?,?)', (message_id, recipient, json.dumps(body)))

    def deliveries(self):
        with self.connect() as db:
            return [{'message_id': r[0], 'recipient': r[1], 'message': json.loads(r[2])}
                    for r in db.execute('SELECT message_id,recipient,body FROM deliveries ORDER BY message_id,recipient')]
