"""Crew context: where each crew member is and what they are doing.

The HealthService uses it to decide who is told about an alert: if an astronaut is on a spacewalk or in the
bathroom, another crew member is told. On board, three sources report it (ContextRecord.source):

  timeline      the crew timeline, the mission plan: sleep, meals, exercise, work, the airlock before and
                after a spacewalk
  room_sensor   presence sensors in the modules; they catch what the plan doesn't, like a trip to the toilet
  suit          spacesuit telemetry: when the person went outside and came back (and their heart rate,
                as Readings from instruments.Spacesuit)

gravsim stands in for all three. Each crew member follows the same plan every day, in UTC (the time the
ISS keeps). The hours are assumed, in the shape of an ISS day; nothing here is fitted:

  00:00-06:00  sleep      Harmony (crew quarters)
  06:00-06:30  hygiene    Tranquility (the toilet and hygiene compartment)
  06:30-07:00  meal       Unity (the galley)
  07:00-09:00  work       a module drawn for the block: Destiny, Columbus, Kibo or Harmony
  09:00-10:00  exercise   Tranquility (resistance machine, treadmill)   } each block happens with probability
  10:00-12:00  work                                                      } equal to the exercise adherence that
  12:00-13:00  meal       Unity                                          } day; a skipped block is work
  13:00-16:00  work
  16:00-17:00  exercise   Destiny (cycle ergometer)
  17:00-19:00  work
  19:00-20:00  meal       Unity
  20:00-22:00  work       (everything else awake, off-duty time included)
  22:00-22:30  hygiene    Tranquility
  22:30-24:00  sleep      Harmony

On top of the plan, one to three unplanned toilet visits of 5 to 15 minutes, seen by the room sensor.
A spacewalk (CrewMember.add_eva) replaces its part of the day: an hour in the Quest airlock suiting up, the
spacewalk itself ("eva", location "outside", source "suit"), an hour in the airlock after; there is no
exercise that day. The wearable's 24-hour heart-rate trace follows the same routine (instruments.py).

A day's routine depends only on the crew member and the date, through its own random stream, so it is the
same however often it is asked for, and adding a spacewalk changes no other day.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np

from .core import TIME_FORMAT, CrewMember, Mission
from .reading import ContextRecord

DAY_PLAN = [    # (start hour, end hour, activity, location); location None: a work module drawn for the block
    (0.0, 6.0, "sleep", "Harmony"),
    (6.0, 6.5, "hygiene", "Tranquility"),
    (6.5, 7.0, "meal", "Unity"),
    (7.0, 9.0, "work", None),
    (9.0, 10.0, "exercise", "Tranquility"),
    (10.0, 12.0, "work", None),
    (12.0, 13.0, "meal", "Unity"),
    (13.0, 16.0, "work", None),
    (16.0, 17.0, "exercise", "Destiny"),
    (17.0, 19.0, "work", None),
    (19.0, 20.0, "meal", "Unity"),
    (20.0, 22.0, "work", None),
    (22.0, 22.5, "hygiene", "Tranquility"),
    (22.5, 24.0, "sleep", "Harmony"),
]
WORK_MODULES = ("Destiny", "Columbus", "Kibo", "Harmony")
LOCATIONS = ("Harmony", "Tranquility", "Unity", "Destiny", "Columbus", "Kibo", "Quest", "outside")
AIRLOCK_HOURS = 1.0                 # in the Quest airlock before and after a spacewalk
TOILET_VISITS = (1, 3)              # unplanned visits a day, at least and at most
TOILET_MINUTES = (5, 15)
ROUTINE_STREAM = 1                  # this module's random stream, next to the day-to-day variation of core.py


def routine(crew: CrewMember, day: float) -> list[ContextRecord]:
    """Where `crew` is and what they are doing over the UTC date of mission `day`: records from 00:00 to 24:00,
    in order, each starting where the last one ended."""
    ms = crew.mission
    midnight = datetime.strptime(ms.timestamp(day)[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    rng = np.random.default_rng([crew._day_key, ROUTINE_STREAM, midnight.toordinal()])
    eva = crew.eva_on(day)
    adherence = crew.adherence(ms.day_of((midnight + timedelta(hours=12)).strftime(TIME_FORMAT)))

    blocks = []        # [start minute, end minute, activity, location, source]
    for start, end, activity, location in DAY_PLAN:
        if activity == "work":
            location = str(rng.choice(WORK_MODULES))
        elif activity == "exercise" and (eva is not None or rng.random() >= adherence):
            activity, location = "work", blocks[-1][3]          # a skipped block: stays at work where they were
        blocks.append([round(start * 60), round(end * 60), activity, location, "timeline"])

    if eva is not None:
        out, back = round(eva.start_hour * 60), round((eva.start_hour + eva.hours) * 60)
        first, last = out - round(AIRLOCK_HOURS * 60), back + round(AIRLOCK_HOURS * 60)
        kept = [[s, min(e, first), *rest] for s, e, *rest in blocks if s < first]
        kept += [[max(s, last), e, *rest] for s, e, *rest in blocks if e > last]
        blocks = sorted(kept + [[first, out, "work", "Quest", "timeline"], [out, back, "eva", "outside", "suit"],
                                [back, last, "work", "Quest", "timeline"]], key=lambda b: b[0])
    blocks = _merge(blocks)

    for _ in range(int(rng.integers(TOILET_VISITS[0], TOILET_VISITS[1] + 1))):
        length = int(rng.integers(TOILET_MINUTES[0], TOILET_MINUTES[1] + 1))
        room = [i for i, b in enumerate(blocks) if b[2] == "work" and b[3] != "Quest" and b[1] - b[0] >= length + 40]
        if not room:
            break
        i = room[int(rng.integers(len(room)))]
        s, e, activity, location, source = blocks[i]
        t = int(rng.integers(s + 20, e - 20 - length + 1))         # not in the first or last 20 minutes of a block
        blocks[i:i + 1] = [[s, t, activity, location, source], [t, t + length, "hygiene", "Tranquility", "room_sensor"],
                           [t + length, e, activity, location, source]]

    def at(minute):
        return (midnight + timedelta(minutes=minute)).strftime(TIME_FORMAT)
    return [ContextRecord(crew_id=crew.id, start=at(s), end=at(e), activity=activity, location=location,
                          source=source, synthetic=True) for s, e, activity, location, source in blocks]


def context_timeline(mission: Mission, crew=None, start: float = 0.0, until: float | None = None) -> list[ContextRecord]:
    """Every crew member's context from mission day `start` to `until` (default: launch to landing, the time on
    board, where the sources are), sorted by start. A record that runs past midnight, the night's sleep, is one
    record. crew: one CrewMember or a list (default: all)."""
    until = mission.landing if until is None else until
    t0, t1 = mission.timestamp(start), mission.timestamp(until)
    crews = mission.crew if crew is None else (crew if isinstance(crew, (list, tuple)) else [crew])
    first = datetime.strptime(t0[:10], "%Y-%m-%d")
    dates = [first + timedelta(days=k) for k in range((datetime.strptime(t1[:10], "%Y-%m-%d") - first).days + 1)]
    out: list[ContextRecord] = []
    for cm in crews:
        records: list[ContextRecord] = []
        for date in dates:
            for r in routine(cm, mission.day_of(date.strftime("%Y-%m-%dT12:00:00Z"))):
                if records and _same(records[-1], r) and records[-1].end == r.start:
                    records[-1].end = r.end
                else:
                    records.append(r)
        for r in records:                  # keep what falls between t0 and t1, cut to fit
            if r.end > t0 and r.start < t1:
                r.start, r.end = max(r.start, t0), min(r.end, t1)
                out.append(r)
    return sorted(out, key=lambda r: (r.start, r.crew_id))


def _same(a: ContextRecord, b: ContextRecord) -> bool:
    return (a.activity, a.location, a.source) == (b.activity, b.location, b.source)


def _merge(blocks: list) -> list:
    """Join neighbouring blocks with the same activity, location and source."""
    out = []
    for b in blocks:
        if out and out[-1][2:] == b[2:] and out[-1][1] == b[0]:
            out[-1][1] = b[1]
        else:
            out.append(list(b))
    return out
