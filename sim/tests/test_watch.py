"""The watch (gravsim.Watch): heart rate every 15 minutes and the night's sleep; fatigue spells it should catch.

Run from sim/:  python -m pytest -q
"""
import numpy as np
import pytest

import gravsim as gs
from gravsim.instruments import day_heart_rate


@pytest.fixture
def crew():
    m = gs.Mission("iss_180", launch_date="2027-03-01")
    return m.add_crew("CM-1", sex="F", seed=4)


def test_a_day_of_watch_readings(crew):
    rs = gs.Watch(seed=1).measure_all(crew, 50)
    hr = [r for r in rs if r.measure == "watch_hr"]
    assert len(hr) == 96 and all(r.instrument == "watch" and r.unit == "bpm" for r in hr)
    assert hr[1].mission_day - hr[0].mission_day == pytest.approx(15 / 1440, abs=1e-3)
    sleep = {r.measure: r for r in rs if r.measure != "watch_hr"}
    assert set(sleep) == {"sleep_hours", "sleep_quality"}
    assert sleep["sleep_hours"].timestamp.endswith("T06:00:00Z")
    assert 1 <= sleep["sleep_quality"].value <= 7 and 2 <= sleep["sleep_hours"].value <= 10


def test_watch_heart_rate_follows_the_day_trace(crew):
    true, _ = day_heart_rate(crew, 50)
    hr = [r.value for r in gs.Watch(noise=0).measure_all(crew, 50) if r.measure == "watch_hr"]
    assert hr == pytest.approx([round(true[m:m + 15].mean()) for m in range(0, 1440, 15)], abs=1)


def test_less_sleep_in_flight_than_on_the_ground(crew):
    w = gs.Watch(noise=0)
    ground = np.mean([w.sleep_true(crew, d)[0] for d in range(-60, -10)])
    flight = np.mean([w.sleep_true(crew, d)[0] for d in range(20, 150)])
    assert ground == pytest.approx(6.9, abs=0.25) and flight == pytest.approx(6.09, abs=0.25)    # Barger 2014


def test_a_fatigue_spell_shows_on_the_wearable_and_the_watch_only(crew):
    before = {m: crew.true_value(m, 132) for m in ("resting_hr", "hrv_rmssd", "vo2peak", "knee_extension_60")}
    sleep_before = gs.Watch(noise=0).sleep_true(crew, 132)
    crew.add_fatigue(130, 6)
    assert crew.fatigue(129) == 0 and crew.fatigue(133) == 1 and crew.fatigue(137) == 0
    assert crew.true_value("resting_hr", 132) == pytest.approx(before["resting_hr"] * 1.12)
    assert crew.true_value("hrv_rmssd", 132) == pytest.approx(before["hrv_rmssd"] * 0.70)
    assert crew.true_value("vo2peak", 132) == before["vo2peak"]
    assert crew.true_value("knee_extension_60", 132) == before["knee_extension_60"]
    hours, score = gs.Watch(noise=0).sleep_true(crew, 132)
    assert hours < sleep_before[0] - 1 and score < sleep_before[1] - 1


def test_the_timeline_carries_the_watch_every_day():
    m = gs.Mission("iss_180", launch_date="2027-03-01")
    m.add_crew("CM-1", seed=2)
    tl = m.timeline(seed=2, until=2, instruments=["watch"])
    assert {r.measure for r in tl} == {"watch_hr", "sleep_hours", "sleep_quality"}
    assert sum(r.measure == "sleep_hours" for r in tl) == len({r.timestamp[:10] for r in tl if r.measure == "sleep_hours"})


def test_store_query_filters_measures_in_sql():
    data = gs.DataService(store=gs.SqliteStore())
    m = gs.Mission("iss_180", launch_date="2027-03-01")
    c = m.add_crew("CM-1", seed=2)
    data.ingest(gs.Watch(seed=1).measure_all(c, 10) + gs.Wearable(seed=1).measure_all(c, 10))
    assert {r.measure for r in data.store.query("CM-1", ["resting_hr"])} == {"resting_hr"}
    assert data.store.query("CM-1", []) == []
    assert len(data.readings("CM-1", "watch_hr")) == 96
