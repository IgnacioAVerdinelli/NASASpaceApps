"""The catalog matches OCHMO-STD-100.1A, and its schedules give the occurrences docs/planner.md lists.

Run from planner/:  python -m pytest -q
"""
import re
from pathlib import Path

import pytest

from planner.catalog import Catalog, day_of, window_of
from planner.mission import Mission, Phase, parse_time

ROOT = Path(__file__).resolve().parents[2]
TEXT = ROOT / "docs" / "references" / "OCHMO-STD-100.1A_RevA_2024-09-09.txt"
CATALOG = Catalog.load()
ISS = Mission(parse_time("2027-03-01T00:00:00Z"),
              [Phase("preflight", -180, 0, 1.0), Phase("flight", 0, 180, 0.0), Phase("postflight", 180, 545, 1.0)],
              "iss_180")


def pages() -> dict[int, str]:
    text = TEXT.read_text(encoding="utf-8")
    return {int(m.group(1)): re.sub(r"\s+", " ", m.group(2))
            for m in re.finditer(r"=== page (\d+) ===\n(.*?)(?==== page|\Z)", text, re.S)}


PAGES = pages()
FIELDS = {"id", "ref", "section", "title", "category", "item_type", "phases", "requirement", "requirement_page",
          "schedule_text", "schedule_page", "schedule", "completion", "instrument", "measures", "steps", "guide",
          "assumptions"}


def test_the_text_is_the_whole_standard():
    assert len(PAGES) == 103
    assert "OCHMO-STD-100.1A" in PAGES[1] or "OCHMO-STD-100.1A" in PAGES[2]


@pytest.mark.parametrize("rid", sorted(CATALOG.routines))
def test_each_routine_quotes_the_standard_on_its_page(rid):
    r = CATALOG.routine(rid)
    assert FIELDS <= r.keys(), FIELDS - r.keys()
    assert r["ref"] == f"OCHMO-STD-100.1A [{rid}]"
    page = PAGES[r["requirement_page"]]
    assert f"[{rid}]" in page
    assert re.sub(r"\s+", " ", r["requirement"]) in page, "requirement not on its page"
    assert re.sub(r"\s+", " ", r["schedule_text"]) in PAGES[r["schedule_page"]], "schedule not on its page"
    assert r["completion"] in ("auto", "crew")
    assert r["item_type"] in ("study", "routine", "treatment")
    assert (r["completion"] == "auto") == bool(r["instrument"]) or r.get("continuous")
    assert r["guide"]["how"] and r["guide"]["if_abnormal"]


def test_dates_and_windows():
    assert day_of("L+30", ISS) == 30 and day_of("R-14", ISS) == 166 and day_of("FD14", ISS) == 13
    assert day_of("R+ 5", ISS) == 185
    assert window_of("L+14/21", ISS) == (14, 21)
    assert window_of("L-90/30", ISS) == (-90, -30)
    assert window_of("R-21/14", ISS) == (159, 166)
    with pytest.raises(ValueError):
        day_of("tomorrow", ISS)


def days(rid):
    return [(o.day_from, o.day_to) for o in CATALOG.occurrences(CATALOG.routine(rid), ISS)]


def test_occurrences_on_a_180_day_iss_mission():
    """The 'Version 1 occurrences' column of docs/planner.md."""
    assert days("6002") == [(14, 21), (87, 93), (159, 166)]             # L+180 and L+270 dropped
    assert days("6012") == [(27, 33), (87, 93), (147, 153)]             # L+30, L+90, R-30
    assert days("6041") == [(27, 33), (57, 63), (135, 141)]
    assert [a + 3 for a, _ in days("6025")] == [14, 44, 74, 104, 134, 164]
    assert [a + 3 for a, _ in days("6015")] == [7, 37, 67, 97, 127, 157]
    assert days("6028") == [(-90, -30), (10, 16), (71, 77), (161, 167), (163, 169), (182, 188), (207, 213)]
    assert days("6013") == [(-180, -30), (180, 210), (515, 545)]        # R+1 year clipped to the mission end
    assert days("6024") == [(-90, -30), (185, 187), (207, 213)]
    assert days("6007") == [(0, 20), (104, 118)]
    assert days("6019") == []                                            # L+180 is landing day
    assert len(days("6039")) == 195                                      # every day from L-7 to R+7


def test_flight_routines_stay_in_flight_and_aci_ones_book_nothing():
    for r in CATALOG.routines.values():
        occ = CATALOG.occurrences(r, ISS)
        if set(r["phases"]) == {"flight"}:
            assert all(0 <= o.day_from and o.day_to < 180 for o in occ), r["id"]
        if r.get("aci") or r.get("continuous"):
            assert occ == [], r["id"]


def test_instruments_and_retest_routines():
    inst = CATALOG.instrument_measures()
    assert set(inst) == {"dxa", "dynamometer", "cycle", "suit"}
    assert CATALOG.routine_for_measure("knee_extension_60")["id"] == "6025"     # the in-flight one
    assert CATALOG.routine_for_measure("vo2peak")["id"] == "6028"
    assert CATALOG.routine_for_measure("hip_bmd")["id"] == "6013"
    assert CATALOG.routine_for_measure("resting_hr") is None
