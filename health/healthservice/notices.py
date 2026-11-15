"""Health notices for the Notification Center: contract v1, routing, revisions and the mission location.

The HealthService publishes each notice on the notifications queue; the Notification Center is what sends it.
The HealthService decides the priority and every delivery (channel, recipient and the text for that recipient);
the Notification Center does not pick recipients or judge clinical severity. See docs/health-notices.md.

    python -m healthservice.notices publish --example critical_eva --crew CM-1   # a synthetic fixture
    python -m healthservice.notices state --id NOTIFICATION_ID --to resolved
    python -m healthservice.notices consume --consumer notification-center      # from another process

The queue is the local demo's SQLite file (gravsim.queue): --queue PATH, or the NASA_QUEUE variable.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

SCHEMA_VERSION = 1
SOURCE = "healthservice"
KIND = "health_notice"
TOPIC = "health.notice"               # queue topic
CHANNEL = "notifications"             # queue channel, shared with the analysis scheduler's study.due
VERSION = "notices-1"                 # model_version of the notices kept in the DataService

PRIORITIES = ("info", "warning", "critical")
STATES = ("active", "resolved", "cancelled")
CHANNELS = ("wearable", "earth", "room", "ship_center", "radio")

# Logical recipient ids (stable, never URLs). To agree with the Notification Center: they are the ones its demo uses.
EARTH = "mission-control"             # channel earth: the flight surgeon and mission control, over the Earth link
SHIP_CENTER = "operations"            # channel ship_center: the operations console on board
ONBOARD = "onboard"                   # channel room: announcement in every module
# channel wearable: the crew member's id (CM-1); channel radio: eva_loop(crew_id)

UNAVAILABLE = {"eva", "hygiene", "sleep"}      # activities in which a crew member is not told a non-critical notice

# Where the spacecraft is, for the Earth link (JPL Horizons body ids). /api/v1/mission has no location yet, so the
# HealthService maps the mission phase to a body: it passes the location on, it does not navigate. "flight" is the
# ISS preset: low Earth orbit, placed on Earth. Phases in transit have no agreed mode yet, so they have no location.
PHASE_BODIES = {"preflight": ("399", "Earth"), "flight": ("399", "Earth"), "postflight": ("399", "Earth"),
                "lunar_surface": ("301", "Moon"), "mars_surface": ("499", "Mars")}
LOCATION_SOURCE = "healthservice:phase-map"


# --------------------------------------------------------------------------- the mission location

def mission_location(mission, day: float, synthetic: bool = True) -> dict:
    """Where the spacecraft is on mission `day`, for the Notification Center's Earth link. mode "body": placed on
    a Horizons body, an approximation for the demo, not a trajectory. mode "unavailable": no location (with the
    reason); the Earth link must stay pending, never be taken as zero delay."""
    phase = mission.phase(day)
    common = {"epoch": mission.timestamp(day), "phase": phase.name, "source": LOCATION_SOURCE, "synthetic": synthetic}
    if phase.name in PHASE_BODIES:
        body_id, body = PHASE_BODIES[phase.name]
        return {"mode": "body", "body_id": body_id, "body": body, **common}
    reason = (f"phase {phase.name}: the spacecraft is in transit and there is no agreed mode for it yet"
              if "transit" in phase.name else f"phase {phase.name}: no body known for it")
    return {"mode": "unavailable", "reason": reason, **common}


# --------------------------------------------------------------------------- routing

def _activity(contexts: dict, crew_id: str) -> str | None:
    record = contexts.get(crew_id)
    return record.get("activity") if record else None


def _available(contexts: dict, crew_id: str) -> bool:
    activity = _activity(contexts, crew_id)
    return activity is not None and activity not in UNAVAILABLE


def eva_loop(crew_id: str) -> str:
    return f"eva-{crew_id}"


def route(priority: str, subject: str, contexts: dict, crew_ids: list[str]) -> tuple[list[tuple], str]:
    """Who gets the notice: [(channel, recipient_id, audience)] and the reason. audience says which text they
    get: "personal" (the crew member it is about), "clinical" (Earth) or "operational" (everyone else).

    - Every notice goes to Earth.
    - info: plus the subject's wearable, if available.
    - warning: plus the subject's wearable, if available, and one available crew member to check in (the ship
      center if there is none).
    - critical: from the first dispatch, the subject, every crew member not on a spacewalk (asleep ones too),
      every module and the ship center. On a spacewalk, also the radio loop of that spacewalk.
    A subject who is not available gets the wearable in a later revision, when they are.
    """
    if priority not in PRIORITIES:
        raise ValueError(f"priority must be one of {PRIORITIES}, not {priority!r}")
    out = [("earth", EARTH, "clinical")]
    others = [c for c in crew_ids if c != subject]
    activity = _activity(contexts, subject)
    if priority == "critical":
        out.append(("wearable", subject, "personal"))
        responders = [c for c in others if _activity(contexts, c) != "eva"]
        out += [("wearable", c, "operational") for c in responders]
        out += [("room", ONBOARD, "operational"), ("ship_center", SHIP_CENTER, "operational")]
        if activity == "eva":
            out.append(("radio", eva_loop(subject), "operational"))
            reason = (f"critical on a spacewalk: radio {eva_loop(subject)}, support crew inside "
                      f"({', '.join(responders) or 'none'}), modules and ship center")
        else:
            reason = f"critical: responders ({', '.join(responders) or 'none'}), modules and ship center"
    else:
        if _available(contexts, subject):
            out.append(("wearable", subject, "personal"))
            reason = f"{priority}: {subject} available"
        else:
            reason = f"{priority}: {subject} unavailable ({activity or 'unknown context'}), wearable held"
        if priority == "warning":
            buddy = next((c for c in others if _available(contexts, c)), None)
            out.append(("wearable", buddy, "operational") if buddy else ("ship_center", SHIP_CENTER, "operational"))
            reason += f"; check-in by {buddy}" if buddy else "; no crew member available, ship center"
    seen, unique = set(), []
    for channel, recipient, audience in out:
        if (channel, recipient) not in seen:
            seen.add((channel, recipient))
            unique.append((channel, recipient, audience))
    return unique, reason


def _where(location: str | None) -> str:
    if location == "outside":
        return " (outside, on a spacewalk)"
    return f" (in {location})" if location else ""


def contents(audience: str, *, priority: str, state: str, subject: str, title: str, message: str,
             location: str | None) -> str:
    """The text for one delivery. Only the subject and Earth get the clinical detail."""
    if state != "active":
        word = "Resolved" if state == "resolved" else "Cancelled"
        if audience == "operational":
            return f"{word}: the notice about {subject} needs no further action."
        return f"{word}: {title}."
    if audience == "personal":
        return message
    if audience == "clinical":
        return f"{subject}: {message}"
    if priority == "critical":
        return f"CRITICAL: {subject} needs assistance now{_where(location)}. Respond and report to the ship center."
    return f"{subject} has a health notice that needs a check-in. Please check in with {subject} when you can."


# --------------------------------------------------------------------------- the notice

def build(*, notification_id: str, revision: int, source_event_id: str, mission, mission_id: str, crew_id: str,
          crew_ids: list[str], contexts: dict, day: float, priority: str, title: str, message: str,
          created_at: str, state: str = "active", synthetic: bool = True, keep_deliveries: list | None = None) -> dict:
    """One revision of a notice, contract v1. A resolved or cancelled notice goes to whoever had the active one
    (keep_deliveries), so each of them can clear it."""
    if state not in STATES:
        raise ValueError(f"state must be one of {STATES}, not {state!r}")
    context = contexts.get(crew_id) or {}
    location = context.get("location")
    if state == "active" or keep_deliveries is None:
        routes, reason = route(priority, crew_id, contexts, crew_ids)
    else:
        routes = [(d["channel"], d["recipient_id"], d["audience"]) for d in keep_deliveries]
        reason = f"{state}: to everyone who had the notice"
    text = dict(priority=priority, state=state, subject=crew_id, title=title, message=message, location=location)
    phase = mission.phase(day)
    return {
        "schema_version": SCHEMA_VERSION,
        "notification_id": notification_id,
        "revision": revision,
        "source": SOURCE,
        "source_event_id": source_event_id,
        "mission_id": mission_id,
        "crew_id": crew_id,
        "kind": KIND,
        "priority": priority,
        "title": title,
        "message": message,
        "created_at": created_at,
        "state": state,
        "requires_ack": state == "active" and priority != "info",
        "synthetic": synthetic,
        "activity": context.get("activity"),
        "crew_location": location,
        "phase": {"name": phase.name, "gravity_g": phase.gravity_g},
        "mission_location": mission_location(mission, day, synthetic),
        "routing_reason": reason,
        "deliveries": [{"channel": c, "recipient_id": r, "audience": a, "content": contents(a, **text)}
                       for c, r, a in routes],
    }


def material(notice: dict) -> tuple:
    """What a new revision is for: state, priority and each delivery (who and what they are told), and where
    the spacecraft is. Context changes that change none of them (a meal after work) do not make a revision."""
    loc = notice["mission_location"]
    return (notice["state"], notice["priority"], loc["mode"], loc.get("body_id"),
            tuple((d["channel"], d["recipient_id"], d["content"]) for d in notice["deliveries"]))


REQUIRED = {"schema_version": int, "notification_id": str, "revision": int, "source": str, "source_event_id": str,
            "mission_id": str, "crew_id": str, "kind": str, "priority": str, "title": str, "message": str,
            "created_at": str, "state": str, "requires_ack": bool, "synthetic": bool, "deliveries": list,
            "mission_location": dict}


def validate(notice: dict) -> list[str]:
    """The ways a notice breaks contract v1 (empty if none)."""
    errors = [f"{k}: missing or not {t.__name__}" for k, t in REQUIRED.items() if not isinstance(notice.get(k), t)]
    if errors:
        return errors
    if notice["schema_version"] != SCHEMA_VERSION:
        errors.append(f"schema_version: {notice['schema_version']} is not {SCHEMA_VERSION}")
    if notice["revision"] < 1:
        errors.append("revision: must be a positive integer")
    if notice["priority"] not in PRIORITIES:
        errors.append(f"priority: {notice['priority']!r} not in {PRIORITIES}")
    if notice["state"] not in STATES:
        errors.append(f"state: {notice['state']!r} not in {STATES}")
    try:
        if datetime.fromisoformat(notice["created_at"]).tzinfo is None:
            errors.append("created_at: needs a time zone")
    except ValueError:
        errors.append(f"created_at: {notice['created_at']!r} is not ISO 8601")
    if not isinstance(notice.get("activity"), (str, type(None))):
        errors.append("activity: must be text or null")
    pairs = [(d.get("channel"), d.get("recipient_id")) for d in notice["deliveries"]]
    if len(pairs) != len(set(pairs)):
        errors.append("deliveries: duplicated channel and recipient")
    for d in notice["deliveries"]:
        if d.get("channel") not in CHANNELS:
            errors.append(f"deliveries: channel {d.get('channel')!r} not in {CHANNELS}")
        if not d.get("recipient_id") or "://" in d["recipient_id"]:
            errors.append(f"deliveries: recipient_id {d.get('recipient_id')!r} must be a logical id")
        if not d.get("content"):
            errors.append(f"deliveries: {d.get('channel')}/{d.get('recipient_id')} has no content")
    if not any(d.get("channel") == "earth" for d in notice["deliveries"]):
        errors.append("deliveries: every notice goes to Earth")
    loc = notice["mission_location"]
    if loc.get("mode") == "body" and not (loc.get("body_id") and loc.get("epoch")):
        errors.append("mission_location: mode body needs body_id and epoch")
    if loc.get("mode") not in ("body", "unavailable"):
        errors.append(f"mission_location: unknown mode {loc.get('mode')!r}")
    return errors


# --------------------------------------------------------------------------- where the notices are kept

class NoticeStore:
    """The latest revision of every notice, kept in the DataService as results of kind "notice" (one record per
    crew member and creation time, as the scheduler keeps its studies)."""

    def __init__(self, source):
        self.source = source

    def _records(self, crew_id: str) -> list[dict]:
        return [r for r in self.source._request("GET", "/api/v1/results", {"crew": crew_id, "kind": "notice"})
                if r["model_version"] == VERSION]

    def latest(self, crew_id: str) -> dict[str, dict]:
        """notification_id -> the latest revision, for one crew member."""
        out = {}
        for record in self._records(crew_id):
            for nid, notice in record["payload"]["notices"].items():
                if nid not in out or notice["revision"] > out[nid]["revision"]:
                    out[nid] = notice
        return out

    def find(self, notification_id: str, crew_ids: list[str]) -> dict | None:
        return next((n for c in crew_ids for nid, n in self.latest(c).items() if nid == notification_id), None)

    def save(self, notice: dict, episode_start: str) -> None:
        crew_id = notice["crew_id"]
        record = next((r for r in self._records(crew_id) if r["timestamp"] == episode_start), None)
        notices = dict(record["payload"]["notices"]) if record else {}
        notices[notice["notification_id"]] = notice
        self.source._request("POST", "/api/v1/results", body={
            "crew_id": crew_id, "kind": "notice", "timestamp": episode_start, "model_version": VERSION,
            "payload": {"notices": notices}})


def publish(queue, notice: dict) -> None:
    """Put one revision on the queue. Publishing the same revision again adds nothing: the queue keeps one message
    per notification id and revision."""
    errors = validate(notice)
    if errors:
        raise ValueError(f"notice {notice.get('notification_id')} breaks contract v1: {errors}")
    queue.publish(TOPIC, notice, channel=CHANNEL, dedupe=f"notice:{notice['notification_id']}:{notice['revision']}")


def episode_start(notice: dict) -> str:
    """The creation time of revision 1, kept inside the id (the last field)."""
    return notice["notification_id"].rsplit("|", 1)[1]


def notification_id(mission_id: str, crew_id: str, topic: str, created_at: str) -> str:
    return "|".join([SOURCE, mission_id, crew_id, topic, created_at])


def update(queue, store: NoticeStore, previous: dict | None, candidate: dict) -> dict:
    """Publish `candidate` as the next revision of `previous` if it changes what the notice says (material), else
    publish `previous` again, unchanged. Publishes before saving: if saving fails, the same revision comes out the
    next time and the queue drops the copy. Returns the notice now current."""
    if previous is not None and material(previous) == material(candidate):
        publish(queue, previous)
        return previous
    candidate = {**candidate, "revision": 1 if previous is None else previous["revision"] + 1}
    publish(queue, candidate)
    store.save(candidate, episode_start(candidate))
    return candidate


# --------------------------------------------------------------------------- synthetic fixtures

FIXTURES = {
    "info": ("info", None),
    "warning": ("warning", None),
    "critical_internal": ("critical", None),
    "critical_eva": ("critical", {"activity": "eva", "location": "outside", "source": "fixture"}),
}


def fixture(name: str, source, crew_id: str) -> tuple[dict, dict]:
    """A synthetic notice to test the contract (there is no clinical producer of critical notices yet): it is
    marked synthetic, its event is "fixture:...", and it uses no clinical threshold. Returns it with the contexts
    used to route it; critical_eva places crew_id outside on a spacewalk."""
    priority, override = FIXTURES[name]
    mission, day = source.mission(), source.current_day()
    crew_ids = [c.id for c in source.crew()]
    contexts = {c: source._request("GET", "/api/v1/context/current", {"crew": c}) for c in crew_ids}
    if override:
        contexts[crew_id] = {**(contexts.get(crew_id) or {}), **override}
    created = mission.timestamp(day)
    notice = build(notification_id=notification_id(mission.name, crew_id, f"fixture-{name}", created), revision=1,
                   source_event_id=f"fixture:{name}:{created}", mission=mission, mission_id=mission.name,
                   crew_id=crew_id, crew_ids=crew_ids, contexts=contexts, day=day, priority=priority,
                   title=f"SYNTHETIC TEST ({priority})",
                   message=f"SYNTHETIC TEST ({priority}): a fixture to test the notice contract, not a clinical finding.",
                   created_at=created, synthetic=True)
    return notice, contexts


# --------------------------------------------------------------------------- command line

def _queue(path: str | None):
    from gravsim.queue import Queue
    path = path or os.environ.get("NASA_QUEUE")
    if not path:
        sys.exit("no queue: pass --queue PATH or set NASA_QUEUE")
    return Queue(path)


def main(argv=None):
    from .sources import DataServiceSource

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--queue", help="SQLite queue file (default: $NASA_QUEUE)")
    sub = parser.add_subparsers(dest="command", required=True)
    pub = sub.add_parser("publish", help="publish a synthetic fixture notice")
    pub.add_argument("--example", choices=list(FIXTURES), required=True)
    pub.add_argument("--crew", default="CM-1")
    pub.add_argument("--data-url", default="http://localhost:8000")
    st = sub.add_parser("state", help="publish a notice's next revision as resolved or cancelled")
    st.add_argument("--id", required=True, help="notification_id")
    st.add_argument("--to", choices=["resolved", "cancelled"], required=True)
    st.add_argument("--data-url", default="http://localhost:8000")
    con = sub.add_parser("consume", help="print the notices on the queue, as JSON lines, and acknowledge them")
    con.add_argument("--consumer", default="notification-center",
                     help="cursor name: each name gets every message once; do not reuse the demo's 'notifications'")
    con.add_argument("--once", action="store_true", help="stop when the queue is drained")
    args = parser.parse_args(argv)
    queue = _queue(args.queue)

    if args.command == "consume":
        import time
        while True:
            item = queue.next(args.consumer, CHANNEL)
            if item is None:
                if args.once:
                    return
                time.sleep(0.5)
                continue
            message_id, topic, body = item
            if topic == TOPIC:
                print(json.dumps({"message_id": message_id, **body}, ensure_ascii=False), flush=True)
            queue.ack(args.consumer, message_id)          # after "persisting" (printing) it
        return

    source = DataServiceSource(args.data_url)
    store = NoticeStore(source)
    if args.command == "publish":
        notice, _ = fixture(args.example, source, args.crew)
        notice = update(queue, store, store.find(notice["notification_id"], [notice["crew_id"]]), notice)
    else:
        crew_ids = [c.id for c in source.crew()]
        previous = store.find(args.id, crew_ids)
        if previous is None:
            sys.exit(f"no notice {args.id}")
        mission, day = source.mission(), source.current_day()
        contexts = {c: source._request("GET", "/api/v1/context/current", {"crew": c}) for c in crew_ids}
        candidate = build(notification_id=previous["notification_id"], revision=previous["revision"],
                          source_event_id=f"manual:{args.to}:{mission.timestamp(day)}", mission=mission,
                          mission_id=previous["mission_id"], crew_id=previous["crew_id"], crew_ids=crew_ids,
                          contexts=contexts, day=day, priority=previous["priority"], title=previous["title"],
                          message=previous["message"], created_at=mission.timestamp(day), state=args.to,
                          synthetic=previous["synthetic"], keep_deliveries=previous["deliveries"])
        notice = update(queue, store, previous, candidate)
    print(json.dumps(notice, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
