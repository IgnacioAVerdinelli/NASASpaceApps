"""Checks for the HealthService.

The parity tests compare against gravsim's own dashboard builder, which the HealthService is ported from:
same readings and day in, same numbers out.
"""
import dataclasses

import gravsim as gs
import pytest
from fastapi.testclient import TestClient

from gravsim.dashboard import build_dashboard as gravsim_dashboard
from gravsim.dashboard import validate
from healthservice import HealthService, Reading, Reference
from healthservice.alerts import CONFIDENCE, can_alert
from healthservice.api import create_app
from healthservice.sources import GravsimSource

DAYS = [-10, 0, 14, 50, 95, 120, 179.5, 200, 400]


@pytest.fixture(scope="module")
def source():
    return GravsimSource("iss_180", n_crew=4, seed=7, day=95)


def comparable(d):
    d = dict(d, summary=dict(d["summary"]))
    d["summary"].pop("notice")                      # wording differs on purpose
    return d


@pytest.mark.parametrize("day", DAYS)
def test_same_dashboard_as_gravsim(source, day):
    service = HealthService(source)
    for cm in source.sim_mission.crew:
        ours = service.dashboard(cm.id, day)
        theirs = gravsim_dashboard(source.sim_mission, cm, day, readings=source.sim_readings)
        assert comparable(ours) == comparable(theirs), (cm.id, day)


@pytest.mark.parametrize("day", DAYS)
def test_dashboard_meets_the_contract(source, day):
    service = HealthService(source)
    for c in source.crew():
        validate(service.dashboard(c.id, day))


def test_unloaded_days_match_gravsim(source):
    for day in [-200, -180, -1, 0, 0.5, 13.7, 90, 179.9, 180, 181, 545, 600]:
        assert source.mission().unloaded_days(day) == pytest.approx(source.sim_mission.unloaded_days(day)), day


def test_truth_never_reaches_the_service(source):
    fields = {f.name for f in dataclasses.fields(Reading)}
    assert "truth" not in fields and "status" not in fields
    assert all(isinstance(r, Reading) for r in source.readings("CM-1", 500))


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


def test_looking_at_a_past_day_saves_nothing(source):
    src = GravsimSource("iss_180", n_crew=2, seed=7, day=95)
    HealthService(src).dashboard("CM-1", day=50)
    assert src.saved_results == []


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
    # one-test rule raised 23 alerts here (evaluation/alert_rule.py)
    assert walk_flight(*flight(n_crew=4, seed=7)) == []


def test_skipping_exercise_is_alerted_and_exercising_is_not():
    m = gs.Mission("iss_180")
    m.add_crew("CM-1", adherence=1.0, seed=1)
    m.add_crew("CM-2", adherence=0.0, responder="fast", seed=2)
    published = walk_flight(*flight(mission=m, seed=7))
    assert {a.crew_id for a in published} == {"CM-2"}
    for a in published:
        assert a.severity == "warning" and a.synthetic
        assert "beyond the typical change without exercise" in a.message


def test_an_alert_is_published_once_while_it_lasts():
    m = gs.Mission("iss_180")
    m.add_crew("CM-1", adherence=0.0, responder="fast", seed=2)
    published = walk_flight(*flight(mission=m, seed=7), step_days=1)
    assert published
    keys = [(a.crew_id, a.measure) for a in published]
    assert len(keys) == len(set(keys))           # each measure keeps alerting on later tests, but is published once


def test_only_measures_that_can_show_a_loss_alert():
    reference, mission = Reference.load(), GravsimSource(n_crew=1).mission()
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


def test_api(source):
    client = TestClient(create_app(HealthService(source)))
    r = client.get("/api/v1/dashboard", headers={"Accept": "application/json", "Origin": "http://localhost:5173"})
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["access-control-allow-origin"] == "*"
    validate(r.json())
    assert client.get("/api/v1/dashboard?crew=CM-3&day=150").json()["summary"]["title"].startswith("CM-3")
    missing = client.get("/api/v1/dashboard?crew=NOPE")
    assert missing.status_code == 404 and "CM-1" in missing.json()["crew"]
    assert client.get("/api/v1/health").json()["status"] == "ok"
    assert isinstance(client.get("/api/v1/alerts").json(), list)
