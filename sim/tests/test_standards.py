"""gravsim against the NASA crew-health standards the team lead pointed to.

Thresholds come from `nasa_standards.json` next to this file; each has the document, section, requirement id
and PDF page it was read from (NASA-STD-3001 Vol 1 Rev C, OCHMO-STD-100.1A Rev A, OCHMO-TB-031). Where a
threshold could not be read in those documents the JSON says so and there is no test for it.

The data behind gravsim is from healthy bed-rest volunteers, not astronauts, so some of these tests describe a
gap between the data and the astronaut population rather than a coding bug. Those are marked xfail(strict=True)
with the reason, and listed in sim/README.md under "Decisions (open to veto)". A strict xfail fails the run if
the gap closes, so the mark has to be removed on purpose.

Run from sim/:  python -m pytest -q tests/test_standards.py   (add -m slow for the whole-population checks)
"""
import json
from pathlib import Path

import numpy as np
import pytest

import gravsim as gs

STD = json.loads((Path(__file__).with_name("nasa_standards.json")).read_text())["thresholds"]
VO2_FLOOR = STD["vo2_in_mission_min_microgravity_eva_ml_kg_min"]["value"]           # 32.9, [V1 4001]
VO2_PRE_REC = STD["vo2_premission_recommendation_ml_kg_min"]["value_15pct_decline"]   # 38.7, Table 4.1-1
KEEP_VO2 = STD["vo2_in_mission_min_fraction_of_premission"]["value"]                 # 0.80, [V1 4003]
KEEP_STRENGTH = STD["muscle_strength_in_mission_min_fraction_of_baseline"]["value"]  # 0.80, [V1 4024]
KEEP_BMD = STD["bmd_in_mission_min_fraction_hip_spine"]["value"]                     # 0.95, [V1 4027]
HTN = STD["hypertension_definition_mmHg"]                                            # 140/90, OCHMO-STD-100.1A p.74
HR_MIN = STD["bradycardia_review_bpm"]["value"]                                      # 30, OCHMO-STD-100.1A p.76


def changes(mid, day, adherence, responder="typical", n=400, preset="iss_180"):
    return np.array([gs.Mission(preset).add_crew(adherence=adherence, responder=responder, seed=i).change(mid, day) for i in range(n)])


def baselines(mid, n=2000):
    return np.array([gs.Mission("iss_180").add_crew(seed=i).baseline[mid] for i in range(n)])


# --------------------------------------------------------------------------- pre-flight baselines vs selection standards

def test_preflight_vo2peak_is_at_least_the_in_mission_floor():
    """An astronaut who already starts below 32.9 ml/kg/min [V1 4001] could not be assigned to a mission with EVAs.
    Bed-rest volunteers (CFT70 median 40.8, min 29.2) are less fit than astronauts; the sampled baselines inherit that."""
    v = baselines("vo2peak")
    share = float(np.mean(v < VO2_FLOOR))
    assert share <= 0.02, f"{share:.1%} of crew start below the in-mission VO2 floor {VO2_FLOOR} ml/kg/min (min {v.min():.1f}, median {np.median(v):.1f}); " \
                          f"{np.mean(v < VO2_PRE_REC):.0%} start below the {VO2_PRE_REC} pre-mission recommendation (Table 4.1-1)"


def test_astronaut_filters_use_the_standards_numbers():
    """The fit draws baselines only from subjects meeting these standards (README, "Decisions"); its numbers must be the
    ones read from the documents."""
    a = gs.PARAMS["astronaut_standards"]
    assert a["vo2peak_min"] == VO2_FLOOR and (a["sbp_below"], a["dbp_below"]) == (HTN["systolic"], HTN["diastolic"])
    assert baselines("vo2peak").min() >= VO2_FLOOR


