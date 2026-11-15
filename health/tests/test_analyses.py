"""Checks for the flight-measurement JSON (GET /api/v1/analyses, healthservice/analyses.py)."""
import threading
from datetime import datetime, timezone

import gravsim as gs
import pytest
from fastapi.testclient import TestClient

from healthservice import CrewInfo, HealthService, MissionInfo, Phase, Reading, Reference, compute_results
from healthservice.alerts import check
from healthservice.analyses import build_analyses
from healthservice.api import create_app
from healthservice.contract import validate_analyses
from healthservice.levels import LEVELS, level_of, noise_band, within_noise
from healthservice.sources import STUDY_KIND, DataServiceSource, GravsimSource

MISSION = MissionInfo(launch_date=datetime(2027, 1, 1, 12, tzinfo=timezone.utc), name="iss_180",
                      phases=[Phase("preflight", -180, 0, 1.0), Phase("flight", 0, 180, 0.0),
                              Phase("postflight", 180, 545, 1.0)])
ANA = CrewInfo("CM-1", "F")


@pytest.fixture(scope="module")
def source():
    return GravsimSource("iss_180", n_crew=4, seed=7, day=95)


def reading(measure, day, value, quality="ok", unit="N·m"):
    return Reading("CM-1", measure, day, MISSION.timestamp(day), value, unit, quality=quality, synthetic=True)


@pytest.mark.parametrize("day", [-100, -10, 0, 14, 50, 95, 170, 179.5, 200, 400, 545])
def test_analyses_meet_the_contract(source, day):
    service = HealthService(source)
    for c in source.crew():
        validate_analyses(service.analyses(c.id, day))


def test_levels():
    reference = Reference.load()
    knee = "knee_extension_60"
    assert [level_of(reference, knee, c) for c in [None, 12.0, 0, -4.9, -5, -9.9, -10, -19.9, -20, -35]] == [
        None, 1, 1, 1, 2, 2, 3, 3, 4, 4]
    # VO2peak below NASA's in-mission minimum is level 4 whatever its change
    assert reference.minimum("vo2peak") == 32.9 and reference.minimum(knee) is None
    assert level_of(reference, "vo2peak", -3.0, 32.8) == 4
    assert level_of(reference, "vo2peak", -3.0, 33.0) == 1
    assert [item["level"] for item in LEVELS] == [1, 2, 3, 4]
    # one knee test against a 2-test reference: 1.645 * 8.35 * sqrt(1.5) = 16.8 points
    assert noise_band(reference, knee, 2) == 16.8
    assert within_noise(reference, knee, -16.7, 2) and not within_noise(reference, knee, -16.9, 2)


def test_analyses_by_hand():
    reference = Reference.load()
    readings = [reading("knee_extension_60", -60, 100.0), reading("knee_extension_60", -30, 110.0),
                reading("knee_extension_60", 14, 94.5), reading("knee_extension_60", 44, 10.0, "out_of_range"),
                reading("knee_extension_60", 74, 81.9),
                reading("trunk_flexion_60", 74, 50.0),                 # left out, as on the dashboard
                reading("vo2peak", -30, 40.0, unit="ml/kg/min"), reading("vo2peak", 13, 33.0, unit="ml/kg/min"),
                reading("vo2peak", 74, 32.0, unit="ml/kg/min")]
    results = compute_results(reference, MISSION, ANA, readings, 80)
    alerts = check(reference, MISSION, results)
    studies = [{"day": 104.0, "study": "strength", "reason": "routine"},
               {"day": 81.0, "study": "retest", "measure": "vo2peak", "reason": "finding"},
               {"day": 60.0, "study": "aerobic_capacity", "reason": "routine"}]              # past: not upcoming
    a = validate_analyses(build_analyses(reference, MISSION, ANA, readings, results, alerts, studies, 80))

    s = a["strength"]
    assert [e["id"] for e in s["evaluations"]] == ["pre", "d14", "d44", "d74"]
    assert [e["label"] for e in s["evaluations"]] == ["Pre-flight", "FD15", "FD45", "FD75"]
    assert [g["key"] for g in s["groups"]] == ["quadriceps", "hamstrings", "calves", "shins", "back"]
    q = s["groups"][0]
    assert q["baseline"] == 105.0 and q["referenceTests"] == 2 and q["unit"] == "N·m"
    assert [p["changePct"] for p in q["points"]] == [0.0, -10.0, None, -22.0]
    assert [p["level"] for p in q["points"]] == [1, 3, None, 4]
    assert [p["quality"] for p in q["points"]] == ["ok", "ok", "out_of_range", "ok"]
    assert [p["withinNoise"] for p in q["points"]] == [True, True, None, False]
    assert s["groups"][1]["points"][1]["quality"] == "not measured"
    assert s["upcoming"] == [{"day": 104.0, "label": "FD105", "reason": "routine"}]

    v = a["aerobic"]
    assert v["baseline"] == 40.0 and v["minimum"] == 32.9 and v["unit"] == "ml/kg/min"
    assert [(e["label"], e["changePct"], e["level"], e["belowMinimum"]) for e in v["evaluations"]] == [
        ("Pre-flight", 0.0, 1, False), ("FD14", -17.5, 3, False), ("FD75", -20.0, 4, True)]
    assert v["evaluations"][1]["test"] is None
    # the mean of the last two VO2peak tests (32.5) is below 32.9: NASA's standard is crossed
    assert v["alert"]["severity"] == "critical" and v["alert"]["rule"] == "nasa_standard"
    assert "below NASA's in-mission minimum" in v["alert"]["message"]
    assert v["upcoming"] == [{"day": 81.0, "label": "FD82", "reason": "retest"}]


