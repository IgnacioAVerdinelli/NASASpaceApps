"""Layer 1, the watch: each vital against the person's own recent days (docs/wearable.md, section 3).

No I/O here. The inputs are DataService reading records (dicts, as GET /api/v1/readings sends them) and crew
context records; the output is the JSON of GET /api/v1/vitals and the findings the watch raises.

- Personal band: mean +- BAND_SD standard deviations of the person's own daily values over the WINDOW readings
  before the last LAG ones (a floor on the SD keeps a steady fortnight from making a hair-trigger). A rolling band
  follows slow change on its own: slow change is layer 2's job (alerts.py); this layer is about acute change.
- Status: `in_range`, `out` (latest beyond the band either way), `deviation` (the mean of the last DEVIATION_DAYS
  values beyond mean +- SUSTAINED_SD standard deviations of a 3-day mean, the bad way: the watch's day-to-day noise
  is large, about +-6 % on resting heart rate, so a single day says little and three days together say more),
  and every one of those days on the worse side of the usual mean, so one big day is not enough;
  `low_now` (SpO2 under SPO2_FLOOR, at once), `no_band` (too few days), `no_data`.
- A deviation is a notice and a suspected finding for the Planner, never an alert by itself.
Every number here is ours, not NASA's.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
from statistics import fmean, pstdev

from .models import MissionInfo

WINDOW, LAG, MIN_BAND = 14, 3, 10          # band from the 14 daily values before the last 3; needs at least 10
BAND_SD = 2.0                               # the daily band shown on the page
SUSTAINED_SD = 2.5                          # deviation: the 3-day mean beyond 2.5 SD of a 3-day mean
DEVIATION_DAYS, CLEAR_DAYS = 3, 2
SPO2_FLOOR = 92.0                           # usual target floor for adult pulse oximetry; ours, not a NASA limit
SERIES_DAYS = 30
TOPIC, SOURCE = "health.finding", "watch"

# measure, name, unit, decimals, bad direction, SD floor
VITALS = [
    ("resting_hr", "Resting heart rate", "bpm", 0, "up", 2.0),
    ("resting_sbp", "Systolic pressure", "mmHg", 0, "up", 4.0),
    ("resting_dbp", "Diastolic pressure", "mmHg", 0, "up", 3.0),
    ("spo2", "Blood oxygen (SpO2)", "%", 0, "down", 1.0),
    ("hrv_rmssd", "Heart-rate variability", "ms", 0, "down", 4.0),
    ("sleep_hours", "Sleep", "h", 1, "down", 0.4),
    ("sleep_quality", "Sleep quality", "/7", 1, "down", 0.6),
]
MEASURES = [v[0] for v in VITALS]
WATCH_HR = "watch_hr"
TEXT = {
    "in_range": "In your usual range",
    "no_band": "Building your usual range (needs 10 days)",
    "no_data": "No data yet",
}
PATTERN_FATIGUE = ("Higher resting heart rate, lower heart-rate variability and short sleep together: often "
                   "fatigue, stress or an illness coming. Rest if you can and mention it at your next medical conference.")


def _usable(records: list[dict]) -> list[dict]:
    return [r for r in records if r.get("quality", "ok") == "ok" and r.get("value") is not None]


def _day(mission: MissionInfo, r: dict) -> float:
    return float(r["mission_day"]) if r.get("mission_day") is not None else mission.day_of(r["timestamp"])


def _beyond(value: float, band: dict, direction: str) -> bool:
    return value > band["high"] if direction == "up" else value < band["low"]


def assess(mission: MissionInfo, measure: str, records: list[dict]) -> dict:
    """One vital: latest value, band, status and series, from its daily reading records up to now."""
    _, name, unit, decimals, direction, floor = next(v for v in VITALS if v[0] == measure)
    rs = sorted(_usable(records), key=lambda r: r["timestamp"])
    out = {"measure": measure, "name": name, "unit": unit, "decimals": decimals, "direction": direction,
           "latest": None, "band": None, "status": "no_data", "daysBeyond": 0, "changePct": None,
           "text": TEXT["no_data"], "series": [], "weekly": []}
    if not rs:
        return out
    values = [float(r["value"]) for r in rs]
    last = rs[-1]
    out["latest"] = {"value": round(values[-1], decimals), "day": round(_day(mission, last), 3), "at": last["timestamp"]}
    out["series"] = [{"day": round(_day(mission, r), 3), "value": round(float(r["value"]), decimals)} for r in rs[-SERIES_DAYS:]]
    weeks: dict[int, list[float]] = {}
    for r in rs:
        weeks.setdefault(math.floor(_day(mission, r) / 7), []).append(float(r["value"]))
    out["weekly"] = [{"week": w, "day": w * 7 + 3.5, "mean": round(fmean(v), decimals + 1)} for w, v in sorted(weeks.items())]

    window = values[-(WINDOW + LAG):-LAG] if len(values) > LAG else []
    if len(window) < MIN_BAND:
        out.update(status="no_band", text=TEXT["no_band"])
    else:
        mean, sd = fmean(window), max(pstdev(window), floor)
        limit = SUSTAINED_SD * sd / math.sqrt(DEVIATION_DAYS)
        band = {"low": round(mean - BAND_SD * sd, 2), "high": round(mean + BAND_SD * sd, 2), "mean": round(mean, 2),
                "days": len(window), "sustainedLow": round(mean - limit, 2), "sustainedHigh": round(mean + limit, 2)}
        out["band"] = band
        out["changePct"] = round((values[-1] - mean) / mean * 100, 1) if mean else None
        beyond = 0
        for v in reversed(values):
            if not _beyond(v, band, direction):
                break
            beyond += 1
        out["daysBeyond"] = beyond
        side = "above" if values[-1] > band["high"] else "below" if values[-1] < band["low"] else None
        recent = fmean(values[-DEVIATION_DAYS:])
        out["recentMean"] = round(recent, decimals + 1)
        # all of the last days on the worse side of the usual mean, and their mean clearly beyond: one big day is not enough
        worse = all((v > mean) if direction == "up" else (v < mean) for v in values[-DEVIATION_DAYS:])
        sustained = worse and (recent > band["sustainedHigh"] if direction == "up" else recent < band["sustainedLow"])
        if sustained and len(values) >= DEVIATION_DAYS:
            word = "Higher" if direction == "up" else "Lower"
            out.update(status="deviation", text=f"{word} than usual for the last {DEVIATION_DAYS} days")
        elif side:
            out.update(status="out", text=f"{side.capitalize()} your usual range today")
        else:
            out.update(status="in_range", text=TEXT["in_range"])
    if measure == "spo2" and values[-1] < SPO2_FLOOR:
        out.update(status="low_now", text=f"Under {SPO2_FLOOR:g} %: repeat the reading at rest and tell the crew medical officer")
    return out


def patterns(vitals: list[dict]) -> list[dict]:
    """Plain-language hints from several vitals beyond their bands together."""
    by = {v["measure"]: v for v in vitals}

    def bad(m):
        v = by.get(m)
        return bool(v and v["band"] and v["latest"] and (
            v["status"] == "deviation" or _beyond(v["latest"]["value"], v["band"], v["direction"])))
    if bad("resting_hr") and bad("hrv_rmssd") and bad("sleep_hours"):
        return [{"id": "fatigue", "text": PATTERN_FATIGUE}]
    return []


# --------------------------------------------------------------------------- the day of heart rate

def _minute(ts: str) -> int:
    return int(ts[11:13]) * 60 + int(ts[14:16])


def day_curves(mission: MissionInfo, day: float, watch: list[dict], preflight: list[dict]) -> dict:
    """The watch's 15-minute heart rate for today so far, yesterday and 7 days ago (UTC dates), and the average
    pre-flight day (each 15-minute slot averaged over the pre-flight days given)."""
    today = date.fromisoformat(mission.timestamp(day)[:10])
    wanted = {"today": today, "yesterday": today - timedelta(days=1), "week_ago": today - timedelta(days=7)}
    curves: dict[str, list] = {k: [] for k in (*wanted, "preflight")}
    for r in _usable(watch):
        d = date.fromisoformat(r["timestamp"][:10])
        for k, want in wanted.items():
            if d == want:
                curves[k].append({"minute": _minute(r["timestamp"]), "value": round(float(r["value"]))})
    slots: dict[int, list[float]] = {}
    for r in _usable(preflight):
        slots.setdefault(_minute(r["timestamp"]), []).append(float(r["value"]))
    curves["preflight"] = [{"minute": m, "value": round(fmean(v), 1)} for m, v in sorted(slots.items())]
    for k in curves:
        curves[k].sort(key=lambda p: p["minute"])
    return curves


def day_context(mission: MissionInfo, day: float, records: list[dict]) -> list[dict]:
    """Today's crew context in minutes since 00:00 UTC, for shading sleep, exercise and spacewalks."""
    today = mission.timestamp(day)[:10]
    midnight = mission.day_of(f"{today}T00:00:00Z")
    out = []
    for c in records:
        s = max(0, round((mission.day_of(c["start"]) - midnight) * 1440))
        e = min(1440, round((mission.day_of(c["end"]) - midnight) * 1440))
        if e > s and c.get("activity") in ("sleep", "exercise", "eva"):
            out.append({"start": s, "end": e, "activity": c["activity"]})
    return out