@pytest.mark.slow
def test_preflight_blood_pressure_is_not_hypertensive():
    """OCHMO-STD-100.1A p.74 defines hypertension as sustained SBP >= 140 or DBP >= 90 mmHg (disqualifying unless treated).
    True baselines: a small share is tolerable. Sustained: the mean of the 14 daily pre-flight wearable readings."""
    s, d = baselines("resting_sbp"), baselines("resting_dbp")
    assert np.mean((s >= HTN["systolic"]) | (d >= HTN["diastolic"])) <= 0.02, f"max SBP {s.max():.0f}, max DBP {d.max():.0f}"
    w = gs.Wearable(seed=1)
    means = []
    for i in range(300):
        c = gs.Mission("iss_180").add_crew(seed=i)
        means.append(np.mean([[r.value for r in w.measure_all(c, day)][1:3] for day in range(-14, 0)], axis=0))
    means = np.array(means)
    share = float(np.mean((means[:, 0] >= HTN["systolic"]) | (means[:, 1] >= HTN["diastolic"])))
    assert share <= 0.02, f"{share:.1%} of crew have a hypertensive 14-day pre-flight mean"


@pytest.mark.slow
@pytest.mark.xfail(strict=True, reason=(
    "Data gap, kept on purpose: about 1 in 10 single pre-flight wearable readings reach 140/90 although no crew member's "
    "true pressure does and no 14-day mean does. The day-to-day variation comes from the only repeat pressures in the data, "
    "two clinic visits weeks apart in CFT70 (14 bed-rest volunteers, about 6 % systolic and 8 % diastolic per reading). "
    "There is no open data on day-to-day variation of a wearable's daily resting pressure."))
def test_single_preflight_bp_readings_rarely_read_hypertensive():
    """Noisy pre-flight readings must not label a large share hypertensive (the verifier's single-reading check)."""
    w = gs.Wearable(seed=1)
    vals = np.array([[r.value for r in w.measure_all(gs.Mission("iss_180").add_crew(seed=i), -30)] for i in range(1000)])
    share = float(np.mean((vals[:, 1] >= HTN["systolic"]) | (vals[:, 2] >= HTN["diastolic"])))
    assert share <= 0.05, f"{share:.1%} of pre-flight wearable readings read as hypertensive (SBP noise CV {gs.MEASURES['resting_sbp']['noise_cv']}, cut at 2.5 SD)"


def test_heart_rate_never_below_review_threshold():
    w = gs.Wearable(seed=2, noise=1.0)
    vals = [w.measure(gs.Mission("iss_180").add_crew(seed=i), d, "resting_hr").value for i in range(300) for d in (-30, 90, 200)]
    assert min(vals) >= HR_MIN, min(vals)


# --------------------------------------------------------------------------- in-flight standards: exercise keeps, no exercise breaks

@pytest.mark.parametrize("mid,keep,req", [("vo2peak", KEEP_VO2, "[V1 4003]"), ("knee_extension_60", KEEP_STRENGTH, "[V1 4024]"),
                                          ("trunk_extension_60", KEEP_STRENGTH, "[V1 4024]"), ("knee_flexion_60", KEEP_STRENGTH, "[V1 4024]")])
def test_exercise_routine_keeps_crew_inside_the_in_flight_limit(mid, keep, req):
    """Following the routine (adherence 1) should keep the large majority of typical crew above the limit through FD180."""
    for day in (30, 90, 180):
        ch = changes(mid, day, 1.0)
        fail = float(np.mean(ch < -(1 - keep) * 100))
        assert fail <= 0.10, f"{mid} {req}: {fail:.0%} of exercising crew below {keep:.0%} of baseline at FD{day} (median {np.median(ch):+.1f} %)"


@pytest.mark.xfail(strict=True, reason=(
    "Data gap, kept on purpose: the bed-rest exercise barely protected calf strength (Campaign 11 exercise group lost 19 % "
    "against 21 % without exercise), so most crew on the routine lose more than the 20 % NASA allows [V1 4024]. ISS "
    "exercise targets the calves; bed-rest exercise did not. gravsim follows the data and invents no protective effect."))
def test_exercise_routine_keeps_ankle_plantarflexion_inside_the_limit():
    """Calf strength [V1 4024]: the fitted exercise effect is only 12 % (Campaign 11 exercise group lost 19 % vs 21 %
    control), so the 'exercise routine' status itself breaks the 80 % standard for most crew. This is what the bed-rest
    data says; the astronaut countermeasure programme is meant to prevent it. Flagged so the team decides."""
    ch = changes("ankle_plantarflexion_30", 180, 1.0)
    fail = float(np.mean(ch < -(1 - KEEP_STRENGTH) * 100))
    assert fail <= 0.25, f"{fail:.0%} of exercising crew lose more than 20 % calf strength by FD180 (median {np.median(ch):+.1f} %)"


