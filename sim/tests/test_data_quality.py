"""Data-quality checks for gravsim against the raw NLSP bed-rest data.

The team lead's requirement: the generator "cannot generate data outside the ranges we got from the original
NASA data". `data_ranges.json` next to this file holds those ranges, derived straight from the CSVs in
data/nlsp (independently of fit_params.py): for each measure the pre-bed-rest minimum and maximum, and the
minimum and maximum % change per cohort. Everything below is checked against that file.

Classification used here (from the review brief):
  (a) a value outside the data range while the reading is inside the data's coverage (<= 90 unloaded days,
      1 g or 0 g, no fault) is a bug;
  (b) outside the coverage the reading must carry extrapolated=True;
  (c) a value pushed out of range by an injected fault must be listed in truth["faults"].

Run from sim/:  python -m pytest -q tests/test_data_quality.py           (the quick checks)
                python -m pytest -q -m slow tests/test_data_quality.py   (the stress tests, a few minutes)
"""
import collections
import itertools
import json
import math
from pathlib import Path

import numpy as np
import pytest

import gravsim as gs

RANGES = json.loads((Path(__file__).with_name("data_ranges.json")).read_text())["measures"]
MODELLED = [m for m in gs.MEASURES if gs.MEASURES[m]["model"] != "constant"]      # spo2 and hrv have no data


RISES_WHEN_DECONDITIONED = {"resting_hr", "resting_sbp", "resting_dbp"}


def worse_sign(mid):
    """+1 if the measure rises when the body deconditions (resting heart rate and pressure), -1 if it falls
    (strength, lean mass, bone, VO2peak). Physiology, not the sign of the fitted parameter: lean_arms was fitted
    at +0.2 %, which must not turn 'more arm muscle' into the bad direction."""
    return 1 if mid in RISES_WHEN_DECONDITIONED else -1


def crews(n, preset="iss_180", **kw):
    m = gs.Mission(preset)
    return m, [m.add_crew(seed=i, **kw) for i in range(n)]


def readings_everywhere(n_crew=6, faults=None, noise=1.0):
    """Readings for every preset, status and a spread of days: the stress sample used by several tests."""
    out = []
    statuses = [dict(adherence=0.0), dict(adherence=1.0), dict(adherence=0.5, responder="fast"),
                dict(adherence=[(0, 1.0), (60, 0.0), (120, 1.0)], responder=2.0), dict(adherence=1.0, responder=-2.0)]
    for preset, status in itertools.product(gs.PRESETS, statuses):
        m = gs.Mission(preset)
        for i in range(n_crew):
            c = m.add_crew(seed=1000 * i + hash(preset) % 97, **status)
            if i % 3 == 0:
                c.add_event(day=40, measures="legs", severity_pct=12, recovery_days=20, label="sprain")
        inst = gs.default_instruments(seed=7, faults=faults or {}, noise=noise)
        days = sorted({-60.0, -30.0, -1.0, 0.0, 7.0, 30.0, 60.0, 89.0, 91.0, 120.0, m.landing - 0.5, m.landing + 5, m.landing + 30,
                       m.landing + 365} | set(np.linspace(m.start, m.end, 9).round(1)))
        for c in m.crew:
            for d in days:
                for ins in inst.values():
                    out += ins.measure_all(c, d)
    return out


# --------------------------------------------------------------------------- sanity: finite, units, physiology

@pytest.mark.slow
def test_values_are_finite_non_negative_and_single_unit():
    units = collections.defaultdict(set)
    for r in readings_everywhere():
        units[r.measure].add(r.unit)
        if r.value is not None:
            assert math.isfinite(r.value), (r.measure, r.value)
            assert r.value >= 0, (r.measure, r.value, r.day_label)
    assert all(len(u) == 1 for u in units.values()), {k: v for k, v in units.items() if len(v) > 1}


def test_spo2_never_above_100_percent():
    """Blood oxygen saturation is a percentage of haemoglobin: 100 is the ceiling. Noise and spikes must be clipped."""
    bad = []
    for faults in ({}, {"wearable": [gs.Fault("spike", prob=0.3, pct=25)]}):
        w = gs.Wearable(seed=3, faults=faults.get("wearable", ()))
        for i in range(300):
            c = gs.Mission("iss_180").add_crew(seed=i)
            r = w.measure(c, -30, "spo2")
            if r.value is not None and r.value > 100:
                bad.append((r.value, r.truth["faults"]))
    assert not bad, f"{len(bad)} SpO2 readings above 100 %, e.g. {bad[:5]}"


