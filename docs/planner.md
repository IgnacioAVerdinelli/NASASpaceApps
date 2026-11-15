# Planner: design and build plan

The Planner of [architecture.md](architecture.md) ("analysis scheduler" in older notes). This page is the contract other people and agents build against. If something here changes, change this page in the same PR.

- **Owner:** Tomás. **Branch:** `feat/planner`, from `main`.
- **State (15/11/2026):** built in `planner/` on `feat/planner`, with tests in `planner/tests/`. The HealthService and the generator read the plan (section 8).

## 1. What it does

The Planner answers **"what should each crew member do next, and when?"** It:

1. **Reads NASA's routine** from a catalog transcribed from OCHMO-STD-100.1A Section 6 (Table 8). Each routine has its requirement number, page, schedule, steps and guide.
2. **Books the routine** for each crew member on the mission: one plan item per occurrence (eye exam on L+30, strength test every 30 days, sleep log every day...).
3. **Books what findings call for**, using the HealthService's conclusions: a retest after a suspected finding, a review by the flight surgeon after a confirmed one.
4. **Tracks each item**: `done` when the instrument's readings arrive or the crew marks it done, `missed` when its window closes without that, `cancelled` when it is no longer needed.
5. **Sends reminders** when a window opens, and tells the ship center about missed items.
6. **Serves the plan and the routines** to the frontend: `GET /api/v1/plan` and `GET /api/v1/routines`, with the guide for each one.

It never reads a value to judge it, as agreed in the architecture: conclusions come from the HealthService. From the DataService it uses only facts: which readings arrived, when the spacewalks are, and the mission clock.

## 2. Where the routine comes from

**OCHMO-STD-100.1A Rev A** (09/09/2024), *NASA Space Flight Medical Selection, Recertification and Mission Evaluation Standards*. Copy: [`references/OCHMO-STD-100.1A_RevA_2024-09-09.pdf`](references/OCHMO-STD-100.1A_RevA_2024-09-09.pdf). What we checked on 14–15/11/2026:

- **It is NASA's current standard.** No Revision B exists.
- **Its Section 6 is the ISS's MED Volume B made agency-wide.** In the words of its authors: Rev A was *"modified to add Mission Medical Evaluations (MED B) at an Agency level vs. program level"* (Coffey, Childress and Francisco, OCHMO, HRP Investigators' Workshop 2025).
- **The binding ISS document is not public.** On the ISS it is SSP 50667, MED Volumes A, B and C, the multilateral version; on Artemis it is the ACMERD.
- **The schedules are examples.** The standard says they are *"for example only"*, based on 30-day and 180-day ISS missions, and are tailored per mission through the HMTA process.
- **The authors say Moon and Mars missions will need new risk trades.**

**How to say it in the demo:** "the plan follows NASA's mission medical standard (OCHMO-STD-100.1A, which carries the ISS's MED B), using its example schedule for a 180-day ISS mission." Do not say "this is the ISS's exact protocol".

## 3. Scope of version 1

- **Mission profile:** `iss_180` only, the profile Table 8 is written for. Other profiles (`artemis_30`, `mars`) come later as catalog overrides (section 11).
- **Phases covered:**
  - every in-flight routine that has a schedule;
  - the pre- and post-flight occurrences of the three routines our generator has instruments for: DXA, dynamometer and cycle.
- **Routines without a schedule** are in the catalog with no plan items, so the routines view can still show them:
  - "as clinically indicated" (ACI) ones, such as in-flight ultrasound and skin photos;
  - continuous ones, such as radiation dosimetry.

### Routines in version 1

Day numbers are mission days: launch is day 0 and landing is day 180. NASA's flight day *N* is day *N − 1*. **Occurrences on or after landing are dropped from in-flight routines.** That is why L+180 and L+270 disappear on a 180-day mission.

