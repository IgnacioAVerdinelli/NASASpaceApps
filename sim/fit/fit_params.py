#!/usr/bin/env python3
"""Fit gravsim's curve parameters from the open NLSP bed-rest data in data/nlsp/ and sim/fit/source_data/.

Run from anywhere:  python sim/fit/fit_params.py
Writes sim/gravsim/params.json. Needs pandas and numpy.

data/nlsp/ keeps only the CFT70 study of MR079G (muscle strength), the one the website uses. The fit compares
bed-rest studies of different lengths, so it reads the other MR079G studies from sim/fit/source_data/
(see the README there). Everything else comes from data/nlsp/.

Every number in params.json is either fitted here (and its source study listed)
or listed under "assumed" for that measure (or under "model" for the generator-wide settings).

What each measure gets:
  curve          loss_pct / rate_pct_per_day, tau_days, exercise_effect, recovery_tau_days
  direction      -1 if the measure falls when the body deconditions, +1 if it rises (physiology, not a fit)
  responder_sd   spread between people of the loss itself, after dropping failed tests
  noise          noise_cv (fitted test-retest or same-day repeat CV), split into device_cv (per reading,
                 assumed instrument accuracy) and bio_cv (day-to-day variation of the person)
  baseline       per-subject pre-bed-rest values of every subject in the files, as quantiles to sample
                 from ("all", "F", "M"), filtered to NASA's astronaut standards where one applies
  data_range     the widest baseline and % change any subject showed: generated readings stay inside it
"""
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "nlsp"
SOURCE_DATA = Path(__file__).resolve().parent / "source_data"     # MR079G studies other than CFT70
OUT = ROOT / "sim" / "gravsim" / "params.json"
MODEL_VERSION = "0.2.0"

# Days in bed per study (from data/nlsp/README.md). Campaign 3 mixed 60- and 90-day
# phases; 75 is the midpoint used for all of its subjects.
BED_DAYS = {"AG Pilot": 21, "HDT30": 30, "Campaign 1": 60, "MEDES": 60, "Campaign 3": 75, "Campaign 11": 70}

# Which way each measure goes when the body deconditions. Physiology, not the sign of a fitted number:
# arm lean mass was fitted at +0.2 %, and that must not make "more arm muscle" the bad direction.
DIRECTION = {
    "knee_extension_60": -1, "knee_flexion_60": -1, "ankle_plantarflexion_30": -1, "ankle_dorsiflexion_30": -1,
    "trunk_extension_60": -1, "trunk_flexion_60": -1,
    "hip_bmd": -1, "spine_bmd": -1, "heel_bmd": -1, "lean_legs": -1, "lean_arms": -1, "lean_trunk": -1,
    "vo2peak": -1, "resting_hr": 1, "resting_sbp": 1, "resting_dbp": 1,
    "spo2": -1, "hrv_rmssd": -1, "heart_rate": 1,
}

# Generator-wide settings. Fitted where the data allows, otherwise assumed and listed here.
MODEL = {
    "z_max": 2.0,                     # a person's response is at most 2 SD from the group median
    "fast_z": [1.2816, 2.0],          # "fast responder": between the 90th percentile and 2 SD
    "shared_response": 0.7,           # weight of the tendency a person shares across measures (assumed)
    "exercise_effect_cap": 0.9,       # no countermeasure removes the whole loss (Campaign 11 knee flexion fitted 1.0)
    "spread_floor": 0.5,              # under exercise, the spread between people shrinks at most to half
    "day_variation_clip_sd": 2.0,     # day-to-day variation of a person, cut at 2 SD
    "device_noise_clip_sd": 2.5,      # instrument noise per reading, cut at 2.5 SD
    "hip_asymmetry_sd_pct": 1.0,      # fixed left/right hip difference per person (assumed)
    "hip_asymmetry_max_pct": 3.0,
    "assumed": [
        "shared_response 0.7: how strongly a fast loser on one measure is a fast loser on the others",
        "spread_floor 0.5: in Campaign 11 and CFT70 the exercise groups spread about as widely as the controls, "
        "so exercise is not allowed to shrink the spread between people below half",
        "exercise_effect_cap 0.9",
        "z_max 2: responders further out than 2 SD are not generated",
        "hip asymmetry N(0, 1 %) cut at 3 %",
    ],
}

# NASA standards for the people the generator draws (crew are astronauts, not bed-rest volunteers).
# Numbers as in sim/tests/nasa_standards.json; test_standards.py checks that the two agree.
ASTRONAUT = {
    "vo2peak_min": 32.9,   # NASA-STD-3001 Vol 1 Rev C, 4.1.1 [V1 4001], p.32: in-mission VO2max >= 32.9 ml/kg/min
    "sbp_below": 140,      # OCHMO-STD-100.1A Rev A, Appendix A, G.3, p.74: hypertension is sustained SBP >= 140
    "dbp_below": 90,       # ... or DBP >= 90 mmHg
}

# Instrument noise per reading (assumed, typical accuracy of the device), as a fraction of the value.
# The fitted test-retest CV is device noise plus the person's day-to-day variation, so
# bio_cv = sqrt(noise_cv^2 - device_cv^2). For DXA the fitted CV comes from same-day repeat scans,
# which is the scanner itself: all of it is device noise, and bone does not change from one day to the next.
DEVICE = {
    **{m: (0.05, "isokinetic dynamometer, about ±5 % per test (assumed)")
       for m in ("knee_extension_60", "knee_flexion_60", "ankle_plantarflexion_30", "ankle_dorsiflexion_30",
                 "trunk_extension_60", "trunk_flexion_60")},
    "vo2peak": (0.03, "metabolic gas analyser, about ±3 % (assumed)"),
    "resting_hr": (0.03, "wearable heart rate, about ±2 bpm at 70 bpm (assumed)"),
    "resting_sbp": (0.033, "blood-pressure cuff, about ±4 mmHg at 120 mmHg (assumed)"),
    "resting_dbp": (0.04, "blood-pressure cuff, about ±3 mmHg at 76 mmHg (assumed)"),
    "spo2": (0.01, "pulse oximeter, about ±1 point (assumed)"),
    "hrv_rmssd": (0.05, "wearable HRV, about ±5 % (assumed)"),
    "heart_rate": (0.03, "spacesuit heart rate, about ±3 % (assumed)"),
}

QUANTILES = list(range(0, 101, 5))     # percentiles stored for sampling baselines (0 = min, 100 = max)


def read_nlsp(path):
    raw = Path(path).read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    df = pd.read_csv(io.StringIO(text))
    df.columns = [str(c).strip() for c in df.columns]
    return df.loc[:, [c for c in df.columns if not c.startswith("Unnamed")]]


def files(pattern):
    """The files matching `pattern` (a path under data/nlsp/). MR079G studies other than CFT70 are read from
    sim/fit/source_data/ instead, which has the same folders."""
    muscle = pattern.startswith("MR079G_isokinetic_muscle/") and not pattern.startswith("MR079G_isokinetic_muscle/MR079G_CFT70/")
    return sorted((SOURCE_DATA if muscle else DATA).glob(pattern))


def rnd(x, n=4):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), n)


def sat(days, tau):
    return 1.0 - np.exp(-np.asarray(days, dtype=float) / tau)


def fit_shared_tau(groups, taus=np.arange(15.0, 150.5, 0.5)):
    """groups: {measure: [(days, change_pct, n), ...]}. Fits change = A_measure * (1 - exp(-days/tau))
    with one tau shared by all measures (weighted least squares, grid search over tau)."""
    best = None
    for tau in taus:
        sse, amps = 0.0, {}
        for m, pts in groups.items():
            d, y, w = (np.array(v, dtype=float) for v in zip(*pts))
            f = sat(d, tau)
            a = (w * y * f).sum() / (w * f * f).sum()
            amps[m] = a
            sse += (w * (y - a * f) ** 2).sum()
        if best is None or sse < best[0]:
            best = (sse, tau, amps)
    return best[1], best[2]


