# gravsim: simulated instrument readings for the gravity hazard

We have no dynamometer, DXA scanner, metabolic cart or flight wearable. `gravsim` stands in for them: a Python package that produces readings for a crew member on any mission day, following the curves measured in NASA's open bed-rest studies (the files in `data/nlsp/`). Readings are random by default and fully controllable: exercise adherence over time, fast responders, injuries on a chosen day, broken instruments.

It is the input to our system. Its output is either plain reading records (JSON or a DataFrame) or the dashboard JSON that the 3D page in `src/front/sketch` reads (contract version 1, `docs/frontend-backend.md` on `design-body`).

All data it produces is synthetic and every reading says so (`synthetic: true`).

## Install and run

Python 3.10 or newer, with `numpy`. `pandas` is needed only for `to_dataframe()` and to refit the parameters.

```bash
cd sim
pip install -e .            # or: pip install numpy pandas, and run from sim/
python -m pytest -q         # 18 checks, including against the bed-rest data
```

```python
import gravsim as gs

mission = gs.Mission("iss_180", launch_date="2027-03-01")
ana = mission.add_crew("CM-1", sex="F", adherence=1.0, seed=1)        # follows the exercise routine
ben = mission.add_crew("CM-2", adherence=[(0, 1.0), (60, 0.2), (120, 1.0)], seed=2)   # skips exercise for two months
ben.add_event(day=95, measures="legs", severity_pct=12, recovery_days=20, label="ankle sprain")

dyn = gs.Dynamometer(seed=3)
r = dyn.measure(ben, day=104, measure="knee_extension_60")
r.value, r.unit, r.day_label            # (131.0, 'ft-lb', 'FD105'): one test, noise included
r.truth                                 # {'value': 111.921, 'change_pct': -23.62, 'faults': []}

readings = mission.timeline()           # NASA schedule for every crew member
df = gs.to_dataframe(readings)          # one row per reading

dash = gs.build_dashboard(mission, ben, day=120, readings=readings)   # JSON for the 3D page
```

`examples/gravsim_demo.ipynb` shows what it generates, with charts against the bed-rest data (needs `pandas` and `altair`; run it from `sim/examples`).

To feed the 3D page:

```bash
python -m gravsim.serve --preset iss_180 --day 95 --speed 20 --port 3000
# then, in src/front/sketch on the design-body branch:
VITE_DASHBOARD_URL=http://localhost:3000/api/v1/dashboard npm run dev
```

`--speed 20` advances the mission 20 days per real minute, so the page (which polls every 3 seconds) shows the mission unfolding. `?crew=CM-2&day=150` on the URL picks a crew member and a day. `/api/v1/readings?crew=CM-1` returns the raw readings.

## The pieces

**Mission.** A list of phases with a gravity level. Presets:

| Preset | Phases | Covered by the data? |
|---|---|---|
| `iss_180` (default) | 180 days at 0 g, then a year back on Earth | Up to day 90; after that the curves are extrapolated |
| `artemis_30` | 12 days transit, 6 on the Moon (0.166 g), 12 back | Assumption: no data for partial gravity |
| `mars` | 180 days transit, 500 on Mars (0.38 g), 180 back | Assumption: no data for partial gravity or for 860 days |

Custom missions: `gs.Mission([gs.Phase("flight", 0, 120, 0.0), ...])`. Partial gravity scales the unloading by `1 - g` unless you pass `unloading=` your own function.

