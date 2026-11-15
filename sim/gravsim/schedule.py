"""Timelines: which instrument reads whom, on which days.

schedule="nasa" follows the in-flight routine described in docs/investigacion-gravedad.md (OCHMO-STD-100.1A
Table 8 and the Spaceflight Standard Measures): DXA only before and after flight, strength every 30 days,
VO2peak on flight days 14, 75, 165 (and every 90 days on longer missions) and 14 days before return, the
wearable every day. schedule=<int> reads every instrument every N days instead, DXA in flight included.
The spacesuit reads only during spacewalks (CrewMember.add_eva), whatever the schedule.

OCHMO-STD-100.1A Rev A (2024-09-09), Table 8 "Mission Medical Examinations for Assigned Crew on > 30-day
Missions", based on a 180-day ISS mission (L = launch, R = return, FD = flight day, d = days):
  [6013] Bone Densitometry (p. 34):            pre-flight L-180/30 d; post-flight R+ <30 d, then as clinically
                                               indicated to assess BMD recovery
  [6024] Functional Fitness Assessment (p. 36): pre-flight L-90/30 d; post-flight R+5/7 d, R+30 d
  [6025] On-Orbit Strength & Conditioning
         Monitoring (p. 36):                    in flight L+14 days (NET 3rd session), then at least every 30 days
  [6012] Specialized ocular assessment:        pre-flight; in flight L+30, L+90, L+180, L+270, R-30 d; post-flight
                                               (docs/investigacion-ojos.md); the post-flight days R+3, R+30, R+180 are ours
  [6028] Test for Aerobic Functional
         Capacity (p. 36):                      pre-flight L-90/30 d; in flight FD14, FD75, FD165, FD255, R-14 d;
                                               post-flight R+5 d, R+30 d
Mission day 0 is launch day, which NASA calls FD1, so flight day N is mission day N - 1.
"""
from __future__ import annotations

from typing import Iterable

from .instruments import INSTRUMENTS, CycleErgometer, DxaScanner, Dynamometer, Instrument, Spacesuit, Watch, Wearable
from .ocular import OcularExam
from .reading import Reading


def default_instruments(seed: int | None = None, faults: dict | None = None, noise: float = 1.0) -> dict[str, Instrument]:
    """One of each instrument. faults: {"dxa": [Fault(...)], ...}; noise: 1 = realistic, 0 = none."""
    faults = faults or {}
    # seed + 1, + 2, ...: each instrument gets its own random stream
    return {cls.name: cls(seed=None if seed is None else seed + k, faults=faults.get(cls.name, ()), noise=noise)
            for k, cls in enumerate((Dynamometer, DxaScanner, CycleErgometer, Wearable, Spacesuit, Watch, OcularExam), start=1)}


def nasa_days(mission, instrument: str) -> list[float]:
    """The mission days on which NASA's routine uses this instrument (Table 8 rows in the module docstring)."""
    land, end = mission.landing, mission.end
    pre = [-60.0, -30.0]          # two baseline sessions inside L-90/30 d, averaged into the pre-flight reference
    if instrument == "dxa":       # [6013]: one pre-flight scan; R+7 (R+ <30 d), then R+180 and R+365 for recovery
        days = pre[:1] + [land + 7, land + 180, land + 365]
    elif instrument == "dynamometer":     # [6025] L+14 then every 30 days; [6024] R+5, R+30
        days = pre + [float(d) for d in range(14, int(land), 30)] + [land + 5, land + 30]
    elif instrument == "cycle":   # [6028] FD14, FD75, FD165, FD255 (then every 90 days), R-14; R+5, R+30
        flight = [fd - 1.0 for fd in [14, 75, 165] + list(range(255, int(land), 90))]
        days = pre + sorted({d for d in flight if 0 <= d < land - 14} | {land - 14.0}) + [land + 5, land + 30]
    elif instrument in ("wearable", "watch"):     # every day: the watch all day long, the wearable's daily values
        days = [float(d) for d in range(-14, int(land + 30))]
    elif instrument == "ocular":  # [6012]: pre-flight; FD30, FD90, then every 90 days, R-30; R+3, R+30, R+180
        flight = [fd - 1.0 for fd in [30, 90] + list(range(180, int(land), 90))]
        days = pre[1:] + sorted({d for d in flight if 0 <= d < land - 30} | {land - 30.0}) + [land + 3, land + 30, land + 180]
    elif instrument == "suit":    # the days of the crew's spacewalks; it reads whoever is outside
        days = sorted({ev.day for cm in mission.crew for ev in cm.evas})
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
        if schedule == "nasa" or name == "suit":
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
    if until is not None:          # a spacewalk that started by `until` may run past it
        out = [r for r in out if r.mission_day <= until]
    out.sort(key=lambda r: (r.mission_day, r.crew_id, r.instrument, r.measure, r.side or ""))   # side, as pipeline.order
    return out

