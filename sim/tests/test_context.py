"""Checks for crew context: the daily routine gravsim generates, spacewalks and the spacesuit's heart rate,
agreement with the wearable's 24-hour trace, and the DataService's context ingestion, queries and API.

Run from sim/:  python -m pytest -q tests/test_context.py
"""
import json
import logging
import threading
import urllib.request
from datetime import datetime, timedelta

import numpy as np
import pytest

import gravsim as gs
from gravsim.serve import data_routes, make_server

DAYS = range(0, 180, 7)


def hhmm(t):
    return t[11:16]


@pytest.fixture(scope="module")
def mission():
    """Four people with different exercise and a two-person spacewalk on day 95."""
    m = gs.Mission("iss_180", launch_date="2027-03-01")
    for i, adherence in enumerate([1.0, 0.0, 0.5, [(0, 1.0), (60, 0.0), (120, 1.0)]]):
        m.add_crew(f"CM-{i + 1}", adherence=adherence, seed=i)
    for c in m.crew[:2]:
        c.add_eva(95, start_hour=12.0, hours=6.5)
    return m


# ---- the routine ----------------------------------------------------------------------------

def test_every_day_is_covered_once_without_gaps(mission):
    for c in mission.crew:
        for d in [*DAYS, 95]:
            day = c.routine(d)
            date = mission.timestamp(d)[:10]
            assert day[0].start == f"{date}T00:00:00Z" and day[-1].end[11:] == "00:00:00Z" and day[-1].end > day[0].start
            assert all(a.end == b.start for a, b in zip(day, day[1:]))           # no gap, no overlap
            for r in day:
                assert r.start < r.end and r.crew_id == c.id and r.synthetic
                assert r.activity in gs.ACTIVITIES and r.location in gs.LOCATIONS and r.source in gs.SOURCES


def test_sleep_meals_and_hygiene_follow_the_plan(mission):
    for c in mission.crew:
        for d in DAYS:
            day = c.routine(d)
            blocks = {(hhmm(r.start), hhmm(r.end), r.activity, r.location) for r in day if r.source == "timeline"}
            assert {("00:00", "06:00", "sleep", "Harmony"), ("22:30", "00:00", "sleep", "Harmony"),
                    ("06:00", "06:30", "hygiene", "Tranquility"), ("22:00", "22:30", "hygiene", "Tranquility"),
                    ("06:30", "07:00", "meal", "Unity"), ("12:00", "13:00", "meal", "Unity"),
                    ("19:00", "20:00", "meal", "Unity")} <= blocks
            assert sum(r.activity == "sleep" for r in day) == 2
            visits = [r for r in day if r.source == "room_sensor"]
            assert 1 <= len(visits) <= 3
            for v in visits:
                assert v.activity == "hygiene" and v.location == "Tranquility"
                minutes = (datetime.fromisoformat(v.end[:-1]) - datetime.fromisoformat(v.start[:-1])) / timedelta(minutes=1)
                assert 5 <= minutes <= 15
                before = next(r for r in day if r.end == v.start)
                assert before.activity == "work"                                 # visits interrupt work, never sleep


def test_exercise_follows_adherence(mission):
    full, none, half, steps = mission.crew

    def blocks(c, d):
        return [(hhmm(r.start), hhmm(r.end), r.location) for r in c.routine(d) if r.activity == "exercise"]
    flight = [d for d in range(0, 180) if d != 95]
    assert all(blocks(full, d) == [("09:00", "10:00", "Tranquility"), ("16:00", "17:00", "Destiny")] for d in flight)
    assert not any(blocks(none, d) for d in range(-30, 200))
    share = np.mean([len(blocks(half, d)) / 2 for d in flight])
    assert 0.4 < share < 0.6, share
    assert not any(blocks(steps, d) for d in range(61, 120)) and all(len(blocks(steps, d)) == 2 for d in range(121, 180))


def test_a_spacewalk_day(mission):
    walker = mission.crew[0]
    day = [(hhmm(r.start), hhmm(r.end), r.activity, r.location, r.source) for r in walker.routine(95)]
    assert ("12:00", "18:30", "eva", "outside", "suit") in day
    assert ("11:00", "12:00", "work", "Quest", "timeline") in day and ("18:30", "19:30", "work", "Quest", "timeline") in day
    assert not any(a == "exercise" for _, _, a, _, _ in day)
    assert day[0][:3] == ("00:00", "06:00", "sleep") and day[-1][:3] == ("22:30", "00:00", "sleep")
    assert [r.activity for r in mission.crew[2].routine(95)].count("eva") == 0       # only the two who go out


