"""The jugular vein ultrasound of OCHMO-STD-100.1A [6041]: duplex ultrasound of both internal jugular veins, with
breathing and compression manoeuvres, to screen for venous thrombosis and flow anomalies. Simulated from published
group results (docs/investigacion-yugular.md).

There is no open per-person data (docs/investigacion-yugular.md, section 5). Each crew member gets a jugular profile
drawn so that the crew as a whole reproduces what was published:

- area of the left vein (Marshall-Goebel 2019, 11 astronauts): 80.7 mm2 supine before flight, 70.3 mm2 on flight
  day ~50 and 60.0 mm2 on flight day ~150; back to the pre-flight value within ~4 days of landing (Arbeille 2015).
  In flight the vein looks like a supine one on Earth, so the pre-flight exam is read lying down (the seated vein,
  9.8 mm2, is nearly empty and is only context on the page);
- flow grade of the left vein, 1 continuous, 2 pulsatile, 3 stagnant, 4 retrograde (Marshall-Goebel 2019, figure 3):
  before flight, supine, 10 of 11 grade 2 and none 3 or 4; on flight day 50, grade 3 in 5 of 11 and grade 4 in 1
  (6 of 11, 55 %); on flight day 150, grade 3 in 2 of 10 and one more grade 4; between the two, 5 of 10 kept their
  grade, 3 improved and 2 got worse;
- echogenicity ("smoke" of slow blood) mild to moderate in the left vein of 6 of 11, never more than mild in the
  right (Pavela 2022); peak velocity lower in flight, lowest in the left (Pavela 2022, no values: ours);
- thrombus: 1 occlusive and 1 partial in 11 (Marshall-Goebel 2019), 0 in 11 (Pavela 2022). We give about 1 crew
  member in 14 a left jugular thrombus, only among those with the most stagnant flow, formed between flight days 35
  and 70; a thrombosed vein does not collapse when pressed and carries no flow. Treatment is not simulated.
Readings come per vein (side "right" and "left"). Every spread, time constant and correlation not named above is ours.
"""
from __future__ import annotations

import math
from statistics import NormalDist

import numpy as np

from .core import MODEL, MODEL_VERSION, CrewMember
from .instruments import Instrument
from .measures import MEASURES
from .pipeline import LIMITS
from .reading import Reading

VASCULAR_STREAM = 4                # the random stream of the jugular profile, next to ocular.OCULAR_STREAM
SIDES = ("right", "left")
VASCULAR_MEASURES = ("ijv_csa", "ijv_flow_grade", "ijv_echogenicity", "ijv_compressible", "ijv_peak_velocity")
GRADED = ("ijv_flow_grade", "ijv_echogenicity", "ijv_compressible")

# area: supine pre-flight (mm2) and the in-flight area as a fraction of it, f(t) = FLOOR + RISE * exp(-t / TAU):
# 0.86 on flight day 50 (70.3 / 80.7 = 0.87 published) and 0.76 on day 150 (60.0 / 80.7 = 0.74)
CSA_SUPINE = {"left": (80.0, 22.0), "right": (100.0, 28.0)}     # mean, SD; the right vein is usually larger (ours)
CSA_FLOOR, CSA_RISE, CSA_TAU = 0.72, 0.27, 80.0
CSA_PERSON_SD = 0.12               # how far one person's in-flight fraction sits from the group's (ours)
CSA_LANDING_TAU = 1.5              # days; back to the pre-flight area within ~4 days (Arbeille 2015)
# flow: a person's stasis susceptibility s and each exam's own draw, correlated EXAM_RHO (about half keep their grade)
EXAM_RHO = 0.75
# thresholds on the exam's stasis score (standard normal): P(grade >= 3) and P(grade 4) early and late in flight
LEFT_EARLY = (0.55, 0.10)          # flight day 50: 6 of 11, 1 of them retrograde
LEFT_LATE = (0.30, 0.10)           # flight day 150: 2 of 10 stagnant and retrograde ones
RIGHT_ANY = (0.03, 0.01)           # the right vein rarely stagnates (Marshall-Goebel 2019 discussion; ours)
EARLY_DAY, LATE_DAY = 50.0, 150.0
GRADE1_SHARE = 0.12                # supine on Earth and in flight, the rest of the normal veins are pulsatile (10 of 11)
# echogenicity: mild from the stagnant line on (6 of 11 ~ the 55 % stagnant on day 50), moderate well above it
ECHO_MILD_BELOW, ECHO_MODERATE_ABOVE = 0.0, 0.9
# peak velocity toward the heart, cm/s (assumed: no published values), and what each grade keeps of it
VELOCITY = {"left": (32.0, 9.0), "right": (40.0, 10.0)}
FLIGHT_VELOCITY = {"left": 0.55, "right": 0.75}      # lower in flight, lowest in the left (Pavela 2022, sizes ours)
GRADE_VELOCITY = {1: 1.0, 2: 0.8, 3: 0.08, 4: -0.35}  # negative: toward the head
# thrombus: among the people with stasis s >= THROMBUS_S, this share gets one (about 1 in 14 overall)
THROMBUS_S, THROMBUS_SHARE, THROMBUS_DAYS = 0.8, 0.34, (35.0, 70.0)
THROMBUS_CLEARS_AFTER = 30.0       # days after landing: the residual clot lies flat and the vein collapses again (ours)

