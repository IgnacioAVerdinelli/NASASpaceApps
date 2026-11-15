"""The eye exam (gravsim.OcularExam, OCHMO-STD-100.1A [6012]): SANS simulated from published group results
(docs/investigacion-ojos.md). The crew as a whole must reproduce the published shares.

Run from sim/:  python -m pytest -q
"""
import numpy as np
import pytest

import gravsim as gs
from gravsim.ocular import OCULAR_MEASURES, profile


def people(n=600):
    m = gs.Mission("iss_180", launch_date="2027-03-01")
    return m, [m.add_crew(f"CM-{i}", seed=1000 + i) for i in range(n)]


def test_one_exam_reads_every_measure_in_its_unit():
    m, (cm, *_) = people(1)
    rs = gs.OcularExam(seed=1).measure_all(cm, 89)
    assert [r.measure for r in rs] == list(OCULAR_MEASURES)
    assert all(r.instrument == "ocular" and r.unit == gs.MEASURES[r.measure]["unit"] for r in rs)
    assert all(gs.LIMITS[r.measure][0] <= r.value <= gs.LIMITS[r.measure][1] for r in rs)
    assert {r.unit for r in rs} <= set(gs.UNITS)


def test_the_crew_reproduces_the_published_shares():
    m, crew = people()
    ch = [profile(c).changes(c, 149.0) for c in crew]          # flight day 150
    share = lambda f: np.mean([f(c) for c in ch])
    assert share(lambda c: c["oct_trt"] >= 20) == pytest.approx(0.66, abs=0.07)      # consensus 2026: 66-69 %
    assert share(lambda c: c["oct_trt"] >= 55) == pytest.approx(0.15, abs=0.05)      # ~15 % Frisén >= 1
    assert share(lambda c: c["frisen_grade"] >= 1) == pytest.approx(0.15, abs=0.05)
    assert share(lambda c: c["choroidal_folds"]) == pytest.approx(0.25, abs=0.06)    # 25 %
    assert share(lambda c: c["globe_flattening"]) == pytest.approx(0.37, abs=0.07)   # 37 %
    assert share(lambda c: c["refraction_se"] > 0.5) == pytest.approx(0.20, abs=0.06)  # 20 %
    assert np.mean([c["oct_mrw"] for c in ch]) == pytest.approx(35.7, abs=4)         # Macias 2020
    assert np.mean([c["oct_choroid"] for c in ch]) == pytest.approx(43, abs=4)
    assert np.mean([c["onsd"] for c in ch]) == pytest.approx(0.9, abs=0.1)


def test_swelling_builds_in_flight_and_resolves_after_landing_the_short_eye_stays():
    m, (cm, *_) = people(1)
    gs.set_sans(cm, 1.5)
    p = profile(cm)
    trt = [p.changes(cm, d)["oct_trt"] for d in (-30, 29, 89, 149, m.landing + 30, m.landing + 180)]
    assert trt[0] == 0 and trt[1] < trt[2] < trt[3] and trt[4] < trt[3] and trt[5] < 0.1 * trt[3]
    assert p.changes(cm, 149)["frisen_grade"] >= 1                                    # past +55 um
    axial = [p.changes(cm, d)["axial_length"] for d in (m.landing, m.landing + 365)]
    assert axial[1] < 0 and abs(axial[1]) == pytest.approx(0.67 * abs(axial[0]), rel=0.05)  # Macias 2020: 0.08 -> 0.05


def test_the_nasa_schedule_reads_the_eyes_on_the_standard_days():
    m = gs.Mission("iss_180", launch_date="2027-03-01")
    days = gs.nasa_days(m, "ocular")
    assert days[0] < 0 and {29.0, 89.0, m.landing - 30} <= set(days) and days[-1] > m.landing


def test_the_dataservice_stores_eye_readings():
    m, (cm, *_) = people(1)
    data = gs.DataService()
    data.ingest(gs.OcularExam(seed=2).measure_all(cm, 89))
    stored = data.readings(cm.id, list(OCULAR_MEASURES))
    assert len(stored) == len(OCULAR_MEASURES) and all(r.quality == "ok" for r in stored)
