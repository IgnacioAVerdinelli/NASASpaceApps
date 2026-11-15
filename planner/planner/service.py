"""The Planner service: keeps each crew member's plan, reacts to events and sends reminders.

Inputs (docs/planner.md, section 6): the routine catalog, the mission clock, readings arriving
(`data.readings_stored`), HealthService findings (`health.finding`), spacewalks in the crew timeline and status
changes posted through the API. Outputs: the plan, saved through the DataService as a result of kind "plan",
and `plan.reminder` / `plan.missed` messages on the notifications channel.
"""
from __future__ import annotations

import logging
import threading
import time

from . import plan as engine
from .catalog import Catalog, Eva

log = logging.getLogger(__name__)
CONSUMER = "planner"
EVENTS = "events"
NOTIFICATIONS = "notifications"
EVA_TTL = 60.0              # seconds between re-reads of the crew timeline's spacewalks


class Planner:
    def __init__(self, source, catalog: Catalog | None = None, queue=None, simulate_crew: bool = False,
                 clock=time.monotonic):
        self.source = source
        self.catalog = catalog or Catalog.load()
        self.queue = queue
        self.simulate_crew = simulate_crew
        self._lock = threading.RLock()
        self._plans: dict[str, list[dict]] = {}
        self._evas: dict[str, tuple[float, list[Eva]]] = {}
        self._clock = clock
        self._instruments = self.catalog.instrument_measures()

    # ------------------------------------------------------------------ inputs
    def evas(self, crew_id: str) -> list[Eva]:
        cached = self._evas.get(crew_id)
        if cached is None or self._clock() - cached[0] > EVA_TTL:
            cached = (self._clock(), self.source.evas(crew_id))
            self._evas[crew_id] = cached
        return cached[1]

    def readings(self, crew_id: str, day: float) -> dict[str, list[tuple[float, str]]]:
        """instrument -> [(mission_day, timestamp)] of usable readings up to `day`."""
        mission = self.source.mission()
        out: dict[str, list[tuple[float, str]]] = {}
        for instrument, measures in self._instruments.items():
            rows = self.source.readings(crew_id, measures, day)
            seen = set()
            for r in rows:
                if r.get("quality", "ok") != "ok" or r.get("value") is None:
                    continue
                d = r.get("mission_day")
                d = mission.day_of(r["timestamp"]) if d is None else float(d)
                if (d, r["timestamp"]) not in seen:
                    seen.add((d, r["timestamp"]))
                    out.setdefault(instrument, []).append((d, r["timestamp"]))
        return out

    def _stored(self, crew_id: str) -> list[dict]:
        if crew_id not in self._plans:
            self._plans[crew_id] = self.source.load_plan(crew_id) or []
        return self._plans[crew_id]

    def _crew(self, crew_id: str | None) -> str:
        crew = self.source.crew()
        if crew_id is None:
            return crew[0]
        if crew_id not in crew:
            raise KeyError(crew_id)
        return crew_id

    # ------------------------------------------------------------------ the plan
    def build(self, crew_id: str, day: float) -> tuple[list[dict], list[tuple[str, dict]]]:
        """The plan as it stands on mission `day`, without saving: stored plan + routine, closed by readings and
        the clock. Returns the items and the transitions it made."""
        mission = self.source.mission()
        fresh = engine.routine_items(self.catalog, mission, crew_id, self.evas(crew_id))
        items = engine.merge(engine.snapshot(self._stored(crew_id)), fresh)
        changes = engine.update(items, mission, day, self.readings(crew_id, day), self.simulate_crew)
        return items, changes

    def refresh(self, crew_id: str) -> list[dict]:
        """Bring one crew member's plan up to the mission clock, save it if it changed and send what is due."""
        with self._lock:
            day = self.source.current_day()
            before = self._stored(crew_id)
            items, changes = self.build(crew_id, day)
            if items != before:
                self._save(crew_id, items, day)
            self._notify(crew_id, items, changes, day)
            return items

    def refresh_all(self) -> None:
        for crew_id in self.source.crew():
            try:
                self.refresh(crew_id)
            except Exception:       # one crew member's failure must not stop the others
                log.exception("Could not refresh the plan of %s", crew_id)

    def handle_finding(self, finding: dict) -> list[tuple[str, dict]]:
        crew_id = finding.get("crew_id")
        if crew_id not in self.source.crew() or not finding.get("measure"):
            log.warning("Ignoring a finding without a known crew member and measure: %s", finding)
            return []
        with self._lock:
            day = self.source.current_day()
            items, changes = self.build(crew_id, day)
            changes += engine.apply_finding(items, finding, self.catalog, self.source.mission(), day,
                                            self.evas(crew_id))
            self._save(crew_id, engine.sort_items(items), day)
            self._notify(crew_id, items, changes, day)
            return changes

    def set_status(self, crew_id: str | None, item_id: str, status: str, by: str | None = None,
                   note: str | None = None) -> dict:
        crew_id = self._crew(crew_id)
        with self._lock:
            day = self.source.current_day()
            items, changes = self.build(crew_id, day)
            item = engine.set_status(items, item_id, status, by, note, self.source.mission(), day)
            self._save(crew_id, items, day)
            self._notify(crew_id, items, changes, day)
            return item

    def _save(self, crew_id: str, items: list[dict], day: float) -> None:
        self.source.save_plan(crew_id, items, self.source.mission().timestamp(day))
        self._plans[crew_id] = engine.snapshot(items)

    # ------------------------------------------------------------------ reminders
    def _notify(self, crew_id: str, items: list[dict], changes: list[tuple[str, dict]], day: float) -> None:
        """plan.reminder when a window opens, plan.missed when a study is missed. The queue's dedupe keys make
        each one go out once, also across restarts."""
        if self.queue is None:
            return
        mission = self.source.mission()
        stamp = mission.timestamp(day)
        for item in items:
            w = item["window"]
            if item["status"] != "booked" or not (w["day_from"] <= day <= w["day_to"]):
                continue
            routine = self.catalog.routines.get(item["routine_id"]) if item["routine_id"] else None
            if item["reason"] == "routine" and routine is not None and not self.catalog.remind(routine):
                continue
            self.queue.publish("plan.reminder", self._message("plan_reminder", crew_id, item, stamp, [crew_id]),
                               channel=NOTIFICATIONS, dedupe=f"plan:{crew_id}:{item['id']}:open")
        for status, item in changes:
            if status == "missed" and item["type"] in engine.NOTIFY_MISSED:
                self.queue.publish("plan.missed", self._message("plan_missed", crew_id, item, stamp,
                                                                [crew_id, "ship_center"]),
                                   channel=NOTIFICATIONS, dedupe=f"plan:{crew_id}:{item['id']}:missed")

    @staticmethod
    def _message(kind: str, crew_id: str, item: dict, stamp: str, notify: list[str]) -> dict:
        return {"type": kind, "priority": "info", "crew_id": crew_id, "notify": notify,
                "item": {k: item[k] for k in ("id", "type", "title", "routine_id", "ref", "measure", "window",
                                              "status")},
                "created_at": stamp, "synthetic": item.get("synthetic", True)}

    # ------------------------------------------------------------------ events
    def step(self) -> bool:
        """Handle the next message on the events channel. Returns False when there is none."""
        if self.queue is None:
            return False
        nxt = self.queue.next(CONSUMER, EVENTS)
        if not nxt:
            return False
        message_id, topic, body = nxt
        if topic == "health.finding":
            self.handle_finding(body)
        elif topic == "data.readings_stored" and body.get("crew_id") in self.source.crew():
            tested = {m for ms in self._instruments.values() for m in ms}
            if tested & set(body.get("measures", [])):      # only an instrument the routine uses can close an item
                self.refresh(body["crew_id"])
        self.queue.ack(CONSUMER, message_id)
        return True

    # ------------------------------------------------------------------ views
    def plan(self, crew_id: str | None = None, day: float | None = None, **filters) -> dict:
        crew_id = self._crew(crew_id)
        mission = self.source.mission()
        with self._lock:
            today = self.source.current_day() if day is None else float(day)
            items, _ = self.build(crew_id, today)
        return {
            "version": 1, "crew_id": crew_id,
            "mission": {"name": mission.name, "today": round(today, 3), "todayLabel": mission.label(today),
                        "landing": mission.landing},
            "source": {"document": self.catalog.source["document"], "revision": self.catalog.source["revision"],
                       "profile": self.catalog.source["profile"], "note": self.catalog.source["note"]},
            "items": engine.view(items, today, **filters),
        }

    def today(self, crew_id: str | None = None, day: float | None = None, ahead: float = 7.0) -> dict:
        """Open items and those due in the next `ahead` days, by when they close."""
        out = self.plan(crew_id, day)
        t = out["mission"]["today"]
        out["items"] = sorted((i for i in out["items"] if i["status"] == "booked" and i["window"]["day_to"] >= t
                               and i["window"]["day_from"] <= t + ahead),
                              key=lambda i: (i["window"]["day_to"], i["id"]))
        return out
