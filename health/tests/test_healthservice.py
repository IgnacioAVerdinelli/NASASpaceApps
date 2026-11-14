"""Checks for the HealthService.

Most run on GravsimSource (gravsim's DataService in this process). The test_http_* ones start the DataService's
HTTP API (gravsim.serve) on a free port and check that DataServiceSource reads and saves the same over HTTP.
"""
import dataclasses
import math
import threading
from datetime import datetime, timezone

import gravsim as gs
import pytest
from fastapi.testclient import TestClient

from healthservice import CrewInfo, HealthService, MissionInfo, Phase, Reading, Reference, compute_results
from healthservice.alerts import CONFIDENCE, can_alert
from healthservice.api import create_app
from healthservice.contract import validate_dashboard
from healthservice.dashboard import build_dashboard
from healthservice.processing import MEASURES
from healthservice.sources import RESULT_KIND, DataServiceError, DataServiceSource, GravsimSource

DAYS = [-10, 0, 14, 50, 95, 120, 179.5, 200, 400]


@pytest.fixture(scope="module")
def source():
    return GravsimSource("iss_180", n_crew=4, seed=7, day=95)


@pytest.mark.parametrize("day", DAYS)
def test_dashboard_meets_the_contract(source, day):
    service = HealthService(source)
    for c in source.crew():
        validate_dashboard(service.dashboard(c.id, day))


# --------------------------------------------------------------------------- the calculation, by hand

MISSION = MissionInfo(launch_date=datetime(2027, 1, 1, 12, tzinfo=timezone.utc), name="iss_180",
                      phases=[Phase("preflight", -180, 0, 1.0), Phase("flight", 0, 180, 0.0),
                              Phase("postflight", 180, 545, 1.0)])
ANA = CrewInfo("CM-1", "F")


def knee(day, value, quality="ok"):
    return Reading("CM-1", "knee_extension_60", day, MISSION.timestamp(day), value, "N·m", quality=quality,
                   synthetic=True)


def test_results_and_dashboard_by_hand():
    reference = Reference.load()
    readings = [knee(-60, 100.0), knee(-30, 110.0), knee(30, 94.5), knee(60, 84.0),
                knee(62, 10.0, "out_of_range"), knee(63, None, "missing")]       # flagged: not measurements
    results = {r.measure: r for r in compute_results(reference, MISSION, ANA, readings, 65)}

    res = results["knee_extension_60"]
    assert res.reference_value == 105.0 and res.reference_n == 2           # mean of the two pre-flight tests
    assert (res.last_mission_day, res.last_value, res.change_pct) == (60, 84.0, -20.0)        # 84 / 105 - 1
    assert (res.previous_mission_day, res.previous_change_pct) == (30, -10.0)                 # 94.5 / 105 - 1
    assert res.unloaded_days == 65                                         # all of the flight so far
    m = reference.measure("knee_extension_60")
    no_exercise = m["loss_pct"] * (1 - math.exp(-65 / m["tau_days"]))
    assert res.typical_no_exercise_pct == pytest.approx(no_exercise)
    assert res.typical_exercise_pct == pytest.approx(no_exercise * (1 - m["exercise_effect"]))
    score = round(100 * 20 / max(abs(m["loss_pct"]), 10), 1)
    assert res.score == score
    assert results["hip_bmd"].change_pct is None and results["hip_bmd"].reference_value is None

    d = validate_dashboard(build_dashboard(reference, MISSION, ANA, readings, list(results.values()), 65))
    assert d["updatedAt"] == "2027-03-07T12:00:00Z" and d["simulated"] is True
    assert d["summary"]["title"] == "CM-1 · FD66"
    assert d["body"]["body"] == "female"
    assert d["body"]["scores"] == {"quadriceps_l": score, "quadriceps_r": score}
    item = d["summary"]["items"][0]
    assert item["changePercent"] == -20.0 and "latest FD61" in item["description"]
    chart = d["charts"][0]
    assert [(p["at"], p["value"]) for p in chart["points"]] == [
        ("2026-11-02T12:00:00Z", 95.2), ("2026-12-02T12:00:00Z", 104.8),
        ("2027-01-31T12:00:00Z", 90.0), ("2027-03-02T12:00:00Z", 80.0)]
    assert chart["insight"] == (f"-20% since pre-flight. After 65 days without gravity, bed-rest subjects changed "
                                f"about {no_exercise:+.0f}% without exercise and "
                                f"{no_exercise * (1 - m['exercise_effect']):+.0f}% with it.")
    assert all(c["points"] == [] for c in d["charts"][1:])