def without_failed_tests(values, k=3.0):
    """Drop values more than k robust SDs (1.4826 x MAD) from the median: failed tests such as the
    -73 % knee extension in MEDES, which no physiology produces in 60 days."""
    v = np.asarray(values, dtype=float)
    v = v[np.isfinite(v)]
    if len(v) < 4:
        return v
    med = np.median(v)
    mad = 1.4826 * np.median(np.abs(v - med))
    return v if mad == 0 else v[np.abs(v - med) <= k * mad]


def responder_sd(cohort_changes, noise_cv, scale):
    """Spread between people of the loss itself, in percentage points of the asymptote (saturating,
    scale(d) = 1 - exp(-d/tau)) or per day (linear, scale(d) = d). Per cohort: failed tests dropped,
    then the SD of the rest, minus the measurement noise of the two tests behind each change (at least
    30 % of the observed spread is kept). Cohorts are weighted by their size."""
    num = den = 0.0
    for d, v in cohort_changes:
        v = without_failed_tests(v)
        if len(v) < 3:
            continue
        sd_obs = float(np.std(v, ddof=1))
        sd_true = np.sqrt(max(sd_obs ** 2 - 2 * (100 * noise_cv) ** 2, (0.3 * sd_obs) ** 2))
        num += len(v) * sd_true / float(scale(d))
        den += len(v)
    return num / den if den else None


def baseline_stats(values, decimals=3):
    """Summary of per-subject baseline values, with the quantiles the generator samples from."""
    v = pd.Series(values, dtype=float).dropna()
    v = v[v > 0]
    if v.empty:
        return None
    return {"mean": rnd(v.mean(), decimals), "sd": rnd(v.std(ddof=1), decimals), "n": int(v.size),
            "min": rnd(v.min(), decimals), "p5": rnd(v.quantile(0.05), decimals), "p95": rnd(v.quantile(0.95), decimals),
            "max": rnd(v.max(), decimals),
            "q": [rnd(v.quantile(p / 100), decimals + 1) for p in QUANTILES]}


def baseline_pools(per_subject, sex, decimals, keep=None, note=None):
    """{"all": stats, "F": stats, "M": stats} over the subjects kept (sex pools need 5 people)."""
    per_subject = pd.Series(per_subject, dtype=float).dropna()
    per_subject = per_subject[per_subject > 0]
    if keep is not None:
        per_subject = per_subject[keep.reindex(per_subject.index).fillna(False).astype(bool)]
    sex = pd.Series(sex).reindex(per_subject.index)
    sex = sex.where(sex.isin(["F", "M"]))
    out = {"all": baseline_stats(per_subject, decimals)}
    for sx in ("F", "M"):
        v = per_subject[sex == sx]
        if len(v) >= 5:
            out[sx] = baseline_stats(v, decimals)
    out["n_unknown_sex"] = int(sex.isna().sum())
    if note:
        out["pool"] = note
    return out


def data_range(baseline_values, change_values, decimals, source):
    """The widest baseline (single tests and per-subject means) and % change any subject showed."""
    b = pd.Series(baseline_values, dtype=float).dropna()
    b = b[b > 0]                                    # one heel scan of 0.0 is a file artefact
    c = pd.Series(change_values, dtype=float).dropna()
    return {"baseline_min": rnd(b.min(), decimals), "baseline_max": rnd(b.max(), decimals),
            "change_pct_min": rnd(c.min(), 2), "change_pct_max": rnd(c.max(), 2),
            "n_baseline_values": int(b.size), "n_changes": int(c.size), "source": source}


def noise_split(mid, noise_cv):
    """(device_cv, bio_cv, note) from the fitted CV: device noise assumed per instrument, the rest is the person."""
    dev, note = DEVICE.get(mid, (noise_cv, "the fitted repeat-scan CV (scanner precision)"))
    dev = min(dev, noise_cv) if mid in DEVICE else noise_cv
    return rnd(dev, 4), rnd(float(np.sqrt(max(noise_cv ** 2 - dev ** 2, 0.0))), 4), note


def spearman(a, b):
    d = pd.concat([pd.Series(a), pd.Series(b)], axis=1).dropna()
    return float(d.iloc[:, 0].rank().corr(d.iloc[:, 1].rank())) if len(d) >= 8 else None


# --------------------------------------------------------------------------- strength (MR079G)
TEST_CODES = {
    ("Knee Concentric Strength", "Extension", "60"): "KES60",
    ("Knee Concentric Strength", "Flexion", "60"): "KFS60",
    ("Ankle Concentric Strength", "Extension", "30"): "APFCS30",
    ("Ankle Concentric Strength", "Flexion", "30"): "ADFCS30",
    ("Back Concentric Strength", "Extension", "60"): "TES60",
    ("Back Concentric Strength", "Flexion", "60"): "TFS60",
}
CFT70_CODES = {("KES", "60"): "KES60", ("KFS", "60"): "KFS60", ("APFCS", "30"): "APFCS30",
               ("ADFCS", "30"): "ADFCS30", ("TES", "60"): "TES60", ("TFS", "60"): "TFS60"}
LONG_FORMAT = {
    "Campaign 1": "MR079G_isokinetic_muscle/MR079G_Campaign_1_Muscle_Strength_Endurance/*_All",
    "Campaign 3": "MR079G_isokinetic_muscle/MR079G_Campaign_3_Isokinetic_Muscle_Function/*",
    "HDT30": "MR079G_isokinetic_muscle/MR079G_HDT30_DataSum/*",
    "AG Pilot": "MR079G_isokinetic_muscle/MR079G_AG_DATASUM/*",
    "MEDES": "MR079G_isokinetic_muscle/MR079G_MEDES_C*/*",
}
NO_COUNTERMEASURE = [("HDT30", "Not labelled"), ("Campaign 1", "Not labelled"),
                     ("Campaign 3", "Not labelled"), ("Campaign 11", "Control")]


def load_strength():
    """The studies the curves are fitted on: the long-format files and Campaign 11's per-subject file."""
    frames = []
    for study, pattern in LONG_FORMAT.items():
        for path in files(pattern):
            df = read_nlsp(path)
            value = df["Value"] if "Value" in df else df["Measured_ft/lb"]
            motion = df["Position"].str.extract(r"(Extension|Flexion) at (\d+)")
            test = df["Test"].str.replace(r"^Trunk (Concentric )?Strength", "Back Concentric Strength", regex=True)
            frames.append(pd.DataFrame({
                "study": study, "subject": study + ":" + df["Subject"].astype(str).str.lstrip("0"),
                "group": "Not labelled", "phase": df["Test_Phase"],
                "br_day": pd.to_numeric(df["BR_Day"], errors="coerce"),
                "code": [TEST_CODES.get(k) for k in zip(test, motion[0], motion[1])],
                "value": pd.to_numeric(value, errors="coerce")}))
    c11 = read_nlsp(files("MR079G_isokinetic_muscle/MR079G_Campaign_11/*_April_2013_MULTI")[0])
    frames.append(pd.DataFrame({
        "study": "Campaign 11", "subject": "Campaign 11:" + c11["Subject"].astype(str),
        "group": c11["Group"].str.title(), "phase": c11["Test_Phase"], "br_day": c11["BR_Day"],
        "code": c11["Parameter"], "value": pd.to_numeric(c11["Measured_Value"], errors="coerce")}))
    return pd.concat(frames, ignore_index=True).dropna(subset=["code", "value"])


