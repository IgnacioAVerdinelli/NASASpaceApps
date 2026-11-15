# Data service: status

Snapshot: Sunday 15 Nov 2026, 00:45 (Argentina, UTC-3). Owner: Juan. The data service is the left part of [architecture.md](architecture.md): sources → DataService ↔ database, with the generator (`gravsim`) standing in for every source. It is all on `main` in `sim/`, and nothing of it is pending review.

## What is on `main`

| Change | Where | State |
|---|---|---|
| Generator, DataService, HTTP API, crew context, events, fit, data checks | PR [#7](https://github.com/IgnacioAVerdinelli/NASASpaceApps/pull/7) (`37aa6c3`) | Merged |
| SQLite storage (`--db`) and the SQLite message queue (`--queue`, `sim/gravsim/queue.py`) for the local demo | Enzo's integration commit `e6fe3dd` | Merged |
| The generator runs the retests the scheduler books (`--run-booked`, off by default) | PR [#15](https://github.com/IgnacioAVerdinelli/NASASpaceApps/pull/15) (`6507667`) | Merged |

Tests: `cd sim && pytest` gives 118 passed and 1 expected failure.

## What it does

- **Generator.** Readings for any crew member and mission day from four simulated instruments: a dynamometer (strength), a DXA scanner (bone density, lean mass), a cycle ergometer (VO2peak) and a wearable (resting heart rate, blood pressure, SpO2, HRV). The suit adds `heart_rate` every 5 minutes during a spacewalk. Curves are fitted to the NASA bed-rest data in `data/nlsp/`. Controls: exercise adherence, fast responders, injuries, instrument faults (offset, drift, dropout, spike, stuck), a noise scale, and the ISS 180-day, Artemis 30-day and Mars presets. The test days follow OCHMO-STD-100.1A Table 8 (`gravsim.schedule.nasa_days`).
- **DataService.** Every reading goes through one cleaning step: UTC timestamps, missing values marked, duplicates dropped, values outside physical limits flagged, one unit per measure (strength in N·m). It stores readings, crew context and results, answers queries over Python and HTTP, and announces what it stored on the event queue. Details in [sim/README.md](../sim/README.md).

## For other services

Run it with `python -m gravsim.serve --db PATH --queue PATH` (port 8000); the root [README](../README.md) has the full demo.

| Endpoint | Returns |
|---|---|
| `GET /api/v1/mission` | Name, launch date, phases with their gravity, the clock (`now`, `now_day`) and the crew with their sex |
| `GET /api/v1/readings`, `GET /api/v1/latest` | Readings up to now. `truth` and `status` (the simulator's hidden state) only with `?truth=1`, for scoring a detector |
| `GET /api/v1/context`, `GET /api/v1/context/current` | Crew context. `/context` covers the last 24 hours unless you pass `start` and `end` |
| `GET /api/v1/results`, `POST /api/v1/results` | Processed results. One result per crew member, kind, time and model version: saving again replaces it |

Events on channel `events`: `data.readings_stored`, `data.context_updated`, `data.result_saved` (shapes in `sim/gravsim/events.py`). Every reading carries `synthetic: true`, and `extrapolated: true` past what the bed-rest data covers. Sensors can send data only from Python (`ingest()`, `ingest_context()`); there is no HTTP endpoint for that.

## Checked against the Planner design (15 Nov)

Against [planner.md](planner.md), on a running DataService (ISS 180 preset, day 95):

- **Saving the plan.** A 450-item plan saved twice as kind `plan` for one crew member left one record (184 KB), and the second save replaced the first. Each save took about 30 ms.
- **Spacewalks.** The whole mission's context for one crew member is 2983 records (0.5 MB) and comes back in 0.05 s. The preset has one spacewalk, on day 108, for CM-1 and CM-2. Its record has activity `eva` and source `suit`, so filter by activity.
- **Routine tests close by themselves.** The generator's DXA, dynamometer and cycle days fall inside the Planner's windows for routines 6013, 6024, 6025 and 6028. It also runs a DXA scan on day 360 (R+180) that has no plan item, which does no harm.

## Pending

1. `run_booked_studies` reads `retest` items of kind `plan` instead of kind `study`, on the first day of each window. [planner.md](planner.md) section 8 puts this change in the Planner PR.
2. Turn `--run-booked` on in the demo once the Planner is merged. Its 14-day cooldown stops the retest loop found on 15 Nov: with today's scheduler, each retest raises the alert again and books another one (CM-2 got 5 VO2peak retests in 13 days).