def test_physiological_floors_and_ceilings_under_faults():
    """Even a faulty instrument should not report a heart rate under 30 or a blood pressure that cannot exist."""
    bad = []
    w = gs.Wearable(seed=5, faults=[gs.Fault("spike", prob=0.5, pct=60)])
    for i in range(300):
        c = gs.Mission("iss_180").add_crew(seed=i)
        for r in w.measure_all(c, 30):
            if r.value is None:
                continue
            if (r.measure == "resting_hr" and not 30 <= r.value <= 220) or (r.measure == "resting_sbp" and not 60 <= r.value <= 250) \
               or (r.measure == "resting_dbp" and not 30 <= r.value <= 150) or (r.measure == "spo2" and not 70 <= r.value <= 100):
                bad.append((r.measure, r.value, r.truth["faults"]))
    assert not bad, f"{len(bad)} impossible values, e.g. {bad[:5]}"


def test_a_dropout_followed_by_another_fault_does_not_crash():
    """Fault handling must not depend on the order of the fault list (dropout sets value=None, the next fault multiplies it)."""
    c = gs.Mission("iss_180").add_crew(seed=1)
    w = gs.Wearable(seed=1, faults=[gs.Fault("dropout", prob=1.0), gs.Fault("offset", pct=5)])
    r = w.measure(c, 50, "resting_hr")
    assert r.value is None and r.quality == "missing"
    d = gs.Dynamometer(seed=1, faults=[gs.Fault("dropout", prob=1.0), gs.Fault("drift", start=0, pct_per_day=0.1)])
    assert d.measure(c, 50, "knee_extension_60").value is None


# --------------------------------------------------------------------------- (a) ranges inside the data's coverage

@pytest.mark.slow
@pytest.mark.parametrize("mid", MODELLED)
def test_true_preflight_baseline_inside_data_range(mid):
    """The noise-free baseline sampled for a crew member must lie between the smallest and largest pre-bed-rest
    value any subject produced for that measure (data_ranges.json: baseline.min/max)."""
    lo, hi = RANGES[mid]["baseline"]["min"], RANGES[mid]["baseline"]["max"]
    vals = np.array([gs.Mission("iss_180").add_crew(seed=i).baseline[mid] for i in range(3000)])
    out = vals[(vals < lo) | (vals > hi)]
    assert out.size == 0, (f"{out.size}/3000 baselines outside the data [{lo}, {hi}] {RANGES[mid]['unit']}: "
                           f"min {vals.min():.3f}, max {vals.max():.3f}")


@pytest.mark.slow
@pytest.mark.parametrize("mid", MODELLED)
def test_noisy_preflight_readings_inside_data_range(mid):
    """Pre-flight readings with realistic noise (no faults) must also stay inside the data's baseline range."""
    lo, hi = RANGES[mid]["baseline"]["min"], RANGES[mid]["baseline"]["max"]
    inst = gs.default_instruments(seed=11)[gs.MEASURES[mid]["instrument"]]
    vals = np.array([inst.measure(gs.Mission("iss_180").add_crew(seed=i), -30, mid).value for i in range(2000)])
    out = vals[(vals < lo) | (vals > hi)]
    assert out.size == 0, (f"{out.size}/2000 pre-flight readings outside the data [{lo}, {hi}]: "
                           f"min {vals.min():.3f}, max {vals.max():.3f}")


@pytest.mark.slow
@pytest.mark.parametrize("mid", MODELLED)
def test_true_change_inside_observed_envelope_within_coverage(mid):
    """Within the data's coverage (0 g, <= 90 unloaded days, no fault, no event) the true % change must lie between
    the smallest and largest change any bed-rest subject showed (data_ranges.json: change_pct.min/max)."""
    lo, hi = RANGES[mid]["change_pct"]["min"], RANGES[mid]["change_pct"]["max"]
    out = []
    for adh, resp in ((0.0, "typical"), (0.0, "fast"), (1.0, "typical"), (0.0, 2.5), (1.0, -2.5)):
        for i in range(300):
            c = gs.Mission("iss_180").add_crew(adherence=adh, responder=resp, seed=i)
            for d in (14, 30, 60, 75, 90):
                ch = c.change(mid, d)
                if not lo <= ch <= hi:
                    out.append((round(ch, 1), d, adh, resp, i))
    assert not out, f"{len(out)} true changes outside the data [{lo}, {hi}] %, e.g. (change, day, adherence, responder, seed) {out[:5]}"


