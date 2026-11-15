"""The eye exam (OCHMO-STD-100.1A [6012], SANS): each exam against the person's own pre-flight exam, classed with
the 2026 expert consensus (docs/investigacion-ojos.md, section 4).

No I/O here. The inputs are DataService reading records (dicts, as GET /api/v1/readings sends them); the output is
the JSON of GET /api/v1/eyes and the findings the exam raises for the Planner.

Classes (consensus 2026, Table 2; one criterion is enough):
- A, earliest indication: retinal thickness around the disc (TRT) >= +20 um, any chorioretinal fold, any
  flattening of the back of the eye, or a refraction shift over +0.50 D;
- B, clinically concerning: TRT >= +55 um or Frisen grade >= 1.
SANS can show in one eye only (consensus 2026: "in either or both eyes"), so each eye is classed on its own against
its own pre-flight exam and the person takes the worse eye's class; averaging the eyes could hide it.
Classes C and D need visual fields and long-term follow-up, which the simulated exam does not give.
A class A or B exam is a finding for the Planner, which books a flight-surgeon review.
"""
from __future__ import annotations

from statistics import fmean

from .models import MissionInfo

TOPIC, SOURCE, MEASURE = "health.finding", "ocular", "eyes"
TRT_A, TRT_B, REFRACTION_A = 20.0, 55.0, 0.5

# measure, name, unit, decimals, group, device, what it shows
EXAM = [
    ("oct_trt", "Retinal thickness around the optic disc", "µm", 0, "oct", "OCT (Heidelberg Spectralis)",
     "Swelling of the optic disc: the first sign of SANS"),
    ("oct_mrw", "Optic nerve rim width", "µm", 0, "oct", "OCT (Heidelberg Spectralis)",
     "How much the nerve head bulges"),
    ("oct_choroid", "Choroid thickness", "µm", 0, "oct", "OCT (Heidelberg Spectralis)",
     "The layer of blood vessels behind the retina fills up"),
    ("frisen_grade", "Optic disc edema (Frisén grade)", "grade", 0, "fundus", "Fundus imaging",
     "Swelling a doctor can see, 0 to 5"),
    ("choroidal_folds", "Chorioretinal folds", "flag", 0, "fundus", "OCT and fundus imaging",
     "Wrinkles in the back of the eye"),
    ("refraction_se", "Refraction", "D", 2, "vision", "Refraction",
     "A shift to the plus side means worse near vision"),
    ("near_va", "Near vision without glasses", "logMAR", 2, "vision", "Near chart and Amsler grid",
     "0 is normal; +0.1 is one line worse"),
    ("iop", "Eye pressure", "mmHg", 0, "pressure", "Tonometer",
     "Context only: it does not show the pressure inside the head"),
    ("onsd", "Optic nerve sheath diameter", "mm", 2, "ultrasound", "Ultrasound (GE Vivid)",
     "A wider sheath hints at more pressure around the brain"),
    ("globe_flattening", "Flattening of the back of the eye", "flag", 0, "ultrasound", "Ultrasound (GE Vivid)",
     "The back of the eye pushed flat; it shortens the eye"),
    ("axial_length", "Length of the eye", "mm", 2, "ultrasound", "Ultrasound / biometry",
     "A shorter eye sees worse up close"),
]
MEASURES = [e[0] for e in EXAM]
EYES = ("right", "left")
EYE_NAMES = {"right": "Right eye", "left": "Left eye"}
FLAGS = {"frisen_grade", "choroidal_folds", "globe_flattening"}
CLASS_ORDER = ["none", "A", "B"]
CLASS_TEXT = {
    "none": "No sign of SANS so far.",
    "A": "Earliest sign of SANS. The flight surgeon reviews it and follows it at the next exams.",
    "B": "Clinically concerning SANS. The flight surgeon reviews it now.",
}


def exams(mission: MissionInfo, records: list[dict]) -> list[dict]:
    """The exam sessions, oldest first: the readings of one day grouped by eye, {day, label, at, values: {eye: {...}}}.
    A reading without a side counts for both eyes."""
    by_day: dict[float, dict] = {}
    for r in records:
        if r.get("quality", "ok") != "ok" or r.get("value") is None or r["measure"] not in MEASURES:
            continue
        day = mission.day_of(r["timestamp"])
        e = by_day.setdefault(round(day, 1), {"day": round(day, 3), "label": r.get("day_label") or mission.label(day),
                                              "at": r["timestamp"], "values": {eye: {} for eye in EYES}})
        for eye in ([r["side"]] if r.get("side") in EYES else EYES):
            e["values"][eye][r["measure"]] = r["value"]
    return [by_day[k] for k in sorted(by_day)]


def baseline(sessions: list[dict]) -> dict[str, dict[str, float]]:
    """The pre-flight reference of each eye: the mean of the exams before launch (the first exam when there is none)."""
    pre = [e for e in sessions if e["day"] < 0] or sessions[:1]
    out = {}
    for eye in EYES:
        out[eye] = {}
        for m in MEASURES:
            vals = [e["values"][eye][m] for e in pre if m in e["values"][eye]]
            if vals:
                out[eye][m] = 0.0 if m in FLAGS else fmean(vals)
    return out