def test_mission_labels_and_days():
    assert [MISSION.label(d) for d in [-30, -0.5, 0, 12.3, 179.9, 180, 185]] == [
        "L-30", "L-1", "FD1", "FD13", "FD180", "R+0", "R+5"]
    assert MISSION.day_of("2027-03-07T12:00:00Z") == 65
    assert MISSION.day_of(MISSION.timestamp(-42.25)) == -42.25


def test_unloaded_days_match_gravsim(source):
    for day in [-200, -180, -1, 0, 0.5, 13.7, 90, 179.9, 180, 181, 545, 600]:
        assert source.mission().unloaded_days(day) == pytest.approx(source.sim_mission.unloaded_days(day)), day


def test_a_reading_without_mission_day_is_placed_by_its_timestamp():
    record = {"crew_id": "CM-1", "measure": "hip_bmd", "mission_day": None, "timestamp": "2027-03-07T12:00:00Z",
              "value": 1.0, "unit": "g/cm²"}
    assert Reading.from_record(record, MISSION).mission_day == 65
    with pytest.raises(ValueError):
        Reading.from_record(record)


def test_truth_never_reaches_the_service(source):
    fields = {f.name for f in dataclasses.fields(Reading)}
    assert "truth" not in fields and "status" not in fields
    assert all(isinstance(r, Reading) for r in source.readings("CM-1", 500))


# --------------------------------------------------------------------------- saving results

def test_results_saved_only_when_new_readings_arrive():
    now = [0.0]
    src = GravsimSource("iss_180", n_crew=2, seed=7, day=20, speed=60, clock=lambda: now[0])
    service = HealthService(src)
    service.dashboard("CM-1")
    saved = len(src.saved_results)
    assert saved > 0
    for _ in range(5):                               # the front polling with no new data
        service.dashboard("CM-1")
    assert len(src.saved_results) == saved
    now[0] = 60.0                                    # one real minute = 60 mission days later
    service.dashboard("CM-1")
    assert len(src.saved_results) > saved


def test_results_are_saved_as_one_record_per_moment():
    src = GravsimSource("iss_180", n_crew=2, seed=7, day=95)
    HealthService(src).dashboard("CM-2")
    [saved] = src.saved_results
    assert (saved.crew_id, saved.kind, saved.timestamp) == ("CM-2", RESULT_KIND, "2027-04-06T12:00:00Z")
    assert saved.payload["mission_day"] == 95
    assert list(saved.payload["measures"]) == MEASURES
    assert saved.payload["measures"]["knee_extension_60"]["change_pct"] is not None


def test_looking_at_a_past_day_saves_nothing():
    src = GravsimSource("iss_180", n_crew=2, seed=7, day=95)
    HealthService(src).dashboard("CM-1", day=50)
    assert src.saved_results == []


# --------------------------------------------------------------------------- alerts

class FlightClock:
    """A fake clock for GravsimSource(day=0, speed=1): one mission day per minute from launch."""

    def __init__(self):
        self.seconds = 0.0

    def __call__(self):
        return self.seconds


def walk_flight(service, clock, step_days=5):
    """Poll every crew member's live dashboard from launch to landing, `step_days` mission days apart."""
    src = service.source
    for day in range(0, int(src.mission().landing) + 1, step_days):
        clock.seconds = day * 60.0
        for c in src.crew():
            service.dashboard(c.id)
    return service.queue.items()


def flight(**kwargs):
    clock = FlightClock()
    return HealthService(GravsimSource(day=0, speed=1, clock=clock, **kwargs)), clock


def test_no_false_alerts_for_the_demo_crew():
    # gravsim's truth says nobody in this crew goes beyond the typical loss without exercise; the old
    # one-test rule raised alerts here (evaluation/alert_rule.py)
    assert walk_flight(*flight(n_crew=4, seed=7)) == []


def exercising_and_not():
    """CM-1 follows the exercise routine; CM-2 skips it and loses fast."""
    m = gs.Mission("iss_180")
    m.add_crew("CM-1", adherence=1.0, seed=1)
    m.add_crew("CM-2", adherence=0.0, responder="fast", seed=2)
    return m