**CrewMember.** One person, consistent across readings. Sex, age and mass (random if not given), a baseline for every measure (sampled from the subjects' pre-bed-rest values) and a personal response (sampled from the spread between subjects). The status controls:

| You said | Parameter |
|---|---|
| Normal (following the routine) | `adherence=1.0`, the Campaign 11 exercise group's curve |
| Not normal (no exercise) | `adherence=0.0`, the control groups' curve |
| Partly following it | `adherence=0.6`, or steps over time: `[(0, 1.0), (60, 0.2), (120, 1.0)]`, or a function of the day |
| Damaged: losing faster than almost everyone | `responder="fast"` (above the 90th percentile), or a number of standard deviations |
| Damaged: an event | `crew.add_event(day, measures="legs", severity_pct=12, recovery_days=20)` |
| Broken instrument | `Fault("offset", start, end, pct=-1.1)`, `"drift"`, `"dropout"`, `"spike"`, `"stuck"` on the instrument |

Measure groups for events: `legs`, `trunk`, `arms`, `bone`, `cardio`, `strength`.

**Instruments.** `measure(crew, day, measure)` returns one `Reading`; `session(crew, day)` returns the whole session as the device records it.

| Instrument | Measures | `session()` |
|---|---|---|
| `Dynamometer` | knee extension/flexion 60°/s, ankle plantar/dorsiflexion 30°/s, trunk extension/flexion 60°/s (ft-lb) | every test with its repetitions |
| `DxaScanner` | hip, spine, heel bone density (g/cm²); lean mass of legs, arms, trunk (g) | full report, left and right hip |
| `CycleErgometer` | VO2peak (ml/kg/min) | graded test stage by stage: watts, heart rate, VO2, Borg |
| `Wearable` | resting heart rate, systolic and diastolic pressure, SpO2, HRV | 24 hours of minute-by-minute heart rate |

`noise=0` on an instrument (or on `timeline()`) turns measurement noise off; `noise=0.5` halves it.

**Reading fields.** `crew_id`, `mission_day`, `day_label` (L-30, FD12, R+5), `timestamp`, `phase`, `gravity_g`, `instrument`, `device`, `measure`, `label`, `value`, `unit`, `region`, `muscle_keys` (the 3D page's keys, e.g. `quadriceps_l`), `quality` (`ok` or `missing`), `synthetic`, `extrapolated`, `model_version`, `status` (adherence, responder, recent events) and `truth` (noise-free value, true % change, active faults). A real monitoring system would not see `truth`; it is there to score one.

**Timeline.** `mission.timeline()` uses the NASA routine from `docs/investigacion-gravedad.md`: DXA only before and after flight (there is no DXA on the ISS), strength every 30 days, VO2peak on flight days 14, 75 and 165, the wearable daily, two baseline sessions before launch. `mission.timeline(schedule=7)` reads everything every 7 days instead. `until=day` gives the timeline so far. `gs.Mission.random(seed=...)` makes a crew with random statuses (some slipping on exercise, the odd fast responder or injury).

## How the curves are built

The data measured people before and after 21 to 90 days of head-down bed rest, with few readings in between. So the shape over time comes from comparing studies of different lengths, and from the follow-up scans after them.

- Strength, lean mass, VO2peak, resting heart rate and pressure approach a plateau with a time constant of 28.5 days, fitted on knee extension across HDT30 (30 days), Campaign 1 (60), Campaign 3 (60 or 90) and Campaign 11 (70). Back in gravity they recover with their own time constant.
- Bone density falls at a steady rate per unloaded day and recovers slowly afterwards (Campaign 3 follow-up scans up to two years).
- Exercise scales the loss by `1 - exercise_effect × adherence`, with the effect taken from Campaign 11's exercise and control groups.
- Measurement noise comes from repeat tests before bed rest and from same-day duplicate DXA scans.

`params.json` holds every number with its source; `python fit/fit_params.py` refits it from `data/nlsp/`. The current fit:

| Measure | Instrument | Unit | Shape without exercise | Loss prevented by full exercise | Recovery time constant | Noise | Assumed instead of fitted |
|---|---|---|---|---|---|---|---|
| `knee_extension_60` | dynamometer | ft-lb | plateau -23.5% | 64% | 19 d | 8.3% | none |
| `knee_flexion_60` | dynamometer | ft-lb | plateau -13.6% | 100% | 19 d | 10.2% | none |
| `ankle_plantarflexion_30` | dynamometer | ft-lb | plateau -25.7% | 12% | 19 d | 10.5% | none |
| `ankle_dorsiflexion_30` | dynamometer | ft-lb | plateau -6.8% | 70% | 19 d | 10.2% | exercise effect |
| `trunk_extension_60` | dynamometer | ft-lb | plateau -17.7% | 77% | 19 d | 8.8% | none |
| `trunk_flexion_60` | dynamometer | ft-lb | plateau -2.8% | 70% | 19 d | 12.3% | exercise effect; Campaign 11 runs the wrong way and is left out |
| `hip_bmd` | DXA | g/cm² | -1.45% per month | 50% | 386 d | 0.8% | exercise effect |
| `spine_bmd` | DXA | g/cm² | -0.10% per month | 50% | 399 d | 0.6% | exercise effect |
| `heel_bmd` | DXA | g/cm² | -0.38% per month | 50% | 286 d | 0.8% | exercise effect |
| `lean_legs` | DXA | g | plateau -6.5% | 64% | 19 d | 0.9% | time constants, exercise effect |
| `lean_arms` | DXA | g | plateau +0.2% | 64% | 19 d | 2.1% | time constants, exercise effect |
| `lean_trunk` | DXA | g | plateau -1.0% | 64% | 19 d | 0.9% | time constants, exercise effect |
| `vo2peak` | cycle | ml/kg/min | plateau -22.2% | 70% | 16.8 d | 6.9% | time constant of the loss |
| `resting_hr` | wearable | bpm | plateau +31.1% | 54% | 6.2 d | 5.7% | time constant of the loss |
| `resting_sbp` | wearable | mmHg | plateau +3.3% | 0% | 10 d | 8.5% | time constants |
| `resting_dbp` | wearable | mmHg | plateau +13.4% | 1% | 10 d | 7.9% | time constants |
| `spo2` | wearable | % | constant | | | 0.7% | everything (typical range, no data) |
| `hrv_rmssd` | wearable | ms | constant | | | 15% | everything (typical range, no data) |

What the tests check against the data: knee extension at 30 and 70 days with and without exercise, VO2peak at 70 days, hip loss per month, VO2 recovery, the spread between subjects, and the heart-rate rise at the same cycling workload (Campaign 3: a median 27.5 bpm).

## Limits

- Bed rest is the ground analog NASA uses, not spaceflight. Say so wherever these numbers appear.
- Past 90 unloaded days, and in partial gravity, readings carry `extrapolated: true`. The 180-day plateau is the fitted curve continued, not a measurement.
- The exercise effect on bone has no open data (Campaign 11's DXA files are restricted); 0.5 is a placeholder.
- Resting heart rate and pressure come from supine rest on the day subjects got up, which includes the effect of standing up again; in flight the change may be smaller.
- The cycle test's stage values use two textbook formulas (ACSM cycling equation for VO2, Tanaka 2001 for maximum heart rate), not the data.
- SpO2 and HRV have no data behind them.
- Groups were small (3 to 29 people per study) and some studies mix groups (AG Pilot, MEDES), so the spread between people is approximate.

## AI use

The code, the fitted parameters and this README were written with the help of an AI assistant (Claude), from the team's data and documents. Space Apps requires saying so in the project description.

## Data credit

NASA Life Sciences Data Archive, via the NASA Life Sciences Portal (https://nlsp.nasa.gov): MR079G Isokinetic Muscle Function (doi:10.83263/bk5h-r757), MR035G Bone Densitometry Assessment (doi:10.83263/7myc-5j86), MR080G Aerobic Capacity (doi:10.83263/w056-8t76).
