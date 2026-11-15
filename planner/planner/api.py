"""HTTP API of the Planner (port 3001). Contract: docs/planner.md, section 7.

GET  /api/v1/plan?crew=CM-2              the plan; filters from_day, to_day, status, type, routine; day= looks at
                                          another mission day without saving anything
GET  /api/v1/plan/today?crew=CM-2        open items and those due in the next 7 days
POST /api/v1/plan/{id}/status?crew=CM-2  {"status": "done"|"missed"|"cancelled", "by": "CM-2", "note": ""}
GET  /api/v1/routines                    the catalog (OCHMO-STD-100.1A Section 6), without the long texts
GET  /api/v1/routines/{id}               one routine with its steps and guide
GET  /api/v1/health                      status, crew and mission day
"""
from __future__ import annotations

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .service import Planner
from .sources import DataServiceError


class StatusChange(BaseModel):
    status: str
    by: str | None = None
    note: str | None = None


def create_app(planner: Planner, allow_origin: str = "*") -> FastAPI:
    app = FastAPI(title="Planner", version="0.1.0")
    app.add_middleware(CORSMiddleware, allow_origins=[allow_origin], allow_methods=["GET", "POST"],
                       allow_headers=["*"])

    def unknown_crew(crew_id) -> JSONResponse:
        return JSONResponse(status_code=404, content={"error": f"no crew member {crew_id}",
                                                      "crew": planner.source.crew()})

    @app.exception_handler(DataServiceError)
    def no_data(_request, exc: DataServiceError) -> JSONResponse:
        return JSONResponse(status_code=503, content={"error": f"DataService unavailable: {exc}"},
                            headers={"Cache-Control": "no-store"})

    @app.get("/api/v1/plan")
    def get_plan(response: Response, crew: str | None = None, day: float | None = None,
                 from_day: float | None = None, to_day: float | None = None, status: str | None = None,
                 type: str | None = None, routine: str | None = None):
        try:
            data = planner.plan(crew, day, from_day=from_day, to_day=to_day, status=status, item_type=type,
                                routine=routine)
        except KeyError:
            return unknown_crew(crew)
        response.headers["Cache-Control"] = "no-store"
        return data

    @app.get("/api/v1/plan/today")
    def get_today(response: Response, crew: str | None = None, day: float | None = None):
        try:
            data = planner.today(crew, day)
        except KeyError:
            return unknown_crew(crew)
        response.headers["Cache-Control"] = "no-store"
        return data

    @app.post("/api/v1/plan/{item_id}/status")
    def post_status(item_id: str, change: StatusChange, crew: str | None = None):
        try:
            return planner.set_status(crew, item_id, change.status, change.by, change.note)
        except KeyError as e:
            if crew is not None and crew not in planner.source.crew():
                return unknown_crew(crew)
            return JSONResponse(status_code=404, content={"error": f"no plan item {e.args[0]}"})
        except ValueError as e:
            code = 409 if "already done" in str(e) else 422
            return JSONResponse(status_code=code, content={"error": str(e)})

    @app.get("/api/v1/routines")
    def routines():
        return {"source": planner.catalog.source,
                "routines": [planner.catalog.summary(r) for r in planner.catalog.routines.values()]}

    @app.get("/api/v1/routines/{routine_id}")
    def routine(routine_id: str):
        r = planner.catalog.routines.get(routine_id)
        if r is None:
            return JSONResponse(status_code=404, content={"error": f"no routine {routine_id}",
                                                          "routines": list(planner.catalog.routines)})
        return r

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok", "crew": planner.source.crew(), "mission_day": planner.source.current_day(),
                "catalog": planner.catalog.source["document"], "simulate_crew": planner.simulate_crew}

    return app
