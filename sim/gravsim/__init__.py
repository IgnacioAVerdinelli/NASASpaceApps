"""gravsim: the DataService, which cleans, holds and serves the health monitor's data, and the generator
that stands in for the sensors: synthetic instrument readings for astronauts losing gravity, fitted to NASA
bed-rest data. See README.md.

    import gravsim as gs

    mission = gs.Mission("iss_180")
    ana = mission.add_crew("CM-1", sex="F", adherence=1.0, seed=1)

    data = gs.DataService()
    data.ingest(mission.timeline(seed=7))              # gravsim stands in for the sensors
    data.latest("CM-1", "bone", at=mission.timestamp(200))
    data.save_result("CM-1", "measure_change", mission.timestamp(120), {"knee_extension_60": -12.5})
"""
from .core import GROUPS, MEASURES, MODEL_VERSION, PARAMS, PRESETS, CrewMember, Event, Mission, Phase, expand
from .dataservice import DataService
from .instruments import CycleErgometer, DxaScanner, Dynamometer, Fault, Instrument, Wearable
from .pipeline import LIMITS, clean
from .reading import Reading, Result, to_dataframe
from .schedule import default_instruments, nasa_days, timeline
from .store import SqliteStore
from .units import UNITS, convert

__version__ = MODEL_VERSION
__all__ = [
    # generator
    "Mission", "Phase", "CrewMember", "Event", "PRESETS", "MEASURES", "GROUPS", "PARAMS", "MODEL_VERSION", "expand",
    "Instrument", "Dynamometer", "DxaScanner", "CycleErgometer", "Wearable", "Fault",
    "timeline", "nasa_days", "default_instruments",
    # the records: raw readings and processed results
    "Reading", "Result", "to_dataframe",
    # DataService
    "DataService", "SqliteStore", "clean", "LIMITS", "UNITS", "convert",
]