def test_one_test_past_the_standard_is_shown_but_not_alerted():
    reference = Reference.load()
    readings = [reading("vo2peak", -30, 40.0, unit="ml/kg/min"), reading("vo2peak", 13, 39.0, unit="ml/kg/min"),
                reading("vo2peak", 74, 31.0, unit="ml/kg/min")]
    results = compute_results(reference, MISSION, ANA, readings, 80)
    a = build_analyses(reference, MISSION, ANA, readings, results, check(reference, MISSION, results), [], 80)
    assert a["aerobic"]["evaluations"][-1]["level"] == 4
    assert a["aerobic"]["alert"] is None or a["aerobic"]["alert"]["rule"] != "nasa_standard"


def test_the_page_and_the_dashboard_agree(source):
    service = HealthService(source)
    for c in source.crew():
        dash = {item["id"]: item for item in service.dashboard(c.id, 150)["summary"]["items"]}
        for g in service.analyses(c.id, 150)["strength"]["groups"]:
            last = next(p for p in reversed(g["points"]) if p["changePct"] is not None)
            assert last["changePct"] == dash[g["key"]]["changePercent"]
            assert g["muscleKeys"] == dash[g["key"]]["muscleKeys"]


def test_the_page_shows_the_alerts_the_queue_gets():
    clock_minutes = [0.0]
    m = gs.Mission("iss_180")
    m.add_crew("CM-1", adherence=0.0, responder="fast", seed=2)
    service = HealthService(GravsimSource(day=0, speed=1, clock=lambda: clock_minutes[0] * 60, mission=m, seed=7))
    shown = set()
    for day in range(0, 181, 5):
        clock_minutes[0] = day
        a = service.analyses("CM-1")
        shown |= {(g["measure"], g["alert"]["severity"]) for g in a["strength"]["groups"] if g["alert"]}
        if a["aerobic"]["alert"]:
            shown.add(("vo2peak", a["aerobic"]["alert"]["severity"]))
    queued = {(alert.measure, alert.severity) for alert in service.queue.items()}
    assert queued and shown == queued


def test_api(source):
    client = TestClient(create_app(HealthService(source)))
    r = client.get("/api/v1/analyses?crew=CM-2&day=150")
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    assert validate_analyses(r.json())["crew"]["id"] == "CM-2"
    missing = client.get("/api/v1/analyses?crew=NOPE")
    assert missing.status_code == 404 and "CM-1" in missing.json()["crew"]


def test_upcoming_tests_come_from_the_scheduler_over_http():
    from gravsim.serve import data_routes, make_server

    mission = gs.Mission.random("iss_180", n_crew=2, seed=7)
    data = gs.DataService()
    data.ingest(mission.timeline(seed=7))
    data.save_result("CM-1", STUDY_KIND, mission.timestamp(134), {"studies": [
        {"id": "strength:134", "study": "strength", "status": "scheduled", "reason": "routine"}]})
    data.save_result("CM-1", STUDY_KIND, mission.timestamp(96), {"studies": [
        {"id": "extra:vo2peak:95", "study": "retest", "measure": "vo2peak", "status": "scheduled", "reason": "finding"}]})
    server = make_server(data_routes(mission, data, lambda: 95.0), port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        source = DataServiceSource(f"http://127.0.0.1:{server.server_address[1]}")
        a = HealthService(source).analyses("CM-1")
        assert a["strength"]["upcoming"] == [{"day": 134.0, "label": "FD135", "reason": "routine"}]
        assert a["aerobic"]["upcoming"] == [{"day": 96.0, "label": "FD97", "reason": "retest"}]
        assert HealthService(source).analyses("CM-2")["strength"]["upcoming"] == []
    finally:
        server.shutdown()
        server.server_close()
