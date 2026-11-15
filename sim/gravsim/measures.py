"""The list of measures, shared by the generator and the DataService: names, units, limits and groups.

It lives in its own module so the DataService depends on this list only, never on the generator.
Everything here comes from params.json, which sim/fit/fit_params.py writes.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

PARAMS: dict = json.loads(Path(__file__).with_name("params.json").read_text(encoding="utf-8"))
MEASURES: dict = PARAMS["measures"]
MODEL_VERSION: str = PARAMS["model_version"]
TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"    # UTC to the second: sorts correctly as text, and the frontend accepts it

# Handy groups for events and filters
GROUPS = {
    "legs": ["knee_extension_60", "knee_flexion_60", "ankle_plantarflexion_30", "ankle_dorsiflexion_30", "lean_legs"],
    "trunk": ["trunk_extension_60", "trunk_flexion_60", "lean_trunk"],
    "arms": ["lean_arms"],
    "bone": ["hip_bmd", "spine_bmd", "heel_bmd"],
    "cardio": ["vo2peak", "resting_hr", "resting_sbp", "resting_dbp"],
    "eyes": ["oct_trt", "oct_mrw", "oct_choroid", "frisen_grade", "choroidal_folds", "globe_flattening",
             "refraction_se", "near_va", "iop", "onsd", "axial_length"],
    "strength": ["knee_extension_60", "knee_flexion_60", "ankle_plantarflexion_30", "ankle_dorsiflexion_30",
                 "trunk_extension_60", "trunk_flexion_60"],
}


def expand(measures: str | Iterable[str] | None) -> list[str]:
    """Measure ids from ids and/or group names ("legs", "bone", ...). None means every measure."""
    if measures is None:
        return list(MEASURES)
    if isinstance(measures, str):
        measures = [measures]
    out: list[str] = []
    for m in measures:
        if m in GROUPS:
            out += GROUPS[m]
        elif m in MEASURES:
            out.append(m)
        else:
            raise KeyError(f"unknown measure or group {m!r}; measures: {sorted(MEASURES)}, groups: {sorted(GROUPS)}")
    return list(dict.fromkeys(out))