def build_vitals(mission: MissionInfo, crew_id: str, day: float, daily: dict[str, list[dict]],
                 watch: list[dict] | None = None, preflight: list[dict] | None = None,
                 context: list[dict] | None = None, simulated: bool = True) -> dict:
    """GET /api/v1/vitals (docs/wearable.md, section 3). `daily`: measure -> its reading records up to `day`."""
    vitals = [assess(mission, m, daily.get(m, [])) for m in MEASURES]
    notice = "Compared with your own last two weeks; not a health assessment."
    return {
        "version": 1, "crew": {"id": crew_id}, "simulated": simulated,
        "mission": {"today": round(day, 3), "todayLabel": mission.label(day), "landing": mission.landing},
        "vitals": vitals,
        "patterns": patterns(vitals),
        "day": {"unit": "bpm", "curves": day_curves(mission, day, watch or [], preflight or []),
                "context": day_context(mission, day, context or [])},
        "notice": ("Synthetic data. " if simulated else "") + notice,
    }


# --------------------------------------------------------------------------- findings for the Planner

def findings(crew_id: str, vitals: list[dict], previous: dict[str, dict]) -> list[dict]:
    """Watch findings to publish: `suspected` when a vital enters a deviation (or SpO2 is low now), `cleared`
    when one that was open is back in its band for CLEAR_DAYS readings. `previous`: the last finding by measure."""
    out = []
    for v in vitals:
        last = previous.get(v["measure"])
        open_ = bool(last and last.get("source") == SOURCE and last["state"] in ("suspected", "confirmed"))
        if v["status"] in ("deviation", "low_now") and not open_:
            days = DEVIATION_DAYS if v["status"] == "deviation" else 1
            start = v["series"][-days]["day"] if len(v["series"]) >= days else v["latest"]["day"]
            out.append(_finding(crew_id, v, "suspected", start))
        elif open_ and v["status"] not in ("deviation", "low_now") and v["band"] and len(v["series"]) >= CLEAR_DAYS and all(
                not _beyond(p["value"], v["band"], v["direction"]) for p in v["series"][-CLEAR_DAYS:]):
            out.append(_finding(crew_id, v, "cleared", last.get("episode_day", v["latest"]["day"])))
    return out


def _finding(crew_id: str, v: dict, state: str, episode_day: float) -> dict:
    basis = (f"SpO2 under {SPO2_FLOOR:g} %" if v["status"] == "low_now"
             else f"mean of the last {DEVIATION_DAYS} days beyond the personal band" if state == "suspected"
             else f"back in the personal band for {CLEAR_DAYS} days")
    return {"type": "finding", "source": SOURCE, "crew_id": crew_id, "measure": v["measure"], "state": state,
            "basis": basis, "rule": "personal_band", "change_pct": v["changePct"],
            "mission_day": v["latest"]["day"], "last_reading_at": v["latest"]["at"], "episode_day": episode_day,
            "text": v["text"], "synthetic": True}


def dedupe(f: dict) -> str:
    """One suspected and one cleared per crew member, vital and episode."""
    return f"finding:{f['crew_id']}:{f['measure']}:watch:{f['episode_day']}:{f['state']}"