def test_a_spacewalk_changes_no_other_day():
    def person():
        return gs.Mission("iss_180").add_crew(adherence=0.7, seed=3)
    plain, walker = person(), person()
    walker.add_eva(40, start_hour=9.0, hours=8.0)
    for d in (38, 39, 41, 42):
        assert [r.to_dict() for r in plain.routine(d)] == [r.to_dict() for r in walker.routine(d)]
    assert plain.routine(40) != walker.routine(40)


def test_add_eva_refuses_impossible_spacewalks():
    m = gs.Mission("iss_180")
    c = m.add_crew(seed=1)
    with pytest.raises(ValueError, match="away from Earth"):
        c.add_eva(-10)
    with pytest.raises(ValueError, match="away from Earth"):
        c.add_eva(200)                                   # after landing
    with pytest.raises(ValueError, match="starts at 8:00"):
        c.add_eva(50, start_hour=7.5)
    with pytest.raises(ValueError, match="starts at 8:00"):
        c.add_eva(50, start_hour=15, hours=6.5)          # would end at 21:30
    c.add_eva(50, start_hour=8, hours=13)                # the longest that fits
    with pytest.raises(ValueError, match="already has a spacewalk"):
        c.add_eva(50.4)


def test_random_missions_sometimes_send_two_crew_out_together():
    with_eva = 0
    for seed in range(20):
        m = gs.Mission.random(seed=seed)
        walks = [(c.id, e.day, e.start_hour, e.hours) for c in m.crew for e in c.evas]
        if walks:
            with_eva += 1
            assert len(walks) == 2 and len({w[1:] for w in walks}) == 1 and 0 < walks[0][1] < m.landing
    assert 4 <= with_eva <= 16


# ---- the context timeline -------------------------------------------------------------------

def test_context_timeline_covers_the_time_on_board(mission):
    ctx = mission.context()
    assert ctx == sorted(ctx, key=lambda r: (r.start, r.crew_id))
    for c in mission.crew:
        mine = [r for r in ctx if r.crew_id == c.id]
        assert mine[0].start == mission.timestamp(0) and mine[-1].end == mission.timestamp(mission.landing)
        assert all(a.end == b.start for a, b in zip(mine, mine[1:]))
        nights = [r for r in mine if r.activity == "sleep"]
        assert all(hhmm(r.start) == "22:30" and hhmm(r.end) == "06:00" for r in nights)   # one record a night
        assert len(nights) == 180
    part = mission.context(crew=mission.crew[0], start=94.5, until=95.5)
    assert {r.crew_id for r in part} == {"CM-1"} and part[0].start == mission.timestamp(94.5)
    assert [r.activity for r in part].count("eva") == 1
    assert mission.context(start=-30, until=-1) and gs.Mission("iss_180").context() == []


def test_context_is_reproducible():
    def run():
        m = gs.Mission.random(seed=1)
        return [r.to_dict() for r in m.context()], [r.to_dict() for r in m.timeline(seed=2, instruments=["suit"])]
    assert run() == run()


# ---- agreement with the wearable and the spacesuit ------------------------------------------

def test_wearable_trace_agrees_with_the_context(mission):
    w = gs.Wearable(noise=0)
    for c in mission.crew:
        for d in (10, 70, 95, 150):
            s = w.session(c, d)
            assert s["context"] == [r.to_dict() for r in c.routine(d)]
            rest = c.true_value("resting_hr", d)
            activity = []
            for r in c.routine(d):
                activity += [r.activity] * int((datetime.fromisoformat(r.end[:-1]) - datetime.fromisoformat(r.start[:-1]))
                                               / timedelta(minutes=1))
            hr = np.array([p["hr_bpm"] for p in s["trace"]])
            act = np.array(activity)
            raised = hr > rest + 7                   # above the daily rhythm (+-6 bpm): exercise or a spacewalk
            assert set(act[raised]) <= {"exercise", "eva"} and raised[np.isin(act, ["exercise", "eva"])].all()
            assert (hr[act == "sleep"] <= rest + 0.5).all()                       # no exercise while asleep
            if "eva" in act:
                assert hr[act == "eva"].mean() > hr[act == "work"].mean() + 15    # higher heart rate outside


