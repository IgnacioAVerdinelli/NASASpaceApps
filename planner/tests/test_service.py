"""The Planner against gravsim's DataService (route table in this process), the SQLite queue and the HTTP API."""
import tempfile
from pathlib import Path

import gravsim as gs
import pytest
from fastapi.testclient import TestClient
from gravsim.queue import Queue
from gravsim.serve import data_routes

from planner.api import create_app
from planner.service import Planner
from planner.sources import PLAN_KIND, PLAN_VERSION, RoutesSource


class Clock:
    def __init__(self, day):
        self.day = day

    def __call__(self):
        return self.day


@pytest.fixture
def setup():
    with tempfile.TemporaryDirectory() as tmp:
        queue = Queue(str(Path(tmp) / "queue.sqlite"))
        mission = gs.Mission.random("iss_180", n_crew=2, seed=7)
        data = gs.DataService(publisher=queue)
        data.ingest(mission.timeline(seed=7, until=95))
        data.ingest_context(mission.context())
        clock = Clock(95.0)
        source = RoutesSource(data_routes(mission, data, clock))
        yield mission, data, queue, clock, source
        data.store.close()


def notifications(queue, consumer="t"):
    out = []
    while item := queue.next(consumer, "notifications"):
        queue.ack(consumer, item[0])
        out.append(item)
    return out


def test_refresh_saves_the_plan_closes_studies_and_reminds(setup):
    mission, data, queue, clock, source = setup
    planner = Planner(source, queue=queue)
    items = planner.refresh("CM-1")
    saved = data.results("CM-1", PLAN_KIND)
    assert len(saved) == 1 and saved[0].model_version == PLAN_VERSION
    assert saved[0].payload["items"] == items
    status = {i["id"]: i["status"] for i in items}
    assert status["6025:14"] == status["6025:44"] == status["6025:74"] == "done"      # generator's strength tests
    assert status["6028:13"] == status["6028:74"] == "done"                            # and VO2peak tests
    assert status["6013:-180"] == "done"                                                # pre-flight DXA
    assert status["6035:30"] == "missed"                                                # nobody closed it
    assert status["6025:104"] == "booked"
    sent = notifications(queue)
    reminders = [b for _, topic, b in sent if topic == "plan.reminder"]
    assert reminders and all(b["notify"] == ["CM-1"] and b["priority"] == "info" for b in reminders)
    assert {b["item"]["id"] for b in reminders} >= {"6015:97", "6003:98"}             # open on day 95
    assert any(topic == "plan.missed" and b["item"]["id"] == "6035:30" for _, topic, b in sent)
    planner.refresh("CM-1")
    assert notifications(queue) == []                                                   # each one once
    assert len(data.results("CM-1", PLAN_KIND)) == 1                                    # replaced, not added


def test_the_plan_survives_a_restart(setup):
    mission, data, queue, clock, source = setup
    Planner(source, queue=queue).set_status("CM-1", "6035:60", "done", "CM-1", "ok")
    again = Planner(source, queue=queue).plan("CM-1")
    assert next(i for i in again["items"] if i["id"] == "6035:60")["status"] == "done"


def test_findings_from_the_queue_book_a_retest(setup):
    mission, data, queue, clock, source = setup
    planner = Planner(source, queue=queue)
    queue.publish("health.finding", {"type": "finding", "crew_id": "CM-2", "measure": "vo2peak",
                                     "mission_day": 95.0, "synthetic": True})
    assert planner.drain() >= 1
    plan = data.results("CM-2", PLAN_KIND)[0].payload["items"]
    retest = next(i for i in plan if i["type"] == "retest")
    assert retest["measure"] == "vo2peak" and retest["instrument"] == "cycle" and retest["window"]["day_from"] == 96.0


def test_simulated_crew(setup):
    mission, data, queue, clock, source = setup
    items = Planner(source, simulate_crew=True).refresh("CM-1")
    assert next(i for i in items if i["id"] == "6035:30")["completion"] == "simulated"


def test_api(setup):
    mission, data, queue, clock, source = setup
    planner = Planner(source, queue=queue)
    client = TestClient(create_app(planner))
    plan = client.get("/api/v1/plan", params={"crew": "CM-1"}).json()
    assert plan["version"] == 1 and plan["mission"]["today"] == 95.0 and plan["mission"]["todayLabel"] == "FD96"
    assert plan["source"]["document"] == "OCHMO-STD-100.1A" and len(plan["items"]) > 300
    past = client.get("/api/v1/plan", params={"crew": "CM-1", "day": 10}).json()
    assert next(i for i in past["items"] if i["id"] == "6035:30")["status"] == "booked"   # day= looks back, no save
    assert data.results("CM-1", PLAN_KIND) == []
    week = client.get("/api/v1/plan", params={"crew": "CM-1", "from_day": 95, "to_day": 102, "type": "study"}).json()
    assert week["items"] and all(i["type"] == "study" for i in week["items"])
    today = client.get("/api/v1/plan/today", params={"crew": "CM-1"}).json()["items"]
    assert today and all(i["status"] == "booked" and i["window"]["day_to"] >= 95 for i in today)
    r = client.post("/api/v1/plan/6035:60/status", params={"crew": "CM-1"}, json={"status": "done", "by": "CM-1"})
    assert r.status_code == 200 and r.json()["status"] == "done"
    assert client.post("/api/v1/plan/6035:60/status", params={"crew": "CM-1"},
                       json={"status": "missed"}).status_code == 409
    assert client.post("/api/v1/plan/nothing/status", params={"crew": "CM-1"},
                       json={"status": "done"}).status_code == 404
    assert client.post("/api/v1/plan/6035:150/status", params={"crew": "CM-1"},
                       json={"status": "later"}).status_code == 422
    assert client.get("/api/v1/plan", params={"crew": "CM-9"}).status_code == 404
    routines = client.get("/api/v1/routines").json()
    assert {r["id"] for r in routines["routines"]} >= {"6012", "6025", "6028", "6039"}
    assert "guide" not in routines["routines"][0]
    assert client.get("/api/v1/routines/6012").json()["guide"]["how"]
    assert client.get("/api/v1/routines/9999").status_code == 404
    assert client.get("/api/v1/health").json()["status"] == "ok"