def test_skipping_exercise_is_alerted_and_exercising_is_not():
    published = walk_flight(*flight(mission=exercising_and_not(), seed=7))
    assert {a.crew_id for a in published} == {"CM-2"}
    for a in published:
        assert a.severity == "warning" and a.synthetic
        assert "beyond the typical change without exercise" in a.message


def test_an_alert_is_published_once_while_it_lasts():
    published = walk_flight(*flight(mission=exercising_and_not(), seed=7), step_days=1)
    assert published
    keys = [(a.crew_id, a.measure) for a in published]
    assert len(keys) == len(set(keys))           # each measure keeps alerting on later tests, but is published once


def test_only_measures_that_can_show_a_loss_alert():
    reference, mission = Reference.load(), MISSION
    # ankle dorsiflexion (about -7% without exercise against 12% test noise) and arm lean mass (no change
    # in bed rest) cannot show a loss beyond the typical one
    assert not can_alert(reference, mission, "ankle_dorsiflexion_30", 2)
    assert not can_alert(reference, mission, "lean_arms", 1)
    for measure in ["knee_extension_60", "knee_flexion_60", "ankle_plantarflexion_30", "trunk_extension_60",
                    "vo2peak"]:
        assert can_alert(reference, mission, measure, 2), measure
    assert can_alert(reference, mission, "hip_bmd", 1)


def test_the_evaluation_scores_the_implemented_rule():
    from evaluation.alert_rule import designed_cases, mean_of_two, measurable

    rule = measurable(mean_of_two(CONFIDENCE))
    points = designed_cases(Reference.load(), n=3)
    assert any(p.service for p in points)
    assert all(p.service == rule(p) for p in points)


# --------------------------------------------------------------------------- the HealthService's API

def test_api(source):
    client = TestClient(create_app(HealthService(source)))
    r = client.get("/api/v1/dashboard", headers={"Accept": "application/json", "Origin": "http://localhost:5173"})
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["access-control-allow-origin"] == "*"
    validate_dashboard(r.json())
    assert client.get("/api/v1/dashboard?crew=CM-3&day=150").json()["summary"]["title"].startswith("CM-3")
    missing = client.get("/api/v1/dashboard?crew=NOPE")
    assert missing.status_code == 404 and "CM-1" in missing.json()["crew"]
    assert client.get("/api/v1/health").json()["status"] == "ok"
    assert isinstance(client.get("/api/v1/alerts").json(), list)


def test_api_when_the_dataservice_is_down(source):
    class Down(GravsimSource):
        def current_day(self):
            raise DataServiceError("GET http://localhost:8000/api/v1/mission failed: connection refused")

    down = Down.__new__(Down)
    down.__dict__.update(source.__dict__)
    client = TestClient(create_app(HealthService(down)))
    r = client.get("/api/v1/dashboard")
    assert r.status_code == 503 and "connection refused" in r.json()["error"]
    assert r.headers["cache-control"] == "no-store"


# --------------------------------------------------------------------------- the DataService over HTTP

@pytest.fixture(scope="module")
def dataservice():
    """gravsim.serve's API for the crew `source` has (seed 7), on a free port, with the clock stopped at day 95."""
    from gravsim.serve import data_routes, make_server

    mission = gs.Mission.random("iss_180", n_crew=4, seed=7)
    data = gs.DataService()
    data.ingest(mission.timeline(seed=7))
    server = make_server(data_routes(mission, data, lambda: 95.0), port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}", data
    server.shutdown()
    server.server_close()


def test_http_source_reads_the_same_as_in_process(dataservice, source):
    url, _ = dataservice
    http = DataServiceSource(url)
    assert http.mission().phases == source.mission().phases
    assert http.mission().launch_date == source.mission().launch_date
    assert http.crew() == source.crew()
    assert http.current_day() == 95.0
    for c in source.crew():
        assert http.readings(c.id, 150) == source.readings(c.id, 150)
    ours, theirs = HealthService(http), HealthService(source)
    for day in [-10, 95, 200]:
        assert ours.dashboard("CM-2", day) == theirs.dashboard("CM-2", day)


def test_http_source_saves_results(dataservice):
    url, data = dataservice
    HealthService(DataServiceSource(url)).dashboard("CM-3")
    [saved] = data.results("CM-3", RESULT_KIND)
    assert saved.timestamp == "2027-04-06T12:00:00Z" and list(saved.payload["measures"]) == MEASURES


def test_http_source_says_when_the_dataservice_is_not_there():
    with pytest.raises(DataServiceError):
        DataServiceSource("http://127.0.0.1:9", timeout=1)