def test_suit_reports_heart_rate_only_during_the_spacewalk(mission):
    suit = [r for r in mission.timeline(seed=3, noise=0) if r.instrument == "suit"]
    assert {r.crew_id for r in suit} == {"CM-1", "CM-2"} and {r.measure for r in suit} == {"heart_rate"}
    trace_of = {c.id: gs.Wearable(noise=0).session(c, 95)["trace"] for c in mission.crew[:2]}
    for crew_id in ("CM-1", "CM-2"):
        mine = [r for r in suit if r.crew_id == crew_id]
        eva = next(r for r in mission.crew[int(crew_id[-1]) - 1].routine(95) if r.activity == "eva")
        assert len(mine) == 78 and all(eva.start <= r.timestamp < eva.end for r in mine)   # every 5 min for 6.5 h
        assert all(r.unit == "bpm" and r.extrapolated and r.synthetic for r in mine)
        for r in mine:                               # the same heart rate the wearable shows that minute
            minute = int(r.timestamp[11:13]) * 60 + int(r.timestamp[14:16])
            assert r.value == trace_of[crew_id][minute]["hr_bpm"]
        rest = mission.crew[int(crew_id[-1]) - 1].true_value("resting_hr", 95)
        assert min(r.value for r in mine) > rest + 10
    kept = gs.DataService().ingest(suit)
    assert len(kept) == len(suit) and all(r.quality == "ok" for r in kept)
    with pytest.raises(ValueError, match="not on a spacewalk"):
        gs.Spacesuit().measure(mission.crew[0], 95.0 - 0.1)
    assert gs.Spacesuit().measure(mission.crew[0], 95.1).measure == "heart_rate"
    assert gs.Spacesuit().measure_all(mission.crew[2], 95) == []


# ---- the DataService ------------------------------------------------------------------------

def record(**fields):
    """A raw context record as a real source might send it."""
    r = {"crew_id": "CM-1", "start": "2027-06-01T09:00:00Z", "end": "2027-06-01T10:00:00Z", "activity": "exercise",
         "location": "Tranquility", "source": "timeline"}
    return {**r, **fields}


def test_context_is_cleaned_on_the_way_in(caplog):
    with caplog.at_level(logging.WARNING):
        kept = gs.clean_context([
            record(start="2027-06-01T11:00:00+02:00", end="2027-06-01T12:00:00+02:00"),    # the same hour, in CEST
            record(location="Destiny"),                                    # sent again: the last one wins
            record(start="2027-06-01T08:00:00", end="2027-06-01T09:00:00", activity="work"),   # no offset: UTC
            record(crew_id=""), record(activity="nap"), record(start="soon"), record(end="2027-06-01T08:59:00Z"),
            {"crew_id": "CM-1", "activity": "sleep"},
        ])
    assert "dropped 5 context records" in caplog.text
    assert [(r.start, r.end, r.activity, r.location) for r in kept] == [
        ("2027-06-01T08:00:00Z", "2027-06-01T09:00:00Z", "work", "Tranquility"),
        ("2027-06-01T09:00:00Z", "2027-06-01T10:00:00Z", "exercise", "Destiny")]
    assert kept[0].synthetic is False and gs.clean_context([]) == []


@pytest.fixture(scope="module")
def data(mission):
    d = gs.DataService()
    d.ingest(mission.timeline(seed=3))
    d.ingest_context(mission.context())
    return d


def test_current_context_at_the_boundaries(mission, data):
    eva = data.current_context("CM-1", mission.timestamp(95.0))                        # launch was at noon, so is the spacewalk
    assert (eva.activity, eva.start) == ("eva", "2027-06-04T12:00:00Z")               # the start is included
    before = data.current_context("CM-1", "2027-06-04T11:59:59Z")
    assert (before.activity, before.location) == ("work", "Quest") and before.end == eva.start
    after = data.current_context("CM-1", eva.end)                                    # the end is not
    assert (after.activity, after.location, after.start) == ("work", "Quest", eva.end)
    assert data.current_context("CM-1", "2027-06-04T14:00:00+02:00") == eva          # any offset
    assert data.current_context("CM-3", eva.start).activity == "meal"               # lunch, on board
    assert data.current_context("CM-1", mission.timestamp(-1)) is None               # before launch: no on-board sources
    assert data.current_context("CM-1", mission.timestamp(mission.landing)) is None   # landed
    assert data.current_context("CM-9", eva.start) is None


