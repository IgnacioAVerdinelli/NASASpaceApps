"""Reference curves fitted from the NASA bed-rest data.

They are the `measures` of gravsim's params.json. Whether they will live in the DataService or here is
still open (docs/health-service.md, question 4); until then they are read from a JSON file:
HEALTH_REFERENCE_PATH, or by default sim/gravsim/params.json in this repository.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "sim" / "gravsim" / "params.json"


class Reference:
    def __init__(self, params: dict):
        self.measures: dict = params["measures"]
        self.model_version: str = params["model_version"]
        self.standards: dict = params.get("astronaut_standards", {})

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Reference":
        path = Path(path or os.environ.get("HEALTH_REFERENCE_PATH") or DEFAULT_PATH)
        return cls(json.loads(path.read_text(encoding="utf-8")))

    def measure(self, measure: str) -> dict:
        return self.measures[measure]

    def typical_change(self, measure: str, unloaded_days: float, adherence: float) -> float | None:
        """Group-typical % change after this many unloaded days (adherence 0 = no exercise, 1 = full routine)."""
        m = self.measures[measure]
        k = 1 - (m.get("exercise_effect") or 0) * adherence
        if m["model"] == "saturating":
            return m["loss_pct"] * k * (1 - math.exp(-unloaded_days / m["tau_days"]))
        if m["model"] == "linear":
            return m["rate_pct_per_day"] * k * unloaded_days
        return None

    def worse_by(self, measure: str, change_pct: float) -> float:
        """How far a change goes in the harmful direction (0 if it goes the other way).

        The harmful direction is the sign of the fitted loss; measures without `loss_pct` count a fall as harmful,
        as gravsim's dashboard does.
        """
        loss = self.measures[measure].get("loss_pct") or -1
        return max(0.0, -change_pct if loss < 0 else change_pct)

    def minimum(self, measure: str) -> float | None:
        """NASA's in-mission minimum for a measure, if it has one (VO2peak: 32.9 ml/kg/min, NASA-STD-3001 Vol 1
        [V1 4001], the `astronaut_standards` of params.json)."""
        return self.standards.get(f"{measure}_min")

    def plateau(self, measure: str) -> float:
        """Size of the no-exercise loss used as 100 on the score scale (at least 10%)."""
        return max(abs(self.measures[measure].get("loss_pct") or 0.0), 10.0)
