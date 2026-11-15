"""Durable queue, delivery outbox and simulated output adapters. Python standard library only."""
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

CHANNELS = {"wearable", "room", "ship_center", "radio", "earth"}
PRIORITIES = {"info", "warning", "critical"}


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def validate(message):
    if not isinstance(message, dict):
        raise ValueError("message must be an object")
    for field in ("notification_id", "source", "source_event_id", "mission_id", "crew_id", "kind", "title", "message", "created_at"):
        if not isinstance(message.get(field), str) or not message[field].strip() or len(message[field]) > 2000:
            raise ValueError(f"invalid {field}")
    if message.get("schema_version") != 1 or type(message.get("revision")) is not int or message["revision"] < 1:
        raise ValueError("schema_version=1 and positive integer revision required")
    try:
        created = datetime.fromisoformat(message["created_at"].replace("Z", "+00:00"))
        if created.tzinfo is None:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError("created_at must be ISO timestamp with timezone") from None
    if not isinstance(message.get("priority"), str) or message["priority"] not in PRIORITIES:
        raise ValueError("priority must be info, warning or critical")
    if message.get("synthetic") is not True:
        raise ValueError("this demo accepts synthetic=true only")
    if type(message.get("requires_ack", False)) is not bool:
        raise ValueError("requires_ack must be boolean")
    if not isinstance(message.get("state", "active"), str) or message.get("state", "active") not in {"active", "resolved", "cancelled"}:
        raise ValueError("invalid lifecycle state")
    deliveries = message.get("deliveries")
    if not isinstance(deliveries, list) or not 1 <= len(deliveries) <= 100:
        raise ValueError("deliveries must contain 1–100 explicitly routed outputs")
    keys = set()
    for delivery in deliveries:
        if not isinstance(delivery, dict) or not isinstance(delivery.get("channel"), str) or delivery["channel"] not in CHANNELS:
            raise ValueError("invalid delivery channel")
        recipient = delivery.get("recipient_id")
        if not isinstance(recipient, str) or not recipient.strip() or len(recipient) > 150:
            raise ValueError("invalid recipient_id")
        content = delivery.get("content")
        if not isinstance(content, str) or not content.strip() or len(content) > 2000:
            raise ValueError("each output requires its own content")
        key = (delivery["channel"], recipient)
        if key in keys:
            raise ValueError("duplicate delivery")
        keys.add(key)
    if not any(channel == "earth" for channel, _ in keys):
        raise ValueError("Earth destination is mandatory")
    if message.get("state", "active") == "active":
        if not any(channel != "earth" for channel, _ in keys) and not (message["priority"] == "info" and message.get("routing_reason")):
            raise ValueError("at least one onboard destination required")
        if message["priority"] == "critical":
            if not any(channel == "room" for channel, _ in keys):
                raise ValueError("critical requires room output")
            if not any(channel == "ship_center" for channel, _ in keys):
                raise ValueError("critical requires ship_center output")
            if message.get("activity") == "eva" and not any(channel == "radio" for channel, _ in keys):
                raise ValueError("critical EVA requires radio output")
    # Reject NaN/Infinity and detach callers' mutable objects.
    return json.loads(json.dumps(message, allow_nan=False))


SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, revision INTEGER NOT NULL,
 payload TEXT NOT NULL, digest TEXT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0,
 UNIQUE(id, revision));
CREATE TABLE IF NOT EXISTS deliveries (
 id INTEGER PRIMARY KEY AUTOINCREMENT, message_seq INTEGER NOT NULL REFERENCES messages(seq),
 notification_id TEXT NOT NULL, revision INTEGER NOT NULL, recipient TEXT NOT NULL, channel TEXT NOT NULL,
 content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt REAL NOT NULL DEFAULT 0, dispatch_cycle TEXT, dispatched_at TEXT, delivered_at TEXT,
 received_at TEXT, acknowledged_at TEXT, last_error TEXT,
 UNIQUE(message_seq, recipient, channel));
CREATE TABLE IF NOT EXISTS attempts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, delivery_id INTEGER NOT NULL REFERENCES deliveries(id),
 at TEXT NOT NULL, outcome TEXT NOT NULL, error TEXT);
