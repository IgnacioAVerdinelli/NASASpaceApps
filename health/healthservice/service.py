"""The HealthService: reads from the DataService, processes, serves the front, saves results, raises alerts."""
from __future__ import annotations

import threading

from .alerts import AlertQueue, check
from .analyses import build_analyses
from .dashboard import build_dashboard
from .models import CrewInfo, Reading
from .processing import MeasureResult, compute_results
from .reference import Reference
from .sources import DataSource
from . import eyes as eyes_mod
from . import vitals as vitals_mod


class HealthService:
    def __init__(self, source: DataSource, reference: Reference | None = None, queue: AlertQueue | None = None,
                 process_on_read: bool = True):
        self.source = source
        self.reference = reference or Reference.load()
        self.queue = queue or AlertQueue()
        self.process_on_read = process_on_read
        self._seen: dict[str, tuple] = {}            # crew id -> identity of the last readings processed
        self._active: dict[str, dict[str, str]] = {}  # crew id -> measure currently alerting -> its severity
        self._lock = threading.Lock()

    def crew(self, crew_id: str | None = None) -> CrewInfo:
        crew = self.source.crew()
        if crew_id is None:
            return crew[0]
        for c in crew:
            if c.id == crew_id:
                return c
        raise KeyError(crew_id)

    def dashboard(self, crew_id: str | None = None, day: float | None = None) -> dict:
        """Dashboard JSON for one crew member.

        Without `day` it shows the current mission day; results are then saved and alerts raised, but only when
        new readings have arrived, so the front polling every 3 seconds does not fill the database with copies.
        With `day` it is a look at that day only: nothing is saved and no alert is raised.
        """
        crew, mission, readings, results, day = self._process(crew_id, day)
        return build_dashboard(self.reference, mission, crew, readings, results, day)

    def analyses(self, crew_id: str | None = None, day: float | None = None) -> dict:
        """Flight-measurement JSON for one crew member (strength and aerobic capacity, test by test), with the
        alerts that hold right now. `day` works as in dashboard()."""
        crew, mission, readings, results, day = self._process(crew_id, day)
        alerts = check(self.reference, mission, results)
        return build_analyses(self.reference, mission, crew, readings, results, alerts,
                              self.source.studies(crew.id), day)

    def vitals(self, crew_id: str | None = None, day: float | None = None) -> dict:
        """Layer 1, the watch (GET /api/v1/vitals, docs/wearable.md): each vital against the person's own last
        two weeks, and the day of heart rate against yesterday, a week ago and the pre-flight day. Read-only."""
        day = self.source.current_day() if day is None else float(day)
        crew = self.crew(crew_id)
        mission = self.source.mission()
        return vitals_mod.build_vitals(mission, crew.id, day, *vitals_inputs(self.source, mission, crew.id, day))

    def eyes(self, crew_id: str | None = None, day: float | None = None) -> dict:
        """The eye exam (GET /api/v1/eyes, docs/investigacion-ojos.md): each exam against the pre-flight one and
        the SANS class of the latest. Read-only."""
        day = self.source.current_day() if day is None else float(day)
        crew = self.crew(crew_id)
        mission = self.source.mission()
        return eyes_mod.build_eyes(mission, crew.id, day, self.source.records(crew.id, eyes_mod.MEASURES, until_day=day))

    def _process(self, crew_id: str | None, day: float | None):
        live = day is None
        day = self.source.current_day() if live else float(day)
        crew = self.crew(crew_id)
        mission = self.source.mission()
        readings = self.source.readings(crew.id, day)
        results = compute_results(self.reference, mission, crew, readings, day)
        if live and self.process_on_read:
            self._on_readings(crew, readings, results)
        return crew, mission, readings, results, day

    def _on_readings(self, crew: CrewInfo, readings: list[Reading], results: list[MeasureResult]) -> None:
        last = max(readings, key=lambda r: r.mission_day, default=None)
        key = (len(readings), last.mission_day if last else None)
        with self._lock:
            if self._seen.get(crew.id) == key:
                return
            self.source.save_results(results)
            now = check(self.reference, self.source.mission(), results)
            active = self._active.setdefault(crew.id, {})
            for measure, alert in now.items():
                if active.get(measure) != alert.severity:      # new, or it moved between warning and critical
                    self.queue.publish(alert)
            self._active[crew.id] = {m: a.severity for m, a in now.items()}
            self._seen[crew.id] = key


def vitals_inputs(source, mission, crew_id: str, day: float, curves: bool = True):
    """What vitals.build_vitals needs, read from the DataService: the daily vitals up to `day`; with `curves`, the
    watch's heart rate of the last 8 UTC dates, of the 14 days before launch, and today's crew context."""
    rows = source.records(crew_id, vitals_mod.MEASURES, until_day=day)
    daily = {m: [r for r in rows if r["measure"] == m] for m in vitals_mod.MEASURES}
    if not curves:
        return daily, None, None, None
    today = mission.timestamp(day)[:10]
    midnight = mission.day_of(f"{today}T00:00:00Z")
    watch = source.records(crew_id, [vitals_mod.WATCH_HR], start=mission.timestamp(midnight - 7), until_day=day)
    pre = source.records(crew_id, [vitals_mod.WATCH_HR], start=mission.timestamp(-14), until_day=min(0.0, day))
    context = source.context(crew_id, f"{today}T00:00:00Z", f"{today}T23:59:59Z")   # the day's plan, so the page can shade it all
    return daily, watch, pre, context
