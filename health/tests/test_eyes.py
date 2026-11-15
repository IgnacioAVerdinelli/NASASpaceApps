"""The eye exam (eyes.py, docs/investigacion-ojos.md): exams against the pre-flight one, SANS classes from the 2026
consensus, the endpoint and the findings for the Planner."""
import gravsim as gs
import pytest
from fastapi.testclient import TestClient

from healthservice import HealthService
from healthservice import eyes
from healthservice.api import create_app
from healthservice.sources import GravsimSource


def test_a_reading_without_a_side_counts_for_both_eyes():
    mission = gs.Mission.random("iss_180", n_crew=1, seed=7)
    from healthservice.sources import mission_info
    info = mission_info(mission)
    recs = [{"measure": "oct_trt", "value": 430, "timestamp": info.timestamp(-30), "side": None},
            {"measure": "oct_trt", "value": 470, "timestamp": info.timestamp(89), "side": "right"},
            {"measure": "oct_trt", "value": 432, "timestamp": info.timestamp(89), "side": "left"}]
    out = eyes.build_eyes(info, "CM-1", 100, recs)
    assert out["exams"][1]["changes"] == {"right": {"oct_trt": 40.0}, "left": {"oct_trt": 2.0}}
    assert out["status"]["eyes"] == {"right": "A", "left": "none"} and out["status"]["class"] == "A"


def test_classes_follow_the_consensus():
    assert eyes.classify({"oct_trt": 10.0, "refraction_se": 0.25}, {})[0] == "none"
    assert eyes.classify({"oct_trt": 25.0}, {})[0] == "A"
    assert eyes.classify({"oct_trt": 5.0}, {"choroidal_folds": 1})[0] == "A"
    assert eyes.classify({"oct_trt": 5.0, "refraction_se": 0.75}, {})[0] == "A"
    assert eyes.classify({"oct_trt": 60.0}, {})[0] == "B"
    cls, signs = eyes.classify({"oct_trt": 30.0}, {"frisen_grade": 1, "globe_flattening": 1})
    assert cls == "B" and {s["sign"] for s in signs} == {"disc_edema", "globe_flattening"}


@pytest.fixture(scope="module")
def sans():
    """A gravsim crew where CM-1 has SANS mostly in the right eye and CM-2 a low susceptibility."""
    m = gs.Mission.random("iss_180", n_crew=2, seed=7)
    gs.set_sans(m.crew[0], 1.8, eye="right")
    gs.set_sans(m.crew[1], -1.5)
    return GravsimSource(mission=m, day=130.0)


def test_a_susceptible_crew_member_reaches_class_b(sans):
    service = HealthService(sans, process_on_read=False)
    out = service.eyes("CM-1")
    assert out["version"] == 2 and out["status"]["class"] == "B" and out["status"]["examLabel"] == "FD90"
    assert out["status"]["eyes"]["right"] == "B" and out["status"]["eyes"]["left"] != "B"   # one eye carries it
    assert out["status"]["signs"][0]["text"].startswith("Right eye:")
    assert [e["label"] for e in out["exams"]] == ["L-30", "FD30", "FD90"]          # nothing after day 130
    trt = next(m for m in out["measures"] if m["measure"] == "oct_trt")
    right, left = trt["eyes"]["right"], trt["eyes"]["left"]
    assert right["series"][0]["change"] == 0 and right["latest"]["change"] >= 55 > left["latest"]["change"]
    assert [m["measure"] for m in out["measures"]] == eyes.MEASURES
    calm = service.eyes("CM-2")
    assert calm["status"]["class"] in ("none", "A") and calm["status"]["text"]
    assert service.eyes("CM-1", day=10)["status"]["class"] == "none"              # only the pre-flight exam yet


def test_eyes_endpoint(sans):
    client = TestClient(create_app(HealthService(sans, process_on_read=False)))
    r = client.get("/api/v1/eyes", params={"crew": "CM-1"})
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store" and r.json()["thresholds"]["oct_trt"]["B"] == 55
    assert client.get("/api/v1/eyes", params={"crew": "CM-9"}).status_code == 404


def test_findings_open_escalate_and_clear(sans):
    service = HealthService(sans, process_on_read=False)
    a = service.eyes("CM-1", day=40)            # FD30 only
    first = eyes.findings("CM-1", a, {})
    assert first and first[0]["source"] == "ocular" and first[0]["measure"] == "eyes"
    prev = {"eyes": first[0]}
    b = service.eyes("CM-1", day=130)
    again = eyes.findings("CM-1", b, prev)
    if a["status"]["class"] == "B":
        assert again == []
    else:
        assert again[0]["state"] == "confirmed"
    late = service.eyes("CM-1", day=sans.mission().landing + 200)  # R+180: the swelling has resolved
    if late["status"]["class"] == "none":
        assert eyes.findings("CM-1", late, prev)[0]["state"] == "cleared"
