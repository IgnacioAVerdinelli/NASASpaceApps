# System architecture

How the pieces of our astronaut health monitor fit together. First drawn from Juan's sketch of 14 November 2026 ([original drawing](img/architecture-sketch.png)); the split between the HealthService and the Planner below was agreed the same night. To run the local demo, see the [README](../README.md).

![Architecture: sources feed the DataService; the HealthService draws every conclusion; the Planner books what happens next and serves the plan to the frontend; the Notification Center delivers; the crew runs what was booked, which closes the loop](img/architecture.svg)

Blue boxes are built, dashed orange boxes are demo stand-ins, grey boxes are outside our software. **Green is agreed and not built yet.** Solid arrows are HTTP calls; arrows through a lane are messages on that queue.

## Who draws the conclusions

The **HealthService is the brain**. It is the only service that reads measurements and decides what they mean: the status of each measure, findings, alerts, and who gets told. The **Planner** (until now "analysis scheduler") takes those conclusions as input and decides what happens next and when: NASA's routine studies (OCHMO-STD-100.1A Table 8), retests and exercise sessions. It never reads raw values and never works out its own status. It also serves the plan to the frontend, so the page can show it.

| Service | Answers | Reads | Produces | Never |
|---|---|---|---|---|
| DataService | What was measured, and what is happening now? | Readings and context from the sources | Stored facts, `data.*` events | Interprets a value |
| HealthService | What does it mean for this person? | Readings and context from the DataService; the bed-rest reference curves | Status per measure, findings, alerts and routed notices, the status JSON for the frontend | Decides when a test happens |
| Planner | What should happen next, and when? | Findings, saved status, studies already done, the crew timeline | Booked studies, retests and exercise sessions; reminders; the plan JSON for the frontend | Reads raw values or works out its own status |
| Notification Center | How does each message reach its people? | Notices and reminders | Deliveries and acknowledgements | Picks recipients or severity (issue #11) |
| Frontend | What should the crew see? | Status from the HealthService, the plan from the Planner | 3D body, flight measurements, the plan | Computes anything clinical |

Why the Planner takes conclusions and not raw variables: to judge a reading it would need its own copy of the alert rule (the mean of two tests against 1.645 times the measurement noise, see [health/README.md](../health/README.md#alert-rules)), the reference curves and each person's baseline, and the two copies would disagree. Besides conclusions it only needs facts from the DataService: which studies were done (their readings arrived), who is free when (no study on a spacewalk day) and how much exercise was logged. If it needs a new signal, such as a trend or exercise adherence, the HealthService adds it to what it publishes.

Conclusions are not medical decisions. A confirmed finding that the routine does not explain goes to people: the flight surgeon on Earth, or the crew medical officer when the radio delay makes Earth too slow.

## The loop

1. The sources (in the demo, the generator) send readings and crew context to the DataService, which cleans and stores them and publishes `data.readings_stored`.
2. The HealthService works out the status of each measure. After one test past the measurement noise it publishes a suspected `health.finding`. When the mean of two tests confirms it, it raises the alert, publishes a confirmed finding and a routed `health.notice`.
3. The Planner books the next step: the Table 8 study, a retest after a suspected finding, or exercise sessions after a confirmed one. It saves the plan through the DataService, serves it at `GET /api/v1/plan`, and publishes `plan.reminder` notices.
4. The crew runs the booked study or session, the instruments record it, and step 1 starts again. In the demo the generator runs the booked retests (`--run-booked`).

## Parts and state

| Part | What it does | State on `main` |
|---|---|---|
| **Sources** | Medical instruments (dynamometer, DXA scanner, cycle ergometer), wearables, room sensors, the spacesuit and the crew timeline. The last three are crew context: where someone is and what they are doing. | We have none. The generator stands in for them. |
| **Generator** (`gravsim`) | Readings and crew context for any mission day, following curves fitted from the NASA bed-rest data. | Built, `sim/`. Runs the retests the Planner books with `--run-booked` (off by default); the Planner's 14-day retest cooldown stops the retest loop ([planner.md](planner.md), section 6). |
| **DataService** | Cleans every reading, converts it to one unit per measure, stores readings, context and results (status, studies, plan), answers queries over HTTP (port 8000) and announces new data. | Built, `sim/gravsim/`. Saves to SQLite with `--db`, publishes to the SQLite queue with `--queue`. |
| **Database** | Readings, crew context, results. | SQLite. |
| **HealthService** | Status, findings, alerts and routed notices; the dashboard and flight-measurement JSON (port 3000). The model is trained on Earth and runs on board. | Built, `health/`. Suspected findings: not yet ([health-service.md](health-service.md), question 9). |
| **Planner** | Table 8 studies, retests and exercise sessions, fitted to the crew timeline; serves the plan. | Built, `planner/` (port 3001), design in [planner.md](planner.md): the in-flight routine of OCHMO-STD-100.1A for a 180-day ISS mission, plus pre- and post-flight DXA, strength and VO2peak; retests and reviews from findings; `GET /api/v1/plan`. Exercise sessions: not yet. |
| **Event queue** | `data.*` and `health.*` messages between services. | SQLite pub/sub (`sim/gravsim/queue.py`), one cursor per consumer. |
| **Notification queue and Notification Center** | `health.notice` and `plan.reminder`, delivered to wearables, room displays, the ship center, the EVA radio and Earth. | Same SQLite file, channel `notifications`. Deliveries are simulated and listed at `GET /api/v1/deliveries` on the HealthService; no real devices, radio or Earth link. |
| **Frontend** | 3D body, flight measurements, the plan. | Built, `src/front/sketch/`, reading the HealthService. The plan view: not yet. |

## Messages the Planner depends on

A finding carries a state, so the Planner can act before the alert (example values):

```json
{
  "type": "finding", "crew_id": "CM-2", "measure": "knee_extension_60",
  "state": "suspected",
  "basis": "one test",
  "level": 3, "change_pct": -14.2, "beyond_noise": 1.2,
  "mission_day": 74, "synthetic": true
}
```

`state` is `suspected`, `confirmed` or `cleared`; `basis` is `one test` or `mean of two`.

A plan item is saved through the DataService as a result of kind `plan`, and `GET /api/v1/plan?crew=CM-2` returns the list:

```json
{
  "id": "retest:knee_extension_60:74", "crew_id": "CM-2",
  "type": "retest",
  "measure": "knee_extension_60", "instrument": "dynamometer",
  "window": {"from": "2027-03-18T00:00:00Z", "to": "2027-03-25T00:00:00Z"},
  "reason": "finding",
  "status": "booked"
}
```

`type` is `study`, `retest` or `session`; `reason` is `routine` (with its Table 8 row), `finding` or `guidance`; `status` is `booked`, `done`, `missed` or `cancelled`. Reminders go out as [contract v1](health-notices.md) notices with priority `info`; a `plan_reminder` kind needs Nacho's OK.

## Exercise sessions

The bed-rest studies compare exercise with no exercise and say nothing about dose, so the Planner books the sessions the routine already has and shows the evidence. It does not prescribe more.

| Finding | Exercise logged, last 14 days | The Planner |
|---|---|---|
| Suspected | Any | Books a retest in the next free slot within 7 days. |
| Confirmed | Under 70% of planned sessions | Books the missed sessions and shows the evidence: after 90 days of bed rest the fitted curves give a 22.5% loss of knee extension strength without exercise and 8.2% with it (VO2peak: 21.3% and 6.3%). |
| Confirmed | 70% or more | Changes nothing on its own and flags the case for the flight surgeon. |

The 7 days and the 70% are our assumptions, not NASA's.

## What we can measure

| Measure | Covered by our data |
|---|---|
| Bone density | Yes (DXA, MR035G) |
| Muscle strength | Yes (dynamometer, MR079G) |
| Aerobic capacity | Yes (cycle test, MR080G) |
| Muscle mass | Partly: lean mass by body region from the same DXA scans |
| Eye exam | No |
| Venous ultrasound | No |

## Things to keep in mind

- All data in the demo is synthetic. It comes from bed-rest studies on Earth (NASA's ground analog for weightlessness), not from spaceflight, and the app has to say so. This is demonstration software, not clinical guidance.
- The bed-rest studies lasted 21 to 90 days. Anything longer is the fitted curve continued, and readings past that point are flagged as extrapolated.