| Routine | Title | Phase | Schedule in the standard (180-day ISS example) | Version 1 occurrences | Closed by |
|---|---|---|---|---|---|
| 6002 | Health status evaluation | flight | L+14/21, L+90, L+180, L+270, R−21/14 | 14–21, 90, 159–166 | crew |
| 6003 | Private medical conference | flight | L+1-7, weekly, pre/post EVA, R−5 d, daily to R−0 d | weekly from day 1–7; daily R−5…R−1; before and after each EVA | crew |
| 6007 | In-flight hearing assessment | flight | on or before FD21, then every 3 months | 0–20, then every 90 days | crew |
| 6012 | Specialized ocular assessment (SANS) | flight | L+30, L+90, L+180, L+270, R−30 | 30, 90, 150 | crew |
| 6013 | Bone densitometry (DXA) | pre, post | L−180/30 d; R+ <30 d; R+1 year | −180…−30; 180–210; 545 | DXA readings |
| 6015 | Body mass | flight | L+7, then monthly | 7, 37, 67, 97, 127, 157 | crew |
| 6022 | Personal radiation dosimetry | flight | ongoing | none (continuous) | — |
| 6024 | Functional fitness (dynamometer stands in) | pre, post | L−90/30 d; R+5/7 d, R+30 d | −90…−30; 185–187; 210 | dynamometer readings |
| 6025 | On-orbit strength monitoring | flight | L+14, then at least every 30 days | 14, 44, 74, 104, 134, 164 | dynamometer readings |
| 6028 | Aerobic capacity test | pre, flight, post | L−90/30 d; FD14, FD75, FD165, FD255, R−14 d; R+5 d, R+30 d | −90…−30; 13, 74, 164, 166; 185, 210 | cycle readings (VO2peak) |
| 6029 | Pre- and post-EVA medical exam | flight | pre- and post-EVA | within 48 h before and 24 h after each EVA | crew |
| 6030 | EVA monitoring | flight | during EVA | during each EVA | suit readings |
| 6033 | Private psychological conference | flight | in flight every 14 days | 14, 28, …, 168 | crew |
| 6035 | Cognitive assessment | flight | in flight 1/month | 30, 60, 90, 120, 150 | crew |
| 6037 | Vitamin D supplement | flight | daily or once a week | weekly, 7, 14, …, 175 | crew |
| 6038 | Dietary questionnaire | flight | weekly | 7, 14, …, 175 | crew |
| 6039 | Sleep log | pre, flight, post | L−7 d continuously until R+7 d | every day from −7 to 187 | crew |
| 6041 | Jugular vein ultrasound (DVT screening) | flight | L+30, L+60, R−42 | 30, 60, 138 | crew |
| 6014, 6016, 6019 (in flight) | Ultrasound, skin photos, in-flight labs | flight | ACI, or L+180 (= landing) | none | — |

A point date (L+30) becomes a window of ± `tolerance_days`, 3 by default. A window written in the standard (L+14/21) is used as written. Both choices are recorded in the catalog.

## 4. The catalog

**File:** `planner/planner/catalog/ochmo-100.1a.json`. It is hand-transcribed from the PDF, and a test keeps it honest (below). One entry per routine:

```json
{
  "id": "6012",
  "ref": "OCHMO-STD-100.1A [6012]",
  "section": "6.1.12",
  "title": "Specialized ocular assessment (SANS)",
  "category": "ocular",
  "phases": ["flight"],
  "requirement": "To assess the effects of exposure to the spaceflight environment on ocular health, crewmembers shall undergo specialized eye examinations pre-flight, in-flight, and post-flight.",
  "requirement_page": 43,
  "schedule_text": "Example Schedule based on 180-day ISS mission: Pre-flight: AME L-21/18 m, L- 9/6 m, In- flight: L+30; L+90; L+180d, L+270 d, R-30;",
  "schedule_page": 44,
  "schedule": [{"at": "L+30"}, {"at": "L+90"}, {"at": "L+180"}, {"at": "L+270"}, {"at": "R-30"}],
  "tolerance_days": 3,
  "completion": "crew",
  "instrument": null,
  "measures": [],
  "performed_by": "crew pair, guided from the ground",
  "equipment": ["OCT", "ultrasound", "visual acuity and Amsler grid on the station laptop"],
  "duration_min": 90,
  "steps": ["Ocular questionnaire", "Visual acuity, distance and near", "Amsler grid", "Threshold visual fields", "2-D ultrasound of the eye", "OCT with multicolor imaging"],
  "guide": {
    "how": "...",
    "if_abnormal": "Record the finding and tell the crew surgeon; the standard asks to follow abnormal findings as clinically indicated."
  },
  "assumptions": ["tolerance of 3 days around each date is ours, not NASA's"]
}
```

### Schedule grammar

One list of terms per routine. Each term produces occurrences:

