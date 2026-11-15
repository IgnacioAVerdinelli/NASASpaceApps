"""gravsim: the DataService, which cleans, holds and serves the health monitor's data, and the generator
that stands in for the sensors: synthetic instrument readings for astronauts losing gravity, fitted to NASA
bed-rest data. See README.md.

    import gravsim as gs

    mission = gs.Mission("iss_180")
    ana = mission.add_crew("CM-1", sex="F", adherence=1.0, seed=1)

    data = gs.DataService()
    data.ingest(mission.timeline(seed=7))              # gravsim stands in for the sensors
    data.latest("CM-1", "bone", at=mission.timestamp(200))
    data.ingest_context(mission.context())             # where each crew member is and what they are doing
    data.current_context("CM-1", mission.timestamp(95.1))
    data.save_result("CM-1", "measure_change", mission.timestamp(120), {"knee_extension_60": -12.5})
"""
from .core import GROUPS, MEASURES, MODEL_VERSION, PARAMS, PRESETS, CrewMember, Eva, Event, Mission, Phase, expand
from .dataservice import DataService
from .events import TOPICS, MockPublisher
from .instruments import CycleErgometer, DxaScanner, Dynamometer, Fault, Instrument, Spacesuit, Watch, Wearable
from .ocular import OcularExam, set_sans
from .vascular import JugularUltrasound, add_thrombus, set_stasis
from .pipeline import LIMITS, STORED_UNITS, clean, clean_context
from .reading import ACTIVITIES, SOURCES, ContextRecord, Reading, Result, to_dataframe
from .routine import LOCATIONS, context_timeline, routine
from .schedule import default_instruments, nasa_days, timeline
from .store import SqliteStore
from .units import UNITS, convert

__version__ = MODEL_VERSION
__all__ = [
    # generator
    "Mission", "Phase", "CrewMember", "Event", "Eva", "PRESETS", "MEASURES", "GROUPS", "PARAMS", "MODEL_VERSION", "expand",
    "Instrument", "Dynamometer", "DxaScanner", "CycleErgometer", "Wearable", "Spacesuit", "Watch", "OcularExam", "set_sans", "JugularUltrasound", "set_stasis", "add_thrombus", "Fault",
    "timeline", "nasa_days", "default_instruments", "routine", "context_timeline", "LOCATIONS",
    # the records: raw readings, crew context and processed results
    "Reading", "ContextRecord", "Result", "ACTIVITIES", "SOURCES", "to_dataframe",
    # DataService
    "DataService", "SqliteStore", "clean", "clean_context", "LIMITS", "STORED_UNITS", "UNITS", "convert", "MockPublisher", "TOPICS",
]