def test_no_exercise_breaks_vo2_and_strength_limits_on_a_plausible_timeline():
    """Without exercise the median crew member should cross the 80 % limits within the first 2-3 months
    (bed-rest controls: VO2 -20 % and knee extension -24 % at 70 days) and not before 3 weeks."""
    for mid in ("vo2peak", "knee_extension_60"):
        c = gs.Mission("iss_180").add_crew(adherence=0.0, responder=0.0, seed=1)
        day = next((d for d in range(0, 181) if c.change(mid, d) < -20), None)
        assert day is not None and 21 <= day <= 90, f"{mid}: median no-exercise crew crosses -20 % on day {day}"
        assert np.mean(changes(mid, 90, 0.0) < -20) >= 0.5, f"{mid}: fewer than half of no-exercise crew below 80 % at FD90"


def test_exercise_routine_keeps_hip_and_spine_bmd_above_95_percent_for_most_crew():
    """[V1 4027]: hip and spine >= 95 % of pre-mission. Rationale (p.39): with ARED etc. 'the majority of crewmembers'
    return with <5 % total hip or spine loss after 6 months. The bone exercise effect (0.5) is a placeholder."""
    for mid in ("hip_bmd", "spine_bmd"):
        ch = changes(mid, 180, 1.0)
        fail = float(np.mean(ch < -(1 - KEEP_BMD) * 100))
        assert fail < 0.5, f"{mid}: {fail:.0%} of exercising crew lose more than 5 % by FD180 (median {np.median(ch):+.1f} %)"


def test_no_exercise_breaks_the_hip_bmd_limit_within_six_months():
    ch = changes("hip_bmd", 180, 0.0)
    assert np.mean(ch < -5) > 0.5, f"median hip change without exercise at FD180 {np.median(ch):+.1f} %"


def test_vo2_recovers_within_the_45_day_reconditioning_window():
    """OCHMO-TB-031 p.2: aerobic capacity and strength return to preflight values within 45 days postflight."""
    for mid in ("vo2peak", "knee_extension_60"):
        c = gs.Mission("iss_180").add_crew(adherence=0.0, responder=0.0, seed=1)
        assert abs(c.change(mid, 180 + 45)) < 0.25 * abs(c.change(mid, 180)), (mid, c.change(mid, 180), c.change(mid, 225))


def test_bone_takes_about_a_year_to_recover():
    """OCHMO-TB-031 p.2: 'for many crewmembers, it requires a year to recover back to preflight values'."""
    c = gs.Mission("iss_180").add_crew(adherence=0.0, responder=0.0, seed=1)
    at_landing, one_year = c.change("hip_bmd", 180), c.change("hip_bmd", 545)
    assert 0.1 * abs(at_landing) < abs(one_year) < 0.7 * abs(at_landing), (at_landing, one_year)


def test_bedrest_curve_matches_the_documents_bedrest_figures():
    """TB-031 p.8: 70-day control group ~10 % VO2 decline (Campaign 11 raw median is -20 %); NASA-STD-3001 p.33:
    6-16 % after 10 days of bed rest (Convertino 1997). The fitted curve gives -6.8 % at 10 days and -20 % at 70."""
    c = gs.Mission("iss_180").add_crew(adherence=0.0, responder=0.0, seed=1)
    assert -16 <= c.change("vo2peak", 10) <= -6, c.change("vo2peak", 10)
    assert -25 <= c.change("vo2peak", 70) <= -10, c.change("vo2peak", 70)


def test_six_month_losses_sit_in_the_documents_spaceflight_bands():
    """NASA-STD-3001 V1 Rev C rationale: VO2 falls ~10-30 % (p.34) and lower-body strength ~10-30 % (p.39) after
    spaceflight 'depending on duration and conditions'. The no-exercise ISS plateau should land in those bands."""
    for mid in ("vo2peak", "knee_extension_60"):
        med = float(np.median(changes(mid, 180, 0.0)))
        assert -30 <= med <= -10, (mid, med)
