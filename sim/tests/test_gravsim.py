"""Checks that the simulator reproduces the bed-rest data it was fitted on, and that its controls work.

Run from sim/:  python -m pytest -q
"""
import statistics as st

import pytest

import gravsim as gs


def crew_changes(measure, day, adherence, n=300, preset="iss_180"):
    m = gs.Mission(preset)
    return [m.add_crew(adherence=adherence, seed=i).change(measure, day) for i in range(n)]


def observed(measure, cohort):
    return next(o["change_pct"] for o in gs.MEASURES[measure]["observed"] if o["cohort"] == cohort)


# ---- the curves land on the data -------------------------------------------------------------

@pytest.mark.parametrize("cohort,adherence", [("Campaign 11 (Control)", 0.0), ("Campaign 11 (Exercise)", 1.0)])
def test_knee_extension_at_70_days_matches_campaign_11(cohort, adherence):
    sim = st.median(crew_changes("knee_extension_60", 70, adherence))
    assert abs(sim - observed("knee_extension_60", cohort)) < 4.0


def test_knee_extension_at_30_days_matches_hdt30():
    sim = st.median(crew_changes("knee_extension_60", 30, 0.0))
    assert abs(sim - observed("knee_extension_60", "HDT30 (Not labelled)")) < 3.0


@pytest.mark.parametrize("cohort,adherence", [("Campaign 11 (Control)", 0.0), ("Campaign 11 (Exercise)", 1.0)])
def test_vo2peak_at_70_days_matches_campaign_11(cohort, adherence):
    sim = st.median(crew_changes("vo2peak", 70, adherence))
    assert abs(sim - observed("vo2peak", cohort)) < 4.0


def test_hip_bone_loss_is_about_one_to_one_and_a_half_percent_per_month():
    sim = st.median(crew_changes("hip_bmd", 60, 0.0))
    assert -3.5 < sim < -2.0


def test_vo2peak_recovers_most_of_the_way_within_two_weeks():
    m = gs.Mission([gs.Phase("pre", -30, 0, 1), gs.Phase("bed", 0, 70, 0), gs.Phase("after", 70, 200, 1)])
    c = m.add_crew(adherence=0.0, seed=1)
    assert abs(c.change("vo2peak", 80)) < 0.7 * abs(c.change("vo2peak", 70))


def test_spread_between_people_looks_like_the_data():
    sims = crew_changes("knee_extension_60", 70, 0.0, n=400)
    spread = st.quantiles(sims, n=10)
    assert spread[0] < -27 and spread[-1] > -17          # data: Campaign 11 control -30 to -20, Campaign 3 wider


def test_same_workload_costs_more_heart_beats_after_bed_rest():
    target = gs.PARAMS["validation"]["campaign3_extra_hr_same_workload_bpm"]["median"]
    m = gs.Mission([gs.Phase("pre", -30, 0, 1), gs.Phase("bed", 0, 75, 0), gs.Phase("after", 75, 120, 1)])
    cyc = gs.CycleErgometer(noise=0)
    extra = []
    for i in range(60):
        c = m.add_crew(adherence=0.0, seed=i)
        before = {s["watts"]: s["hr_bpm"] for s in cyc.session(c, -1)["stages"]}
        after = {s["watts"]: s["hr_bpm"] for s in cyc.session(c, 74.9)["stages"]}
        extra += [after[w] - before[w] for w in after if w in before and w > 0]
    assert abs(st.median(extra) - target) < 12


# ---- controls -------------------------------------------------------------------------------

def test_seed_repeats_exactly():
    def run():
        m = gs.Mission.random(seed=11)
        return [(r.crew_id, r.measure, r.mission_day, r.value) for r in m.timeline(seed=3)]
    assert run() == run()


def test_adherence_steps_change_the_curve():
    m = gs.Mission("iss_180")
    steady = m.add_crew(adherence=1.0, seed=5)
    slip = m.add_crew(adherence=[(0, 1.0), (60, 0.0), (120, 1.0)], seed=5)
    assert slip.change("knee_extension_60", 59) == pytest.approx(steady.change("knee_extension_60", 59))
    assert slip.change("knee_extension_60", 120) < steady.change("knee_extension_60", 120) - 5


def test_fast_responder_loses_more_than_typical():
    fast = st.median(crew_changes_resp("fast"))
    typical = st.median(crew_changes_resp("typical"))
    assert fast < typical - 3


def crew_changes_resp(responder):
    m = gs.Mission("iss_180")
    return [m.add_crew(adherence=0.0, responder=responder, seed=i).change("knee_extension_60", 90) for i in range(200)]


def test_event_drops_then_recovers():
    m = gs.Mission("iss_180")
    c = m.add_crew(seed=2)
    base = c.change("knee_extension_60", 99)
    c.add_event(day=100, measures="legs", severity_pct=12, recovery_days=15, label="sprain")
    assert c.change("knee_extension_60", 100) == pytest.approx(c.change("knee_extension_60", 100, events=False) - 12)
    assert c.change("knee_extension_60", 160) - c.change("knee_extension_60", 160, events=False) > -1
    assert "sprain" in c.status(101)["events"] and base > c.change("knee_extension_60", 100)


def test_faults():
    m = gs.Mission("iss_180")
    c = m.add_crew(seed=1)
    clean = gs.DxaScanner(noise=0).measure(c, 200, "hip_bmd").value
    off = gs.DxaScanner(noise=0, faults=[gs.Fault("offset", start=190, end=250, pct=-1.1)]).measure(c, 200, "hip_bmd")
    assert off.value == pytest.approx(clean * 0.989, abs=0.002) and off.truth["faults"] == ["offset -1.1%"]
    gone = gs.Wearable(seed=1, faults=[gs.Fault("dropout", prob=1.0)]).measure(c, 50, "resting_hr")
    assert gone.value is None and gone.quality == "missing"


def test_nasa_schedule_has_no_dxa_in_flight():
    m = gs.Mission("iss_180")
    m.add_crew(seed=1)
    dxa_days = {r.mission_day for r in m.timeline() if r.instrument == "dxa"}
    assert not any(0 <= d < m.landing for d in dxa_days)
    every_week = {r.mission_day for r in m.timeline(schedule=7, instruments=["dxa"])}
    assert any(0 <= d < m.landing for d in every_week)


def test_extrapolation_flags():
    iss = gs.Mission("iss_180")
    c = iss.add_crew(seed=1)
    assert not c.extrapolated("knee_extension_60", 80)
    assert c.extrapolated("knee_extension_60", 120)          # past the 90 days the data covers
    assert c.extrapolated("spo2", 10)                         # no data behind it at all
    mars = gs.Mission("mars")
    assert mars.add_crew(seed=1).extrapolated("hip_bmd", 200)


def test_sessions_have_the_expected_shape():
    m = gs.Mission("iss_180")
    c = m.add_crew(seed=1)
    assert len(gs.Dynamometer().session(c, 30)["tests"]) == 6
    assert {"hip_left", "hip_right", "lean_legs"} <= set(gs.DxaScanner().session(c, 190)["report"])
    stages = gs.CycleErgometer().session(c, 75)["stages"]
    assert stages[0]["watts"] == 0 and len(stages) > 4
    assert len(gs.Wearable().session(c, 10)["trace"]) == 1440
