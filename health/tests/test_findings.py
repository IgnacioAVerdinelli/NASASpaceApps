"""Findings for the Planner: suspected after one test, confirmed with the alert, cleared when neither holds."""
import tempfile
from pathlib import Path

import gravsim as gs
from gravsim.queue import Queue

from healthservice import Reading, Reference, compute_results
from healthservice import findings
from healthservice.alerts import check
from healthservice.demo import DemoWorker
from healthservice.sources import GravsimSource

from test_demo import LocalSource
from test_healthservice import ANA, MISSION, exercising_and_not, knee

REFERENCE = Reference.load()


def step(readings, day, previous=None):
    """The findings published after processing the readings up to `day`."""
    results = compute_results(REFERENCE, MISSION, ANA, [r for r in readings if r.mission_day <= day], day)
    return {f["measure"]: f for f in findings.changes(REFERENCE, MISSION, results, check(REFERENCE, MISSION, results),
                                                       previous or {})}


PRE = [knee(-60, 100.0), knee(-30, 110.0)]          # reference: 105


def test_one_test_past_the_noise_is_suspected_not_alerted():
    readings = PRE + [knee(30, 60.0)]                  # -42.9%, far past the no-exercise curve on day 30
    f = step(readings, 31)["knee_extension_60"]
    assert (f["state"], f["basis"], f["rule"], f["level"]) == ("suspected", "one test", "beyond_typical", 4)
    assert f["beyond_noise"] > 1 and f["change_pct"] == -42.9
    assert (f["crew_id"], f["mission_day"], f["type"], f["synthetic"]) == ("CM-1", 30, "finding", True)
    assert f["last_reading_at"] == MISSION.timestamp(30)


def test_a_test_inside_the_noise_gives_no_finding():
    assert "knee_extension_60" not in step(PRE + [knee(30, 100.0)], 31)


def test_suspected_then_confirmed_then_cleared():
    readings = PRE + [knee(30, 60.0)]
    first = step(readings, 31)
    readings.append(knee(60, 62.0))
    second = step(readings, 61, first)
    f = second["knee_extension_60"]
    assert (f["state"], f["basis"], f["rule"], f["mission_day"]) == ("confirmed", "mean of two", "beyond_typical", 60)
    assert f["beyond_noise"] > 1
    readings += [knee(90, 104.0), knee(120, 106.0)]   # back to pre-flight
    third = step(readings, 121, second)
    f = third["knee_extension_60"]
    assert (f["state"], f["basis"], f["mission_day"]) == ("cleared", "mean of two", 120)
    assert "knee_extension_60" not in step(readings, 122, third)     # cleared once, then quiet


def test_vo2peak_past_the_standard_in_one_test_is_suspected():
    def vo2(day, value):
        return Reading("CM-1", "vo2peak", day, MISSION.timestamp(day), value, "ml/kg/min", synthetic=True)
    readings = [vo2(-60, 45.0), vo2(-30, 45.0), vo2(13, 31.0)]      # under the 32.9 in-mission minimum
    results = compute_results(REFERENCE, MISSION, ANA, readings, 14)
    assert "vo2peak" not in check(REFERENCE, MISSION, results)      # one test is not an alert
    f = findings.evaluate(REFERENCE, MISSION, results, {})["vo2peak"]
    assert (f["state"], f["rule"], f["level"]) == ("suspected", "nasa_standard", 4)


def test_over_a_flight_suspected_comes_before_confirmed():
    """The point of the suspected state: the Planner can book a retest before the alert."""
    source = GravsimSource(mission=exercising_and_not(), seed=7)
    info = source.mission()
    states = {}
    for cm in source.crew():
        mine, previous = source.readings(cm.id, info.landing), {}
        for day in sorted({r.mission_day for r in mine if 0 <= r.mission_day <= info.landing}):
            results = compute_results(REFERENCE, info, cm, mine, day)
            for f in findings.changes(REFERENCE, info, results, check(REFERENCE, info, results), previous):
                states.setdefault((cm.id, f["measure"]), []).append((f["mission_day"], f["state"]))
                previous[f["measure"]] = f
    skipped = {m: s for (c, m), s in states.items() if c == "CM-2" and any(st == "confirmed" for _, st in s)}
    assert skipped, "the crew member who skips exercise has confirmed findings"
    first = {m: min(d for d, st in s if st == "confirmed") for m, s in skipped.items()}
    assert any(min(d for d, st in s if st == "suspected") < first[m]
               for m, s in skipped.items() if any(st == "suspected" for _, st in s))
    assert not any(st == "confirmed" and m != "vo2peak" for (c, m), s in states.items() if c == "CM-1" for _, st in s)


def test_the_worker_publishes_each_finding_once_and_remembers_it():
    with tempfile.TemporaryDirectory() as tmp:
        queue = Queue(str(Path(tmp) / "queue.sqlite"))
        mission = exercising_and_not()
        data = gs.DataService(publisher=queue)
        data.ingest(mission.timeline(seed=7, until=120))
        data.ingest_context(mission.context())
        worker = DemoWorker(LocalSource(mission, data, 120), queue)
        worker.process_readings({"crew_id": "CM-2"})
        worker.process_readings({"crew_id": "CM-2"})        # the same readings again: nothing new
        published = []
        while item := queue.next("t", "events"):
            queue.ack("t", item[0])
            if item[1] == findings.TOPIC:
                published.append(item[2])
        assert published and all(f["crew_id"] == "CM-2" for f in published)
        assert len({findings.dedupe(f) for f in published}) == len(published)
        assert {f["state"] for f in published} <= {"suspected", "confirmed"}
        saved = worker.findings.latest("CM-2")
        assert saved == {f["measure"]: f for f in published}
        data.store.close()
