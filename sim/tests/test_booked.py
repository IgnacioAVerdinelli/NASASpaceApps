"""The generator runs the retests the analysis scheduler books (gravsim.serve.run_booked_studies).

Run from sim/:  python -m pytest -q
"""
import gravsim as gs
from gravsim.instruments import INSTRUMENTS
from gravsim.serve import run_booked_studies

DYNAMOMETER = INSTRUMENTS["dynamometer"].measures


def setup(studies, day=40):
    mission = gs.Mission("iss_180", launch_date="2027-03-01")
    mission.add_crew("CM-1", sex="M", seed=1)
    data = gs.DataService()
    data.save_result("CM-1", "study", mission.timestamp(day), {"studies": studies}, model_version="demo-scheduler-1")
    return mission, data


RETEST = {"id": "extra:knee_extension_60:39", "study": "retest", "measure": "knee_extension_60",
          "status": "scheduled", "reason": "finding"}


def test_a_retest_is_measured_when_its_day_comes():
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


def test_routine_studies_and_unknown_measures_are_left_alone():
    routine = {"id": "strength:44.0", "study": "strength", "status": "scheduled", "reason": "routine"}
    unknown = {**RETEST, "id": "extra:nothing:39", "measure": "nothing"}
    mission, data = setup([routine, unknown])
    assert run_booked_studies(mission, data, 60, set()) == 0
    assert data.readings("CM-1", start=mission.timestamp(40), end=mission.timestamp(40)) == []
