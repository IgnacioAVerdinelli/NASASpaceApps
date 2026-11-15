"""The eye exam of OCHMO-STD-100.1A [6012] (SANS, spaceflight-associated neuro-ocular syndrome): OCT, fundus,
near vision and refraction, tonometry and ocular ultrasound, simulated from published group results.

There is no open per-person data (docs/investigacion-ojos.md, section 5). Each crew member gets a SANS profile
drawn so that the crew as a whole reproduces what NASA published (docs/investigacion-ojos.md, sections 3 and 6):

- optic disc edema: peripapillary total retinal thickness (TRT) +30 +/- 24 um on flight day 150, so about 2 in 3
  people pass the +20 um "earliest indication" and about 15 % the +55 um "clinically concerning" line (consensus
  2026: 66-69 % and ~15 % Frisen >= 1); the optic nerve rim (MRW) follows it, +36 um on average (Macias 2020);
- choroid +43 +/- 15 um on flight day 150 (Macias 2020); folds in the top quarter (25 %, consensus 2026);
- posterior globe flattening in 37 %; a hyperopic shift over +0.50 D in about 20 % (consensus 2026);
- the eye 0.08 mm shorter at landing and still 0.05 mm a year later (Macias 2020);
- optic nerve sheath diameter (ONSD) about 6.0 mm, about 0.9 mm wider in flight (ONSD review 2022);
- intraocular pressure about 14 mmHg, 1 mmHg higher in flight: assumed, there are no public flight values.
Changes grow from launch, near their top by flight day 150 and keep growing slowly on longer missions (Macias
2021); after landing the swelling resolves in weeks, the shorter eye and the refraction only partly.
Every spread, time constant and correlation not named above is ours.
"""
from __future__ import annotations

import math

import numpy as np

from .core import MODEL, MODEL_VERSION, CrewMember
from .instruments import Instrument
from .pipeline import LIMITS
from .reading import Reading
from .measures import MEASURES

OCULAR_STREAM = 3                  # the random stream of the SANS profile, next to routine.ROUTINE_STREAM and EVA_STREAM
RISE_TAU_DAYS = 60.0               # how fast the swelling builds after launch (assumed)
REF_FLIGHT_DAY = 150.0             # the published changes are on flight day 150 (Macias 2020)
EDEMA_TAU_DAYS = 60.0              # optic disc swelling after landing (assumed)
CHOROID_TAU_DAYS = 30.0            # choroid after landing (assumed)
ONSD_TAU_DAYS = 7.0                # nerve sheath after landing (assumed)
AXIAL_KEEP, AXIAL_TAU_DAYS = 0.625, 180.0   # the eye keeps 0.05 of its 0.08 mm a year later (Macias 2020)
FRISEN_STEPS = (55.0, 90.0, 130.0)  # TRT increase for Frisen grade 1, 2, 3 (the first from the consensus, the rest ours)

# measure: (measurement noise SD in the measure's unit, rounding step); all assumed
NOISE = {
    "oct_trt": (5.0, 1), "oct_mrw": (6.0, 1), "oct_choroid": (8.0, 1),
    "refraction_se": (0.15, 0.25), "near_va": (0.04, 0.02), "iop": (1.5, 1), "onsd": (0.2, 0.01),
    "axial_length": (0.02, 0.01), "frisen_grade": (0.0, 1), "choroidal_folds": (0.0, 1), "globe_flattening": (0.0, 1),
}
OCULAR_MEASURES = tuple(NOISE)