def load_strength_all():
    """Every strength subject in the files, for baselines and the data range. Campaign 11's per-subject
    file repeats CFT70's PRE2/POST1/POST2 tests for 15 of CFT70's 42 people, so it is replaced by CFT70
    here (each person counted once). Campaign 17's post-bed-rest file labels its tests PRE_TEST, so only
    its BR-12 (before bed rest) file is used."""
    s = load_strength()
    frames = [s[s.study != "Campaign 11"]]
    for path in files("MR079G_isokinetic_muscle/MR079G_CFT70/MR079G_CFT70_*_strength_ALL"):
        phase, it = re.search(r"_(PRE|POST)(\d)_", path.name).groups()
        df = read_nlsp(path)
        df.columns = ["Group" if c.lower() == "group" else c for c in df.columns]      # GROUP in one file
        frames.append(pd.DataFrame({
            "study": "CFT70", "subject": "CFT70:" + df["Subject"].astype(str), "group": df["Group"].str.title(),
            "phase": phase + "_TEST", "br_day": int(it),
            "code": [CFT70_CODES.get((str(t).strip(), str(a).strip().removesuffix(".0"))) for t, a in zip(df["Test_Type"], df["Angle"])],
            "value": pd.to_numeric(df["Value"], errors="coerce")}))
    c17 = read_nlsp(files("MR079G_isokinetic_muscle/MR079G_Campaign_17_Isokinetic_DataSum/*_BR-12_ALL")[0])
    long = c17.melt(id_vars=["Subject"], value_vars=list(CFT70_CODES.values()), var_name="code", value_name="value")
    frames.append(pd.DataFrame({"study": "Campaign 17", "subject": "Campaign 17:" + long["Subject"].astype(str),
                                "group": "Not labelled", "phase": "PRE_TEST", "br_day": -12, "code": long["code"],
                                "value": pd.to_numeric(long["value"], errors="coerce")}))
    return pd.concat(frames, ignore_index=True).dropna(subset=["code", "value"])


def subject_sex():
    """Sex per subject key ("Campaign 3:224"): from the DXA files (same subject codes as the strength
    files) and CFT70's demographics file. HDT30 and Campaign 17 have no sex in the open files."""
    sex = {}
    for study, pattern in DXA_SETS["hip_bmd"][1].items():
        d = dxa(pattern, study)
        sex.update(d.groupby("SUBJ").SEXC.first().to_dict())
    demo = read_nlsp(files("MR079G_isokinetic_muscle/MR079G_CFT70/MR079G_CFT70_Demographics_ALL")[0])
    sex.update({"CFT70:" + str(k): str(v).strip().upper()[:1] for k, v in demo.groupby("Subject").Sex.first().items()})
    return pd.Series({k: v for k, v in sex.items() if v in ("F", "M")})


def strength_params(sex):
    s = load_strength()
    pre = s[s.phase == "PRE_TEST"]
    post = s[s.phase == "POST_TEST"].sort_values("br_day")
    before = pre.groupby(["study", "group", "code", "subject"]).value.mean()
    first = post.groupby(["study", "group", "code", "subject"]).first()
    ch = pd.concat([before.rename("before"), first.value.rename("after"), first.br_day.rename("post_day")], axis=1).dropna()
    ch["change"] = 100 * (ch.after / ch.before - 1)
    ch = ch.reset_index()

    # cohort medians (median resists the few failed tests, e.g. -74 %)
    cohorts = ch.groupby(["study", "group", "code"]).change.agg(["median", "size"]).reset_index()
    groups, observed = {}, {}
    for code in TEST_CODES.values():
        pts, obs = [], []
        for study, group in NO_COUNTERMEASURE:
            row = cohorts[(cohorts.study == study) & (cohorts.group == group) & (cohorts.code == code)]
            if row.empty:
                continue
            med, n = float(row["median"].iloc[0]), int(row["size"].iloc[0])
            obs.append({"cohort": f"{study} ({group})", "days": BED_DAYS[study], "change_pct": rnd(med, 2), "n": n})
            if not (code == "TFS60" and study == "Campaign 11"):
                pts.append((BED_DAYS[study], med, n))
        groups[code], observed[code] = pts, obs
    # One timescale for every strength test, fitted on knee extension (most subjects, cleanest test);
    # the other tests' curves are too uneven across studies to pin a timescale down.
    tau, _ = fit_shared_tau({"KES60": groups["KES60"]})
    amps = {}
    for code, pts in groups.items():
        d, y, w = (np.array(v, dtype=float) for v in zip(*pts))
        f = sat(d, tau)
        amps[code] = (w * y * f).sum() / (w * f * f).sum()

    # exercise effect: Campaign 11 exercise vs control at 70 days
    c11 = cohorts[cohorts.study == "Campaign 11"].pivot_table(index="code", columns="group", values="median")
    effects = {}
    for code in TEST_CODES.values():
        if code in c11.index and c11.loc[code, "Control"] < -3:
            e = 1 - c11.loc[code, "Exercise"] / c11.loc[code, "Control"]
            effects[code] = float(np.clip(e, 0, 1))
    fallback_effect = float(np.median(list(effects.values())))

    def cohort_changes(code):
        return [(BED_DAYS[st], ch[(ch.study == st) & (ch.group == g) & (ch.code == code)].change.values)
                for st, g in NO_COUNTERMEASURE]

    # test-retest: subjects with two or more sessions before bed rest
    sess = pre.groupby(["code", "subject", "br_day"]).value.mean().reset_index()
    rep = sess.groupby(["code", "subject"]).value.agg(["mean", "std", "size"])
    rep = rep[rep["size"] >= 2]
    noise = (rep["std"] / rep["mean"]).groupby("code").apply(lambda v: float(np.sqrt((v ** 2).mean())))

    # recovery: later sessions after bed rest relative to the first one
    rec = []
    nocm = pd.concat([post[(post.study == st) & (post.group == g)] for st, g in NO_COUNTERMEASURE])
    nocm = nocm.merge(before.rename("before").reset_index(), on=["study", "group", "code", "subject"])
    nocm["change"] = 100 * (nocm.value / nocm.before - 1)
    for (code, subj), g in nocm.groupby(["code", "subject"]):
        g = g.sort_values("br_day")
        if len(g) < 2 or g.change.iloc[0] > -5:
            continue
        s0, d0 = g.change.iloc[0], g.br_day.iloc[0]
        for _, r in g.iloc[1:].iterrows():
            ratio = r.change / s0
            if r.br_day - d0 >= 3 and 0.05 < ratio < 0.98:
                rec.append(-(r.br_day - d0) / np.log(ratio))
    rec_tau = float(np.median(rec)) if len(rec) >= 8 else None

    # baselines and data range: every subject in the files (Campaign 17 and CFT70 included)
    every = load_strength_all()
    every_pre = every[every.phase == "PRE_TEST"]
    per_subject = every_pre.groupby(["code", "subject"]).value.mean()
    every_post = every[every.phase == "POST_TEST"].merge(per_subject.rename("before").reset_index(), on=["code", "subject"])
    every_post["change"] = 100 * (every_post.value / every_post.before - 1)
    studies = ", ".join(sorted(every.study.unique()))

    meta = {
        "KES60": ("knee_extension_60", "Knee extension, 60°/s", "Quadriceps", ["quadriceps_l", "quadriceps_r"]),
        "KFS60": ("knee_flexion_60", "Knee flexion, 60°/s", "Hamstrings", ["hamstrings_l", "hamstrings_r"]),
        "APFCS30": ("ankle_plantarflexion_30", "Ankle plantarflexion, 30°/s", "Calves", ["calf_l", "calf_r"]),
        "ADFCS30": ("ankle_dorsiflexion_30", "Ankle dorsiflexion, 30°/s", "Shins", ["shin_muscles_l", "shin_muscles_r"]),
        "TES60": ("trunk_extension_60", "Trunk extension, 60°/s", "Back", ["back_muscles_l", "back_muscles_r"]),
        "TFS60": ("trunk_flexion_60", "Trunk flexion, 60°/s", "Abdominals", ["abdominal_muscles"]),
    }
    out, per_subject_by_mid = {}, {}
    for code, (mid, label, region, keys) in meta.items():
        assumed = []
        e = effects.get(code)
        if e is None:
            e = fallback_effect
            assumed.append("exercise_effect (median of the other strength tests)")
        ncv = float(noise.get(code, 0.06))
        rsd = responder_sd(cohort_changes(code), ncv, lambda d: sat(d, tau))
        rt = rec_tau
        if rt is None:
            rt = 30.0
            assumed.append("recovery_tau_days")
        subj = per_subject.xs(code, level="code")
        per_subject_by_mid[mid] = subj
        out[mid] = {
            "instrument": "dynamometer", "code": code, "label": label, "region": region, "muscle_keys": keys,
            "unit": "ft-lb", "decimals": 1, "model": "saturating",
            "loss_pct": rnd(amps[code], 2), "tau_days": float(tau), "exercise_effect": rnd(e, 3),
            "recovery_tau_days": rnd(rt, 1), "responder_sd": rnd(rsd, 3), "noise_cv": rnd(ncv, 4),
            "baseline": baseline_pools(subj, sex, 1, note=f"per-subject mean of the pre-bed-rest tests: {studies}"),
            "data_range": data_range(pd.concat([every_pre[every_pre.code == code].value, subj]),
                                     every_post[every_post.code == code].change, 1,
                                     f"MR079G pre-bed-rest tests and every post-bed-rest test: {studies}"),
            "observed": observed[code] + ([{"cohort": "Campaign 11 (Exercise)", "days": 70,
                                             "change_pct": rnd(c11.loc[code, "Exercise"], 2)}] if code in c11.index else []),
            "source": "MR079G (doi:10.83263/bk5h-r757): curve from HDT30, Campaign 1, Campaign 3, Campaign 11; "
                      f"baselines from {studies}",
            "assumed": assumed,
        }
        if code == "TFS60":
            out[mid]["assumed"].append("Campaign 11 trunk flexion runs the wrong way (+18 % control), left out of the fit")
    notes = {"strength_tau_days": float(tau), "strength_recovery_estimates": len(rec),
             "strength_subjects": int(every_pre.subject.nunique()),
             "strength_subjects_by_study": {k: int(v) for k, v in every_pre.groupby("study").subject.nunique().items()}}
    return out, notes, per_subject_by_mid


