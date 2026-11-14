"""MOCK of the HealthService (another part of the team builds the real one), for the 3D page demo.

It reads from gravsim's DataService and builds the dashboard JSON the 3D page shows. Run it from sim/:

    python -m mocks.healthservice.serve --day 95 --speed 20 --port 3000

    from mocks.healthservice import HealthService, validate_dashboard
    dash = HealthService(data).dashboard(crew, day=120)      # data: a gravsim.DataService
"""
from .health import HealthService, validate_dashboard

__all__ = ["HealthService", "validate_dashboard"]