# measure: (measurement noise SD in its unit, rounding step); all assumed
NOISE = {"ijv_csa": (0.08, 1), "ijv_peak_velocity": (2.5, 0.1), "ijv_flow_grade": (0.0, 1),
         "ijv_echogenicity": (0.0, 1), "ijv_compressible": (0.0, 1)}


def _quantile(p_upper: float) -> float:
    """The standard normal value with p_upper above it."""
    return NormalDist().inv_cdf(1 - p_upper)


class VeinProfile:
    """One jugular vein of one person: its pre-flight values and how it behaves in flight."""

    def __init__(self, rng: np.random.Generator, side: str, stasis: float):
        n = rng.standard_normal
        mean, sd = CSA_SUPINE[side]
        self.csa = float(np.clip(mean + sd * n(), 25, 200))
        self.csa_flight = float(np.clip(1 + CSA_PERSON_SD * n(), 0.6, 1.4))
        vmean, vsd = VELOCITY[side]
        self.velocity = float(np.clip(vmean + vsd * n(), 12, 70))
        self.stasis = stasis
        self.grade1 = float(rng.random()) < GRADE1_SHARE  # this vein tends to continuous flow when it is normal


class JugularProfile:
    """One person's two jugular veins: a shared stasis susceptibility (stronger in the left vein) and a thrombus or not."""

    def __init__(self, crew: CrewMember):
        rng = np.random.default_rng([crew._day_key, VASCULAR_STREAM])
        chosen = getattr(crew, "ijv_stasis_z", None)          # set_stasis(): a chosen susceptibility, for the demo
        s = float(rng.standard_normal()) if chosen is None else float(chosen)
        self.stasis = s
        self.veins = {"left": VeinProfile(rng, "left", s),
                      "right": VeinProfile(rng, "right", 0.5 * s + math.sqrt(0.75) * float(rng.standard_normal()))}
        self._exam_seed = int(rng.integers(2 ** 62))
        forced = getattr(crew, "ijv_thrombus", None)           # add_thrombus(): (day, side)
        u, when = float(rng.random()), float(rng.uniform(*THROMBUS_DAYS))
        if forced is not None:
            self.thrombus = forced
        elif s >= THROMBUS_S and u < THROMBUS_SHARE and crew.mission.landing > when:
            self.thrombus = (when, "left")
        else:
            self.thrombus = None

    def score(self, day: float, side: str) -> float:
        """The stasis score of the exam on `day`: the person's susceptibility plus that exam's own draw."""
        rng = np.random.default_rng([self._exam_seed, int(round(day * 10)), SIDES.index(side)])
        return EXAM_RHO * self.veins[side].stasis + math.sqrt(1 - EXAM_RHO ** 2) * float(rng.standard_normal())

    @staticmethod
    def thresholds(flight_day: float, side: str) -> tuple[float, float]:
        """Stasis-score thresholds for grade >= 3 and for grade 4 on this flight day (interpolated early to late)."""
        if side == "right":
            p3, p4 = RIGHT_ANY
        else:
            t = min(1.0, max(0.0, (flight_day - EARLY_DAY) / (LATE_DAY - EARLY_DAY)))
            p3 = LEFT_EARLY[0] + t * (LEFT_LATE[0] - LEFT_EARLY[0])
            p4 = LEFT_EARLY[1] + t * (LEFT_LATE[1] - LEFT_EARLY[1])
        return _quantile(p3), _quantile(p4)

    def clot(self, crew: CrewMember, day: float, side: str) -> bool:
        if not self.thrombus or self.thrombus[1] != side:
            return False
        land = crew.mission.landing
        return self.thrombus[0] <= day < land + THROMBUS_CLEARS_AFTER

    def state(self, crew: CrewMember, day: float, side: str) -> dict:
        """The true state of one vein on mission `day` (no measurement noise)."""
        v, ms = self.veins[side], crew.mission
        land, flight = ms.landing, ms.unloaded_days(min(day, ms.landing))
        in_flight = 0 <= day <= land and flight > 0
        after = max(0.0, day - land)
        f_flight = (CSA_FLOOR + CSA_RISE * math.exp(-flight / CSA_TAU)) * v.csa_flight
        if in_flight:
            csa = v.csa * f_flight
        elif day > land:            # back towards the supine pre-flight area within days
            csa = v.csa * (1 + (f_flight - 1) * math.exp(-after / CSA_LANDING_TAU))
        else:
            csa = v.csa
        clot = self.clot(crew, day, side)
        if clot:
            grade, echo = 3, 2                                  # no flow through the clot; the clot itself is echogenic
        elif in_flight:
            t3, t4 = self.thresholds(flight, side)
            sc = self.score(day, side)
            grade = 4 if sc >= t4 else 3 if sc >= t3 else (1 if v.grade1 else 2)
            echo = 2 if sc >= t3 + ECHO_MODERATE_ABOVE else 1 if sc >= t3 - ECHO_MILD_BELOW else 0
            if side == "right":
                echo = min(echo, 1)                             # never more than mild in the right (Pavela 2022)
        else:                       # supine on Earth: pulsatile or continuous, clear
            grade, echo = (1 if v.grade1 else 2), 0
        speed = v.velocity * (FLIGHT_VELOCITY[side] if in_flight else 1.0) * (0.0 if clot else GRADE_VELOCITY[grade])
        return {"ijv_csa": csa, "ijv_flow_grade": float(grade), "ijv_echogenicity": float(echo),
                "ijv_compressible": 0.0 if clot else 1.0, "ijv_peak_velocity": speed}

    def baseline(self, measure: str, side: str) -> float:
        v = self.veins[side]
        return {"ijv_csa": v.csa, "ijv_peak_velocity": v.velocity, "ijv_flow_grade": 1.0 if v.grade1 else 2.0,
                "ijv_echogenicity": 0.0, "ijv_compressible": 1.0}[measure]