# --------------------------------------------------------------------------- DXA (MR035G)
def dxa(pattern, study):
    out = []
    for path in files("MR035G_bone_densitometry/" + pattern):
        df = read_nlsp(path)
        df.columns = [c.upper() for c in df.columns]
        df["STUDY"] = study
        df["SUBJ"] = study + ":" + df["SUBJECT"].astype(str).str.lstrip("0")
        df["DAY"] = pd.to_datetime(df.get("SCAN_DATE", df.get("DATE")), format="mixed", errors="coerce").dt.normalize()
        df["PHASE"] = df["TEST_PHASE"].astype(str) if "TEST_PHASE" in df else ""
        df["SEXC"] = df["SEX"].astype(str).str.upper().str[0] if "SEX" in df else ""
        side = re.search(r"_(LH|RH)_[Bb]one", path.name)
        df["SIDE"] = side.group(1) if side else ""
        out.append(df)
    return pd.concat(out, ignore_index=True)


def over_time(df, value):
    """One value per subject and scan day: same-day repeats averaged (their spread kept for the scanner
    precision), then left and right hips averaged, the way gravsim's hip_bmd sits between the two sides."""
    df = df[pd.to_numeric(df[value], errors="coerce") > 0]          # drop the odd 0.0 scan
    sides = (df.dropna(subset=["DAY", value]).groupby(["STUDY", "SUBJ", "DAY", "SIDE"], as_index=False)
               .agg(value=(value, "mean"), dup_sd=(value, "std"), dup_n=(value, "size"),
                    phase=("PHASE", "first"), sex=("SEXC", "first")))
    daily = (sides.groupby(["STUDY", "SUBJ", "DAY"], as_index=False)
                  .agg(value=("value", "mean"), dup_sd=("dup_sd", "mean"), dup_n=("dup_n", "min"),
                       phase=("phase", "first"), sex=("sex", "first")).sort_values("DAY"))
    g = daily.groupby(["STUDY", "SUBJ"])
    daily["days"] = (daily.DAY - g.DAY.transform("min")).dt.days
    daily["base"] = g.value.transform("first")
    daily["change"] = 100 * (daily.value / daily.base - 1)
    return daily


def precision(daily, default):
    """Scanner precision from same-day repeat scans: median CV x 1.25 (robust to the odd mismatched pair)."""
    dup = daily[daily.dup_n >= 2]
    cv = (dup.dup_sd / dup.value).dropna()
    return float(1.25 * cv.median()) if len(cv) >= 5 else default


def first_after(daily):
    known = daily.phase.isin(["PRE_TEST", "IN_TEST", "POST_TEST"])
    cand = daily[(daily.phase == "POST_TEST") | (~known & (daily.days >= 20))]
    return cand.sort_values("days").groupby(["STUDY", "SUBJ"]).first().reset_index()


DXA_SETS = {
    "hip_bmd": ("HTOT_BMD", {"Campaign 1": "MR035G_Campaign_1_DXA/*H_Bone", "Campaign 3": "MR035G_Campaign_3_DXA_Hip/*H_Bone",
                             "MEDES": "MR035G_MEDES_DXA/*H_bone_ALL", "AG Pilot": "MR035G_AG_PILOT_DXA_ANALYZED/*H_bone_*"}),
    "spine_bmd": ("TOT_BMD", {"Campaign 1": "MR035G_Campaign_1_DXA/*S_Bone", "Campaign 3": "MR035G_Campaign_3_DXA_Spine/*S_Bone",
                              "MEDES": "MR035G_MEDES_DXA/*S_bone_ALL", "AG Pilot": "MR035G_AG_PILOT_DXA_ANALYZED/*_S_bone_*"}),
    "heel_bmd": ("NET_AVG_BMD", {"Campaign 1": "MR035G_Campaign_1_DXA/*Heel", "Campaign 3": "MR035G_Campaign_3_DXA_Heel/*",
                                 "AG Pilot": "MR035G_AG_PILOT_DXA_ANALYZED/*Heel_*"}),
}
LEAN_SETS = {"Campaign 1": "MR035G_Campaign_1_DXA/*WB_Comp", "Campaign 3": "MR035G_Campaign_3_DXA_Whole_Body/*WB_Comp*",
             "AG Pilot": "MR035G_AG_PILOT_DXA_ANALYZED/*WB_comp*", "MEDES": "MR035G_MEDES_DXA/*WB_comp*"}
LEAN_REGIONS = {"lean_legs": ["L_LEG_LEAN", "R_LEG_LEAN"], "lean_arms": ["LARM_LEAN", "RARM_LEAN"], "lean_trunk": ["TRUNK_LEAN"]}
BONE_STUDIES = ["Campaign 1", "Campaign 3", "MEDES"]   # AG Pilot left out of the curves: 21 days and centrifuge mixed in


