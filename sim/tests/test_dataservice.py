"""Checks for the DataService: units, the cleaning rules, the inert store, and gravsim's readings going
through the pipeline.

Run from sim/:  python -m pytest -q
"""
import logging

import pytest

import gravsim as gs


def sensor(**fields):
    """A raw record as a real wearable might send it."""
    record = {"crew_id": "CM-1", "measure": "resting_hr", "timestamp": "2027-03-01T08:00:00Z",
              "value": 72, "unit": "bpm", "instrument": "wearable"}
    return {**record, **fields}


# ---- units ----------------------------------------------------------------------------------

@pytest.mark.parametrize("value,unit,to,expected", [
    (100, "N·m", "ft-lb", 73.756),
    (17.5, "kg", "g", 17500),
    (950, "mg/cm²", "g/cm²", 0.95),
    (1.2, "beats/s", "bpm", 72),
    (73.756, "ft-lb", "N·m", 100),
])
def test_convert(value, unit, to, expected):
    assert gs.convert(value, unit, to) == pytest.approx(expected, rel=1e-4)


def test_convert_refuses_unknown_units_and_other_kinds():
    with pytest.raises(ValueError, match="unknown unit"):
        gs.convert(1, "furlong", "g")
    with pytest.raises(ValueError, match="can't convert"):
        gs.convert(1, "kg", "bpm")


def test_every_measure_has_a_known_unit_and_limits():
    for mid, m in gs.MEASURES.items():
        assert gs.UNITS[m["unit"]] == (m["unit"], 1.0), mid           # its unit is a canonical one
        assert mid in gs.LIMITS, mid


# ---- cleaning -------------------------------------------------------------------------------

def test_wearable_in_beats_per_second_is_stored_in_bpm():
    [r] = gs.clean([sensor(value=1.2, unit="beats/s")])
    assert (r.value, r.unit, r.quality) == (72.0, "bpm", "ok")
    assert r.label == gs.MEASURES["resting_hr"]["label"] and r.synthetic is False


def test_times_become_utc_iso():
    stamps = ["2027-03-01T10:00:00+02:00", "2027-03-01T08:00:00", "2027-03-01 08:00:00Z", 1803888000]
    assert {r.timestamp for r in gs.clean([sensor(timestamp=t, instrument=str(i)) for i, t in enumerate(stamps)])} \
        == {"2027-03-01T08:00:00Z"}


def test_missing_values_are_flagged_not_dropped():
    readings = gs.clean([sensor(value=v, instrument=str(i)) for i, v in enumerate([None, "", "n/a", float("nan")])])
    assert len(readings) == 4 and all(r.value is None and r.quality == "missing" for r in readings)


def test_values_outside_physiological_limits_are_flagged():
    [low, ok, high] = gs.clean([sensor(value=v, timestamp=f"2027-03-01T0{i}:00:00Z") for i, v in enumerate([1.2, 72, 400])])
    assert (low.quality, ok.quality, high.quality) == ("out_of_range", "ok", "out_of_range")
    assert low.value == 1.2            # kept as sent, so nothing is lost


def test_unknown_or_wrong_units_are_flagged():
    by_unit = {r.unit: r for r in gs.clean([sensor(unit="kg"), sensor(unit="bananas", instrument="other")])}
    assert (by_unit["kg"].quality, by_unit["kg"].value) == ("bad_unit", 72.0)      # value and unit kept as sent
    assert by_unit["bananas"].quality == "bad_unit"


def test_records_without_who_what_or_when_are_dropped(caplog):
    with caplog.at_level(logging.WARNING):
        kept = gs.clean([sensor(), sensor(crew_id=None), sensor(measure="body_temp"), sensor(timestamp="yesterday"),
                         {"crew_id": "CM-1", "measure": "resting_hr"}])
    assert len(kept) == 1 and "dropped 4 records" in caplog.text


def test_duplicates_keep_the_last_and_output_is_sorted():
    readings = gs.clean([sensor(timestamp="2027-03-02T08:00:00Z"), sensor(value=70), sensor(value=71),
                         sensor(timestamp="2027-03-01T10:00:00+02:00", value=75)])
    assert [(r.timestamp, r.value) for r in readings] == [("2027-03-01T08:00:00Z", 75.0), ("2027-03-02T08:00:00Z", 72.0)]


# ---- the inert store ------------------------------------------------------------------------

def test_store_has_the_schema_but_saves_and_finds_nothing():
    store = gs.SqliteStore()
    columns = [row[1] for row in store.db.execute("PRAGMA table_info(readings)")]
    assert columns[:5] == ["crew_id", "measure", "timestamp", "instrument", "side"]
    readings = gs.clean([sensor()])
    store.save(readings)
    assert store.query("CM-1") == []
    assert store.db.execute("SELECT COUNT(*) FROM readings").fetchone() == (0,)


# ---- gravsim through the DataService --------------------------------------------------------

@pytest.fixture(scope="module")
def mission_and_data():
    m = gs.Mission.random(seed=5)
    data = gs.DataService()
    generated = m.timeline(seed=5)
    kept = data.ingest(generated)
    return m, data, generated, kept


def test_generator_readings_go_through_the_pipeline_unchanged(mission_and_data):
    m, data, generated, kept = mission_and_data
    assert len(kept) == len(generated)                       # nothing dropped or merged, same order
    for g, k in zip(generated, kept):
        assert k.to_dict() == {**g.to_dict(), "quality": k.quality}
    # the only flags: gravsim's SpO2 can exceed 100 %, which the limits catch
    assert all(r.measure == "spo2" and r.value > 100 for r in kept if r.quality == "out_of_range")


def test_readings_filter_by_crew_measure_and_time(mission_and_data):
    m, data, _, _ = mission_and_data
    found = data.readings("CM-2", "bone", start=m.timestamp(0), end=m.timestamp(m.landing + 30))
    assert found and {r.measure for r in found} <= set(gs.GROUPS["bone"]) and {r.crew_id for r in found} == {"CM-2"}
    assert all(m.timestamp(0) <= r.timestamp <= m.timestamp(m.landing + 30) for r in found)
    assert data.readings("nobody") == []


def test_latest_is_the_newest_usable_reading_of_each_measure(mission_and_data):
    m, _, _, kept = mission_and_data
    data = gs.DataService()
    data.ingest(kept)
    latest = data.latest("CM-1", ["knee_extension_60", "vo2peak"], at=m.timestamp(100))
    assert set(latest) == {"knee_extension_60", "vo2peak"}
    assert latest["knee_extension_60"].mission_day == 74 and latest["vo2peak"].mission_day == 75
    data.ingest([sensor(measure="vo2peak", unit="ml/kg/min", value=None, timestamp=m.timestamp(99))])
    assert data.latest("CM-1", "vo2peak", at=m.timestamp(100))["vo2peak"].mission_day == 75     # a gap doesn't hide it
