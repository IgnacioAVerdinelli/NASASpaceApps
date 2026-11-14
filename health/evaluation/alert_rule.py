"""How well alert rules tell real losses from measurement noise, scored against gravsim's `truth`.

    cd health && .venv/bin/python evaluation/alert_rule.py

For every reading from launch on of the measures the HealthService checks, a rule decides "alert" using only
what the HealthService sees: the readings, cleaned as the DataService cleans them (only quality "ok" counts),
and the bed-rest reference. gravsim's `truth` (the noise-free
change) then says whether the alert was right:

- real: the true change has gone further in the harmful direction than the typical change bed-rest subjects
  had without exercise after the same days without gravity (what the alert claims);
- clear: it has gone at least CLEAR_POINTS further;
- false: it has not gone beyond at all.

Every rule looks at the "excess": how many percentage points the measured change goes beyond that typical
change (positive = worse), against the noise of one test, 100 * noise_cv * sqrt(1 + 1/n_ref) (see
healthservice/alerts.py). The last row runs the HealthService's own code (compute_results + alerts.check) on
the same readings, so the table scores what is actually implemented.
"""
from __future__ import annotations

import argparse
import math
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable

import gravsim as gs
from gravsim.schedule import default_instruments, timeline

from healthservice import CrewInfo, Reading, Reference, compute_results
from healthservice.alerts import can_alert, check
from healthservice.processing import ITEMS, WHOLE_BODY
from healthservice.sources import mission_info

MEASURES = [m for _, m, _, _ in ITEMS] + [m for m, _, _ in WHOLE_BODY]
CLEAR_POINTS = 5.0


@dataclass
class Point:
    """One reading from launch on, as a rule sees it, plus what truth says."""
    group: str
    crew: str                     # unique across missions
    measure: str
    day: float
    in_flight: bool
    excess: float                 # measured: points beyond the typical change without exercise (+ = worse)
    true_excess: float            # the same with gravsim's noise-free change
    noise_pts: float              # 100 * noise_cv
    n_ref: int                    # pre-flight readings in the reference
    can_alert: bool               # the measure's typical loss over the mission is bigger than one test's noise
    prev: "Point | None" = None   # previous reading of this measure from launch on
    service: bool = False         # flagged by the HealthService's own alerts.check

    @property
    def sigma(self) -> float:
        return self.noise_pts * math.sqrt(1 + 1 / self.n_ref)


def points_for(mission: gs.Mission, seed: int, group: str, reference: Reference, faults=None) -> list[Point]:
    insts = default_instruments(seed, faults=faults)
    insts.pop("wearable")                         # none of its measures can alert
    sim = [r for r in gs.clean(timeline(mission, "nasa", instruments=insts)) if r.measure in MEASURES]
    info = mission_info(mission)
    landing = info.landing

    series = defaultdict(list)
    for r in sim:
        series[(r.crew_id, r.measure)].append(r)
    out, index = [], {}
    for (crew_id, mid), rs in series.items():
        rs.sort(key=lambda r: r.mission_day)
        rs = [r for r in rs if r.value is not None and r.quality == "ok"]
        pre = [r.value for r in rs if r.mission_day < 0]
        if not pre:
            continue
        ref = sum(pre) / len(pre)
        prev = None
        for r in rs:
            if r.mission_day < 0:
                continue
            typical = reference.worse_by(mid, reference.typical_change(mid, info.unloaded_days(r.mission_day), 0.0))
            p = Point(group, f"{seed}/{crew_id}", mid, r.mission_day, r.mission_day < landing,
                      excess=reference.worse_by(mid, 100 * (r.value / ref - 1)) - typical,
                      true_excess=reference.worse_by(mid, r.truth["change_pct"]) - typical,
                      noise_pts=100 * reference.measure(mid)["noise_cv"], n_ref=len(pre),
                      can_alert=can_alert(reference, info, mid, len(pre)), prev=prev)
            out.append(p)
            index[(crew_id, mid, r.mission_day)] = p
            prev = p

    # the HealthService itself, on the same readings, after each day with new readings
    readings = [Reading.from_record(r.to_dict()) for r in sim]
    for cm in mission.crew:
        crew = CrewInfo(cm.id, cm.sex)
        mine = [r for r in readings if r.crew_id == cm.id]
        for day in sorted({r.mission_day for r in mine if r.mission_day >= 0}):
            results = {res.measure: res for res in compute_results(reference, info, crew, mine, day)}
            for mid in check(reference, info, list(results.values())):
                index[(cm.id, mid, results[mid].last_mission_day)].service = True
    return out


