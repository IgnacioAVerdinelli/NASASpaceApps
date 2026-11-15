"""The plan engine: statuses, merging and the finding rules of docs/planner.md (no I/O)."""
import pytest

from planner import plan as engine
from planner.catalog import Catalog, Eva
from planner.mission import Mission, Phase, parse_time

CATALOG = Catalog.load()
ISS = Mission(parse_time("2027-03-01T00:00:00Z"),
              [Phase("preflight", -180, 0, 1.0), Phase("flight", 0, 180, 0.0), Phase("postflight", 180, 545, 1.0)],
              "iss_180")
EVA = Eva(81.5, 81.8)


def items(evas=()):
    return engine.routine_items(CATALOG, ISS, "CM-1", list(evas))


def by_id(xs, iid):
    return next(i for i in xs if i["id"] == iid)


def test_ids_are_unique_and_items_follow_the_contract():
    xs = items([EVA])
    assert len({i["id"] for i in xs}) == len(xs)
    i = by_id(xs, "6041:30")
    assert i["type"] == "study" and i["reason"] == "routine" and i["status"] == "booked"
    assert i["window"] == {"from": "2027-03-28T00:00:00Z", "to": "2027-04-03T00:00:00Z",
                           "day_from": 27.0, "day_to": 33.0, "day": 30.0, "label": "L+30"}
    eva = by_id(xs, "6029:eva:81.5:before")
    assert eva["eva"]["part"] == "before" and eva["window"]["day_to"] == 81.5
    assert by_id(xs, "6030:eva:81.5:during")["instrument"] == "suit"


def test_readings_close_auto_items_and_the_clock_misses_the_rest():
    xs = items()
    readings = {"dynamometer": [(14.0, "2027-03-15T00:00:00Z")], "cycle": [(13.0, "2027-03-14T00:00:00Z")]}
    changes = engine.update(xs, ISS, 40, readings)
    assert by_id(xs, "6025:14")["status"] == "done" and by_id(xs, "6025:14")["done_by"] == "instrument"
    assert by_id(xs, "6028:13")["status"] == "done"
    assert by_id(xs, "6041:30")["status"] == "missed"           # a crew item nobody closed
    assert by_id(xs, "6025:44")["status"] == "booked"           # window not over
    assert ("missed", by_id(xs, "6041:30")) in changes


def test_a_reading_after_today_does_not_count():
    xs = items()
    engine.update(xs, ISS, 12, {"cycle": [(13.0, "2027-03-14T00:00:00Z")]})
    assert by_id(xs, "6028:13")["status"] == "booked"


def test_simulated_crew_closes_crew_items_mid_window():
    xs = items()
    engine.update(xs, ISS, 30, {}, simulate_crew=True)
    assert by_id(xs, "6041:30")["status"] == "done" and by_id(xs, "6041:30")["completion"] == "simulated"
    assert by_id(xs, "6025:14")["status"] == "missed"           # auto items still need readings


def test_merge_keeps_status_and_cancels_what_left_the_routine():
    stored = items([EVA])
    by_id(stored, "6041:30")["status"] = "done"
    fresh = items()                                              # the spacewalk was removed
    merged = engine.merge(stored, fresh)
    assert by_id(merged, "6041:30")["status"] == "done"
    assert by_id(merged, "6029:eva:81.5:before")["status"] == "cancelled"
    assert len(merged) == len(stored)


def finding(**kw):
    return {"type": "finding", "crew_id": "CM-1", "measure": "knee_extension_60", "mission_day": 74.0,
            "change_pct": -14.2, "synthetic": True} | kw


def test_a_suspected_finding_books_one_retest_in_the_next_free_week():
    xs = items([Eva(75.2, 75.5)])
    changes = engine.apply_finding(xs, finding(state="suspected"), CATALOG, ISS, 74.3, [Eva(75.2, 75.5)])
    (status, retest), = changes
    assert status == "booked" and retest["type"] == "retest" and retest["id"] == "retest:knee_extension_60:74"
    assert retest["window"]["day_from"] == 76.0                 # day 75 has a spacewalk
    assert retest["window"]["day_to"] == 83.0
    assert retest["instrument"] == "dynamometer" and retest["routine_id"] == "6025"
    assert retest["finding"]["change_pct"] == -14.2
    assert engine.apply_finding(xs, finding(mission_day=75.0), CATALOG, ISS, 75.0) == []   # one open at a time


def test_a_finding_without_state_is_treated_as_suspected():
    xs = items()
    (_, retest), = engine.apply_finding(xs, finding(), CATALOG, ISS, 74.0)
    assert retest["type"] == "retest"