class SansProfile:
    """One person's eyes: baselines and how far each change goes by flight day 150 (see the module docstring)."""

    def __init__(self, crew: CrewMember):
        rng = np.random.default_rng([crew._day_key, OCULAR_STREAM])
        n = rng.standard_normal
        u = float(n())                                  # a shared SANS susceptibility
        if getattr(crew, "sans_z", None) is not None:   # set_sans(): a chosen susceptibility, for the demo
            u = float(crew.sans_z)
        z_choroid = 0.5 * u + math.sqrt(0.75) * float(n())
        z_flat = 0.6 * u + 0.8 * float(n())
        z_ref = 0.6 * z_flat + 0.8 * float(n())
        z_sheath = 0.6 * u + 0.8 * float(n())
        self.base = {
            "oct_trt": 430 + 30 * float(n()),               # um; 412-483 in the 1-year crew (Macias 2021)
            "oct_mrw": 400 + 50 * float(n()),               # um
            "oct_choroid": float(np.clip(170 + 40 * n(), 60, 350)),
            "refraction_se": float(np.clip(-0.5 + 1.5 * n(), -6, 3)),
            "near_va": float(np.clip(0.0 + 0.06 * n(), -0.2, 0.3)),
            "iop": float(np.clip(14 + 2.5 * n(), 9, 21)),
            "onsd": float(np.clip(5.98 + 0.35 * n(), 4.8, 7.2)),
            "axial_length": float(np.clip(24.0 + 0.9 * n(), 21.5, 27.0)),
        }
        self.trt = max(-3.0, 30 + 24 * u)
        self.mrw = 1.19 * self.trt + 6 * float(n())
        self.choroid = max(5.0, 43 + 15 * z_choroid)
        self.folds = z_choroid > 0.674                  # top quarter
        self.flattening = z_flat > 0.33                 # 37 %
        self.refraction = float(np.clip(0.2 + 0.36 * z_ref, -0.25, 1.75))
        self.axial = max(0.0, 0.08 + 0.03 * z_ref)
        self.sheath = float(np.clip(0.9 + 0.35 * z_sheath, 0.0, 2.0))
        self.iop = 1.0

    def changes(self, crew: CrewMember, day: float) -> dict:
        """True change from the pre-flight value of each measure on mission `day` (no noise), plus the signs."""
        ms = crew.mission
        land = ms.landing
        flight = ms.unloaded_days(min(day, land))
        rise = (1 - math.exp(-flight / RISE_TAU_DAYS)) / (1 - math.exp(-REF_FLIGHT_DAY / RISE_TAU_DAYS))
        after = max(0.0, day - land)

        def decay(tau):
            return math.exp(-after / tau) if after else 1.0

        keep = AXIAL_KEEP + (1 - AXIAL_KEEP) * math.exp(-after / AXIAL_TAU_DAYS) if after else 1.0
        trt = self.trt * rise * decay(EDEMA_TAU_DAYS)
        return {
            "oct_trt": trt, "oct_mrw": self.mrw * rise * decay(EDEMA_TAU_DAYS),
            "oct_choroid": self.choroid * rise * decay(CHOROID_TAU_DAYS),
            "refraction_se": self.refraction * rise * keep, "axial_length": -self.axial * rise * keep,
            "onsd": self.sheath * min(1.0, flight / 10) * decay(ONSD_TAU_DAYS),
            "iop": self.iop if 0 < day <= land else 0.0,
            "near_va": 0.2 * self.refraction * rise * keep,     # about one chart line per +0.5 D, uncorrected
            "frisen_grade": float(sum(trt >= s for s in FRISEN_STEPS)),
            "choroidal_folds": float(self.folds and rise >= 0.5),
            "globe_flattening": float(self.flattening and rise >= 0.6),
        }

    def true_value(self, crew: CrewMember, measure: str, day: float) -> float:
        ch = self.changes(crew, day)[measure]
        if measure in ("frisen_grade", "choroidal_folds", "globe_flattening"):
            return ch
        return self.base[measure] + ch


def set_sans(crew: CrewMember, z: float) -> None:
    """Give this person a chosen SANS susceptibility, in SD (0 = the group median, 1.5 = about 1 in 15 people:
    retinal thickness about +66 um by flight day 150, past the clinically concerning line)."""
    crew.sans_z = float(z)
    crew._sans = None


def profile(crew: CrewMember) -> SansProfile:
    p = getattr(crew, "_sans", None)
    if p is None:
        p = crew._sans = SansProfile(crew)
    return p


class OcularExam(Instrument):
    """The [6012] eye exam: OCT (Heidelberg Spectralis), fundus, near vision and refraction, tonometry and ocular
    ultrasound (GE Vivid). One value per measure, the mean of both eyes. Faults are not simulated."""
    name = "ocular"
    device = "ISS eye exam: Spectralis OCT, fundus imaging, tonometer, Vivid ultrasound"
    measures = OCULAR_MEASURES

    def measure(self, crew: CrewMember, day: float, measure: str | None = None) -> Reading:
        measure = measure or self.measures[0]
        if measure not in self.measures:
            raise KeyError(f"{self.name} measures {self.measures}, not {measure!r}")
        p = profile(crew)
        true = p.true_value(crew, measure, day)
        sd, step = NOISE[measure]
        c = MODEL["device_noise_clip_sd"]
        value = true + float(np.clip(self.rng.normal(), -c, c)) * sd * self.noise
        lo, hi = LIMITS[measure]
        value = min(max(round(value / step) * step, lo), hi)
        m = MEASURES[measure]
        value = round(value, m["decimals"])
        ms = crew.mission
        phase = ms.phase(day)
        base = 0.0 if measure in ("frisen_grade", "choroidal_folds", "globe_flattening") else p.base[measure]
        return Reading(
            crew_id=crew.id, mission_day=round(float(day), 3), day_label=ms.label(day), timestamp=ms.timestamp(day),
            phase=phase.name, gravity_g=phase.gravity_g, instrument=self.name, device=self.device,
            measure=measure, value=value, unit=m["unit"], side=None, quality="ok", synthetic=True,
            extrapolated=True, model_version=MODEL_VERSION, status=crew.status(day),
            truth={"value": round(true, m["decimals"] + 2), "change": round(true - base, 3), "faults": []},
        )

    def measure_all(self, crew: CrewMember, day: float) -> list[Reading]:
        return [self.measure(crew, day, m) for m in self.measures]
