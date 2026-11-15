"""Contract v1 of the health notices (issue #11): routing, revisions, mission location and the queue."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import gravsim as gs
import pytest
from gravsim.queue import Queue
from gravsim.serve import data_routes

from healthservice import notices
from healthservice.alerts import Alert
from healthservice.demo import DemoWorker
from healthservice.models import CrewInfo
from healthservice.sources import DataServiceSource, mission_info

CREW = ["CM-1", "CM-2", "CM-3"]
ISS = mission_info(gs.Mission("iss_180", launch_date="2027-01-01"))


def ctx(activity, location=None):
    return {"activity": activity, "location": location, "source": "test"}


def notice(priority, contexts, *, state="active", subject="CM-1", keep=None, mission=ISS, day=95.0, revision=1):
    return notices.build(notification_id=notices.notification_id("iss_180", subject, "knee_extension_60",
                                                                  "2027-04-06T00:00:00Z"),
                         revision=revision, source_event_id="test:1", mission=mission, mission_id="iss_180",
                         crew_id=subject, crew_ids=CREW, contexts=contexts, day=day, priority=priority,
                         title="Knee extension strength: loss beyond expected",
                         message="CLINICAL DETAIL -30% since pre-flight.", created_at="2027-04-06T00:00:00Z",
                         state=state, keep_deliveries=keep)


def pairs(n):
    return [(d["channel"], d["recipient_id"]) for d in n["deliveries"]]


def content(n, channel, recipient):
    return next(d["content"] for d in n["deliveries"] if (d["channel"], d["recipient_id"]) == (channel, recipient))


class MemoryStore:
    def __init__(self):
        self.saved = {}

    def save(self, n, episode_start):
        assert episode_start == "2027-04-06T00:00:00Z"
        self.saved[n["notification_id"]] = n


def published(queue, consumer="t"):
    out = []
    while item := queue.next(consumer, notices.CHANNEL):
        queue.ack(consumer, item[0])
        out.append(item)
    return out


# --------------------------------------------------------------------------- the three kinds of dispatch

def test_info_goes_to_the_subjects_wearable_and_earth_without_ack():
    n = notice("info", {"CM-1": ctx("work", "Destiny"), "CM-2": ctx("work"), "CM-3": ctx("work")})
    assert notices.validate(n) == []
    assert pairs(n) == [("earth", "mission-control"), ("wearable", "CM-1")]
    assert n["requires_ack"] is False
    assert "CLINICAL DETAIL" in content(n, "wearable", "CM-1")


def test_critical_inside_calls_everyone_from_the_first_dispatch():
    n = notice("critical", {"CM-1": ctx("work", "Destiny"), "CM-2": ctx("sleep", "Harmony"), "CM-3": ctx("work")})
    assert notices.validate(n) == []
    assert pairs(n) == [("earth", "mission-control"), ("wearable", "CM-1"), ("wearable", "CM-2"),
                        ("wearable", "CM-3"), ("room", "onboard"), ("ship_center", "operations")]
    assert n["requires_ack"] is True
    for channel, recipient in [("wearable", "CM-2"), ("room", "onboard"), ("ship_center", "operations")]:
        text = content(n, channel, recipient)
        assert "CLINICAL DETAIL" not in text and "CM-1" in text and "Destiny" in text   # operational only
    assert "CLINICAL DETAIL" in content(n, "earth", "mission-control")


def test_critical_on_a_spacewalk_adds_the_radio_loop_and_the_support_crew():
    n = notice("critical", {"CM-1": ctx("eva", "outside"), "CM-2": ctx("eva", "outside"), "CM-3": ctx("sleep")})
    assert notices.validate(n) == []
    assert pairs(n) == [("earth", "mission-control"), ("wearable", "CM-1"), ("wearable", "CM-3"),
                        ("room", "onboard"), ("ship_center", "operations"), ("radio", "eva-CM-1")]
    assert n["activity"] == "eva" and n["crew_location"] == "outside"
    assert "outside, on a spacewalk" in content(n, "radio", "eva-CM-1")
    assert "CLINICAL DETAIL" not in content(n, "radio", "eva-CM-1")


def test_warning_adds_a_crew_member_to_check_in():
    n = notice("warning", {"CM-1": ctx("work"), "CM-2": ctx("sleep"), "CM-3": ctx("meal", "Unity")})
    assert pairs(n) == [("earth", "mission-control"), ("wearable", "CM-1"), ("wearable", "CM-3")]
    assert n["requires_ack"] is True
    assert "CLINICAL DETAIL" not in content(n, "wearable", "CM-3")


# --------------------------------------------------------------------------- revisions

def test_publishing_the_same_revision_again_adds_nothing():
    with tempfile.TemporaryDirectory() as tmp:
        queue, store = Queue(str(Path(tmp) / "q.sqlite")), MemoryStore()
        contexts = {"CM-1": ctx("work"), "CM-2": ctx("work"), "CM-3": ctx("work")}
        first = notices.update(queue, store, None, notice("warning", contexts))
        again = notices.update(queue, store, first, notice("warning", contexts))     # same event processed again
        notices.publish(queue, first)
        assert again is first and first["revision"] == 1
        bodies = [b for _, topic, b in published(queue) if topic == notices.TOPIC]
        assert bodies == [first]


def test_route_change_then_resolution_and_cancellation_make_new_revisions():
    with tempfile.TemporaryDirectory() as tmp:
        queue, store = Queue(str(Path(tmp) / "q.sqlite")), MemoryStore()
        asleep = {"CM-1": ctx("sleep"), "CM-2": ctx("work"), "CM-3": ctx("work")}
        awake = {**asleep, "CM-1": ctx("meal", "Unity")}
        r1 = notices.update(queue, store, None, notice("warning", asleep))
        assert ("wearable", "CM-1") not in pairs(r1)
        r1b = notices.update(queue, store, r1, notice("warning", {**asleep, "CM-1": ctx("hygiene")}))
        assert r1b is r1                                     # context changed, nobody else to tell: no revision
        r2 = notices.update(queue, store, r1, notice("warning", awake))
        assert (r2["notification_id"], r2["revision"]) == (r1["notification_id"], 2)
        assert ("wearable", "CM-1") in pairs(r2)
        r3 = notices.update(queue, store, r2, notice("warning", awake, state="resolved", keep=r2["deliveries"]))
        assert (r3["revision"], r3["state"], r3["requires_ack"]) == (3, "resolved", False)
        assert pairs(r3) == pairs(r2)                        # everyone who had it can clear it
        assert all(d["content"].startswith("Resolved") for d in r3["deliveries"])
        c1 = notices.update(queue, store, None, notice("info", awake, subject="CM-2"))
        c2 = notices.update(queue, store, c1, notice("info", awake, subject="CM-2", state="cancelled",
                                                     keep=c1["deliveries"]))
        assert (c2["revision"], c2["state"], c2["requires_ack"]) == (2, "cancelled", False)
        assert all(d["content"].startswith("Cancelled") for d in c2["deliveries"])
        revisions = [(b["crew_id"], b["revision"], b["state"]) for _, _, b in published(queue)]
        assert revisions == [("CM-1", 1, "active"), ("CM-1", 2, "active"), ("CM-1", 3, "resolved"),
                             ("CM-2", 1, "active"), ("CM-2", 2, "cancelled")]
        assert store.saved[r1["notification_id"]] is r3 and store.saved[c1["notification_id"]] is c2


def test_worker_resolves_the_notice_when_the_measure_stops_alerting():
    with tempfile.TemporaryDirectory() as tmp:
        queue = Queue(str(Path(tmp) / "q.sqlite"))
        mission = gs.Mission.random("iss_180", n_crew=2, seed=7)
        data = gs.DataService()
        data.ingest(mission.timeline(seed=7, until=95))
        data.ingest_context(mission.context())
        worker = DemoWorker(LocalSource(mission, data, 95), queue)
        alert = Alert("CM-1", "knee_extension_60", "warning", "Test", 95, mission.timestamp(95), True)
        with patch("healthservice.demo.check", return_value={"knee_extension_60": alert}):
            worker.process_readings({"crew_id": "CM-1"})
        with patch("healthservice.demo.check", return_value={}):
            worker.process_readings({"crew_id": "CM-1"})
            worker.process_readings({"crew_id": "CM-1"})     # already resolved: nothing new
        bodies = [b for _, topic, b in published(queue) if topic == notices.TOPIC]
        assert [(b["revision"], b["state"]) for b in bodies] == [(1, "active"), (2, "resolved")]
        assert len({b["notification_id"] for b in bodies}) == 1
        data.store.close()


# --------------------------------------------------------------------------- mission location

@pytest.mark.parametrize("preset, day, mode, body_id", [
    ("iss_180", 95, "body", "399"),           # low Earth orbit, placed on Earth
    ("artemis_30", 15, "body", "301"),        # lunar surface
    ("mars", 300, "body", "499"),             # Mars surface
    ("mars", 100, "unavailable", None),       # in transit: no agreed mode
])
def test_mission_location(preset, day, mode, body_id):
    mission = mission_info(gs.Mission(preset, launch_date="2027-01-01"))
    loc = notices.mission_location(mission, day)
    assert (loc["mode"], loc.get("body_id")) == (mode, body_id)
    assert loc["epoch"] == mission.timestamp(day)            # the mission clock, not the time of publishing
    assert loc["source"] == notices.LOCATION_SOURCE and loc["synthetic"] is True
    if mode == "unavailable":
        assert "transit" in loc["reason"]
    n = notice("info", {"CM-1": ctx("work")}, mission=mission, day=day)
    assert notices.validate(n) == []


def test_validate_finds_contract_errors():
    n = notice("info", {"CM-1": ctx("work")})
    assert notices.validate({**n, "priority": "urgent"}) == ["priority: 'urgent' not in ('info', 'warning', 'critical')"]
    assert notices.validate({**n, "created_at": "2027-04-06T00:00:00"}) == ["created_at: needs a time zone"]
    assert "deliveries: duplicated channel and recipient" in notices.validate({**n, "deliveries": n["deliveries"] * 2})
    no_earth = [d for d in n["deliveries"] if d["channel"] != "earth"]
    assert "deliveries: every notice goes to Earth" in notices.validate({**n, "deliveries": no_earth})
    url = [{**n["deliveries"][0], "recipient_id": "https://example.org/watch"}]
    assert any("logical id" in e for e in notices.validate({**n, "deliveries": url}))
    body = {**n["mission_location"], "mode": "body", "body_id": None}
    assert "mission_location: mode body needs body_id and epoch" in notices.validate({**n, "mission_location": body})
    with pytest.raises(ValueError):
        notices.publish(None, {**n, "revision": 0})


# --------------------------------------------------------------------------- fixtures and the queue between processes

class LocalSource(DataServiceSource):
    def __init__(self, mission, data, day):
        self._mission = mission_info(mission)
        self._crew = [CrewInfo(c.id, c.sex) for c in mission.crew]
        self.routes = data_routes(mission, data, lambda: day)

    def _request(self, method, path, query=None, body=None):
        return self.routes[method, path](query or {}, body)[1]


def test_fixtures_are_marked_synthetic_and_published_between_processes():
    with tempfile.TemporaryDirectory() as tmp:
        path = str(Path(tmp) / "q.sqlite")
        queue = Queue(path)
        mission = gs.Mission.random("mars", n_crew=3, seed=7)
        data = gs.DataService()
        data.ingest_context(mission.context())
        source = LocalSource(mission, data, 300)
        store = notices.NoticeStore(source)
        for name in ("info", "critical_internal", "critical_eva"):
            n, _ = notices.fixture(name, source, "CM-1")
            assert n["synthetic"] is True and n["source_event_id"].startswith(f"fixture:{name}:")
            assert notices.validate(n) == []
            notices.update(queue, store, None, n)
        eva = store.find(notices.fixture("critical_eva", source, "CM-1")[0]["notification_id"], ["CM-1"])
        assert ("radio", "eva-CM-1") in pairs(eva)
        assert eva["mission_location"]["body_id"] == "499"

        consume = [sys.executable, "-m", "healthservice.notices", "--queue", path, "consume", "--once"]
        out = subprocess.run(consume, capture_output=True, text=True, check=True).stdout.splitlines()
        assert [json.loads(line)["source_event_id"].split(":")[1] for line in out] == \
            ["info", "critical_internal", "critical_eva"]
        assert subprocess.run(consume, capture_output=True, text=True, check=True).stdout == ""    # acknowledged
        other = subprocess.run(consume[:-1] + ["--consumer", "audit", "--once"], capture_output=True, text=True,
                               check=True).stdout.splitlines()
        assert len(other) == 3                                  # another consumer does not compete for them
        data.store.close()