| Term | Meaning | Example |
|---|---|---|
| `{"at": "L+30"}` | A point date, ± `tolerance_days` | L+30 → days 27–33 |
| `{"at": "FD14"}` | A flight day (day 13), ± tolerance | |
| `{"window": "L+14/21"}` | A range written in the standard, used as is | days 14–21 |
| `{"window": "R-21/14"}` | Same, counted back from landing | days 159–166 |
| `{"window": "L-90/30"}` | Pre-flight range | days −90…−30 |
| `{"every": 30, "from": "L+14", "until": "R-1"}` | Recurrence; each occurrence ± tolerance | 14, 44, 74… |
| `{"every": 1, "from": "L-7", "until": "R+7", "tolerance_days": 0.5}` | Daily item | sleep log |
| `{"eva": "before", "hours": 48}` / `{"eva": "after", "hours": 24}` / `{"eva": "during"}` | Anchored to each spacewalk in the crew timeline | 6029, 6030, 6003 |

Anchors are `L` (launch, day 0), `R` (landing) and `FD` (flight day). Windows are clipped to the mission (`mission.start`…`mission.end`). For a routine whose `phases` is `["flight"]`, any occurrence that is not fully before landing is dropped.

### How we know the catalog matches the standard

- `docs/references/OCHMO-STD-100.1A_RevA_2024-09-09.txt` holds the PDF's text, one block per page. It is produced by `planner/scripts/extract_ochmo_text.py`, which needs pypdf; the tests read only the `.txt`.
- `planner/tests/test_catalog.py` checks that, for every routine:
  - its `[60xx]` number and `requirement` appear on `requirement_page`;
  - its `schedule_text` appears on `schedule_page`, after collapsing whitespace.
- Every number we chose ourselves (tolerances, how a recurrence starts) goes in `assumptions`.

## 5. Plan items

