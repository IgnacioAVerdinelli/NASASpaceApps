"""Checks for the HealthService MOCK: the dashboard follows the 3D page's contract, uses only what the
instruments reported, saves what it computes through the DataService, and is served over HTTP.

Run from sim/:  python -m pytest -q mocks
"""
import json
import threading
import urllib.request

import pytest

import gravsim as gs
from gravsim.serve import make_server
from mocks.healthservice import HealthService, health, validate_dashboard
from mocks.healthservice.serve import dashboard_routes


@pytest.fixture(scope="module")
def mission_and_data():
    m = gs.Mission.random(seed=4)
    data = gs.DataService()
    data.ingest(m.timeline(seed=4))
    return m, data


def test_dashboard_follows_the_frontend_contract(mission_and_data):
    m, data = mission_and_data
    service = HealthService(data)
    for c in m.crew:
        for day in (-30, 0, 120, 300):
            d = validate_dashboard(service.dashboard(c, day))
            assert d["simulated"] is True
        assert d["body"]["scores"]


def test_dashboard_validator_rejects_what_the_page_rejects(mission_and_data):
    m, data = mission_and_data
    good = HealthService(data).dashboard(m.crew[0], 120)
    for path, bad in [(("body", "scores", "quadriceps_l"), float("nan")), (("body", "viewRequest"), {"direction": "up"}),
                      (("charts", 0, "points", 0, "at"), "2027-13-40T00:00:00Z"), (("summary", "items", 0, "changePercent"), "8")]:
        d = json.loads(json.dumps(good))
        *parents, last = path
        target = d
        for p in parents:
            target = target[p]
        target[last] = bad
        with pytest.raises(ValueError):
            validate_dashboard(d)


def test_dashboard_uses_only_readings_never_truth():
    m = gs.Mission.random(seed=4); data = gs.DataService(); data.ingest(m.timeline(seed=4))
    service = HealthService(data)
    before = [service.dashboard(c, 120) for c in m.crew]
    for c in m.crew:
        for r in data.readings(c.id):                       # the readings the DataService holds
            r.truth = {"value": -1e9, "change_pct": -1e9, "faults": ["corrupted"]}
    after = [service.dashboard(c, 120) for c in m.crew]
    assert before == after
    for d in after:
        validate_dashboard(d)


def test_dashboard_saves_what_it_computes():
    m = gs.Mission.random(seed=5)
    data = gs.DataService()
    data.ingest(m.timeline(seed=5))
    crew = m.crew[0]
    dash = HealthService(data).dashboard(crew, 120)

    saved = {r.kind: r for r in data.results(crew.id)}
    assert set(saved) == {"dashboard", "measure_change"}
    assert {r.timestamp for r in saved.values()} == {m.timestamp(120)}
    assert saved["dashboard"].payload == dash
    changes = saved["measure_change"].payload
    for item in dash["summary"]["items"]:
        measure = next(mid for item_id, mid, _, _ in health.REGIONS if item_id == item["id"])
        change = changes[measure]["change_pct"]
        assert item["changePercent"] == (None if change is None else round(change, 1))
    assert changes["vo2peak"]["latest_at"] <= m.timestamp(120)


def test_dashboard_is_served_over_http(mission_and_data):
    m, data = mission_and_data
    server = make_server(dashboard_routes(m, HealthService(data), clock=lambda: 95.0), port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}/api/v1/dashboard"
    try:
        with urllib.request.urlopen(f"{base}?crew=CM-2&day=120") as r:
            d = validate_dashboard(json.load(r))
        assert d["updatedAt"] == m.timestamp(120) and d["summary"]["title"].startswith("CM-2")
        with urllib.request.urlopen(base) as r:            # no day: the mission clock
            assert json.load(r)["updatedAt"] == m.timestamp(95)
        with pytest.raises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(f"{base}?crew=CM-9")
        assert e.value.code == 404 and json.load(e.value)["crew"] == [c.id for c in m.crew]
    finally:
        server.shutdown()
        server.server_close()
