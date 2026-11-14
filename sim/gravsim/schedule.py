"""Timelines: which instrument reads whom, on which days.

schedule="nasa" follows the in-flight routine described in docs/investigacion-gravedad.md (OCHMO-STD-100.1A
Table 8 and the Spaceflight Standard Measures): DXA only before and after flight, strength every 30 days,
VO2peak on flight days 14, 75, 165 (and every 90 days on longer missions), the wearable every day.
schedule=<int> reads every instrument every N days instead, DXA in flight included.
"""
from __future__ import annotations

from typing import Iterable

from .instruments import INSTRUMENTS, CycleErgometer, DxaScanner, Dynamometer, Instrument, Wearable
from .reading import Reading


def default_instruments(seed: int | None = None, faults: dict | None = None, noise: float = 1.0) -> dict[str, Instrument]:
    """One of each instrument. faults: {"dxa": [Fault(...)], ...}; noise: 1 = realistic, 0 = none."""
    faults = faults or {}
    # seed + 1, + 2, ...: each instrument gets its own random stream
    return {cls.name: cls(seed=None if seed is None else seed + k, faults=faults.get(cls.name, ()), noise=noise)
            for k, cls in enumerate((Dynamometer, DxaScanner, CycleErgometer, Wearable), start=1)}


def nasa_days(mission, instrument: str) -> list[float]:
    """The mission days on which NASA's routine uses this instrument."""
    land, end = mission.landing, mission.end
    pre = [-60.0, -30.0]          # two baseline sessions, averaged into the pre-flight reference
    if instrument == "dxa":
        days = pre[:1] + [land + 7, land + 180, land + 365]
    elif instrument == "dynamometer":
        days = pre + [float(d) for d in range(14, int(land), 30)] + [land + 5, land + 30]
    elif instrument == "cycle":
        flight = [14.0, 75.0, 165.0] + [float(d) for d in range(255, int(land), 90)]
        days = pre + [d for d in flight if d < land] + [land + 5, land + 30]
    elif instrument == "wearable":
        days = [float(d) for d in range(-14, int(land + 30))]
    else:
        raise KeyError(instrument)
    return [d for d in days if mission.start <= d <= end]


def timeline(mission, schedule: str | int = "nasa", instruments: dict[str, Instrument] | Iterable[str] | None = None,
             crew=None, seed: int | None = None, until: float | None = None, noise: float = 1.0) -> list[Reading]:
    """Every reading for the crew (all of it by default) over the mission, sorted by day.

    instruments: a dict name -> Instrument (to set faults or seeds), or names to use with defaults.
    until: stop at this mission day (a timeline "so far").
    noise: scale on measurement noise for default instruments (1 = realistic, 0 = none).
    """
    if instruments is None:
        instruments = default_instruments(seed, noise=noise)
    elif not isinstance(instruments, dict):
        instruments = {n: INSTRUMENTS[n](seed=seed, noise=noise) for n in instruments}
    crews = mission.crew if crew is None else (crew if isinstance(crew, (list, tuple)) else [crew])
    out: list[Reading] = []
    for name, inst in instruments.items():
        if schedule == "nasa":
            days = nasa_days(mission, name)
        else:
            step = float(schedule)
            days, d = [], -30.0
            while d <= mission.landing + 60 and d <= mission.end:
                days.append(d)
                d += step
        if until is not None:
            days = [d for d in days if d <= until]
        for cm in crews:
            for d in days:
                out += inst.measure_all(cm, d)
    out.sort(key=lambda r: (r.mission_day, r.crew_id, r.instrument, r.measure))
    return out

