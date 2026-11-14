"""gravsim: synthetic instrument readings for astronauts losing gravity, fitted to NASA bed-rest data,
plus the DataService and HealthService that carry them to the 3D page. See README.md.

    import gravsim as gs

    mission = gs.Mission("iss_180")
    ana = mission.add_crew("CM-1", sex="F", adherence=1.0, seed=1)

    data = gs.DataService()
    data.ingest(mission.timeline(seed=7))              # gravsim stands in for the sensors
    data.latest("CM-1", "bone", at=mission.timestamp(200))
    gs.HealthService(data).dashboard(ana, day=120)     # JSON for the 3D page
"""
from .core import GROUPS, MEASURES, MODEL_VERSION, PARAMS, PRESETS, CrewMember, Event, Mission, Phase, expand
from .dataservice import DataService
from .health import HealthService, validate_dashboard
from .instruments import CycleErgometer, DxaScanner, Dynamometer, Fault, Instrument, Wearable
from .pipeline import LIMITS, clean
from .reading import Reading, to_dataframe
from .schedule import default_instruments, nasa_days, timeline
from .store import SqliteStore
from .units import UNITS, convert

__version__ = MODEL_VERSION
__all__ = [
    # generator
    "Mission", "Phase", "CrewMember", "Event", "PRESETS", "MEASURES", "GROUPS", "PARAMS", "MODEL_VERSION", "expand",
    "Instrument", "Dynamometer", "DxaScanner", "CycleErgometer", "Wearable", "Fault",
    "timeline", "nasa_days", "default_instruments",
    # the record every part passes around
    "Reading", "to_dataframe",
    # DataService and HealthService
    "DataService", "SqliteStore", "clean", "LIMITS", "UNITS", "convert",
    "HealthService", "validate_dashboard",
]