@pytest.mark.slow
def test_out_of_range_values_are_extrapolated_or_fault_marked():
    """Every reading outside [baseline range x change range] must either be flagged extrapolated (b) or carry the
    fault that produced it in truth['faults'] (c). Anything else is class (a): a bug."""
    faults = {"dxa": [gs.Fault("offset", pct=-1.1), gs.Fault("drift", start=100, pct_per_day=0.05)],
              "dynamometer": [gs.Fault("spike", prob=0.2, pct=40)], "cycle": [gs.Fault("offset", pct=8)],
              "wearable": [gs.Fault("spike", prob=0.05, pct=25), gs.Fault("dropout", prob=0.1)]}
    unexplained = collections.Counter(); examples = {}
    for r in readings_everywhere(n_crew=4, faults=faults) + readings_everywhere(n_crew=4, faults=None, noise=0.0):
        if r.value is None or r.measure not in RANGES:
            continue
        b, ch = RANGES[r.measure]["baseline"], RANGES[r.measure]["change_pct"]
        lo = b["min"] * (1 + min(ch["min"], 0) / 100); hi = b["max"] * (1 + max(ch["max"], 0) / 100)
        if lo <= r.value <= hi:
            continue
        if r.truth["faults"] or r.extrapolated or r.status["events"]:
            continue                                 # classes (b) and (c): allowed, and marked
        unexplained[r.measure] += 1
        examples.setdefault(r.measure, (r.value, r.day_label, r.status, r.truth))
    assert not unexplained, f"out-of-range readings with no fault, no event and extrapolated=False: {dict(unexplained)}; e.g. {examples}"


def test_extrapolated_flag_follows_the_data_coverage():
    iss = gs.Mission("iss_180"); c = iss.add_crew(seed=1)
    assert not c.extrapolated("knee_extension_60", 89.9)
    assert c.extrapolated("knee_extension_60", 90.5) and c.extrapolated("knee_extension_60", 400)
    art = gs.Mission("artemis_30"); a = art.add_crew(seed=1)
    assert not a.extrapolated("hip_bmd", 11.9)                     # 0 g transit, 12 days
    assert a.extrapolated("hip_bmd", 12.5) and a.extrapolated("hip_bmd", 60)    # partial gravity and after it
    mars = gs.Mission("mars"); mm = mars.add_crew(seed=1)
    assert not mm.extrapolated("vo2peak", 60) and mm.extrapolated("vo2peak", 95)


# --------------------------------------------------------------------------- consistency

def test_same_crew_and_seeds_give_identical_output():
    def run():
        m = gs.Mission.random(seed=11)
        return [(r.crew_id, r.measure, r.mission_day, r.value, r.truth["value"]) for r in m.timeline(seed=3)]
    assert run() == run()
    a = gs.Mission("iss_180").add_crew(seed=9); b = gs.Mission("iss_180").add_crew(seed=9)
    assert a.baseline == b.baseline and a.sex == b.sex and a.z == b.z


def test_dxa_session_hips_agree_with_hip_reading():
    c = gs.Mission("iss_180").add_crew(seed=3)
    dxa = gs.DxaScanner(seed=2, noise=0)
    rep = dxa.session(c, 190)["report"]
    hip = dxa.measure(c, 190, "hip_bmd")
    assert (rep["hip_left"]["truth"]["value"] + rep["hip_right"]["truth"]["value"]) / 2 == pytest.approx(hip.truth["value"], abs=1e-3)
    asym = [abs(rep_["hip_left"]["value"] / rep_["hip_right"]["value"] - 1) for rep_ in
            (gs.DxaScanner(noise=0).session(gs.Mission("iss_180").add_crew(seed=i), 190)["report"] for i in range(200))]
    assert max(asym) < 0.05, f"left/right hip differ by up to {100 * max(asym):.1f} %"


def test_cycle_session_peak_agrees_with_vo2peak_reading():
    """The last completed stage's VO2 must sit just below the true peak, and the reported peak reading must be the
    same quantity the stages were built from (within the fitted measurement noise)."""
    cyc = gs.CycleErgometer(seed=1)
    for i in range(40):
        c = gs.Mission("iss_180").add_crew(seed=i)
        for d in (-30, 75):
            s = cyc.session(c, d)
            true = c.true_value("vo2peak", d)
            last = s["stages"][-1]["vo2_ml_kg_min"]
            assert last <= true * 1.1, (last, true)
            assert abs(s["reading"]["value"] / true - 1) <= 2.5 * gs.MEASURES["vo2peak"]["noise_cv"] + 0.01


