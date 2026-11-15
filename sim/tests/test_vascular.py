"""The jugular vein ultrasound (gravsim.JugularUltrasound, OCHMO-STD-100.1A [6041]): flow anomalies and thrombosis
of the internal jugular veins simulated from published group results (docs/investigacion-yugular.md). The crew as a
whole must reproduce the published shares.

Run from sim/:  python -m pytest -q
"""
import numpy as np
import pytest

import gravsim as gs
from gravsim.vascular import VASCULAR_MEASURES, profile


def people(n=1200):
    m = gs.Mission("iss_180", launch_date="2027-03-01")
    return m, [m.add_crew(f"CM-{i}", seed=3000 + i) for i in range(n)]


def state(c, day, side="left"):
    return profile(c).state(c, day, side)


def test_one_exam_reads_every_measure_of_both_veins_in_its_unit():
    m, (cm, *_) = people(1)
    rs = gs.JugularUltrasound(seed=1).measure_all(cm, 30)
    assert [r.measure for r in rs] == list(VASCULAR_MEASURES) * 2
    assert [r.side for r in rs] == ["right"] * len(VASCULAR_MEASURES) + ["left"] * len(VASCULAR_MEASURES)
    assert all(r.instrument == "vascular" and r.unit == gs.MEASURES[r.measure]["unit"] for r in rs)
    assert all(gs.LIMITS[r.measure][0] <= r.value <= gs.LIMITS[r.measure][1] for r in rs)
    assert {r.unit for r in rs} <= set(gs.UNITS) and "veins" in gs.GROUPS


def test_the_crew_reproduces_the_published_shares():
    m, crew = people()
    for day, stagnant, retro in ((50, 0.55, 0.10), (150, 0.30, 0.10)):   # Marshall-Goebel 2019, flight days 50 and 150
        g = np.array([state(c, day)["ijv_flow_grade"] for c in crew])
        assert np.mean(g >= 3) == pytest.approx(stagnant, abs=0.07)
        assert np.mean(g == 4) == pytest.approx(retro, abs=0.05)
    echo = np.array([state(c, 50)["ijv_echogenicity"] for c in crew])
    assert np.mean(echo >= 1) == pytest.approx(6 / 11, abs=0.1)                      # Pavela 2022
    right = [state(c, 50, "right") for c in crew]
    assert np.mean([s["ijv_flow_grade"] >= 3 for s in right]) < 0.08                 # the left vein carries it
    assert max(s["ijv_echogenicity"] for s in right if s["ijv_compressible"]) <= 1   # never more than mild on the right
    area = {d: np.mean([state(c, d)["ijv_csa"] for c in crew]) for d in (-90, 50, 150)}
    assert area[-90] == pytest.approx(80.7, abs=6) and area[50] == pytest.approx(70.3, abs=5)
    assert area[150] == pytest.approx(60.0, abs=5)
    pre = np.array([state(c, -90)["ijv_flow_grade"] for c in crew])
    assert set(pre) <= {1.0, 2.0} and np.mean(pre == 2) == pytest.approx(10 / 11, abs=0.08)   # supine on Earth
    clots = np.mean([profile(c).thrombus is not None for c in crew])
    assert 0.03 < clots < 0.12                                                       # 2 in ~22 astronauts studied


def test_the_area_returns_within_days_of_landing():
    m, (cm, *_) = people(1)
    v = [state(cm, d)["ijv_csa"] for d in (-90, 60, m.landing + 5, m.landing + 45)]
    assert v[1] < v[0] and abs(v[2] - v[0]) < 0.05 * v[0] and v[3] == pytest.approx(v[0])


def test_a_thrombus_stops_flow_and_the_vein_does_not_collapse_until_it_lies_flat():
    m, (cm, *_) = people(1)
    gs.add_thrombus(cm, 55)
    before, during, after = (state(cm, d) for d in (50, 60, m.landing + 45))
    assert before["ijv_compressible"] == 1 and during["ijv_compressible"] == 0 and during["ijv_peak_velocity"] == 0
    assert during["ijv_flow_grade"] == 3 and during["ijv_echogenicity"] == 2
    assert after["ijv_compressible"] == 1 and state(cm, 60, "right")["ijv_compressible"] == 1
    r = gs.JugularUltrasound(seed=3).measure(cm, 60, "ijv_compressible", "left")
    assert r.value == 0 and r.truth["thrombus"] is True
    with pytest.raises(ValueError):
        gs.add_thrombus(cm, -10)
    with pytest.raises(ValueError):
        gs.add_thrombus(cm, 50, side="middle")


def test_a_chosen_stasis_makes_the_left_vein_stagnant_in_flight():
    m, (cm, *_) = people(1)
    gs.set_stasis(cm, 2.0)
    grades = [state(cm, d)["ijv_flow_grade"] for d in (30, 60, 138)]
    assert sum(g >= 3 for g in grades) >= 2
    gs.set_stasis(cm, -2.0)
    assert all(state(cm, d)["ijv_flow_grade"] <= 2 for d in (30, 60, 138))


def test_the_nasa_schedule_scans_the_veins_on_the_standard_days():
    m = gs.Mission("iss_180", launch_date="2027-03-01")
    days = gs.nasa_days(m, "vascular")
    assert days[0] < 0 and {29.0, 59.0, m.landing - 42} <= set(days) and days[-1] > m.landing
    assert len([d for d in days if 0 <= d <= m.landing]) == 3                       # L+30, L+60, R-42 only
    mars = gs.Mission("mars", launch_date="2027-03-01")
    assert len([d for d in gs.nasa_days(mars, "vascular") if 0 <= d <= mars.landing]) > 10   # every 60 days, ours


def test_the_dataservice_stores_vein_readings():
    m, (cm, *_) = people(1)
    data = gs.DataService()
    data.ingest(gs.JugularUltrasound(seed=2).measure_all(cm, 30))
    stored = data.readings(cm.id, "veins")
    assert len(stored) == 2 * len(VASCULAR_MEASURES) and all(r.quality == "ok" for r in stored)
    assert {r.unit for r in stored} == {"mm²", "grade", "flag", "cm/s"}
