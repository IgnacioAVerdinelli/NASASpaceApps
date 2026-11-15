"""Layer 1, the watch (healthservice/vitals.py, GET /api/v1/vitals): personal band, deviations, findings."""
from datetime import datetime, timezone

import gravsim as gs
import pytest
from fastapi.testclient import TestClient

from healthservice import HealthService, MissionInfo, Phase
from healthservice import vitals
from healthservice.api import create_app
from healthservice.sources import GravsimSource

MISSION = MissionInfo(launch_date=datetime(2027, 1, 1, 12, tzinfo=timezone.utc), name="iss_180",
                      phases=[Phase("preflight", -180, 0, 1.0), Phase("flight", 0, 180, 0.0),
                              Phase("postflight", 180, 545, 1.0)])


def rec(day, value, measure="resting_hr", quality="ok"):
    return {"measure": measure, "mission_day": day, "timestamp": MISSION.timestamp(day), "value": value,
            "quality": quality}


def series(values, measure="resting_hr", first=100):
    return [rec(first + i, v, measure) for i, v in enumerate(values)]


STEADY = [60, 61, 59, 60, 62, 60, 61, 59, 60, 61, 60, 62, 59, 60]       # 14 days, mean 60.3, sd ~0.9 -> floor 2


def test_in_range_out_and_deviation():
    v = vitals.assess(MISSION, "resting_hr", series(STEADY + [61, 60, 62]))
    assert v["status"] == "in_range" and v["band"]["days"] == 14
    assert v["band"]["low"] == pytest.approx(60 - 4, abs=0.02)               # median 60, SD floor of 2 bpm, +-2 SD
    v = vitals.assess(MISSION, "resting_hr", series(STEADY + [60, 61, 70]))
    assert v["status"] == "out" and v["daysBeyond"] == 1 and v["text"] == "Above your usual range today"
    v = vitals.assess(MISSION, "resting_hr", series(STEADY + [69, 70, 71]))
    assert v["status"] == "deviation" and v["daysBeyond"] == 3 and v["changePct"] > 15
    assert v["text"] == "Higher than usual for the last 3 days" and v["recentMean"] == 70
    # three days a little high, none beyond the daily band: their mean still is (2.5 SD of a 3-day mean)
    v = vitals.assess(MISSION, "resting_hr", series(STEADY + [63.5, 63.5, 63.5]))
    assert v["status"] == "deviation" and v["daysBeyond"] == 0
    assert vitals.assess(MISSION, "resting_hr", series(STEADY + [62, 63, 62]))["status"] == "in_range"


def test_the_good_direction_is_not_a_deviation():
    v = vitals.assess(MISSION, "resting_hr", series(STEADY + [50, 50, 50]))
    assert v["status"] == "out" and v["daysBeyond"] == 0                     # lower resting heart rate: not bad
    hrv = vitals.assess(MISSION, "hrv_rmssd", series([45] * 14 + [30, 29, 28], "hrv_rmssd"))
    assert hrv["status"] == "deviation" and hrv["direction"] == "down"


def test_no_data_no_band_and_flagged_readings():
    assert vitals.assess(MISSION, "spo2", [])["status"] == "no_data"
    assert vitals.assess(MISSION, "resting_hr", series([60] * 8))["status"] == "no_band"
    flagged = series(STEADY + [61, 60, 62]) + [rec(117, None, quality="missing")]
    assert vitals.assess(MISSION, "resting_hr", flagged)["latest"]["day"] == 116


def test_spo2_under_the_floor_is_at_once():
    v = vitals.assess(MISSION, "spo2", series([97] * 14 + [97, 97, 90], "spo2"))
    assert v["status"] == "low_now"


def test_fatigue_pattern_needs_all_three():
    hr = vitals.assess(MISSION, "resting_hr", series(STEADY + [69, 70, 71]))
    hrv = vitals.assess(MISSION, "hrv_rmssd", series([45] * 14 + [30, 29, 28], "hrv_rmssd"))
    sleep = vitals.assess(MISSION, "sleep_hours", series([6.1] * 14 + [4.5, 4.4, 4.6], "sleep_hours"))
    assert vitals.patterns([hr, hrv, sleep])[0]["id"] == "fatigue"
    assert vitals.patterns([hr, hrv]) == []


def test_findings_open_once_and_clear():
    dev = vitals.assess(MISSION, "resting_hr", series(STEADY + [69, 70, 71]))
    (f,) = vitals.findings("CM-1", [dev], {})
    assert (f["state"], f["source"], f["measure"], f["episode_day"]) == ("suspected", "watch", "resting_hr", 114)
    assert vitals.findings("CM-1", [dev], {"resting_hr": f}) == []           # still open: nothing new
    noisy = vitals.assess(MISSION, "resting_hr", series(STEADY + [69, 70, 71, 62, 63, 64]))
    assert noisy["status"] != "deviation" and vitals.findings("CM-1", [noisy], {"resting_hr": f}) == []   # not settled yet
    back = vitals.assess(MISSION, "resting_hr", series(STEADY + [69, 70, 71, 60, 61, 60]))
    (c,) = vitals.findings("CM-1", [back], {"resting_hr": f})
    assert c["state"] == "cleared" and c["episode_day"] == 114 and vitals.dedupe(c) != vitals.dedupe(f)


