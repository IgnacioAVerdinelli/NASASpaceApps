"""How big a change is, for the flight-measurement page (strength and aerobic capacity).

One scale for every measure on that page, so the page, the HealthService and the alerts use the same numbers
(the scale comes from docs/handoff/frontend.md, by Tomás):

- level 1: less than 5% worse than pre-flight;
- level 2: 5 to 10% worse;
- level 3: 10 to 20% worse;
- level 4: 20% worse or more. For VO2peak a fall of 20% or more is a loss of performance and 32.9 ml/kg/min is
  the in-mission minimum (OCHMO-TB-031, NASA-STD-3001 Vol 1 [V1 4001], docs/investigacion-gravedad.md 5.2), so a
  VO2peak below that minimum is level 4 too, whatever its change.

The level only says how big the measured change is. Whether it is more than the test's noise is a separate
question (`within_noise`): one dynamometer test against the pre-flight reference has a noise of about 10 points
(alerts.noise), so a -8% strength reading may be no loss at all. Alerts (alerts.check) take both into account.
"""
from __future__ import annotations

from .alerts import CONFIDENCE, STANDARD_LOSS_PCT, noise
from .reference import Reference

LEVELS = [
    {"level": 1, "label": "No clear change", "range": "less than 5% worse than pre-flight"},
    {"level": 2, "label": "Mild loss", "range": "5 to 10% worse"},
    {"level": 3, "label": "Moderate loss", "range": "10 to 20% worse"},
    {"level": 4, "label": "Large loss", "range": "20% worse or more, or below a NASA minimum"},
]
BOUNDS = (5.0, 10.0, STANDARD_LOSS_PCT)     # points worse than pre-flight where levels 2, 3 and 4 start


def level_of(reference: Reference, measure: str, change_pct: float | None, value: float | None = None) -> int | None:
    """Level 1-4 of a change (None without a change). `value` is checked against the measure's NASA minimum."""
    if change_pct is None:
        return None
    floor = reference.minimum(measure)
    if floor is not None and value is not None and value < floor:
        return 4
    worse = reference.worse_by(measure, change_pct)
    return 1 + sum(worse >= b for b in BOUNDS)


def noise_band(reference: Reference, measure: str, n_ref: int) -> float:
    """Half-width, in points, of the band one test's change stays inside by noise alone 90% of the time."""
    return round(CONFIDENCE * noise(reference, measure, max(n_ref, 1)), 1)


def within_noise(reference: Reference, measure: str, change_pct: float | None, n_ref: int) -> bool | None:
    """Whether one test's change is inside that band: no more than the test's noise can explain."""
    if change_pct is None:
        return None
    return abs(change_pct) < noise_band(reference, measure, n_ref)
