"""The generator runs the retests the Planner books (gravsim.serve.run_booked_studies, docs/planner.md).

Run from sim/:  python -m pytest -q
"""
import gravsim as gs
from gravsim.instruments import INSTRUMENTS
from gravsim.serve import run_booked_studies

DYNAMOMETER = INSTRUMENTS["dynamometer"].measures


def item(iid, kind, day, measure=None, status="booked", reason="finding"):
    return {"id": iid, "type": kind, "measure": measure, "status": status, "reason": reason,
            "window": {"day_from": day, "day_to": day + 7, "day": day}}


def setup(items):
    mission = gs.Mission("iss_180", launch_date="2027-03-01")
    mission.add_crew("CM-1", sex="M", seed=1)
    data = gs.DataService()
    data.save_result("CM-1", "plan", mission.timestamp(-180), {"items": items}, model_version="planner-1")
    return mission, data


RETEST = item("retest:knee_extension_60:39", "retest", 40.0, "knee_extension_60")


def test_a_retest_is_measured_when_its_window_opens():
    mission, data = setup([RETEST])
    at = mission.timestamp(40)
    assert run_booked_studies(mission, data, 39.5, set()) == 0
    assert data.readings("CM-1", DYNAMOMETER, start=at, end=at) == []
    done = set()
    assert run_booked_studies(mission, data, 40.2, done) == 1
    readings = data.readings("CM-1", DYNAMOMETER, start=at, end=at)
    assert sorted({r.measure for r in readings}) == sorted(DYNAMOMETER)
    assert all(r.instrument == "dynamometer" and r.synthetic for r in readings)
    assert run_booked_studies(mission, data, 41, done) == 0            # once
    assert run_booked_studies(mission, data, 41, set()) == 0           # nor again after a restart
    assert len(data.readings("CM-1", DYNAMOMETER, start=at, end=at)) == len(readings)


def test_routine_studies_closed_retests_and_unknown_measures_are_left_alone():
    routine = item("6025:44", "study", 41.0, reason="routine")
    cancelled = item("retest:vo2peak:39", "retest", 40.0, "vo2peak", status="cancelled")
    unknown = item("retest:nothing:39", "retest", 40.0, "nothing")
    mission, data = setup([routine, cancelled, unknown])
    assert run_booked_studies(mission, data, 60, set()) == 0
    assert data.readings("CM-1", start=mission.timestamp(40), end=mission.timestamp(41)) == []
