#!/usr/bin/env python3
"""Fit gravsim's curve parameters from the open NLSP bed-rest data in data/nlsp/.

Run from anywhere:  python sim/fit/fit_params.py
Writes sim/gravsim/params.json. Needs pandas and numpy.

Every number in params.json is either fitted here (and its source study listed)
or listed under "assumed" for that measure.
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
OUT = ROOT / "sim" / "gravsim" / "params.json"
MODEL_VERSION = "0.1.0"

# Days in bed per study (from data/nlsp/README.md). Campaign 3 mixed 60- and 90-day
# phases; 75 is the midpoint used for all of its subjects.
BED_DAYS = {"AG Pilot": 21, "HDT30": 30, "Campaign 1": 60, "MEDES": 60, "Campaign 3": 75, "Campaign 11": 70}


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
    return sorted(DATA.glob(pattern))


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


def robust_cv(values):
    v = np.asarray(values, dtype=float)
    v = v[np.isfinite(v)]
    if len(v) < 3:
        return None
    mad = np.median(np.abs(v - np.median(v))) * 1.4826
    return float(mad / abs(np.median(v))) if np.median(v) else None


def responder_sd(cohort_changes, noise_cv, scale):
    """Spread between people of the loss itself, in percentage points of the asymptote (saturating,
    scale(d) = 1 - exp(-d/tau)) or per day (linear, scale(d) = d). Measurement noise of the two tests
    behind each change is subtracted; at least 30 % of the observed spread is kept."""
    num = den = 0.0
    for d, v in cohort_changes:
        v = np.asarray(v, dtype=float)
        v = v[np.isfinite(v)]
        if len(v) < 3:
            continue
        sd_obs = 1.4826 * np.median(np.abs(v - np.median(v)))
        sd_true = np.sqrt(max(sd_obs ** 2 - 2 * (100 * noise_cv) ** 2, (0.3 * sd_obs) ** 2))
        num += len(v) * sd_true / float(scale(d))
        den += len(v)
    return num / den if den else None


def baseline_stats(values, decimals=3):
    v = pd.Series(values, dtype=float).dropna()
    return {"mean": rnd(v.mean(), decimals), "sd": rnd(v.std(ddof=1), decimals), "n": int(v.size),
            "p5": rnd(v.quantile(0.05), decimals), "p95": rnd(v.quantile(0.95), decimals)}


# --------------------------------------------------------------------------- strength (MR079G)
TEST_CODES = {
    ("Knee Concentric Strength", "Extension", "60"): "KES60",
    ("Knee Concentric Strength", "Flexion", "60"): "KFS60",
    ("Ankle Concentric Strength", "Extension", "30"): "APFCS30",
    ("Ankle Concentric Strength", "Flexion", "30"): "ADFCS30",
    ("Back Concentric Strength", "Extension", "60"): "TES60",
    ("Back Concentric Strength", "Flexion", "60"): "TFS60",
}
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


def strength_params():
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

    meta = {
        "KES60": ("knee_extension_60", "Knee extension, 60°/s", "Quadriceps", ["quadriceps_l", "quadriceps_r"]),
        "KFS60": ("knee_flexion_60", "Knee flexion, 60°/s", "Hamstrings", ["hamstrings_l", "hamstrings_r"]),
        "APFCS30": ("ankle_plantarflexion_30", "Ankle plantarflexion, 30°/s", "Calves", ["calf_l", "calf_r"]),
        "ADFCS30": ("ankle_dorsiflexion_30", "Ankle dorsiflexion, 30°/s", "Shins", ["shin_muscles_l", "shin_muscles_r"]),
        "TES60": ("trunk_extension_60", "Trunk extension, 60°/s", "Back", ["back_muscles_l", "back_muscles_r"]),
        "TFS60": ("trunk_flexion_60", "Trunk flexion, 60°/s", "Abdominals", ["abdominal_muscles"]),
    }
    out = {}
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
        out[mid] = {
            "instrument": "dynamometer", "code": code, "label": label, "region": region, "muscle_keys": keys,
            "unit": "ft-lb", "decimals": 1, "model": "saturating",
            "loss_pct": rnd(amps[code], 2), "tau_days": float(tau), "exercise_effect": rnd(e, 3),
            "recovery_tau_days": rnd(rt, 1), "responder_sd": rnd(rsd, 3), "noise_cv": rnd(ncv, 4),
            "baseline": {"all": baseline_stats(before.xs(code, level="code"), 1)},
            "observed": observed[code] + ([{"cohort": "Campaign 11 (Exercise)", "days": 70,
                                             "change_pct": rnd(c11.loc[code, "Exercise"], 2)}] if code in c11.index else []),
            "source": "MR079G (doi:10.83263/bk5h-r757): HDT30, Campaign 1, Campaign 3, Campaign 11",
            "assumed": assumed,
        }
        if code == "TFS60":
            out[mid]["assumed"].append("Campaign 11 trunk flexion runs the wrong way (+18 % control), left out of the fit")
    notes = {"strength_tau_days": float(tau), "strength_recovery_estimates": len(rec)}
    return out, notes


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
        out.append(df)
    return pd.concat(out, ignore_index=True)


def over_time(df, value):
    daily = (df.dropna(subset=["DAY", value]).groupby(["STUDY", "SUBJ", "DAY"], as_index=False)
               .agg(value=(value, "mean"), dup_sd=(value, "std"), dup_n=(value, "size"),
                    phase=("PHASE", "first"), sex=("SEXC", "first")).sort_values("DAY"))
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
    "hip_bmd": ("HTOT_BMD", {"Campaign 1": "MR035G_Campaign_1_DXA/*LH_Bone", "Campaign 3": "MR035G_Campaign_3_DXA_Hip/*LH_Bone",
                             "MEDES": "MR035G_MEDES_DXA/*H_bone_ALL", "AG Pilot": "MR035G_AG_PILOT_DXA_ANALYZED/*LH_bone_*"}),
    "spine_bmd": ("TOT_BMD", {"Campaign 1": "MR035G_Campaign_1_DXA/*S_Bone", "Campaign 3": "MR035G_Campaign_3_DXA_Spine/*S_Bone",
                              "MEDES": "MR035G_MEDES_DXA/*S_bone_ALL", "AG Pilot": "MR035G_AG_PILOT_DXA_ANALYZED/*_S_bone_*"}),
    "heel_bmd": ("NET_AVG_BMD", {"Campaign 1": "MR035G_Campaign_1_DXA/*Heel", "Campaign 3": "MR035G_Campaign_3_DXA_Heel/*",
                                 "AG Pilot": "MR035G_AG_PILOT_DXA_ANALYZED/*Heel_*"}),
}
LEAN_SETS = {"Campaign 1": "MR035G_Campaign_1_DXA/*WB_Comp", "Campaign 3": "MR035G_Campaign_3_DXA_Whole_Body/*WB_Comp*",
             "AG Pilot": "MR035G_AG_PILOT_DXA_ANALYZED/*WB_comp*", "MEDES": "MR035G_MEDES_DXA/*WB_comp*"}
LEAN_REGIONS = {"lean_legs": ["L_LEG_LEAN", "R_LEG_LEAN"], "lean_arms": ["LARM_LEAN", "RARM_LEAN"], "lean_trunk": ["TRUNK_LEAN"]}
BONE_STUDIES = ["Campaign 1", "Campaign 3", "MEDES"]   # AG Pilot left out: 21 days and centrifuge mixed in


def dxa_params(strength_tau, strength_rec_tau, strength_effect):
    out = {}
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
        firsts = daily.sort_values("DAY").groupby("SUBJ").first()
        base = {"all": baseline_stats(firsts.value)}
        for sx in ("F", "M"):
            v = firsts[firsts.sex == sx].value
            if len(v) >= 5:
                base[sx] = baseline_stats(v)
        label, region, keys = labels[mid]
        out[mid] = {
            "instrument": "dxa", "code": col, "label": label, "region": region, "muscle_keys": keys,
            "unit": "g/cm²", "decimals": 3, "model": "linear",
            "rate_pct_per_day": rnd(rate, 5), "exercise_effect": 0.5,
            "recovery_tau_days": rnd(np.median(rec), 1) if len(rec) >= 5 else 300.0,
            "responder_sd": rnd(responder_sd([(BED_DAYS[st], after[after.STUDY == st].change.values) for st in BONE_STUDIES],
                                             prec, lambda d: d), 5),
            "noise_cv": rnd(prec, 4), "baseline": base, "observed": observed,
            "source": "MR035G (doi:10.83263/7myc-5j86): " + ", ".join(BONE_STUDIES) + "; recovery from Campaign 3 follow-up scans",
            "assumed": ["exercise_effect (no open DXA data with exercise groups; 0.5 is a placeholder)"]
                       + ([] if len(rec) >= 5 else ["recovery_tau_days"]),
        }
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
        firsts = daily.sort_values("DAY").groupby("SUBJ").first()
        base = {"all": baseline_stats(firsts.value, 0)}
        for sx in ("F", "M"):
            v = firsts[firsts.sex == sx].value
            if len(v) >= 5:
                base[sx] = baseline_stats(v, 0)
        label, region, keys = lean_meta[mid]
        out[mid] = {
            "instrument": "dxa", "code": "+".join(LEAN_REGIONS[mid]), "label": label, "region": region, "muscle_keys": keys,
            "unit": "g", "decimals": 0, "model": "saturating",
            "loss_pct": rnd(amp, 2), "tau_days": strength_tau, "exercise_effect": rnd(strength_effect, 3),
            "recovery_tau_days": strength_rec_tau,
            "responder_sd": rnd(responder_sd([(BED_DAYS[st], after[after.STUDY == st].change.values) for st in BONE_STUDIES],
                                             prec, lambda d: sat(d, strength_tau)), 3),
            "noise_cv": rnd(prec, 4), "baseline": base, "observed": observed,
            "source": "MR035G (doi:10.83263/7myc-5j86) whole-body scans: " + ", ".join(BONE_STUDIES),
            "assumed": ["tau_days (shared with strength)", "exercise_effect (taken from knee extension)",
                        "recovery_tau_days (shared with strength)"],
        }
    return out


# --------------------------------------------------------------------------- Campaign 11 / CFT70 (MR080G)
def cft70():
    df = pd.concat([read_nlsp(p) for p in files("MR080G_aerobic_capacity/MR080G_CFT70/MR080G_CFT70_*_ALL")
                    if "avgs" not in p.name], ignore_index=True)
    for c in ["REL VO2PK", "WEIGHT", "AGE", "HRsupine", "SBPsupine", "DBPsupine", "HRseated", "BR DAY"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["GROUP"] = df["GROUP"].str.title()
    return df


def cft_measure(df, col, mid, instrument, label, unit, decimals, strength_tau, source):
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
    rep = 100 * (wide.PRE / wide.SCREEN - 1)
    noise = float(np.nanstd(rep.values) / 100 / np.sqrt(2))
    pre = df[df.TEST == "PRE"]
    base = {"all": baseline_stats(pre[col], decimals)}
    for sx in ("F", "M"):
        base[sx] = baseline_stats(pre[pre.SEX == sx][col], decimals)
    return {
        "instrument": instrument, "code": col, "label": label, "region": None, "muscle_keys": [],
        "unit": unit, "decimals": decimals, "model": "saturating",
        "loss_pct": rnd(amp, 2), "tau_days": strength_tau, "exercise_effect": rnd(effect, 3),
        "recovery_tau_days": rnd(np.median(rec), 1) if len(rec) >= 4 else 10.0,
        "responder_sd": rnd(responder_sd([(70, ch1.xs("Control").values)], noise, lambda d: sat(d, strength_tau)), 3),
        "noise_cv": rnd(noise, 4), "baseline": base,
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
    out = {"vo2peak": cft_measure(df, "REL VO2PK", "vo2peak", "cycle", "Peak oxygen uptake (VO2peak)", "ml/kg/min", 1,
                                  strength_tau, src + "; REL VO2PK only (other peak columns are shifted in some rows)")}
    out["resting_hr"] = cft_measure(df, "HRsupine", "resting_hr", "wearable", "Resting heart rate (supine)", "bpm", 0,
                                    strength_tau, src + "; supine rest before the cycle test")
    out["resting_sbp"] = cft_measure(df, "SBPsupine", "resting_sbp", "wearable", "Resting systolic pressure", "mmHg", 0,
                                     strength_tau, src + "; supine rest before the cycle test")
    out["resting_dbp"] = cft_measure(df, "DBPsupine", "resting_dbp", "wearable", "Resting diastolic pressure", "mmHg", 0,
                                     strength_tau, src + "; supine rest before the cycle test")
    pre = df[df.TEST == "PRE"]
    extra = {"cycle": {"age": baseline_stats(pre.AGE, 0), "weight_kg": {"all": baseline_stats(pre.WEIGHT, 1)},
                       "hr_seated_rest": baseline_stats(pre.HRseated, 0)}}
    return out, extra


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


ASSUMED_WEARABLE = {
    "spo2": {"instrument": "wearable", "code": None, "label": "Blood oxygen saturation (SpO2)", "region": None, "muscle_keys": [],
             "unit": "%", "decimals": 0, "model": "constant", "baseline": {"all": {"mean": 97.5, "sd": 1.0, "p5": 96, "p95": 99}},
             "noise_cv": 0.007, "responder_sd": 0.0, "source": "not in the data",
             "assumed": ["whole measure: typical healthy range 95-100 %, no trend; replace with a cited source"]},
    "hrv_rmssd": {"instrument": "wearable", "code": None, "label": "Heart-rate variability (RMSSD)", "region": None, "muscle_keys": [],
                  "unit": "ms", "decimals": 0, "model": "constant", "baseline": {"all": {"mean": 42, "sd": 15, "p5": 20, "p95": 75}},
                  "noise_cv": 0.15, "responder_sd": 0.0, "source": "not in the data",
                  "assumed": ["whole measure: typical adult range, no trend; replace with a cited source"]},
}


def main():
    strength, notes = strength_params()
    kes = strength["knee_extension_60"]
    measures = dict(strength)
    measures.update(dxa_params(notes["strength_tau_days"], kes["recovery_tau_days"], kes["exercise_effect"]))
    aer, extra = aerobic_and_wearable(notes["strength_tau_days"])
    measures.update(aer)
    measures.update(ASSUMED_WEARABLE)
    params = {
        "model_version": MODEL_VERSION,
        "fitted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data": "data/nlsp (NASA Life Sciences Portal: MR079G, MR035G, MR080G), head-down bed rest",
        "max_unloading_days_in_data": 90,
        "bed_days_used": BED_DAYS,
        "notes": notes,
        "instruments": extra,
        "validation": gxt_validation(),
        "measures": measures,
    }
    OUT.write_text(json.dumps(params, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"shared timescale tau = {notes['strength_tau_days']} d; strength recovery estimates: {notes['strength_recovery_estimates']}")
    for k, m in measures.items():
        loss = m.get("loss_pct")
        rate = m.get("rate_pct_per_day")
        print(f"  {k:26s} {m['model']:10s} loss={loss!s:7s} rate/d={rate!s:9s} ex={m.get('exercise_effect')!s:6s} "
              f"rec={m.get('recovery_tau_days')!s:6s} resp_sd={m['responder_sd']!s:7s} noise={m['noise_cv']!s:7s} "
              f"base={m['baseline']['all']['mean']} assumed={len(m['assumed'])}")


if __name__ == "__main__":
    main()
