"""Checks for what the DataService publishes on the event queue: the topics, the messages (small and
JSON-serialisable), one message per crew member per call, and nothing when nothing was stored.

Run from sim/:  python -m pytest -q tests/test_events.py
"""
import json
import logging

import pytest

import gravsim as gs


@pytest.fixture(scope="module")
def mission():
    m = gs.Mission.random(seed=7)            # the server's default mission: CM-1 and CM-2 go outside on day 108
    assert any(c.evas for c in m.crew)
    return m


def published(data, topic=None):
    return [e["message"] for e in data.publisher.messages if topic in (None, e["topic"])]


def test_the_default_publisher_is_the_mock_and_starts_empty():
    data = gs.DataService()
    assert isinstance(data.publisher, gs.MockPublisher) and list(data.publisher.messages) == []
    assert gs.TOPICS == ("data.readings_stored", "data.context_updated", "data.result_saved")


def test_one_readings_message_per_crew_member_per_ingest(mission):
    data = gs.DataService()
    first = mission.timeline(seed=7, until=30)
    kept = data.ingest(first)
    messages = published(data)
    assert [e["topic"] for e in data.publisher.messages] == ["data.readings_stored"] * 4
    assert sorted(m["crew_id"] for m in messages) == ["CM-1", "CM-2", "CM-3", "CM-4"]
    for m in messages:
        mine = [r for r in kept if r.crew_id == m["crew_id"]]
        assert m == {"crew_id": m["crew_id"], "count": len(mine), "measures": sorted({r.measure for r in mine}),
                     "start": mine[0].timestamp, "end": mine[-1].timestamp}
    data.ingest([r for r in mission.timeline(seed=7) if r.mission_day > 30 and r.crew_id == "CM-3"])
    assert len(published(data)) == 5 and published(data)[-1]["crew_id"] == "CM-3"   # one more: only CM-3 sent


def test_a_sensor_record_is_announced_like_gravsims():
    data = gs.DataService()
    data.ingest([{"crew_id": "CM-1", "measure": "resting_hr", "timestamp": "2027-06-01T09:30:00+02:00",
                  "value": 1.15, "unit": "beats/s"}])
    assert published(data) == [{"crew_id": "CM-1", "count": 1, "measures": ["resting_hr"],
                                "start": "2027-06-01T07:30:00Z", "end": "2027-06-01T07:30:00Z"}]


def test_one_context_message_per_crew_member_per_ingest(mission):
    data = gs.DataService()
    kept = data.ingest_context(mission.context(start=107.5, until=108.5))
    messages = published(data, "data.context_updated")
    assert len(messages) == len(published(data)) == 4
    for m in messages:
        mine = [c for c in kept if c.crew_id == m["crew_id"]]
        assert m["count"] == len(mine) and m["activities"] == sorted({c.activity for c in mine})
        assert (m["start"], m["end"]) == (mission.timestamp(107.5), mission.timestamp(108.5))
    walkers = {m["crew_id"] for m in messages if "eva" in m["activities"]}
    assert walkers == {c.id for c in mission.crew if c.evas}


def test_every_saved_result_is_announced_including_studies():
    data = gs.DataService()
    data.save_result("CM-1", "measure_change", "2027-06-01T12:00:00Z", {"knee_extension_60": -12.5})
    study = data.save_result("CM-2", "study", "2027-06-10T12:00:00Z",
                             {"study": "bone_densitometry", "status": "scheduled", "reason": "hip loss"})
    assert [e["topic"] for e in data.publisher.messages] == ["data.result_saved"] * 2
    assert published(data)[1] == {"crew_id": "CM-2", "kind": "study", "timestamp": "2027-06-10T12:00:00Z",
                                  "computed_at": study.computed_at, "model_version": gs.MODEL_VERSION}
    data.save_result("CM-1", "measure_change", "2027-06-01T12:00:00Z", {"knee_extension_60": -12.0})   # recomputed
    assert len(published(data)) == 3                   # a replaced result is saved again, so it is announced again


def test_nothing_is_published_when_nothing_was_stored(caplog):
    data = gs.DataService()
    with caplog.at_level(logging.WARNING):
        assert data.ingest([]) == [] and data.ingest([{"crew_id": "CM-1", "measure": "elbow_flexion"}]) == []
        assert data.ingest_context([]) == [] and data.ingest_context([{"crew_id": "CM-1", "activity": "nap"}]) == []
    assert list(data.publisher.messages) == []


def test_every_message_is_json_and_small(mission):
    data = gs.DataService()
    data.ingest(mission.timeline(seed=7))
    data.ingest_context(mission.context())
    data.save_result("CM-1", "study", mission.timestamp(120), {"study": "aerobic_capacity"})
    assert len(data.publisher.messages) == 9
    for e in data.publisher.messages:
        assert e["topic"] in gs.TOPICS and json.loads(json.dumps(e)) == e
        assert len(json.dumps(e["message"])) < 1000                   # what changed, not the data itself


def test_any_object_with_publish_can_be_the_queue(mission):
    class Queue:
        def __init__(self):
            self.sent = []

        def publish(self, topic, message):
            self.sent.append((topic, json.dumps(message)))

    queue = Queue()
    data = gs.DataService(publisher=queue)
    data.ingest(mission.timeline(seed=7, until=0))
    data.save_result("CM-4", "dashboard", mission.timestamp(0), {"version": 1})
    assert [t for t, _ in queue.sent] == ["data.readings_stored"] * 4 + ["data.result_saved"]


def test_the_mock_logs_and_keeps_a_bounded_history(caplog):
    pub = gs.MockPublisher(keep=3)
    with caplog.at_level(logging.INFO, logger="gravsim.events"):
        for i in range(5):
            pub.publish("data.result_saved", {"n": i})
    assert [e["message"]["n"] for e in pub.messages] == [2, 3, 4]
    assert 'data.result_saved {"n": 4}' in caplog.text
    with pytest.raises(TypeError):
        pub.publish("data.result_saved", {"when": object()})          # not JSON: refused at once