def set_stasis(crew: CrewMember, z: float) -> None:
    """Give this person a chosen jugular stasis susceptibility, in SD (0 = the group median; 1.5 = about 1 in 15
    people: the left vein stagnant or retrograde at most in-flight exams)."""
    crew.ijv_stasis_z = float(z)
    crew._ijv = None


def add_thrombus(crew: CrewMember, day: float, side: str = "left") -> None:
    """A jugular vein thrombus from mission `day` in one vein (left by default, where it has been seen in flight):
    from then on that vein does not collapse when pressed and carries no flow, until it lies flat after landing."""
    if side not in SIDES:
        raise ValueError(f"side must be one of {SIDES}, not {side!r}")
    if not 0 <= day <= crew.mission.landing:
        raise ValueError(f"a jugular thrombus here forms in flight (days 0 to {crew.mission.landing:g}), not on {day:g}")
    crew.ijv_thrombus = (float(day), side)
    crew._ijv = None


def profile(crew: CrewMember) -> JugularProfile:
    p = getattr(crew, "_ijv", None)
    if p is None:
        p = crew._ijv = JugularProfile(crew)
    return p


class JugularUltrasound(Instrument):
    """The [6041] jugular vein ultrasound: duplex ultrasound of both internal jugular veins with compression and
    breathing manoeuvres (GE Vivid, 12-5 MHz linear probe, guided from the ground). One reading per measure and vein
    (side "right" / "left"). Faults are not simulated."""
    name = "vascular"
    device = "ISS ultrasound: GE Vivid, linear probe, duplex Doppler of the internal jugular veins"
    measures = VASCULAR_MEASURES

    def measure(self, crew: CrewMember, day: float, measure: str | None = None, side: str = "left") -> Reading:
        measure = measure or self.measures[0]
        if measure not in self.measures:
            raise KeyError(f"{self.name} measures {self.measures}, not {measure!r}")
        if side not in SIDES:
            raise ValueError(f"side must be one of {SIDES}, not {side!r}")
        p = profile(crew)
        true = p.state(crew, day, side)[measure]
        sd, step = NOISE[measure]
        c = MODEL["device_noise_clip_sd"]
        if measure == "ijv_csa":     # area noise is relative: about 8 % (the study accepted 10 % between sonographers)
            value = true * (1 + float(np.clip(self.rng.normal(), -c, c)) * sd * self.noise)
        else:
            value = true + float(np.clip(self.rng.normal(), -c, c)) * sd * self.noise
        lo, hi = LIMITS[measure]
        value = min(max(round(value / step) * step, lo), hi)
        m = MEASURES[measure]
        value = round(value, m["decimals"])
        ms = crew.mission
        phase = ms.phase(day)
        return Reading(
            crew_id=crew.id, mission_day=round(float(day), 3), day_label=ms.label(day), timestamp=ms.timestamp(day),
            phase=phase.name, gravity_g=phase.gravity_g, instrument=self.name, device=self.device,
            measure=measure, value=value, unit=m["unit"], side=side, quality="ok", synthetic=True,
            extrapolated=True, model_version=MODEL_VERSION, status=crew.status(day),
            truth={"value": round(true, m["decimals"] + 2), "change": round(true - p.baseline(measure, side), 3),
                   "thrombus": p.clot(crew, day, side), "faults": []},
        )

    def measure_all(self, crew: CrewMember, day: float) -> list[Reading]:
        """Both veins, every measure."""
        return [self.measure(crew, day, m, side) for side in SIDES for m in self.measures]