def classify(changes: dict[str, float], values: dict[str, float]) -> tuple[str, list[dict]]:
    """The SANS class of one eye at one exam and the signs behind it (consensus 2026, Table 2)."""
    trt = changes.get("oct_trt")
    signs = []
    if trt is not None and (trt >= TRT_B or values.get("frisen_grade", 0) >= 1):
        signs.append({"sign": "disc_edema", "class": "B",
                      "text": f"optic disc swelling, retina {trt:+.0f} µm around the disc" +
                              (f", Frisén grade {values['frisen_grade']:.0f}" if values.get("frisen_grade", 0) >= 1 else "")})
    elif trt is not None and trt >= TRT_A:
        signs.append({"sign": "disc_edema", "class": "A", "text": f"early optic disc swelling, retina {trt:+.0f} µm around the disc"})
    if values.get("choroidal_folds", 0) >= 1:
        signs.append({"sign": "folds", "class": "A", "text": "folds in the back of the eye"})
    if values.get("globe_flattening", 0) >= 1:
        signs.append({"sign": "globe_flattening", "class": "A", "text": "the back of the eye is flattened"})
    ref = changes.get("refraction_se")
    if ref is not None and ref > REFRACTION_A:
        signs.append({"sign": "refraction", "class": "A", "text": f"near vision shifted {ref:+.2f} D"})
    return worst(s["class"] for s in signs), signs


def worst(classes) -> str:
    return max(classes, key=CLASS_ORDER.index, default="none")


def build_eyes(mission: MissionInfo, crew_id: str, day: float, records: list[dict], simulated: bool = True) -> dict:
    """GET /api/v1/eyes: every exam up to `day`, each eye against its own pre-flight exam; the class of the person is
    the worse eye's, since SANS can show in one eye only and an average would hide it."""
    sessions = [e for e in exams(mission, records) if e["day"] <= day + 1e-9]
    base = baseline(sessions)
    for e in sessions:
        e["changes"], e["eyes"] = {}, {}
        for eye in EYES:
            vals, b = e["values"][eye], base[eye]
            e["changes"][eye] = {m: round(v - b[m], 3) for m, v in vals.items() if m in b}
            cls, signs = classify(e["changes"][eye], vals) if e["day"] >= 0 else ("none", [])
            e["eyes"][eye] = {"class": cls, "signs": [s | {"eye": eye} for s in signs]}
        e["class"] = worst(e["eyes"][eye]["class"] for eye in EYES)
        e["signs"] = [s for eye in EYES for s in e["eyes"][eye]["signs"]]
    flight = [e for e in sessions if e["day"] >= 0]
    latest = sessions[-1] if sessions else None
    current = flight[-1] if flight else None
    cls = current["class"] if current else "none"
    measures = []
    for mid, name, unit, decimals, group, device, about in EXAM:
        per_eye = {}
        for eye in EYES:
            series = [{"day": e["day"], "label": e["label"], "value": e["values"][eye][mid],
                       "change": e["changes"][eye].get(mid)} for e in sessions if mid in e["values"][eye]]
            per_eye[eye] = {"baseline": base[eye].get(mid), "latest": series[-1] if series else None, "series": series}
        measures.append({"measure": mid, "name": name, "unit": unit, "decimals": decimals, "group": group,
                         "device": device, "about": about, "flag": mid in FLAGS, "eyes": per_eye})
    peak = max(flight, key=lambda e: CLASS_ORDER.index(e["class"]), default=None)
    by_eye = {eye: current["eyes"][eye]["class"] if current else "none" for eye in EYES}
    return {
        "version": 2, "crew": {"id": crew_id}, "simulated": simulated, "eyeOrder": list(EYES),
        "mission": {"today": round(day, 3), "todayLabel": mission.label(day), "landing": mission.landing},
        "status": {"class": cls, "text": CLASS_TEXT[cls], "eyes": by_eye,
                   "signs": [s | {"text": f"{EYE_NAMES[s['eye']]}: {s['text']}"} for s in current["signs"]] if current else [],
                   "examLabel": current["label"] if current else None,
                   "worstClass": peak["class"] if peak else "none", "worstLabel": peak["label"] if peak else None},
        "thresholds": {"oct_trt": {"A": TRT_A, "B": TRT_B}, "refraction_se": {"A": REFRACTION_A}},
        "exams": sessions, "latest": latest, "measures": measures,
        "notice": ("Synthetic data, modelled on published NASA results. " if simulated else "")
                  + "Each eye is compared with its own pre-flight exam; the class is the worse eye's (2026 SANS expert "
                    "consensus). Not a medical assessment.",
    }


# --------------------------------------------------------------------------- findings for the Planner

def findings(crew_id: str, eyes: dict, previous: dict[str, dict]) -> list[dict]:
    """The exam's finding to publish: `suspected` when the class becomes A, `confirmed` when it becomes B, `cleared`
    when an open one is back to no sign. `previous`: the last finding by measure."""
    st, latest = eyes["status"], eyes["latest"]
    if latest is None or latest["day"] < 0:
        return []
    last = previous.get(MEASURE)
    open_cls = last.get("class") if last and last.get("source") == SOURCE and last["state"] != "cleared" else "none"
    cls = st["class"]
    if CLASS_ORDER.index(cls) > CLASS_ORDER.index(open_cls):
        return [_finding(crew_id, eyes, "confirmed" if cls == "B" else "suspected")]
    if cls == "none" and open_cls != "none":
        return [_finding(crew_id, eyes, "cleared")]
    return []


def _finding(crew_id: str, eyes: dict, state: str) -> dict:
    st, latest = eyes["status"], eyes["latest"]
    basis = "; ".join(s["text"] for s in st["signs"]) or "no sign of SANS at the last exam"
    return {"type": "finding", "source": SOURCE, "crew_id": crew_id, "measure": MEASURE, "state": state,
            "class": st["class"], "basis": basis, "rule": "sans_consensus_2026",
            "mission_day": latest["day"], "last_reading_at": latest["at"], "episode_day": latest["day"],
            "text": f"Eyes (SANS class {st['class']}): {basis}" if state != "cleared" else "Eyes: no sign of SANS",
            "synthetic": True}


def dedupe(f: dict) -> str:
    return f"finding:{f['crew_id']}:{MEASURE}:{f['last_reading_at']}:{f['state']}"