def test_dynamometer_session_reports_the_best_repetition():
    c = gs.Mission("iss_180").add_crew(seed=1)
    for t in gs.Dynamometer(seed=1).session(c, 30)["tests"]:
        assert t["reading"]["value"] == max(r["peak_torque"] for r in t["reps"])


@pytest.mark.slow
@pytest.mark.parametrize("mid", MODELLED)
def test_no_exercise_is_never_better_than_full_exercise(mid):
    """Same person, same seed: skipping all exercise must not leave the measure in a better state than following
    the routine, on any flight day. (A positive personal amplitude flips this for some measures.)"""
    worse = worse_sign(mid)
    bad = []
    for i in range(300):
        a0 = gs.Mission("iss_180").add_crew(adherence=0.0, seed=i)
        a1 = gs.Mission("iss_180").add_crew(adherence=1.0, seed=i)
        for d in (30, 90, 180):
            if worse * (a0.change(mid, d) - a1.change(mid, d)) < -1e-6:
                bad.append((i, d, round(a0.change(mid, d), 2), round(a1.change(mid, d), 2)))
    assert not bad, f"{len(bad)} cases where no exercise beats exercise (seed, day, change adh0, change adh1): {bad[:5]}"


@pytest.mark.slow
@pytest.mark.parametrize("mid", MODELLED)
def test_deconditioning_direction_matches_the_data(mid):
    """Without exercise, the group must move in the direction the bed-rest studies measured (bone and muscle down,
    resting heart rate up). More than a small minority of crew moving the other way is a modelling fault."""
    worse = worse_sign(mid)
    ch = np.array([gs.Mission("iss_180").add_crew(adherence=0.0, seed=i).change(mid, 75) for i in range(1000)])
    share_wrong_way = float(np.mean(worse * ch < 0))
    assert share_wrong_way <= 0.10, f"{share_wrong_way:.0%} of no-exercise crew improve on {mid} at FD75 (median change {np.median(ch):+.2f} %)"


@pytest.mark.parametrize("mid", MODELLED)
def test_loss_grows_in_flight_and_recovers_after_landing(mid):
    """|change| never shrinks while unloaded (it approaches the plateau), and shrinks back towards 0 after landing."""
    for i in range(100):
        c = gs.Mission("iss_180").add_crew(adherence=0.0, seed=i)
        inflight = [abs(c.change(mid, d)) for d in range(0, 181, 10)]
        assert all(b >= a - 1e-9 for a, b in zip(inflight, inflight[1:])), (mid, i, inflight)
        assert abs(c.change(mid, 365)) < abs(c.change(mid, 180)) or abs(c.change(mid, 180)) < 1e-9
        assert abs(c.change(mid, 545)) < 0.5 * abs(c.change(mid, 180)) + 1e-9, (mid, i, c.change(mid, 180), c.change(mid, 545))
        assert c.change(mid, -1) == 0


@pytest.mark.slow
def test_fast_responder_and_events_make_every_measure_worse_not_better():
    """A 'fast responder' loses faster on every measure, and an injury event moves the measure in its worse
    direction. (lean_arms has loss_pct = +0.2, so both currently *add* arm muscle.)"""
    for mid in MODELLED:
        worse = worse_sign(mid)
        fast = np.median([gs.Mission("iss_180").add_crew(adherence=0.0, responder="fast", seed=i).change(mid, 90) for i in range(150)])
        typ = np.median([gs.Mission("iss_180").add_crew(adherence=0.0, responder="typical", seed=i).change(mid, 90) for i in range(150)])
        assert worse * (fast - typ) >= 0, f"{mid}: fast responders change {fast:+.2f} % vs typical {typ:+.2f} %"
        c = gs.Mission("iss_180").add_crew(seed=2)
        before = c.true_value(mid, 50)
        c.add_event(day=50, measures=[mid], severity_pct=10, recovery_days=20)
        after = c.true_value(mid, 50)
        assert worse * (after - before) > 0, f"{mid}: event moved the value from {before:.1f} to {after:.1f} (wrong way)"


