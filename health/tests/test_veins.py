"""The jugular vein ultrasound (veins.py, docs/investigacion-yugular.md): scans against the pre-flight one, levels,
the endpoint and the findings for the Planner."""
import gravsim as gs
import pytest
from fastapi.testclient import TestClient

from healthservice import HealthService
from healthservice import veins
from healthservice.api import create_app
from healthservice.sources import GravsimSource, mission_info


def test_levels():
    assert veins.judge({"ijv_flow_grade": 2, "ijv_compressible": 1, "ijv_echogenicity": 1})[0] == "normal"
    assert veins.judge({"ijv_flow_grade": 3, "ijv_compressible": 1})[0] == "check"
    level, signs = veins.judge({"ijv_flow_grade": 4, "ijv_compressible": 1, "ijv_echogenicity": 2})
    assert level == "check" and {s["sign"] for s in signs} == {"retrograde", "echogenicity"}
    level, signs = veins.judge({"ijv_flow_grade": 3, "ijv_compressible": 0, "ijv_echogenicity": 2})
    assert level == "alarm" and [s["sign"] for s in signs] == ["not_compressible"]   # the clot, said once


def test_each_vein_on_its_own_and_a_reading_without_a_side_counts_for_both():
    info = mission_info(gs.Mission.random("iss_180", n_crew=1, seed=7))
    recs = [{"measure": "ijv_csa", "value": 80, "timestamp": info.timestamp(-90), "side": None},
            {"measure": "ijv_flow_grade", "value": 2, "timestamp": info.timestamp(-90), "side": None},
            {"measure": "ijv_csa", "value": 66, "timestamp": info.timestamp(30), "side": "left"},
            {"measure": "ijv_flow_grade", "value": 3, "timestamp": info.timestamp(30), "side": "left"},
            {"measure": "ijv_flow_grade", "value": 2, "timestamp": info.timestamp(30), "side": "right"}]
    out = veins.build_veins(info, "CM-1", 40, recs)
    assert out["scans"][1]["changes"]["left"] == {"ijv_csa": -14.0, "ijv_flow_grade": 1.0}
    assert out["status"]["sides"] == {"right": "normal", "left": "check"} and out["status"]["level"] == "check"
    assert out["status"]["signs"][0]["text"] == "Left vein: blood is standing still (grade 3)"
    assert out["scans"][0]["level"] == "normal"                # pre-flight scans are never judged


@pytest.fixture(scope="module")
def clot():
    """A gravsim crew where CM-1 gets a left jugular thrombus on flight day 45 and CM-2 a low stasis."""
    m = gs.Mission.random("iss_180", n_crew=2, seed=7)
    gs.add_thrombus(m.crew[0], 45)
    gs.set_stasis(m.crew[1], -2.0)
    return GravsimSource(mission=m, day=130.0)


def test_a_thrombus_raises_the_alarm_at_the_next_scan(clot):
    service = HealthService(clot, process_on_read=False)
    early = service.veins("CM-1", day=40)
    assert [s["label"] for s in early["scans"]] == ["L-90", "FD30"] and early["status"]["level"] != "alarm"
    out = service.veins("CM-1")
    assert out["version"] == 1 and out["status"]["level"] == "alarm" and out["status"]["scanLabel"] == "FD60"
    assert out["status"]["sides"]["left"] == "alarm" and out["status"]["sides"]["right"] != "alarm"
    assert out["status"]["signs"][0]["text"].startswith("Left vein: does not collapse")
    flow = next(m for m in out["measures"] if m["measure"] == "ijv_compressible")
    assert flow["sides"]["left"]["latest"]["value"] == 0 and flow["sides"]["right"]["latest"]["value"] == 1
    assert [m["measure"] for m in out["measures"]] == veins.MEASURES
    assert out["reference"]["supine"] == 80.7 and out["grades"]["3"] == "Standing still"
    calm = service.veins("CM-2")
    assert calm["status"]["level"] == "normal" and calm["status"]["text"]


def test_veins_endpoint(clot):
    client = TestClient(create_app(HealthService(clot, process_on_read=False)))
    r = client.get("/api/v1/veins", params={"crew": "CM-1"})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store" and r.json()["status"]["level"] == "alarm"
    assert client.get("/api/v1/veins", params={"crew": "CM-9"}).status_code == 404


def test_findings_open_escalate_and_clear(clot):
    service = HealthService(clot, process_on_read=False)
    alarm = service.veins("CM-1")
    (f,) = veins.findings("CM-1", alarm, {})
    assert f["source"] == "vascular" and f["measure"] == "veins" and f["state"] == "confirmed" and f["urgent"]
    assert veins.findings("CM-1", alarm, {"veins": f}) == []                       # published once
    check = {"veins": f | {"level": "check", "state": "suspected"}}
    assert veins.findings("CM-1", alarm, check)[0]["state"] == "confirmed"           # check -> alarm escalates
    late = service.veins("CM-1", day=clot.mission().landing + 46)                  # R+45: the clot lies flat
    assert late["status"]["level"] == "normal"                                       # the R+45 scan: it collapses again
    calm = service.veins("CM-2")
    assert veins.findings("CM-2", calm, {"veins": f | {"crew_id": "CM-2"}})[0]["state"] == "cleared"
