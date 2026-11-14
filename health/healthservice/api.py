"""HTTP API of the HealthService.

GET /api/v1/dashboard    dashboard JSON for the 3D page (contract version 1). ?crew=CM-2 picks a crew member,
                         ?day=150 looks at a given mission day without saving anything.
GET /api/v1/alerts       alerts published so far (until the notification system defines its queue)
GET /api/v1/health       service status

If the DataService does not answer, /dashboard and /health answer 503 with the reason, and the page keeps
retrying.
"""
from __future__ import annotations

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .service import HealthService
from .sources import DataServiceError


def create_app(service: HealthService, allow_origin: str = "*", delivery_queue=None) -> FastAPI:
    app = FastAPI(title="HealthService", version="0.2.0")
    app.add_middleware(CORSMiddleware, allow_origins=[allow_origin], allow_methods=["GET"], allow_headers=["*"])

    def unknown_crew(crew_id: str) -> JSONResponse:
        return JSONResponse(status_code=404, content={
            "error": f"no crew member {crew_id}", "crew": [c.id for c in service.source.crew()]})

    @app.exception_handler(DataServiceError)
    def no_data(_request, exc: DataServiceError) -> JSONResponse:
        return JSONResponse(status_code=503, content={"error": f"DataService unavailable: {exc}"},
                            headers={"Cache-Control": "no-store"})

    @app.get("/api/v1/dashboard")
    def dashboard(response: Response, crew: str | None = None, day: float | None = None):
        try:
            data = service.dashboard(crew, day)
        except KeyError:
            return unknown_crew(crew)
        response.headers["Cache-Control"] = "no-store"
        return data

    @app.get("/api/v1/alerts")
    def alerts(crew: str | None = None):
        return [a.to_dict() for a in service.queue.items() if crew is None or a.crew_id == crew]

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok", "crew": [c.id for c in service.source.crew()],
                "mission_day": round(service.source.current_day(), 2),
                "reference_curves": service.reference.model_version}

    @app.get("/api/v1/deliveries")
    def deliveries():
        return [] if delivery_queue is None else delivery_queue.deliveries()

    return app