def test_exercise_does_not_remove_all_variation():
    """With exercise_effect = 1.0 every exercising crew member has exactly zero true change on knee flexion; the data's
    exercise group spread from -10.7 % to +26 %. A countermeasure effect of 100 % is a fit artefact."""
    ch = {round(gs.Mission("iss_180").add_crew(adherence=1.0, seed=i).change("knee_flexion_60", 90), 6) for i in range(50)}
    assert len(ch) > 1, "all exercising crew have identical knee flexion change (exercise_effect = 1.0)"


def test_leg_strength_and_leg_lean_mass_move_together():
    ke, ll, kb, lb = [], [], [], []
    for i in range(400):
        c = gs.Mission("iss_180").add_crew(adherence=0.0, seed=i)
        ke.append(c.change("knee_extension_60", 90)); ll.append(c.change("lean_legs", 90))
        kb.append(c.baseline["knee_extension_60"]); lb.append(c.baseline["lean_legs"])
    assert np.corrcoef(ke, ll)[0, 1] > 0.3, "losses of leg strength and leg lean mass are not correlated"
    assert np.corrcoef(kb, lb)[0, 1] > 0.3, "a person with more leg muscle is not stronger: baselines are sampled independently"


def test_day_labels_phases_and_timestamps():
    m = gs.Mission("iss_180", launch_date="2027-03-01"); c = m.add_crew(seed=1); w = gs.Wearable(noise=0)
    exp = {-60: ("L-60", "preflight", "2026-12-31T12:00:00Z"), -1: ("L-1", "preflight", "2027-02-28T12:00:00Z"),
           0: ("FD1", "flight", "2027-03-01T12:00:00Z"), 1: ("FD2", "flight", "2027-03-02T12:00:00Z"),
           179: ("FD180", "flight", "2027-08-27T12:00:00Z"), 180: ("R+0", "postflight", "2027-08-28T12:00:00Z"),
           181: ("R+1", "postflight", "2027-08-29T12:00:00Z"), 545: ("R+365", "postflight", "2028-08-27T12:00:00Z")}
    for d, (lab, ph, ts) in exp.items():
        r = w.measure(c, d, "resting_hr")
        assert (r.day_label, r.phase, r.timestamp) == (lab, ph, ts), (d, r.day_label, r.phase, r.timestamp)
        assert r.gravity_g == (1.0 if ph != "flight" else 0.0)
    a = gs.Mission("artemis_30").add_crew(seed=1)
    labels = [(d, w.measure(a, d, "resting_hr").day_label, w.measure(a, d, "resting_hr").phase) for d in (0, 12, 18, 29, 30)]
    assert labels == [(0, "FD1", "transit"), (12, "FD13", "lunar_surface"), (18, "FD19", "transit_return"), (29, "FD30", "transit_return"), (30, "R+0", "postflight")]


def test_nasa_schedule_days():
    m = gs.Mission("iss_180"); m.add_crew(seed=1)
    cycle = gs.nasa_days(m, "cycle")
    assert [m.label(d) for d in cycle[:5]] == ["L-60", "L-30", "FD14", "FD75", "FD165"]  # OCHMO-STD-100.1A Table 8 [6028]
    assert m.landing - 14 in cycle and m.landing + 5 in cycle and m.landing + 30 in cycle  # R-14 d; R+5 d, R+30 d
    assert gs.nasa_days(m, "dynamometer")[2:5] == [14.0, 44.0, 74.0]                      # L+14 then every 30 days
    assert not any(0 <= d < m.landing for d in gs.nasa_days(m, "dxa"))                   # no DXA in flight
    tl = m.timeline()
    assert all(r.mission_day == round(r.mission_day, 3) for r in tl) and tl == sorted(tl, key=lambda r: (r.mission_day, r.crew_id, r.instrument, r.measure))


def test_dashboard_uses_only_readings_never_truth():
    m = gs.Mission.random(seed=4); data = gs.DataService(); data.ingest(m.timeline(seed=4))
    health = gs.HealthService(data)
    before = [health.dashboard(c, 120) for c in m.crew]
    for c in m.crew:
        for r in data.readings(c.id):                       # the readings the DataService holds
            r.truth = {"value": -1e9, "change_pct": -1e9, "faults": ["corrupted"]}
    after = [health.dashboard(c, 120) for c in m.crew]
    assert before == after
    for d in after:
        gs.validate_dashboard(d)