def test_day_curves_and_context():
    day = 50.5                                       # 2027-02-20T00:00 UTC
    watch = [rec(day - 1 + m / 1440, 60 + m // 60, "watch_hr") for m in range(0, 1440, 15)]
    watch += [rec(day + m / 1440, 70, "watch_hr") for m in range(0, 600, 15)]
    curves = vitals.day_curves(MISSION, day + 0.4, watch, [rec(-3.5 + m / 1440, 58, "watch_hr") for m in range(0, 1440, 15)])
    assert len(curves["today"]) == 40 and len(curves["yesterday"]) == 96 and curves["week_ago"] == []
    assert curves["yesterday"][0] == {"minute": 0, "value": 60} and len(curves["preflight"]) == 96
    ctx = vitals.day_context(MISSION, day + 0.4, [{"start": MISSION.timestamp(day - 0.1), "end": MISSION.timestamp(day + 0.25),
                                                    "activity": "sleep"}, {"start": MISSION.timestamp(day + 0.3),
                                                    "end": MISSION.timestamp(day + 0.35), "activity": "work"}])
    assert ctx == [{"start": 0, "end": 360, "activity": "sleep"}]


@pytest.fixture(scope="module")
def tired():
    """A gravsim crew where CM-2 has a fatigue spell from day 120 for 6 days."""
    m = gs.Mission.random("iss_180", n_crew=2, seed=7)
    m.crew[1].add_fatigue(120, 6)
    return GravsimSource(mission=m, day=124.6)


def test_a_fatigue_spell_is_caught_by_the_watch(tired):
    service = HealthService(tired, process_on_read=False)
    out = service.vitals("CM-2")
    by = {v["measure"]: v for v in out["vitals"]}
    assert by["resting_hr"]["status"] == "deviation" and by["hrv_rmssd"]["status"] == "deviation"
    assert by["sleep_hours"]["status"] in ("deviation", "out")
    assert out["patterns"] and out["patterns"][0]["id"] == "fatigue"
    assert len(out["day"]["curves"]["yesterday"]) == 96 and len(out["day"]["curves"]["preflight"]) == 96
    assert {c["activity"] for c in out["day"]["context"]} >= {"sleep"}
    calm = {v["measure"]: v["status"] for v in service.vitals("CM-1")["vitals"]}
    assert "deviation" not in calm.values()
    before = {v["measure"]: v["status"] for v in service.vitals("CM-2", day=119.6)["vitals"]}
    assert "deviation" not in before.values()


def test_vitals_endpoint(tired):
    client = TestClient(create_app(HealthService(tired, process_on_read=False)))
    r = client.get("/api/v1/vitals", params={"crew": "CM-2"})
    assert r.status_code == 200 and r.json()["version"] == 1 and r.headers["cache-control"] == "no-store"
    assert [v["measure"] for v in r.json()["vitals"]] == vitals.MEASURES
    assert client.get("/api/v1/vitals", params={"crew": "CM-9"}).status_code == 404


def test_the_worker_publishes_watch_findings_for_the_planner(tmp_path):
    from unittest.mock import patch

    from gravsim.queue import Queue
    from gravsim.serve import data_routes

    from healthservice.demo import DemoWorker
    from healthservice.models import CrewInfo
    from healthservice.sources import DataServiceSource, mission_info

    class LocalSource(DataServiceSource):
        def __init__(self, mission, data, day):
            self._mission = mission_info(mission)
            self._crew = [CrewInfo(c.id, c.sex) for c in mission.crew]
            self.routes = data_routes(mission, data, lambda: day)

        def _request(self, method, path, query=None, body=None):
            return self.routes[method, path](query or {}, body)[1]

    queue = Queue(str(tmp_path / "queue.sqlite"))
    m = gs.Mission.random("iss_180", n_crew=2, seed=7)
    m.crew[1].add_fatigue(120, 6)
    data = gs.DataService()
    data.ingest(m.timeline(seed=7, until=124.6, instruments=["wearable", "watch"]))
    data.ingest_context(m.context())
    worker = DemoWorker(LocalSource(m, data, 124.6), queue)
    with patch.object(worker, "process_readings") as processed:
        worker.on_readings({"crew_id": "CM-2", "measures": ["watch_hr"]})
        processed.assert_not_called()                     # the 15-minute heart rate alone changes nothing
        worker.on_readings({"crew_id": "CM-2", "measures": ["resting_hr", "hrv_rmssd"]})
        processed.assert_not_called()
    worker.on_readings({"crew_id": "CM-2", "measures": ["sleep_hours"]})        # again: nothing new
    out = []
    while item := queue.next("t", "events"):
        queue.ack("t", item[0])
        out.append(item[2])
    watch = [f for f in out if f.get("source") == "watch"]
    assert watch and {f["state"] for f in watch} == {"suspected"}
    assert {f["measure"] for f in watch} >= {"resting_hr", "hrv_rmssd"}
    assert len(watch) == len({f["measure"] for f in watch})                    # once per vital and episode
    assert worker.findings.latest("CM-2")["resting_hr"]["source"] == "watch"