A plan item is one thing one crew member has to do in one window. This extends the shape in [architecture.md](architecture.md#messages-the-planner-depends-on); every field of that shape is kept.

```json
{
  "id": "6012:30", "crew_id": "CM-2",
  "type": "study",
  "routine_id": "6012", "ref": "OCHMO-STD-100.1A [6012]",
  "title": "Specialized ocular assessment (SANS)", "category": "ocular",
  "measure": null, "measures": [], "instrument": null,
  "window": {"from": "2027-03-28T00:00:00Z", "to": "2027-04-03T00:00:00Z",
             "day_from": 27.0, "day_to": 33.0, "day": 30.0, "label": "L+30"},
  "reason": "routine",
  "status": "booked",
  "completion": "crew",
  "done_at": null, "done_by": null,
  "finding": null, "eva": null,
  "synthetic": true
}
```

| Field | Values |
|---|---|
| `id` | Stable and unique per crew member. Routine items: `<routine>:<day>`, where `day` is the date the standard names (`6012:30`). Retests: `retest:<measure>:<finding day>`. Reviews: `review:<measure>:<finding day>`. Spacewalk items: `<routine>:eva:<eva day>:<before\|after\|during>` |
| `type` | `study` (a test or exam), `routine` (a recurring task that is not a test: conference, sleep log, questionnaire), `treatment` (vitamin D), `retest`, `review`. `session` (exercise) is reserved for later (section 9) |
| `measure` | The measure a retest is about (as in the architecture example). `measures` lists every measure the instrument reports |
| `reason` | `routine` (it comes from the catalog), `finding` (retest or review) or `guidance` (reserved) |
| `status` | `booked`, `done`, `missed` or `cancelled`. The four statuses of the architecture |
| `completion` | How the item gets closed: `auto` (by readings), `crew` (by a POST), `simulated` (by `--simulate-crew`, demo only) |
| `window.day_from`, `day_to`, `day` | Mission days, to save the frontend the conversion. `day` is the date the standard names (L+30 → 30), or the window start. `label` is the standard's own label (`L+30`, `FD14`, `R-14`, `L-90/30`, `EVA before`); for recurrences it is the flight-day label (`FD45`) |
| `finding` | For a retest or a review: the finding that caused it |
| `eva` | For spacewalk items: `{"day", "start", "end"}` |

**An item is "open"** when `day_from ≤ today ≤ day_to` and its status is `booked`. The API adds `"open": true|false` and `"overdue": false` when it serves an item; neither is stored.

### Lifecycle

```
booked ──readings in window (auto) or POST done──▶ done
   │
   ├──window ended, not done──▶ missed     (also a POST)
   └──finding cleared / POST cancel──▶ cancelled
```

- An `auto` item can also be closed by a POST, for example if the instrument was down and the test was logged by hand.
- A `done` item never goes back.

### Where it is stored

- In the DataService, as a result of **kind `plan`**: one record per crew member, with `timestamp` = the mission start and `model_version` = `planner-1`. Its `payload` is `{"generated_at": "<mission time>", "items": [...]}`.
- The DataService keeps one result per crew member, kind, time and version, so every save replaces the whole plan. That is atomic, and the Planner is the only writer.
- A whole-mission plan is about 450 items, around 150 KB of JSON per crew member.

## 6. What makes the Planner act

| Input | From | The Planner |
|---|---|---|
| Start-up, then every few seconds | itself | Builds the routine items for each crew member and merges them with the stored plan. Existing ids keep their status; new routine ids are added as `booked`. |
| `data.readings_stored` (channel `events`) | DataService | When the readings come from an instrument the routine uses, asks for that instrument's readings. If a usable one (quality `ok`) falls inside an `auto` item's window, the item becomes `done` with `done_at` set to that reading's time. |
| `health.finding` (channel `events`) | HealthService | Applies the finding rules below. |
| Spacewalks | DataService context (`GET /api/v1/context`, activity `eva`) | Spacewalk items for every EVA in the timeline. A retest is never booked on a spacewalk day. |
| The clock (`now_day` of `/api/v1/mission`) | DataService | `booked` items whose window has ended become `missed`; windows that open send a reminder. |
| `POST /api/v1/plan/{id}/status` | crew, frontend | `done`, `missed` or `cancelled`, with `by` and an optional `note`. |

### Finding rules

These are the architecture's rules, plus a cooldown so that a retest cannot loop. That loop is the problem Juan found with `--run-booked`.

| Finding `state` | The Planner |
|---|---|
| `suspected`, or no `state` (older HealthService versions) | If a retest for that crew member and measure is already open, nothing. If one was done in the last **14 days**, it books a `review` instead. Otherwise it books a `retest` in the first window of 7 days that starts tomorrow, has no spacewalk on its first day and ends by landing. |
| `confirmed` | Books a `review` (flight surgeon or crew medical officer) for the next 7 days, unless one is already open for that measure. The architecture's exercise sessions wait for an adherence signal (section 9). |
| `cleared` | Cancels the open retest or review for that measure. |

The 7 days and the 14 days are our assumptions, not NASA's, as are the architecture's 7 days and 70 %.

### Reminders

All of them go on channel `notifications`, and the demo's Notification Center stand-in already delivers anything that carries `notify`.

**When a window opens**, topic `plan.reminder`, with dedupe `plan:<crew>:<id>:open`:

```json
{"type": "plan_reminder", "priority": "info", "crew_id": "CM-2", "notify": ["CM-2"],
 "item": {"id": "6012:30", "title": "Specialized ocular assessment (SANS)", "routine_id": "6012",
          "window": {"from": "...", "to": "...", "label": "L+30"}},
 "created_at": "<mission time>", "synthetic": true}
```

**When an item is missed**, topic `plan.missed`, sent to the crew member and `ship_center`, with dedupe `plan:<crew>:<id>:missed`.

The final notice kind for these needs Nacho's OK ([health-notices.md](health-notices.md)).

## 7. API (port 3001)

| Endpoint | Returns |
|---|---|
| `GET /api/v1/plan?crew=CM-2` | `{"version": 1, "crew_id", "mission": {"name", "today", "todayLabel", "landing"}, "source": {"document", "revision", "note"}, "items": [...]}`. Optional filters: `from_day`, `to_day`, `status`, `type`, `routine`. `day=` looks at another mission day without saving anything |
| `GET /api/v1/plan/today?crew=CM-2` | The open items, plus those due in the next 7 days, sorted by `day_to` |
| `GET /api/v1/routines` | The catalog, without the long guide text |
| `GET /api/v1/routines/{id}` | One routine with its steps and guide |
| `POST /api/v1/plan/{id}/status?crew=CM-2` | Body `{"status": "done"\|"missed"\|"cancelled", "by": "CM-2", "note": ""}`. Answers the updated item; `409` if the item is already `done` |
| `GET /api/v1/health` | Status, crew and mission day |

The frontend's Vite proxy sends `/api/v1/plan` and `/api/v1/routines` to port 3001, and the rest of `/api` to 3000. This change is part of the Planner PR.

## 8. Changes to other parts (same PR)

These are agreed in the decision of 15/11. Each one keeps working the same way from the reader's side:

| Part | Change |
|---|---|
| `health/healthservice/demo.py` | Remove `schedule_routine`, `handle_finding` and the `scheduler` consumer. The Planner does that now. Processing, notices and the delivery stand-in stay. |
| `health/healthservice/sources.py` | `studies()` reads kind `plan` and turns `study` and `retest` items into the flat list `analyses.py` uses (`{day, id, study, reason, measure}`), so the flight-measurement page's `upcoming` keeps working. `study` is mapped from the routine: 6024 and 6025 → `strength`, 6028 → `aerobic_capacity`, 6013 → `bone_densitometry`; retests → `retest`. |
| `sim/gravsim/serve.py` `run_booked_studies` | Reads the `retest` items of kind `plan` instead of kind `study`. It runs each one on the first day of its window, and only once, as it does today. |
| `src/front/sketch/vite.config.js` | Proxy for port 3001. |
| `README.md` | How to start the Planner. |

## 9. Work packages (to build in parallel)

| # | Package | Who | Depends on |
|---|---|---|---|
| 1 | Catalog, PDF text and catalog test | Tomás (Planner PR) | — |
| 2 | Plan engine (occurrences, merge, statuses, finding rules) and its tests | Tomás | 1 |
| 3 | Service: DataService source, queue consumers, reminders, `--simulate-crew` | Tomás | 2 |
| 4 | HTTP API and the Vite proxy | Tomás | 3 |
| 5 | Migration of the readers (section 8) | Tomás | 2 |
| 6 | **Plan view in the frontend**: "Mission plan" tab of `vuelo.html` (`src/front/sketch/plan/`, `data/plan.js`): counts, studies across the flight, next 7 days, whole mission by routine, missed, routine guide and mark as done or missed | Tomás (built on `feat/plan-view`) | contract only |
| 7 | **`suspected` and `cleared` findings** in the HealthService, with the shape in [architecture.md](architecture.md#messages-the-planner-depends-on). Built: `health/healthservice/findings.py` ([health-service.md](health-service.md#hallazgo-y-aviso)) | Valen | — |
| 8 | **Notification kind** for `plan.reminder` and `plan.missed` in the Notification Center | Nacho | contract only |
| 9 | **Exercise sessions** after a confirmed finding (architecture table). Needs the HealthService to publish logged exercise for the last 14 days | later | 7 and an adherence signal |

## 10. Running it (once merged)

```bash
python3 -m venv .venv
.venv/bin/pip install -e ./sim -e './health[dev]' -e './planner[dev]'
.venv/bin/python -m gravsim.serve --day 95 --speed 20 --db /tmp/nasa-data.sqlite --queue /tmp/nasa-queue.sqlite
.venv/bin/python -m healthservice --queue /tmp/nasa-queue.sqlite
.venv/bin/python -m healthservice.demo --queue /tmp/nasa-queue.sqlite
.venv/bin/python -m planner --queue /tmp/nasa-queue.sqlite --simulate-crew      # port 3001
```

With `--simulate-crew`, every `crew` item is marked done in the middle of its window, so the demo is not full of missed items. Without it, the crew closes items through the API.

## 11. Later

- **Other mission profiles** as catalog overrides. `artemis_30` would use Table 7 (missions under 30 days), where most in-flight items are ACI. `mars` would stretch the recurrences over the whole mission and replace the ground-based items (private conferences, guided ultrasound) with versions the crew can run alone, given the radio delay.
- **ACI items** booked from HealthService findings, for example a blood test after a suspected infection.
- **Exercise sessions** (package 9).

## Sources

- OCHMO-STD-100.1A Rev A: [nasa.gov PDF](https://www.nasa.gov/wp-content/uploads/2023/04/ochmo-std-100.1a.pdf); copy in [`references/`](references/).
- Coffey, Childress and Francisco, *NASA Space Flight Medical Selection, Recertification and Mission Evaluation Standards: Forward Work for Future Long-Duration Exploration Missions*, HRP IWS 2025: [nasa.gov PDF](https://www.nasa.gov/wp-content/uploads/2025/01/nasa-spaceflight-medical-selection-recertification-and-mission-evaluation-standards.pdf).
- OCHMO presentation at HRP IWS, January 2025: [nasa.gov PDF](https://www.nasa.gov/wp-content/uploads/2025/01/nasa-spaceflight-medical-selection-recertification-and-mission-evaluation-standards-presentation.pdf).
- NASA-STD-3001, Appendix A references (SSP 50667 MED A/B/C): [nasa.gov](https://www.nasa.gov/reference/appendix-a-references).
