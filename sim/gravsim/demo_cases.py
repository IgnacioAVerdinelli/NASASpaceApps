"""Fixed synthetic crew for the five-case local demonstration."""

from .core import Mission


def demo_mission():
    mission = Mission("iss_180", name="iss_180_demo_five")
    for i in range(1, 6):
        mission.add_crew(f"CM-{i}", seed=6 if i == 3 else i, adherence=1.0, responder=0)
    mission.crew[1].add_fatigue(130, 2)
    mission.crew[2].add_fatigue(126, 7)
    mission.crew[3].add_event(70, measures="legs", severity_pct=35, recovery_days=180,
                              label="simulated strength loss")
    mission.crew[4].add_event(50, measures=["vo2peak"], severity_pct=30, recovery_days=365,
                              label="simulated aerobic loss")
    return mission