def dxa_baseline(daily, decimals, source):
    """Per-subject baseline (the first scan day) as pools, and the data range over every subject and study.
    For the range, each subject's change is the first scan after bed rest (POST_TEST, or 20 to 120 days
    after the first scan where the files have no phase) against the mean of their pre-bed-rest scan days."""
    firsts = daily.sort_values("DAY").groupby("SUBJ").first()
    pre = daily[daily.phase == "PRE_TEST"].groupby("SUBJ").value.mean().reindex(firsts.index).fillna(firsts.value)
    known = daily.phase.isin(["PRE_TEST", "IN_TEST", "POST_TEST"])
    post = daily[(daily.phase == "POST_TEST") | (~known & daily.days.between(20, 120))]
    post = post.sort_values("days").groupby("SUBJ").value.first()
    change = 100 * (post / pre.reindex(post.index) - 1)
    return (baseline_pools(firsts.value, firsts.sex, decimals,
                           note="first scan of every subject: " + ", ".join(sorted(daily.STUDY.unique()))),
            data_range(pd.concat([firsts.value, pre]), change, decimals,
                       source + "; per-subject baseline, first scan after bed rest"),
            firsts.value)


def dxa_params(strength_tau, strength_rec_tau, strength_effect):
    out, per_subject = {}, {}
    # ---- bone: linear loss while unloaded, exponential recovery afterwards
    labels = {"hip_bmd": ("Total hip bone density", "Hip", []),
              "spine_bmd": ("Lumbar spine (L1-L4) bone density", "Lumbar spine", []),
              "heel_bmd": ("Heel bone density", "Heel", [])}
    for mid, (col, studies) in DXA_SETS.items():
        daily = pd.concat([over_time(dxa(p, st), col) for st, p in studies.items()], ignore_index=True)
        after = first_after(daily)
        rates, observed = [], []
        for st in BONE_STUDIES:
            a = after[after.STUDY == st]
            if len(a) >= 3:
                rates.append((a.change.median() / BED_DAYS[st], len(a)))
                observed.append({"cohort": st, "days": BED_DAYS[st], "change_pct": rnd(a.change.median(), 2), "n": int(len(a))})
        rate = sum(r * n for r, n in rates) / sum(n for _, n in rates)
        # recovery: Campaign 3 scans months after the first post-bed-rest scan
        rec = []
        c3 = daily[daily.STUDY == "Campaign 3"]
        for subj, g in c3.groupby("SUBJ"):
            a = after[after.SUBJ == subj]
            if a.empty or a.change.iloc[0] > -1.0:
                continue
            s0, d0 = a.change.iloc[0], a.days.iloc[0]
            for _, r in g[g.days > d0 + 60].iterrows():
                ratio = r.change / s0
                if 0.05 < ratio < 0.98:
                    rec.append(-(r.days - d0) / np.log(ratio))
        prec = precision(daily, 0.01)
        src = "MR035G (doi:10.83263/7myc-5j86): " + ", ".join(studies)
        base, rng_, per_subject[mid] = dxa_baseline(daily, 3, src)
        label, region, keys = labels[mid]
        out[mid] = {
            "instrument": "dxa", "code": col, "label": label, "region": region, "muscle_keys": keys,
            "unit": "g/cm²", "decimals": 3, "model": "linear",
            "rate_pct_per_day": rnd(rate, 5), "exercise_effect": 0.5,
            "recovery_tau_days": rnd(np.median(rec), 1) if len(rec) >= 5 else 300.0,
            "responder_sd": rnd(responder_sd([(BED_DAYS[st], after[after.STUDY == st].change.values) for st in BONE_STUDIES],
                                             prec, lambda d: d), 5),
            "noise_cv": rnd(prec, 4), "baseline": base, "data_range": rng_, "observed": observed,
            "source": "MR035G (doi:10.83263/7myc-5j86): " + ", ".join(BONE_STUDIES) + "; recovery from Campaign 3 follow-up scans",
            "assumed": ["exercise_effect (no open DXA data with exercise groups; 0.5 is a placeholder)"]
                       + ([] if len(rec) >= 5 else ["recovery_tau_days"]),
        }
    out["spine_bmd"]["assumed"].append(
        "the bed-rest fit is nearly flat (-0.1 % a month); spaceflight spine loss is likely larger than bed rest suggests")
    # ---- lean mass by region: saturating, timescale shared with strength
    lean_daily = {}
    for st, pattern in LEAN_SETS.items():
        wb = dxa(pattern, st)
        for mid, cols in LEAN_REGIONS.items():
            wb[mid] = wb[cols].apply(pd.to_numeric, errors="coerce").sum(axis=1, min_count=len(cols))
            lean_daily.setdefault(mid, []).append(over_time(wb, mid))
    lean_meta = {"lean_legs": ("Leg lean mass", "Legs", ["quadriceps_l", "quadriceps_r", "hamstrings_l", "hamstrings_r",
                                                          "adductors_l", "adductors_r", "calf_l", "calf_r"]),
                 "lean_arms": ("Arm lean mass", "Arms", ["upper_arm_muscles_l", "upper_arm_muscles_r",
                                                          "forearm_muscles_l", "forearm_muscles_r"]),
                 "lean_trunk": ("Trunk lean mass", "Trunk", ["back_muscles_l", "back_muscles_r", "abdominal_muscles"])}
    for mid, parts in lean_daily.items():
        daily = pd.concat(parts, ignore_index=True)
        after = first_after(daily)
        pts, observed = [], []
        for st in BONE_STUDIES:
            a = after[after.STUDY == st]
            if len(a) >= 3:
                pts.append((BED_DAYS[st], a.change.median(), len(a)))
                observed.append({"cohort": st, "days": BED_DAYS[st], "change_pct": rnd(a.change.median(), 2), "n": int(len(a))})
        d, y, w = (np.array(v, dtype=float) for v in zip(*pts))
        f = sat(d, strength_tau)
        amp = (w * y * f).sum() / (w * f * f).sum()
        prec = precision(daily, 0.015)
        src = "MR035G (doi:10.83263/7myc-5j86) whole-body scans: " + ", ".join(LEAN_SETS)
        base, rng_, per_subject[mid] = dxa_baseline(daily, 0, src)
        label, region, keys = lean_meta[mid]
        out[mid] = {
            "instrument": "dxa", "code": "+".join(LEAN_REGIONS[mid]), "label": label, "region": region, "muscle_keys": keys,
            "unit": "g", "decimals": 0, "model": "saturating",
            "loss_pct": rnd(amp, 2), "tau_days": strength_tau, "exercise_effect": rnd(strength_effect, 3),
            "recovery_tau_days": strength_rec_tau,
            "responder_sd": rnd(responder_sd([(BED_DAYS[st], after[after.STUDY == st].change.values) for st in BONE_STUDIES],
                                             prec, lambda d: sat(d, strength_tau)), 3),
            "noise_cv": rnd(prec, 4), "baseline": base, "data_range": rng_, "observed": observed,
            "source": "MR035G (doi:10.83263/7myc-5j86) whole-body scans: " + ", ".join(BONE_STUDIES),
            "assumed": ["tau_days (shared with strength)", "exercise_effect (taken from knee extension)",
                        "recovery_tau_days (shared with strength)"],
        }
    return out, per_subject