def test_a_finding_again_after_a_recent_retest_books_a_review_not_a_loop():
    xs = items()
    engine.apply_finding(xs, finding(), CATALOG, ISS, 74.0)
    retest = by_id(xs, "retest:knee_extension_60:74")
    engine.update(xs, ISS, 76.5, {"dynamometer": [(76.0, ISS.timestamp(76.0))]})
    assert retest["status"] == "done"
    (_, review), = engine.apply_finding(xs, finding(mission_day=76.0), CATALOG, ISS, 76.5)
    assert review["type"] == "review" and review["completion"] == "crew"
    assert review["title"] == "Review by the flight surgeon: knee extension strength"
    assert "retest" in review["finding"]["why"]
    assert engine.apply_finding(xs, finding(mission_day=77.0), CATALOG, ISS, 77.0) == []   # review already open


def test_confirmed_books_a_review_and_cleared_cancels():
    xs = items()
    engine.apply_finding(xs, finding(), CATALOG, ISS, 74.0)
    (_, review), = engine.apply_finding(xs, finding(state="confirmed", mission_day=75.0), CATALOG, ISS, 75.0)
    assert review["type"] == "review"
    cancelled = engine.apply_finding(xs, finding(state="cleared", mission_day=76.0), CATALOG, ISS, 76.0)
    assert {i["type"] for _, i in cancelled} == {"retest", "review"}
    assert all(i["status"] == "cancelled" for _, i in cancelled)


def test_no_retest_without_an_instrument_or_time_before_landing():
    xs = items()
    (_, r1), = engine.apply_finding(xs, finding(measure="resting_hr"), CATALOG, ISS, 74.0)
    assert r1["type"] == "review"
    (_, r2), = engine.apply_finding(xs, finding(mission_day=179.5), CATALOG, ISS, 179.5)
    assert r2["type"] == "review"


def test_set_status():
    xs = items()
    item = engine.set_status(xs, "6041:30", "done", "CM-1", "all normal", ISS, 30.2)
    assert item["status"] == "done" and item["done_by"] == "CM-1" and item["note"] == "all normal"
    with pytest.raises(ValueError, match="already done"):
        engine.set_status(xs, "6041:30", "missed", "CM-1", None, ISS, 31)
    with pytest.raises(ValueError):
        engine.set_status(xs, "6041:60", "booked", "CM-1", None, ISS, 31)
    with pytest.raises(KeyError):
        engine.set_status(xs, "nothing", "done", "CM-1", None, ISS, 31)


def test_view_flags_open_and_filters():
    xs = items()
    v = engine.view(xs, 30.0, from_day=25, to_day=35, item_type="study")
    assert v and all(i["type"] == "study" for i in v)
    assert by_id(v, "6041:30")["open"] is True and by_id(v, "6041:30")["overdue"] is False


def test_the_watch_closes_the_sleep_log():
    xs = items()
    engine.update(xs, ISS, 31, {"watch": [(30.25, ISS.timestamp(30.25))]})
    assert by_id(xs, "6039:30")["status"] == "done" and by_id(xs, "6039:30")["done_by"] == "instrument"
    assert by_id(xs, "6039:29")["status"] == "missed"                 # no report that night


def test_a_watch_finding_books_a_review_never_a_retest():
    xs = items()
    f = finding(measure="resting_hr", source="watch", state="suspected", change_pct=12.0,
                text="Higher than usual for the last 3 days")
    (_, review), = engine.apply_finding(xs, f, CATALOG, ISS, 74.0)
    assert review["type"] == "review" and review["title"] == "Review by the flight surgeon: resting heart rate"
    assert review["finding"]["source"] == "watch" and review["finding"]["why"] == "Higher than usual for the last 3 days"
    sleep = finding(measure="sleep_hours", source="watch", state="suspected", mission_day=75.0)
    (_, r2), = engine.apply_finding(xs, sleep, CATALOG, ISS, 75.0)
    assert r2["type"] == "review" and not any(i["type"] == "retest" for i in xs)
    cancelled = engine.apply_finding(xs, f | {"state": "cleared"}, CATALOG, ISS, 77.0)
    assert [i["id"] for _, i in cancelled] == [review["id"]]


def test_an_eye_finding_books_a_review_and_the_exam_closes_6012():
    xs = items()
    f = finding(measure="eyes", source="ocular", state="suspected", text="Eyes (SANS class A): early optic disc swelling")
    (_, review), = engine.apply_finding(xs, f, CATALOG, ISS, 30.0)
    assert review["type"] == "review" and review["title"] == "Review by the flight surgeon: eyes (SANS)"
    assert not any(i["type"] == "retest" for i in xs)
    exam = next(i for i in xs if i["id"].startswith("6012:") and i["status"] == "booked")
    day = exam["window"]["day_from"] + 0.5
    engine.update(xs, ISS, day + 1, {"ocular": [(day, ISS.timestamp(day))]})
    assert by_id(xs, exam["id"])["status"] == "done" and by_id(xs, exam["id"])["done_by"] == "instrument"