# --------------------------------------------------------------------------- rules

Rule = Callable[[Point], bool]


def one_test(k: float) -> Rule:
    """The latest test goes beyond the typical change by more than k sigma."""
    return lambda p: p.excess > k * p.sigma


def two_in_a_row(k: float) -> Rule:
    """The latest two tests each go beyond it by more than k sigma."""
    return lambda p: p.prev is not None and p.excess > k * p.sigma and p.prev.excess > k * p.prev.sigma


def mean_of_two(k: float) -> Rule:
    """The mean excess of the latest two tests goes beyond k times its own noise."""
    def rule(p: Point) -> bool:
        if p.prev is None:
            return False
        return (p.excess + p.prev.excess) / 2 > k * p.noise_pts * math.sqrt(0.5 + 1 / p.n_ref)
    return rule


def measurable(rule: Rule) -> Rule:
    """Only on measures whose typical loss over the mission is bigger than one test's noise."""
    return lambda p: p.can_alert and rule(p)


RULES: dict[str, Rule] = {
    "Old rule: 1 test beyond typical, all measures": one_test(0),
    "1 test, k=2": measurable(one_test(2)),
    "1 test, k=2.5": measurable(one_test(2.5)),
    "2 in a row, k=1": measurable(two_in_a_row(1)),
    "2 in a row, k=1.645": measurable(two_in_a_row(1.645)),
    "Mean of 2, k=1.645, all measures": mean_of_two(1.645),
    "Mean of 2, k=1.645": measurable(mean_of_two(1.645)),
    "Mean of 2, k=2": measurable(mean_of_two(2)),
    "HealthService (alerts.check)": lambda p: p.service,
}


# --------------------------------------------------------------------------- populations

def random_crews(reference: Reference, seeds, faults=None) -> list[Point]:
    """gravsim's Mission.random, as the demo uses it: mostly exercising, some slipping, the odd fast responder
    or injury."""
    pts = []
    for s in seeds:
        pts += points_for(gs.Mission.random("iss_180", n_crew=4, seed=s), s, "random crew", reference, faults)
    return pts


CASES = {
    "full exercise": dict(adherence=1.0),
    "half exercise": dict(adherence=0.5),
    "no exercise": dict(adherence=0.0),
    "no exercise, fast responder": dict(adherence=0.0, responder="fast"),
    "full exercise, fast responder": dict(adherence=1.0, responder="fast"),
    "stops exercising, days 60-120": dict(adherence=[(-1000, 1.0), (60, 0.1), (120, 1.0)]),
    "full exercise, leg injury day 60": dict(adherence=1.0, injury=True),
}


def designed_cases(reference: Reference, n: int, seed: int = 1) -> list[Point]:
    pts = []
    for gi, (name, spec) in enumerate(CASES.items()):
        spec = dict(spec)
        injury = spec.pop("injury", False)
        m = gs.Mission("iss_180")
        for i in range(n):
            cm = m.add_crew(f"CM-{i + 1}", seed=seed * 10_000 + gi * 1000 + i, **spec)
            if injury:
                cm.add_event(60, "legs", severity_pct=15, recovery_days=30, label="leg injury")
        pts += points_for(m, seed * 100 + gi, name, reference)
    return pts


# --------------------------------------------------------------------------- scoring

