"""Unit registry: every unit we accept, the canonical unit of its kind, and the factor between them.

The DataService stores each measure in the canonical unit of its kind (pipeline.STORED_UNITS). For most
measures that is the `unit` params.json gives it. Strength is the exception: params.json and the simulated
dynamometer keep it in ft-lb, as NASA's files do, and the DataService stores it in N·m, the SI unit the
website shows. So a wearable that reports heart rate in beats per second is stored in bpm, and a dynamometer
that reports ft-lb is stored in N·m.
"""
from __future__ import annotations

# unit: (canonical unit, factor), so that value_in_canonical = value * factor.
# Each unit here is a plain multiple of its canonical one; a unit with an offset (°F) would need a function.
UNITS = {
    # torque (dynamometer); 1 ft-lb = 1.35582 N·m
    "N·m": ("N·m", 1.0),
    "Nm": ("N·m", 1.0),
    "ft-lb": ("N·m", 1.3558179483),
    # bone density per area (DXA)
    "g/cm²": ("g/cm²", 1.0),
    "g/cm2": ("g/cm²", 1.0),
    "mg/cm²": ("g/cm²", 0.001),
    "mg/cm2": ("g/cm²", 0.001),
    # lean mass (DXA)
    "g": ("g", 1.0),
    "kg": ("g", 1000.0),
    "lb": ("g", 453.59237),
    # oxygen uptake per kg of body mass (cycle test)
    "ml/kg/min": ("ml/kg/min", 1.0),
    # heart rate (wearable)
    "bpm": ("bpm", 1.0),
    "beats/s": ("bpm", 60.0),
    # blood pressure
    "mmHg": ("mmHg", 1.0),
    "kPa": ("mmHg", 7.50061683),
    # oxygen saturation: some APIs report 0.97 instead of 97 %
    "%": ("%", 1.0),
    "fraction": ("%", 100.0),
    # heart-rate variability
    "ms": ("ms", 1.0),
    "s": ("ms", 1000.0),
    # sleep duration (watch, actigraphy)
    "h": ("h", 1.0),
    "min": ("h", 1 / 60),
    # self-rated scores (sleep quality 1-7)
    "score": ("score", 1.0),
}


def canonical(unit: str) -> str:
    """The canonical unit of `unit`'s kind ("ft-lb" -> "N·m"). Raises ValueError for an unknown unit."""
    if unit not in UNITS:
        raise ValueError(f"unknown unit {unit!r}; known: {', '.join(UNITS)}")
    return UNITS[unit][0]


def convert(value: float, unit: str, to: str) -> float:
    """`value` in `unit`, expressed in `to`. Raises ValueError for an unknown unit or a different kind."""
    for u in (unit, to):
        if u not in UNITS:
            raise ValueError(f"unknown unit {u!r}; known: {', '.join(UNITS)}")
    (base, factor), (to_base, to_factor) = UNITS[unit], UNITS[to]
    if base != to_base:
        raise ValueError(f"can't convert {unit} to {to}")
    return value * factor / to_factor
