# Data service: status and planned changes

Snapshot: Saturday 14 Nov 2026, 19:20 (Argentina). Updated after the work in section 2 was pushed. Owner: Juan (the data service). Read this before working from what is on GitHub: several changes are in progress or local and not pushed yet.

The agreed architecture is in [architecture.md](architecture.md). The data service is the left part of it: sources → DataService ↔ database, with the generator (`gravsim`) standing in for every source during the challenge. The HealthService, the two queues, the analysis scheduler, the notification system and the frontend belong to other teammates.

## Where things are

| Place | What is there | State |
|---|---|---|
| `main` | `docs/architecture.md` (diagram and parts), `docs/img/architecture-sketch.png`, `docs/references/OCHMO-STD-100.1A_RevA_2024-09-09.pdf` (Table 8 on pages 33-37) | Pushed |
| `feat/sensor-simulator` on GitHub (`0560b75`) | `sim/`: the generator, the DataService with its HTTP API, crew context, the event hook, tests, README, demo notebook; the HealthService mock in `sim/mocks/`. Based on `Feat/gravityEffectsInvestigation` (Tomás's data in `data/nlsp/`) | Pushed, **current** |
| Pull request to `main` | Only the data service and what it depends on | **Planned**: final checks running now |

## 1. Done and pushed (on `feat/sensor-simulator`)

- **Generator (`sim/gravsim/`).** Readings for any crew member and mission day, from four simulated instruments: a dynamometer (strength), a DXA scanner (bone density, lean mass), a cycle ergometer (VO2peak) and a wearable (resting heart rate, blood pressure, SpO2, HRV). Its curves are fitted to the NASA bed-rest data in `data/nlsp/`. It has these controls:
  - exercise adherence over time;
  - fast responders;
  - injuries on a chosen day;
  - instrument faults: offset, drift, dropout, spike, stuck;
  - a noise scale;
  - mission presets: ISS 180 days, Artemis 30 days, Mars.
- **DataService (`sim/gravsim/dataservice.py`).** Every reading passes through the same cleaning step (`pipeline.py`):
  - timestamps are converted to UTC;
  - missing values are marked;
  - duplicates are dropped;
  - values outside physical limits are flagged;
  - each measure is converted to one unit (`units.py`, e.g. beats per second → bpm).

  It stores readings and processed results and answers timeline queries. The SQLite store (`store.py`) has its schema defined but does nothing yet; for the challenge, all data comes from the generator.
- **Data quality, checked by an independent review against the NASA data and standards.**
  - No baseline, reading or change falls outside what NASA measured, within the 90 days the data covers.
  - No impossible values.
  - Exercise never looks worse than no exercise.
  - The schedule follows OCHMO-STD-100.1A Table 8.
  - Two known data gaps are documented, not hidden: calf strength under exercise, and single blood-pressure readings.
  - The README lists the decisions that are open to veto.

## 2. Pushed in `0560b75` (was in progress)

- **The dashboard mock moves out of the data service.**
  - The dashboard builder that fed the 3D page during the demo moves from `sim/gravsim/health.py` to `sim/mocks/healthservice/`. It is a mock of the HealthService, which another teammate owns.
  - The dependency only goes from the mock to the DataService, never the other way.
  - The mock keeps serving `/api/v1/dashboard` so the 3D page demo still works. Nothing is deleted.
- **`gravsim.serve` becomes the DataService's own HTTP API** (standard library, JSON):
  - `GET /api/v1/readings`: every reading so far for a crew member (`crew`, `measures`, `day` filters).
  - `GET /api/v1/latest`: the newest usable reading of each measure.
  - `GET /api/v1/context`: context records between `start` and `end` (default: the last 24 h).
  - `GET /api/v1/context/current`: what a crew member is doing and where, at `at` (default: now), or null.
  - `GET /api/v1/results` and `POST /api/v1/results`: processed results. POST takes JSON with `crew_id`, `kind`, `timestamp` and `payload`.
- **Crew context, the data behind context-aware alerts.**
  - A `ContextRecord`: `crew_id`, `start`, `end` (UTC), `activity`, `location`, `source`, `synthetic`.
    - Activities: sleep, exercise, work, meal, hygiene, eva.
    - Location: an ISS module, or "outside" during a spacewalk.
    - Source: room sensors, crew timeline or spacesuit.
  - The generator simulates a daily routine for each person (sleep 22:30-06:00, meals, hygiene, work in a module, two exercise blocks that follow exercise adherence, a few unplanned toilet visits from the room sensor), plus spacewalk days you can set (`crew.add_eva(day, start_hour, hours)`, with an hour in the Quest airlock before and after). During a spacewalk the suit reports a new measure, `heart_rate`, every 5 minutes.
  - When sources overlap, `current_context` prefers what was observed: suit, then room sensor, then the crew timeline.
  - The DataService stores context and answers "where is this astronaut and what are they doing".
- **Event hook, for the event queue.**
  - `DataService(publisher=...)` takes any object with `publish(topic, message)`. The default is a mock that only logs.
  - Topics: `data.readings_stored` (crew_id, count, measures, start, end), `data.context_updated` (crew_id, count, activities, start, end), `data.result_saved` (crew_id, kind, timestamp, computed_at, model_version). One message per ingest call per crew member; nothing is published when nothing was stored. The DataService stores first, then publishes.
  - The exact schemas are in `sim/README.md` on the branch.
- **Demo notebook:** the dashboard section moves to a separate notebook next to the mock.

## 3. Planned

1. **Final checks** (running now, in parallel): data quality and NASA standards on the final code; crew context, events and the HTTP API; and a merge-readiness check that installs and tests only the files that will land.
3. **Pull request to `main`** containing only the data service and its dependencies.
   - Lands: `sim/gravsim/`, `sim/fit/`, the data-service tests, `sim/pyproject.toml`, the README and `data/nlsp/`.
   - Stays on the branch: the dashboard mock, Tomás's research doc and `prototype/`, and the duplicate zips in `data/healthData/`.
   - The team reviews and merges it.

## For other services

- **Run the DataService API:** `cd sim && python -m gravsim.serve` (port 8000). The HealthService mock that feeds the 3D page: `python -m mocks.healthservice.serve` (port 3000).
- **Read data** through the DataService API above, not from the generator directly.
- **Sensors** can only send data from Python for now (`ingest()`, `ingest_context()`); there is no HTTP endpoint for sending readings yet.
- **Every reading:**
  - has one unit per measure;
  - carries `synthetic: true` (generated data);
  - carries `extrapolated: true` past what the bed-rest data covers (more than 90 days without gravity, or partial gravity).
- **`truth`** on a reading holds the noise-free value and the active faults. A real monitoring system would not see it; use it only to score your own detection.
- **The analysis scheduler** can store and read its studies through `save_result` / `results` (or the HTTP endpoints), with `kind` set to its own name, e.g. `study`.
