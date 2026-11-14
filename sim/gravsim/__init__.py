"""gravsim: synthetic instrument readings for astronauts losing gravity, fitted to NASA bed-rest data.

    import gravsim as gs

    mission = gs.Mission("iss_180")
    ana = mission.add_crew("CM-1", sex="F", adherence=1.0, seed=1)          # follows the exercise routine
    ben = mission.add_crew("CM-2", adherence=[(0, 1.0), (60, 0.2), (120, 1.0)], seed=2)   # skips exercise for 2 months
    ben.add_event(day=95, measures="legs", severity_pct=12, recovery_days=20, label="ankle sprain")

    dyn = gs.Dynamometer(seed=3)
    dyn.measure(ana, day=90, measure="knee_extension_60")      # one Reading
    dyn.session(ben, day=90)                                   # every test with its repetitions

    readings = mission.timeline()                              # NASA schedule, every crew member
    df = gs.to_dataframe(readings)                             # needs pandas
"""
from .core import GROUPS, MEASURES, MODEL_VERSION, PARAMS, PRESETS, CrewMember, Event, Mission, Phase, expand
from .dashboard import build_dashboard, validate
from .instruments import CycleErgometer, DxaScanner, Dynamometer, Fault, Instrument, Reading, Wearable
from .schedule import default_instruments, nasa_days, timeline, to_dataframe, to_records

__version__ = MODEL_VERSION
__all__ = [
    "Mission", "Phase", "CrewMember", "Event", "Fault", "Reading", "Instrument",
    "Dynamometer", "DxaScanner", "CycleErgometer", "Wearable",
    "timeline", "nasa_days", "default_instruments", "to_dataframe", "to_records",
    "build_dashboard", "validate", "MEASURES", "GROUPS", "PRESETS", "PARAMS", "MODEL_VERSION", "expand",
]
