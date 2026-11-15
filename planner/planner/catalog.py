"""The routine catalog transcribed from OCHMO-STD-100.1A Section 6 (Table 8), and its schedule grammar.

Each routine lists schedule terms (docs/planner.md, section 4):

    {"at": "L+30"}                                  a point date, +- tolerance_days
    {"at": "FD14"}                                  a flight day (mission day 13), +- tolerance
    {"window": "L+14/21"} / {"window": "R-21/14"}   a range written in the standard, used as is
    {"every": 30, "from": "L+14", "until": "R-1"}   a recurrence; each occurrence +- tolerance
    {"eva": "before", "hours": 48}                  anchored to each spacewalk ("before", "after", "during")

Anchors: L = launch (day 0), R = landing, FD = flight day (FD N = day N - 1). Windows are clipped to the
mission; a routine done only in flight drops any occurrence that is not fully before landing.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from .mission import Mission

CATALOG_PATH = Path(__file__).with_name("catalog") / "ochmo-100.1a.json"
_DAY = re.compile(r"^(L|R)([+-])\s*(\d+(?:\.\d+)?)$")
_FD = re.compile(r"^FD\s*(\d+)$")
_WINDOW = re.compile(r"^(L|R)([+-])\s*(\d+(?:\.\d+)?)/(\d+(?:\.\d+)?)$")


@dataclass(frozen=True)
class Eva:
    """A spacewalk from the crew timeline, in mission days."""
    start: float
    end: float


@dataclass(frozen=True)
class Occurrence:
    nominal: float          # the date the standard names (or the start of its window)
    day_from: float
    day_to: float
    label: str              # the standard's own label: "L+30", "FD14", "L-90/30", "EVA before"
    eva: Eva | None = None
    eva_part: str | None = None
    in_flight: bool = False  # written as a flight date (FDn, L+n, R-n): it must fall between launch and landing


def day_of(term: str, mission: Mission) -> float:
    """'L+30' -> 30, 'R-14' -> landing - 14, 'FD14' -> 13."""
    term = term.replace(" ", "")
    if m := _FD.match(term):
        return float(m.group(1)) - 1.0
    m = _DAY.match(term)
    if not m:
        raise ValueError(f"not a mission date: {term!r}")
    anchor = 0.0 if m.group(1) == "L" else mission.landing
    sign = 1.0 if m.group(2) == "+" else -1.0
    return anchor + sign * float(m.group(3))


def window_of(term: str, mission: Mission) -> tuple[float, float]:
    """'L+14/21' -> (14, 21), 'L-90/30' -> (-90, -30), 'R-21/14' -> (landing-21, landing-14)."""
    m = _WINDOW.match(term.replace(" ", ""))
    if not m:
        raise ValueError(f"not a window: {term!r}")
    anchor = 0.0 if m.group(1) == "L" else mission.landing
    sign = 1.0 if m.group(2) == "+" else -1.0
    a, b = anchor + sign * float(m.group(3)), anchor + sign * float(m.group(4))
    return min(a, b), max(a, b)


def fmt(day: float) -> str:
    """A mission day for ids: 30 -> '30', 29.5 -> '29.5'."""
    return str(int(day)) if float(day).is_integer() else f"{day:.2f}".rstrip("0").rstrip(".")


class Catalog:
    def __init__(self, data: dict):
        self.data = data
        self.source = data["source"]
        self.defaults = data.get("defaults", {})
        self.routines = {r["id"]: r for r in data["routines"]}

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Catalog":
        return cls(json.loads(Path(path or CATALOG_PATH).read_text(encoding="utf-8")))

    def routine(self, routine_id: str) -> dict:
        return self.routines[routine_id]

    def tolerance(self, routine: dict, term: dict) -> float:
        return float(term.get("tolerance_days", routine.get("tolerance_days", self.defaults.get("tolerance_days", 3))))

    def remind(self, routine: dict) -> bool:
        return bool(routine.get("remind", self.defaults.get("remind", True)))

    def instrument_measures(self) -> dict[str, list[str]]:
        """Instrument -> the measures it reports, from the routines closed by readings."""
        out: dict[str, list[str]] = {}
        for r in self.routines.values():
            if r.get("instrument"):
                out.setdefault(r["instrument"], [])
                out[r["instrument"]] += [m for m in r.get("measures", []) if m not in out[r["instrument"]]]
        return out

    def routine_for_measure(self, measure: str, phase: str = "flight") -> dict | None:
        """The routine whose instrument tests `measure`, preferring one done in `phase` (retests use it)."""
        found = [r for r in self.routines.values() if measure in r.get("measures", []) and r.get("instrument")]
        found.sort(key=lambda r: phase not in r["phases"])
        return found[0] if found else None

    def occurrences(self, routine: dict, mission: Mission, evas: list[Eva] = ()) -> list[Occurrence]:
        """Every occurrence of `routine` on this mission, in order, clipped and filtered by phase."""
        out: list[Occurrence] = []
        for term in routine.get("schedule", []):
            tol = self.tolerance(routine, term)
            if "at" in term:
                d = day_of(term["at"], mission)
                out.append(Occurrence(d, d - tol, d + tol, term["at"].replace(" ", ""),
                                      in_flight=_flight_term(term["at"])))
            elif "window" in term:
                a, b = window_of(term["window"], mission)
                out.append(Occurrence(a, a, b, term["window"].replace(" ", ""), in_flight=_flight_term(term["window"])))
            elif "every" in term:
                step, d = float(term["every"]), day_of(term["from"], mission)
                last = day_of(term["until"], mission) if "until" in term else mission.end
                while d <= last + 1e-9:
                    out.append(Occurrence(d, d - tol, d + tol, mission.label(d)))
                    d += step
            elif "eva" in term:
                hours = float(term.get("hours", 0)) / 24.0
                for ev in evas:
                    if term["eva"] == "before":
                        out.append(Occurrence(ev.start, ev.start - hours, ev.start, "EVA before", ev, "before"))
                    elif term["eva"] == "after":
                        out.append(Occurrence(ev.end, ev.end, ev.end + hours, "EVA after", ev, "after"))
                    else:
                        out.append(Occurrence(ev.start, ev.start, ev.end, "EVA", ev, "during"))
            else:
                raise ValueError(f"routine {routine['id']}: unknown schedule term {term}")
        kept = []
        flight_only = set(routine.get("phases", [])) == {"flight"}
        for o in out:
            lo, hi = max(o.day_from, mission.start), min(o.day_to, mission.end)
            if hi < lo:
                continue
            if (flight_only or o.in_flight) and (lo < 0 or hi > mission.landing or (o.eva is None and hi >= mission.landing)):
                continue
            kept.append(Occurrence(o.nominal, lo, hi, o.label, o.eva, o.eva_part))
        return sorted(kept, key=lambda o: (o.day_from, o.label))

    def summary(self, routine: dict) -> dict:
        """A routine without its long texts, for GET /api/v1/routines."""
        keys = ("id", "ref", "section", "title", "category", "item_type", "phases", "completion", "instrument",
                "duration_min", "performed_by", "aci", "continuous")
        return {k: routine.get(k) for k in keys} | {"schedule_text": routine["schedule_text"]}


def _flight_term(term: str) -> bool:
    """FDn, L+n and R-n name days between launch and landing."""
    t = term.replace(" ", "")
    return t.startswith(("FD", "L+", "R-"))