def test_overlapping_sources_observed_then_newest_wins():
    data = gs.DataService()
    data.ingest_context([record(activity="work", start="2027-06-01T07:00:00Z", end="2027-06-01T12:00:00Z"),
                         record(activity="hygiene", start="2027-06-01T08:10:00Z", end="2027-06-01T08:20:00Z",
                                source="room_sensor"),
                         record(activity="meal", location="Unity", start="2027-06-01T08:00:00Z",
                                end="2027-06-01T08:30:00Z"),            # planned, inside the planned work block
                         record(activity="eva", location="outside", start="2027-06-01T10:00:00Z",
                                end="2027-06-01T11:00:00Z", source="suit"),
                         record(activity="meal", location="Unity", start="2027-06-01T10:40:00Z",
                                end="2027-06-01T11:10:00Z")])          # planned lunch while the suit says outside

    def now(t):
        return data.current_context("CM-1", f"2027-06-01T{t}:00Z")
    assert [now(t).activity for t in ("07:00", "08:05", "08:15", "08:25", "08:30")] == \
        ["work", "meal", "hygiene", "meal", "work"]
    assert [(now(t).activity, now(t).source) for t in ("10:45", "11:05")] == [("eva", "suit"), ("meal", "timeline")]


def test_context_window_includes_both_ends(mission, data):
    day = data.context("CM-2", "2027-06-04T06:00:00Z", "2027-06-04T12:00:00Z")
    assert (day[0].activity, day[0].start) == ("hygiene", "2027-06-04T06:00:00Z")     # the night ended at 06:00, not under way
    assert (day[-1].activity, day[-1].start) == ("eva", "2027-06-04T12:00:00Z")       # starts at the window's end: under way
    assert all(r.crew_id == "CM-2" for r in day) and day == sorted(day, key=lambda r: r.start)
    assert len(data.context("CM-2")) == len([r for r in mission.context() if r.crew_id == "CM-2"])


def test_context_table_is_defined_but_inert():
    store = gs.SqliteStore()
    assert [row[1] for row in store.db.execute("PRAGMA table_info(context)")] == \
        ["crew_id", "start", "end", "activity", "location", "source", "synthetic"]
    pk = [row[1] for row in sorted(store.db.execute("PRAGMA table_info(context)"), key=lambda row: row[5]) if row[5]]
    assert pk == ["crew_id", "source", "start"]
    data = gs.DataService(store=store)
    kept = data.ingest_context([record()])
    assert store.query_context("CM-1") == [] and store.db.execute("SELECT COUNT(*) FROM context").fetchone() == (0,)
    assert data.context("CM-1") == kept                      # the DataService keeps it in memory


def test_context_api(mission, data):
    server = make_server(data_routes(mission, data, clock=lambda: 95.1), port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}/api/v1"

    def get(path):
        with urllib.request.urlopen(base + path) as r:
            return json.load(r)
    try:
        now = get("/context/current?crew=CM-2")
        assert (now["activity"], now["location"], now["source"]) == ("eva", "outside", "suit")
        assert get("/context/current?crew=CM-2&at=2027-06-04T05:00:00Z")["activity"] == "sleep"
        assert get("/context/current?crew=CM-2&day=-3") is None
        last_day = get("/context?crew=CM-2")                    # the 24 hours up to now
        assert last_day[0]["start"] <= mission.timestamp(94.1) < last_day[0]["end"] and last_day[-1]["activity"] == "eva"
        window = get("/context?crew=CM-3&start=2027-06-04T12:00:00Z&end=2027-06-04T13:00:00Z")
        assert window == [r.to_dict() for r in data.context("CM-3", "2027-06-04T12:00:00Z", "2027-06-04T13:00:00Z")]
    finally:
        server.shutdown()
        server.server_close()