# --------------------------------------------------------------------------- Campaign 11 / CFT70 (MR080G)
def cft70():
    df = pd.concat([read_nlsp(p) for p in files("MR080G_aerobic_capacity/MR080G_CFT70/MR080G_CFT70_*_ALL")
                    if "avgs" not in p.name], ignore_index=True)
    for c in ["REL VO2PK", "WEIGHT", "AGE", "HRsupine", "SBPsupine", "DBPsupine", "HRseated", "BR DAY"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["GROUP"] = df["GROUP"].str.title()
    df["SUBJ"] = "CFT70:" + df["SUBJECT"].astype(str)
    return df


def vo2_other_studies():
    """Peak VO2 (ml/kg/min) of Campaign 3 (peak cycle tests) and Campaign 1 (graded test): per-subject
    baseline and first post-bed-rest change. Used for the baseline pool and the data range only."""
    def norm(c):
        low = c.strip().lower()
        return "vo2" if low.startswith("rvo2") or "ml/kg" in low else c.strip()
    rows = []
    for p in files("MR080G_aerobic_capacity/MR080G_Campaign_3_Aerobic_Capacity_Summary/*Peak*summary.csv"):
        df = read_nlsp(p)
        df.columns = [norm(c) for c in df.columns]
        df = df.loc[:, ~df.columns.duplicated()]
        pk = df[df["Stage"].astype(str).str.strip() == "Peak"]
        rows.append(pd.DataFrame({"subj": "Campaign 3:" + pk["Subject"].astype(str).str.lstrip("0"),
                                  "phase": pk["Test_Phase"].astype(str).str.strip(),
                                  "br_day": pd.to_numeric(pk["BR_Day"], errors="coerce"),
                                  "vo2": pd.to_numeric(pk["vo2"], errors="coerce")}))
    c1 = read_nlsp(files("MR080G_aerobic_capacity/MR080G_Campaign_1_Physical_Fitness_Evaluation/*GXT_*All")[0])
    c1 = c1[c1["Stage"].astype(str).str.strip() == "Peak"]
    rows.append(pd.DataFrame({"subj": "Campaign 1:" + c1["Subject"].astype(str), "phase": c1["Test_Phase"].astype(str).str.strip(),
                              "br_day": pd.to_numeric(c1["BR_Day"], errors="coerce"), "vo2": pd.to_numeric(c1["RVO2"], errors="coerce")}))
    v = pd.concat(rows, ignore_index=True).dropna(subset=["vo2"])
    pre = v[v.phase == "PRE_TEST"].groupby("subj").vo2.mean()
    post = v[v.phase == "POST_TEST"].sort_values("br_day").groupby("subj").vo2.first()
    change = (100 * (post / pre - 1)).dropna()
    return pre, change


def cft_measure(df, col, mid, instrument, label, unit, decimals, strength_tau, source, extra_pre=None, extra_change=None,
                keep=None, filter_note=None):
    wide = df.pivot_table(index=["GROUP", "SUBJECT"], columns="TEST", values=col)
    day = df.pivot_table(index=["GROUP", "SUBJECT"], columns="TEST", values="BR DAY").reindex(wide.index)
    ch1 = 100 * (wide.POST1 / wide.PRE - 1)
    ch2 = 100 * (wide.POST2 / wide.PRE - 1)
    ctrl, ex = ch1.xs("Control").median(), ch1.xs("Exercise").median()
    amp = ctrl / sat(70, strength_tau)
    effect = float(np.clip(1 - ex / ctrl, 0, 1)) if abs(ctrl) > 1 else 0.0
    rec = []
    for subj in ch1.xs("Control").index:
        s1, s2 = ch1.loc[("Control", subj)], ch2.loc[("Control", subj)]
        dd = day.loc[("Control", subj), "POST2"] - day.loc[("Control", subj), "POST1"]
        if np.isfinite(s1) and np.isfinite(s2) and np.isfinite(dd) and abs(s1) > 3 and 0.05 < s2 / s1 < 0.98 and dd > 0:
            rec.append(-dd / np.log(s2 / s1))
    # test-retest: screening vs pre-bed-rest test, failed tests dropped as in responder_sd (one subject's
    # systolic pressure read 36 % higher at the second visit)
    rep = 100 * (wide.PRE / wide.SCREEN - 1)
    noise = float(np.std(without_failed_tests(rep.values)) / 100 / np.sqrt(2))
    pre = df[df.TEST == "PRE"].set_index("SUBJ")
    per_subject = pre[col]
    sex = pre.SEX.astype(str).str.upper().str[0]
    if extra_pre is not None:
        per_subject = pd.concat([per_subject, extra_pre])
    changes = pd.concat([ch1.dropna()] + ([extra_change] if extra_change is not None else []))
    single = df[df.TEST.isin(["PRE", "SCREEN"])][col]
    studies = "CFT70" + (", Campaign 3, Campaign 1" if extra_pre is not None else "")
    keep_mask = keep(per_subject) if keep is not None else None
    base = baseline_pools(per_subject, sex, decimals, keep=keep_mask,
                          note=f"per-subject pre-bed-rest value: {studies}" + (f"; {filter_note}" if filter_note else ""))
    return {
        "instrument": instrument, "code": col, "label": label, "region": None, "muscle_keys": [],
        "unit": unit, "decimals": decimals, "model": "saturating",
        "loss_pct": rnd(amp, 2), "tau_days": strength_tau, "exercise_effect": rnd(effect, 3),
        "recovery_tau_days": rnd(np.median(rec), 1) if len(rec) >= 4 else 10.0,
        "responder_sd": rnd(responder_sd([(70, ch1.xs("Control").values)], noise, lambda d: sat(d, strength_tau)), 3),
        "noise_cv": rnd(noise, 4), "baseline": base,
        "data_range": data_range(pd.concat([single, per_subject]), changes, decimals,
                                 f"MR080G {studies}: pre-bed-rest and screening tests; first test after bed rest vs PRE"),
        "observed": [{"cohort": "Campaign 11 (Control)", "days": 70, "change_pct": rnd(ctrl, 2), "n": int(ch1.xs("Control").notna().sum())},
                     {"cohort": "Campaign 11 (Exercise)", "days": 70, "change_pct": rnd(ex, 2), "n": int(ch1.xs("Exercise").notna().sum())},
                     {"cohort": "Campaign 11 (Control), ~10 days after", "days": None, "change_pct": rnd(ch2.xs("Control").median(), 2),
                      "n": int(ch2.xs("Control").notna().sum())}],
        "source": source,
        "assumed": ["tau_days (shared with strength; the data has one bed-rest length)"]
                   + ([] if len(rec) >= 4 else ["recovery_tau_days"]),
    }


def aerobic_and_wearable(strength_tau):
    df = cft70()
    src = "MR080G (doi:10.83263/w056-8t76), Campaign 11 / CFT70"
    pre = df[df.TEST == "PRE"].set_index("SUBJ")
    # astronaut standards for the people drawn: VO2peak >= 32.9 [V1 4001]; BP below 140/90 (OCHMO-STD-100.1A App. A G.3)
    bp_ok = (pre.SBPsupine < ASTRONAUT["sbp_below"]) & (pre.DBPsupine < ASTRONAUT["dbp_below"])
    bp_note = (f"kept only subjects below {ASTRONAUT['sbp_below']}/{ASTRONAUT['dbp_below']} mmHg "
               f"(OCHMO-STD-100.1A Rev A, Appendix A, G.3): {int(bp_ok.sum())} of {int(bp_ok.size)}")
    vo2_pre, vo2_change = vo2_other_studies()
    all_vo2 = pd.concat([pre["REL VO2PK"], vo2_pre])
    vo2_ok = all_vo2 >= ASTRONAUT["vo2peak_min"]
    vo2_note = (f"kept only subjects with VO2peak >= {ASTRONAUT['vo2peak_min']} ml/kg/min "
                f"(NASA-STD-3001 Vol 1 Rev C [V1 4001]): {int(vo2_ok.sum())} of {int(all_vo2.notna().sum())}")
    out = {"vo2peak": cft_measure(df, "REL VO2PK", "vo2peak", "cycle", "Peak oxygen uptake (VO2peak)", "ml/kg/min", 1,
                                  strength_tau, src + "; REL VO2PK only (other peak columns are shifted in some rows); "
                                  "baselines and data range also from Campaign 3 and Campaign 1 peak tests",
                                  extra_pre=vo2_pre, extra_change=vo2_change,
                                  keep=lambda v: v >= ASTRONAUT["vo2peak_min"], filter_note=vo2_note)}
    out["resting_hr"] = cft_measure(df, "HRsupine", "resting_hr", "wearable", "Resting heart rate (supine)", "bpm", 0,
                                    strength_tau, src + "; supine rest before the cycle test")
    out["resting_sbp"] = cft_measure(df, "SBPsupine", "resting_sbp", "wearable", "Resting systolic pressure", "mmHg", 0,
                                     strength_tau, src + "; supine rest before the cycle test",
                                     keep=lambda v: bp_ok.reindex(v.index), filter_note=bp_note)
    out["resting_dbp"] = cft_measure(df, "DBPsupine", "resting_dbp", "wearable", "Resting diastolic pressure", "mmHg", 0,
                                     strength_tau, src + "; supine rest before the cycle test",
                                     keep=lambda v: bp_ok.reindex(v.index), filter_note=bp_note)
    extra = {"cycle": {"age": baseline_stats(pre.AGE, 0), "weight_kg": {"all": baseline_stats(pre.WEIGHT, 1)},
                       "hr_seated_rest": baseline_stats(pre.HRseated, 0)}}
    for v in extra["cycle"].values():
        (v.get("all", v)).pop("q", None)
    return out, extra, pre


def gxt_validation():
    """Heart-rate rise at the same workload in Campaign 3 (used by the tests, not by the model)."""
    def col(name):
        n = name.lower()
        if n.startswith(("workload", "watts")):
            return "watts"
        if n.startswith("hr"):
            return "hr"
        return name
    gx = [read_nlsp(p).rename(columns=col) for p in files("MR080G_aerobic_capacity/MR080G_Campaign_3_Aerobic_Capacity_Summary/*.csv")
          if "Submax" not in p.name]
    gx = pd.concat([d.loc[:, ~d.columns.duplicated()] for d in gx], ignore_index=True)
    gx["watts"] = pd.to_numeric(gx.watts, errors="coerce")
    gx["hr"] = pd.to_numeric(gx.hr, errors="coerce")
    gx = gx[(gx.watts > 0) & (gx.Stage.astype(str).str.strip() != "Peak")]
    t = gx.groupby(["Subject", "Test_Phase", "Date", "BR_Day"], as_index=False).size()
    pre = t[t.Test_Phase == "PRE_TEST"].sort_values("BR_Day").groupby("Subject").first()
    post = t[t.Test_Phase == "POST_TEST"].sort_values("BR_Day").groupby("Subject").first()
    both = pre.index.intersection(post.index)
    rows = []
    for subj in both:
        a = gx[(gx.Subject == subj) & (gx.Date == pre.loc[subj, "Date"])].groupby("watts").hr.mean()
        b = gx[(gx.Subject == subj) & (gx.Date == post.loc[subj, "Date"])].groupby("watts").hr.mean()
        for w in a.index.intersection(b.index):
            rows.append(b[w] - a[w])
    return {"campaign3_extra_hr_same_workload_bpm": {"median": rnd(np.median(rows), 1), "n_pairs": len(rows)}}


# --------------------------------------------------------------------------- shared factors between baselines
def baseline_factors(strength, lean, cft_pre, sex):
    """Gaussian-copula loadings: a person's baselines are drawn from the empirical distributions above, tied
    together by shared standard-normal factors. Of two people of the same sex, the one with more leg muscle is
    usually stronger. Loadings from rank correlations within sex (pairwise r = loading_a x loading_b)."""
    size_measures = list(strength) + list(lean)
    table = pd.concat([pd.Series(v, name=k) for k, v in {**strength, **lean}.items()], axis=1)
    table["sex"] = sex.reindex(table.index)
    pairs = []
    for sx in ("F", "M"):
        t = table[table.sex == sx]
        for i, a in enumerate(size_measures):
            for b in size_measures[i + 1:]:
                r = spearman(t[a], t[b])
                if r is not None:
                    pairs.append(r)
    r_size = float(np.median(pairs))
    lam = float(np.sqrt(max(r_size, 0.0)))
    # VO2peak per kg and body mass against strength: CFT70 men (same subject codes in MR079G and MR080G)
    men = cft_pre[cft_pre.SEX.astype(str).str.upper().str[0] == "M"]
    r_vo2 = [spearman(strength[m].reindex(men.index), men["REL VO2PK"]) for m in strength]
    r_mass = [spearman(strength[m].reindex(men.index), men["WEIGHT"]) for m in strength]
    lam_vo2 = float(np.clip(np.median([r for r in r_vo2 if r is not None]) / lam, -0.9, 0.9))
    lam_mass = float(np.clip(np.median([r for r in r_mass if r is not None]) / lam, -0.9, 0.9))
    r_bp = spearman(cft_pre.SBPsupine, cft_pre.DBPsupine)
    lam_bp = float(np.sqrt(max(r_bp, 0.0)))
    n_matched = int(table.dropna(subset=["knee_extension_60", "lean_legs"]).shape[0])
    return {
        "size": {"loadings": {**{m: rnd(lam, 3) for m in size_measures}, "vo2peak": rnd(lam_vo2, 3), "mass_kg": rnd(lam_mass, 3)},
                 "source": f"rank correlations within sex: strength and lean mass on {n_matched} subjects with both "
                           f"(MR079G and MR035G share subject codes), median pairwise r = {r_size:.2f}; VO2peak and body mass "
                           f"against strength on CFT70 men (median r = {np.median([r for r in r_vo2 if r is not None]):.2f} and "
                           f"{np.median([r for r in r_mass if r is not None]):.2f}): heavier people are stronger, VO2 per kg barely follows strength"},
        "blood_pressure": {"loadings": {"resting_sbp": rnd(lam_bp, 3), "resting_dbp": rnd(lam_bp, 3)},
                           "source": f"CFT70 pre-bed-rest supine values, rank correlation of systolic and diastolic r = {r_bp:.2f}"},
    }


ASSUMED_WEARABLE = {
    "spo2": {"instrument": "wearable", "code": None, "label": "Blood oxygen saturation (SpO2)", "region": None, "muscle_keys": [],
             "unit": "%", "decimals": 0, "model": "constant",
             "baseline": {"all": {"mean": 97.5, "sd": 1.0, "min": 95, "p5": 96, "p95": 99, "max": 100}},
             "noise_cv": 0.01, "responder_sd": 0.0, "source": "not in the data",
             "assumed": ["whole measure: typical healthy range 95-100 %, no trend; replace with a cited source"]},
    "hrv_rmssd": {"instrument": "wearable", "code": None, "label": "Heart-rate variability (RMSSD)", "region": None, "muscle_keys": [],
                  "unit": "ms", "decimals": 0, "model": "constant",
                  "baseline": {"all": {"mean": 42, "sd": 15, "min": 15, "p5": 20, "p95": 75, "max": 90}},
                  "noise_cv": 0.15, "responder_sd": 0.0, "source": "not in the data",
                  "assumed": ["whole measure: typical adult range, no trend; replace with a cited source"]},
}


# The spacesuit's heart rate during a spacewalk, for crew context. "derived": the instrument computes it from the
# person's resting heart rate (instruments.eva_heart_rate), so it has no baseline and draws nothing per person.
ASSUMED_SUIT = {
    "heart_rate": {"instrument": "suit", "code": None, "label": "Heart rate (spacesuit, during a spacewalk)", "region": None,
                   "muscle_keys": [], "unit": "bpm", "decimals": 0, "model": "derived", "noise_cv": 0.03, "responder_sd": 0.0,
                   "source": "not in the data",
                   "assumed": ["whole measure: resting heart rate that day plus 0.2 to 0.5 of the way to maximum, changing "
                               "with each task (instruments.eva_heart_rate); replace with a cited source"]},
}


def finish(mid, m):
    """Rules every measure gets after its fit: direction, the exercise cap, no improvement while unloaded,
    and the noise split."""
    m["direction"] = DIRECTION[mid]
    if m["model"] not in ("constant", "derived"):
        e = m.get("exercise_effect") or 0.0
        if e > MODEL["exercise_effect_cap"]:
            m["exercise_effect"] = MODEL["exercise_effect_cap"]
            m["assumed"].append(f"exercise_effect fitted {e:g}, capped at {MODEL['exercise_effect_cap']}")
        key = "loss_pct" if m["model"] == "saturating" else "rate_pct_per_day"
        if m[key] * m["direction"] < 0:
            m["assumed"].append(f"{key} fitted {m[key]:+g}, which is improvement while unloaded; set to 0 and the spread "
                                "left to measurement noise")
            m[key], m["responder_sd"] = 0.0, 0.0
    dev, bio, note = noise_split(mid, m["noise_cv"])
    m["device_cv"], m["bio_cv"], m["noise_source"] = dev, bio, note
    order = ["instrument", "code", "label", "region", "muscle_keys", "unit", "decimals", "direction", "model",
             "loss_pct", "rate_pct_per_day", "tau_days", "exercise_effect", "recovery_tau_days", "responder_sd",
             "noise_cv", "device_cv", "bio_cv", "noise_source", "baseline", "data_range", "observed", "source", "assumed"]
    return {k: m[k] for k in order if k in m}


def main():
    sex = subject_sex()
    strength, notes, strength_subj = strength_params(sex)
    kes = strength["knee_extension_60"]
    measures = dict(strength)
    dx, lean_subj = dxa_params(notes["strength_tau_days"], kes["recovery_tau_days"], kes["exercise_effect"])
    measures.update(dx)
    aer, extra, cft_pre = aerobic_and_wearable(notes["strength_tau_days"])
    measures.update(aer)
    measures.update(ASSUMED_WEARABLE)
    measures.update(ASSUMED_SUIT)
    measures = {mid: finish(mid, m) for mid, m in measures.items()}
    lean = {k: v for k, v in lean_subj.items() if k.startswith("lean_")}
    params = {
        "model_version": MODEL_VERSION,
        "fitted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data": "data/nlsp (NASA Life Sciences Portal: MR079G, MR035G, MR080G), head-down bed rest",
        "max_unloading_days_in_data": 90,
        "bed_days_used": BED_DAYS,
        "notes": notes,
        "model": MODEL,
        "astronaut_standards": ASTRONAUT,
        "baseline_factors": baseline_factors(strength_subj, lean, cft_pre, sex),
        "instruments": extra,
        "validation": gxt_validation(),
        "measures": measures,
    }
    OUT.write_text(json.dumps(params, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"shared timescale tau = {notes['strength_tau_days']} d; strength recovery estimates: {notes['strength_recovery_estimates']}; "
          f"strength subjects: {notes['strength_subjects']} {notes['strength_subjects_by_study']}")
    print("baseline factors:", json.dumps({k: v["loadings"] for k, v in params["baseline_factors"].items()}))
    for k, m in measures.items():
        loss = m.get("loss_pct")
        rate = m.get("rate_pct_per_day")
        base = m.get("baseline", {})          # a "derived" measure (the suit's heart rate) has none
        b = base.get("all", {})
        r = m.get("data_range", {})
        print(f"  {k:24s} {m['model']:10s} dir={m['direction']:+d} loss={loss!s:7s} rate/d={rate!s:9s} ex={m.get('exercise_effect')!s:6s} "
              f"rsd={m['responder_sd']!s:7s} noise={m['noise_cv']!s:6s} dev={m['device_cv']!s:6s} bio={m['bio_cv']!s:6s} "
              f"base n={b.get('n')} [{b.get('min')}, {b.get('max')}] F={base.get('F', {}).get('n')} "
              f"M={base.get('M', {}).get('n')} range=[{r.get('baseline_min')}, {r.get('baseline_max')}] "
              f"change=[{r.get('change_pct_min')}, {r.get('change_pct_max')}]")


def short(assumed: str) -> str:
    """A few words for the README table from one "assumed" entry."""
    rules = [(r"^tau_days", "loss time constant"), (r"^recovery_tau_days", "recovery time constant"),
             (r"^exercise_effect fitted ([\d.]+), capped at ([\d.]+)", r"exercise effect capped at \2 (fitted \1)"),
             (r"^exercise_effect", "exercise effect"),
             (r"^(loss_pct|rate_pct_per_day) fitted ([+\-\d.]+),.*", r"loss set to 0 (fitted \2%)"),
             (r"^Campaign 11 trunk flexion.*", "Campaign 11 left out (runs the wrong way)"),
             (r"^the bed-rest fit is nearly flat.*", "spaceflight loss likely larger"),
             (r"^whole measure.*", "everything (no data)")]
    for pattern, repl in rules:
        if re.match(pattern, assumed):
            return re.sub(pattern, repl, assumed).split(" (shared")[0].split(" (no open")[0].split(" (median")[0].split(" (taken")[0]
    return assumed


NM_PER_FT_LB = 1.3558179483      # as in gravsim/units.py


def readme_table(params=None):
    """The parameter table in sim/README.md, from params.json:  python sim/fit/fit_params.py --table
    Strength is fitted in ft-lb, as in NASA's files; the table shows it in N·m, the unit the DataService stores."""
    params = params or json.loads(OUT.read_text(encoding="utf-8"))
    shown = {"ft-lb": ("N·m", NM_PER_FT_LB)}
    inst = {"dynamometer": "dynamometer", "dxa": "DXA", "cycle": "cycle", "wearable": "wearable", "suit": "spacesuit"}
    rows = ["| Measure | Instrument | Unit | Worse is | Shape without exercise | Loss prevented by full exercise "
            "| Spread between people | Recovery time constant | Noise: device + day to day | Baselines drawn from "
            "| Assumed instead of fitted |",
            "|---|---|---|---|---|---|---|---|---|---|---|"]
    for mid, m in params["measures"].items():
        if m["model"] == "saturating":
            shape = f"plateau {m['loss_pct']:+.1f}%"
            spread = f"{m['responder_sd']:.1f} pts"
        elif m["model"] == "linear":
            shape = f"{30 * m['rate_pct_per_day']:+.2f}% per month"
            spread = f"{30 * m['responder_sd']:.2f} pts/month"
        else:
            shape, spread = ("constant", "") if m["model"] == "constant" else ("resting heart rate + effort", "")
        ex = f"{100 * m['exercise_effect']:.0f}%" if m.get("exercise_effect") is not None else ""
        rec = f"{m['recovery_tau_days']:g} d" if m.get("recovery_tau_days") else ""
        dec = m["decimals"]
        unit, factor = shown.get(m["unit"], (m["unit"], 1.0))
        if "baseline" in m:
            b = m["baseline"]["all"]
            base = f"{b['min'] * factor:.{dec}f} to {b['max'] * factor:.{dec}f}" + (f" ({b['n']} people)" if b.get("n") else " (assumed)")
        else:
            base = "none of its own"
        noise = f"{100 * m['device_cv']:.1f}% + {100 * m['bio_cv']:.1f}%"
        assumed = "; ".join(short(a) for a in m["assumed"]) or "none"
        rows.append(f"| `{mid}` | {inst[m['instrument']]} | {unit} | {'higher' if m['direction'] > 0 else 'lower'} "
                    f"| {shape} | {ex} | {spread} | {rec} | {noise} | {base} | {assumed} |")
    return "\n".join(rows)


if __name__ == "__main__":
    import sys
    if "--table" in sys.argv:
        print(readme_table())
    else:
        main()