def score(points: list[Point], rule: Rule) -> dict:
    flagged = [p for p in points if rule(p)]
    real = [p for p in points if p.true_excess > 0]
    clear = [p for p in points if p.true_excess >= CLEAR_POINTS]
    raised = [p for p in flagged if p.prev is None or not rule(p.prev)]       # what the queue gets
    return {
        "flagged": len(flagged),
        "false": sum(p.true_excess <= 0 for p in flagged),
        "raised": len(raised),
        "false_raised": sum(p.true_excess <= 0 for p in raised),
        "real": len(real),
        "real_caught": sum(rule(p) for p in real),
        "clear": len(clear),
        "clear_caught": sum(rule(p) for p in clear),
    }


def pct(a: int, b: int) -> str:
    return "-" if b == 0 else f"{100 * a / b:.0f}%"


def table(title: str, points: list[Point], rules: dict[str, Rule]) -> str:
    rows = [f"### {title}", "",
            "| Rule | Alerts raised | False alerts | Real readings caught | Clear readings caught |",
            "|---|---|---|---|---|"]
    for name, rule in rules.items():
        s = score(points, rule)
        rows.append(f"| {name} | {s['raised']} | {s['false_raised']} | "
                    f"{s['real_caught']}/{s['real']} ({pct(s['real_caught'], s['real'])}) | "
                    f"{s['clear_caught']}/{s['clear']} ({pct(s['clear_caught'], s['clear'])}) |")
    return "\n".join(rows)


def crew_table(title: str, points: list[Point], rule: Rule) -> str:
    """Per crew member, in flight: who got an alert, who got a false one, and when the first came."""
    rows = [f"### {title}", "",
            "| Case | Crew | Clear loss in flight | Alerted in flight | Of those with a clear loss | "
            "With a false alert | First alert, median day |",
            "|---|---|---|---|---|---|---|"]
    by_crew = defaultdict(list)
    for p in points:
        if p.in_flight:
            by_crew[(p.group, p.crew)].append(p)
    groups = defaultdict(lambda: defaultdict(int))
    first = defaultdict(list)
    for (g, _), ps in by_crew.items():
        o = groups[g]
        flagged = [p for p in ps if rule(p)]
        clear = any(p.true_excess >= CLEAR_POINTS for p in ps)
        o["crew"] += 1
        o["clear"] += clear
        o["alerted"] += bool(flagged)
        o["clear_alerted"] += clear and bool(flagged)
        o["false"] += any(p.true_excess <= 0 for p in flagged)
        if flagged:
            first[g].append(min(p.day for p in flagged))
    for g, o in groups.items():
        day = f"{statistics.median(first[g]):.0f}" if first[g] else "-"
        rows.append(f"| {g} | {o['crew']} | {o['clear']} | {o['alerted']} | {o['clear_alerted']}/{o['clear']} | "
                    f"{o['false']} | {day} |")
    return "\n".join(rows)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--seeds", type=int, default=50, help="random missions of 4 crew (default 50)")
    ap.add_argument("--per-case", type=int, default=25, help="crew per designed case (default 25)")
    args = ap.parse_args(argv)
    reference = Reference.load()

    demo = random_crews(reference, [7])
    rand = random_crews(reference, range(args.seeds))
    spikes = random_crews(reference, range(args.seeds),
                          faults={"dynamometer": [gs.Fault("spike", prob=0.1, pct=20)]})
    cases = designed_cases(reference, args.per_case)
    service = RULES["HealthService (alerts.check)"]

    print(f"Real = truth beyond the typical change without exercise; clear = at least {CLEAR_POINTS:g} points "
          "beyond; false = not beyond at all. Readings from launch on, flight and the two tests after landing.\n")
    print(table("Demo mission (seed 7, 4 crew, the one the HealthService serves by default)", demo, RULES), "\n")
    print(table(f"Random crews ({args.seeds} missions x 4 crew)", rand, RULES), "\n")
    print(table("Same crews, with 1 in 10 dynamometer tests off by 20% (spike fault)", spikes, RULES), "\n")
    print(table(f"Designed cases ({len(CASES)} cases x {args.per_case} crew)", cases, RULES), "\n")
    print(crew_table("HealthService rule, per crew member (designed cases and random crews)", cases + rand, service))


if __name__ == "__main__":
    main()