CREATE TABLE IF NOT EXISTS simulated_receipts (
 delivery_id INTEGER PRIMARY KEY REFERENCES deliveries(id),
 envelope TEXT NOT NULL, accepted_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS transit (
 delivery_id INTEGER PRIMARY KEY REFERENCES deliveries(id), envelope TEXT NOT NULL,
 received_due REAL NOT NULL, confirmed_due REAL NOT NULL, plan TEXT NOT NULL);
"""


class NotificationCenter:
    def __init__(self, path, adapter=None, retry_seconds=2.0, clock=time.time, transports=None, latency=None):
        self.lock = threading.RLock()
        self.clock = clock
        self.retry_seconds = retry_seconds
        self.latency = latency
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript(SCHEMA)
        # Interrupted deliveries are retried. A real downstream adapter must deduplicate its delivery ID.
        with self.db:
            self.db.execute("UPDATE deliveries SET status='queued' WHERE status='dispatching'")
        self.adapter = adapter or self._simulated_adapter
        self.transports = dict(transports or {})
        if any(channel not in CHANNELS or not callable(sender) for channel, sender in self.transports.items()):
            self.db.close()
            raise ValueError("transports must map known channels to callable senders")
        self.channel_available = {channel: True for channel in CHANNELS}
        # A disconnected/slow Earth adapter cannot exhaust onboard workers (or vice versa).
        self.pools = {channel: ThreadPoolExecutor(max_workers=2, thread_name_prefix=f"notify-{channel}")
                      for channel in CHANNELS}
        self.stop = threading.Event()
        self.worker = None
        self.version = 0

    def publish(self, raw):
        message = validate(raw)
        payload = json.dumps(message, sort_keys=True, allow_nan=False)
        digest = hashlib.sha256(payload.encode()).hexdigest()
        with self.lock, self.db:
            previous = self.db.execute("SELECT digest FROM messages WHERE id=? AND revision=?",
                                       (message["notification_id"], message["revision"])).fetchone()
            if previous:
                if previous["digest"] != digest:
                    raise ValueError("same notification/revision has different content")
                return {"status": "duplicate", "notification_id": message["notification_id"]}
            latest = self.db.execute("SELECT MAX(revision) FROM messages WHERE id=?", (message["notification_id"],)).fetchone()[0]
            if latest and latest > message["revision"]:
                return {"status": "stale", "notification_id": message["notification_id"]}
            self.db.execute("INSERT INTO messages(id,revision,payload,digest) VALUES(?,?,?,?)",
                            (message["notification_id"], message["revision"], payload, digest))
            # Superseded local messages must not be presented after a route change or cancellation.
            self.db.execute("""UPDATE deliveries SET status='cancelled' WHERE notification_id=? AND revision<?
                AND channel!='earth' AND status IN ('queued','waiting_link','retrying','dispatching','in_transit')""",
                            (message["notification_id"], message["revision"]))
            self.version += 1
        return {"status": "queued", "notification_id": message["notification_id"]}

    def tick(self):
        """Consume Notification queue; atomically create all outputs, then independently dispatch each."""
        with self.lock, self.db:
            for pending in self.db.execute("SELECT t.*,d.channel,d.status FROM transit t JOIN deliveries d ON d.id=t.delivery_id WHERE d.status='in_transit'").fetchall():
                if not self.channel_available[pending['channel']]:
                    continue
                if pending['received_due'] <= self.clock():
                    self.db.execute('INSERT OR IGNORE INTO simulated_receipts VALUES(?,?,?)',
                                    (pending['delivery_id'], pending['envelope'], utc_now()))
                if pending['confirmed_due'] <= self.clock():
                    self.db.execute("UPDATE deliveries SET status='delivered',delivered_at=? WHERE id=?", (utc_now(), pending['delivery_id']))
                    self.version += 1
            for row in self.db.execute("SELECT * FROM messages WHERE consumed=0 ORDER BY seq").fetchall():
                message = json.loads(row["payload"])
                latest = self.db.execute("SELECT MAX(revision) FROM messages WHERE id=?", (row["id"],)).fetchone()[0]
                for delivery in message["deliveries"]:
                    if delivery["channel"] != "earth" and row["revision"] < latest:
                        continue
                    self.db.execute("""INSERT OR IGNORE INTO deliveries(message_seq,notification_id,revision,recipient,channel,content)
                        VALUES(?,?,?,?,?,?)""", (row["seq"], row["id"], row["revision"], delivery["recipient_id"], delivery["channel"], delivery["content"]))
                self.db.execute("UPDATE messages SET consumed=1 WHERE seq=?", (row["seq"],))
            jobs = self.db.execute("""SELECT * FROM deliveries WHERE status IN ('queued','waiting_link','retrying')
                AND next_attempt<=? ORDER BY id""", (self.clock(),)).fetchall()
            cycle = utc_now()
            for job in jobs:
                self.db.execute("""UPDATE deliveries SET status='dispatching', attempts=attempts+1,
                    dispatch_cycle=?, dispatched_at=? WHERE id=?""", (cycle, cycle, job["id"]))
            if jobs:
                self.version += 1
        # No network/hardware call inside the lock or transaction. Earth and onboard share dispatch cycle.
        for job in jobs:
            self.pools[job["channel"]].submit(self._deliver, dict(job))
        return len(jobs)

    def _simulated_adapter(self, job):
        if self.latency:
            with self.lock:
                message = json.loads(self.db.execute('SELECT payload FROM messages WHERE seq=?', (job['message_seq'],)).fetchone()[0])
                if not self.channel_available[job['channel']]:
                    raise ConnectionError('simulated link unavailable')
            plan = self.latency(job['channel'], message.get('mission_location'))
            with self.lock, self.db:
                self.db.execute('INSERT OR REPLACE INTO transit VALUES(?,?,?,?,?)',
                    (job['id'], json.dumps(self.output_envelope(job)), self.clock() + plan['one_way_seconds'],
                     self.clock() + plan['confirmation_seconds'], json.dumps(plan)))
            return 'in_transit'
        with self.lock, self.db:
            available = self.channel_available[job["channel"]]
            if not available:
                raise ConnectionError(f"simulated {job['channel']} link unavailable")
            envelope = self.output_envelope(job)
            self.db.execute("INSERT OR IGNORE INTO simulated_receipts VALUES(?,?,?)",
                            (job["id"], json.dumps(envelope), utc_now()))

    def output_envelope(self, job):
        """Transport contract: only the addressed output's content leaves this boundary."""
        with self.lock:
            message = json.loads(self.db.execute("SELECT payload FROM messages WHERE seq=?",
                                                (job["message_seq"],)).fetchone()[0])
        return {
            "schema_version": 1,
            "idempotency_key": json.dumps([message["mission_id"], job["notification_id"],
                                          job["revision"], job["channel"], job["recipient"]]),
            "notification_id": job["notification_id"], "revision": job["revision"],
            "channel": job["channel"], "recipient_id": job["recipient"],
            "priority": message["priority"], "state": message.get("state", "active"),
            "content": job["content"], "created_at": message["created_at"], "synthetic": True,
            "requires_ack": job["channel"] == "wearable" and message.get("requires_ack", False),
        }

    def outputs(self, channel, recipient):
        """Simulated receiver projection. Earth retains history; onboard shows active revisions."""
        if channel not in CHANNELS or not recipient:
            raise ValueError("valid channel and recipient required")
        with self.lock:
            rows = self.db.execute("""SELECT r.envelope,r.accepted_at,m.payload,m.revision,
                (SELECT MAX(revision) FROM messages WHERE id=m.id) latest
                FROM simulated_receipts r JOIN deliveries d ON d.id=r.delivery_id
                JOIN messages m ON m.seq=d.message_seq
                WHERE d.channel=? AND d.recipient=? ORDER BY d.id DESC""", (channel, recipient)).fetchall()
            return [{**json.loads(row["envelope"]), "accepted_at": row["accepted_at"]}
                    for row in rows if channel == "earth" or
                    (row["revision"] == row["latest"] and json.loads(row["payload"]).get("state", "active") == "active")]

    def _deliver(self, job):
        # A revision may have invalidated a queued task while another adapter was slow.
        with self.lock:
            if self.db.execute("SELECT status FROM deliveries WHERE id=?", (job["id"],)).fetchone()[0] != "dispatching":
                return
        error = None
        try:
            sender = self.transports.get(job["channel"])
            if sender:
                if sender(self.output_envelope(job)) is False:
                    raise ConnectionError('transport rejected delivery')
                outcome = None
            else:
                outcome = self.adapter(job)
        except Exception as exc:
            error = str(exc)[:500]
        with self.lock, self.db:
            status = ("waiting_link" if job["channel"] == "earth" else "retrying") if error else ('in_transit' if outcome == 'in_transit' else 'delivered')
            changed = self.db.execute("""UPDATE deliveries SET status=?, delivered_at=?, last_error=?, next_attempt=?
                WHERE id=? AND status='dispatching'""", (status, utc_now() if status == 'delivered' else None, error,
                self.clock() + min(60, self.retry_seconds * 2 ** min(job["attempts"], 5)) if error else 0, job["id"])).rowcount
            self.db.execute("INSERT INTO attempts(delivery_id,at,outcome,error) VALUES(?,?,?,?)",
                            (job["id"], utc_now(), status if changed else "superseded", error))
            self.version += 1

    def inbox(self, crew_id):
        with self.lock, self.db:
            rows = self.db.execute("""SELECT m.payload,d.id delivery_id,d.content,d.acknowledged_at,d.delivered_at
                FROM deliveries d JOIN messages m ON m.seq=d.message_seq
                WHERE d.recipient=? AND d.channel='wearable' AND d.status='delivered'
                AND m.revision=(SELECT MAX(revision) FROM messages WHERE id=m.id) ORDER BY m.seq DESC""", (crew_id,)).fetchall()
            result = []
            for row in rows:
                message = json.loads(row["payload"])
                if message.get("state", "active") != "active":
                    continue
                self.db.execute("UPDATE deliveries SET received_at=COALESCE(received_at,?) WHERE id=?", (utc_now(), row["delivery_id"]))
                visible = {key: message.get(key) for key in ("notification_id", "revision", "kind", "title", "priority", "created_at", "synthetic", "requires_ack")}
                if any(d.get('audience') == 'operational' and d['channel'] == 'wearable' and d['recipient_id'] == crew_id for d in message['deliveries']):
                    visible['title'] = 'Aviso operacional'
                result.append({**visible, "message": row["content"], "delivery_id": row["delivery_id"],
                               "acknowledged_at": row["acknowledged_at"], "delivered_at": row["delivered_at"]})
            return result

    def acknowledge(self, delivery_id, crew_id):
        with self.lock, self.db:
            row = self.db.execute("""SELECT d.*,m.payload FROM deliveries d JOIN messages m ON m.seq=d.message_seq
                WHERE d.id=? AND d.recipient=? AND d.channel='wearable' AND d.status='delivered'""", (delivery_id, crew_id)).fetchone()
            if not row:
                raise ValueError("no delivered wearable message for this demo actor")
            message = json.loads(row["payload"])
            latest = self.db.execute("SELECT MAX(revision) FROM messages WHERE id=?", (row["notification_id"],)).fetchone()[0]
            if row["revision"] != latest or message.get("state", "active") != "active":
                raise ValueError("message is superseded or no longer active")
            if not message.get("requires_ack", False):
                raise ValueError("this notification does not require acknowledgement")
            self.db.execute("UPDATE deliveries SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE id=?", (utc_now(), delivery_id))
            self.version += 1

    def deliveries(self):
        with self.lock:
            return [dict(row) for row in self.db.execute("SELECT * FROM deliveries ORDER BY id DESC")]

    def crew(self):
        from .fixtures import CREW
        with self.lock:
            crew = set(CREW)
            for row in self.db.execute('SELECT payload FROM messages'):
                message = json.loads(row['payload'])
                crew.add(message['crew_id'])
                crew.update(d['recipient_id'] for d in message['deliveries'] if d['channel'] == 'wearable')
            return sorted(crew)

    def result(self, channel, identifier):
        with self.lock:
            row = self.db.execute('SELECT * FROM deliveries WHERE id=? AND channel=?', (identifier, channel)).fetchone()
            if not row:
                raise ValueError('delivery not found for channel')
            transit = self.db.execute('SELECT plan FROM transit WHERE delivery_id=?', (identifier,)).fetchone()
            received = self.db.execute('SELECT accepted_at FROM simulated_receipts WHERE delivery_id=?', (identifier,)).fetchone()
            return {'delivery_id': identifier, 'channel': channel, 'status': row['status'],
                    'return': True if row['status'] == 'delivered' else False if row['status'] == 'cancelled' else None,
                    'destination_received': bool(received), 'confirmed_at': row['delivered_at'],
                    'delay': json.loads(transit['plan']) if transit else None, 'last_error': row['last_error']}

    def set_channel(self, channel, available):
        if not isinstance(channel, str) or channel not in CHANNELS or type(available) is not bool:
            raise ValueError("unknown channel or availability")
        with self.lock, self.db:
            self.channel_available[channel] = available
            if available:
                self.db.execute("UPDATE deliveries SET next_attempt=0 WHERE channel=? AND status IN ('waiting_link','retrying')", (channel,))
            self.version += 1

    def start(self):
        def run():
            while not self.stop.is_set():
                self.tick()
                self.stop.wait(.1)
        self.worker = threading.Thread(target=run, daemon=True, name="notification-consumer")
        self.worker.start()

    def close(self):
        self.stop.set()
        if self.worker:
            self.worker.join()
        for pool in self.pools.values():
            pool.shutdown(wait=True)
        with self.lock:
            self.db.close()
