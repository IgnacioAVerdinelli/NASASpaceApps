# Watch and vital signs: two layers of monitoring

Design and contract for the crew's first line of monitoring, the watch, and how it sits next to the historical analysis we already have. Other people and agents build against this page; change it in the same PR as the code.

- **Owner:** Tomás. **State (15/11/2026):** built in four branches, merged in this order:

| Branch | Part | What |
|---|---|---|
| `feat/wearable-data` | simulator / DataService | the watch: heart rate every 15 min, the night's sleep; fatigue spells for the demo |
| `feat/vitals-analysis` | HealthService | `GET /api/v1/vitals`: personal band, sustained deviations, day curves; watch findings |
| `feat/vitals-planner` | Planner | the sleep log closes itself from the watch; a watch finding books a review |
| `feat/vitals-view` | frontend | "Now · watch" on the Health summary, and the "Vital signs" tab |

## 1. Two layers

| | **Layer 1 · Now: the watch** | **Layer 2 · Trend: the history** |
|---|---|---|
| Question | How am I today, compared with myself? | Am I losing faster than expected? |
| Source | Watch and wearable, every day, all day | Periodic tests: strength, VO2peak, DXA |
| Time scale | Hours to weeks | Weeks to months |
| Compared with | The person's own last two weeks | The pre-flight reference and the NASA bed-rest curves |
| What it raises | A **deviation**: a notice, never an alert by itself | **Alerts** (alerts.py) and findings for the Planner |

The watch catches change early, but noisily. A deviation that lasts becomes a *suspected finding*, and the Planner books a review by the flight surgeon. The tests of layer 2 confirm or clear what the body is doing. Nothing in layer 1 is a diagnosis.

## 2. What the watch measures

New instrument `watch` in gravsim (`instruments.Watch`). The daily resting values stay with `wearable`.

| Measure | Instrument | Unit | How often | Model |
|---|---|---|---|---|
| `watch_hr` | watch | bpm | every 15 min (average of those minutes) | the wearable's 24-hour trace: resting level, daily rhythm, sleep dip, exercise blocks, spacewalks |
| `sleep_hours` | watch | h | once a night, reported at 06:00 UTC | 6.9 h on the ground, **6.09 h in flight** (Barger et al. 2014, *Lancet Neurology*, 85 astronauts), ±0.6 h night to night |
| `sleep_quality` | watch | score 1–7 | once a night | the self-rated scale of OCHMO-STD-100.1A [6039]; follows the hours slept |
| `resting_hr` | wearable | bpm | once a day | fitted (MR001G / CFT70) |
| `resting_sbp`, `resting_dbp` | wearable | mmHg | once a day | fitted |
| `spo2` | wearable | % | once a day | assumed 95–100 % |
| `hrv_rmssd` | wearable | ms | once a day | assumed |

**Fatigue spells**, for the demo: `CrewMember.add_fatigue(day, days)` or `gravsim.serve --fatigue CM-3:132:6`. During the spell the resting heart rate is 12 % higher, HRV 30 % lower, systolic pressure 3 % higher and the night about 1.6 h shorter with a worse score. Strength, VO2peak and bone are not touched: it is something only the watch sees. The sizes are assumed.

**Volume:** about 100 readings a day per crew member, 23 000 over a 180-day mission. The DataService filters by measure in SQL and in memory, and `GET /api/v1/readings` takes `start` so a client asks only for the window it shows.

## 3. The analysis (HealthService)

### Personal band

For each vital and each day: the mean and SD of the person's own daily values over the **14 days before the last 3** (days d−17 to d−4). The band is mean ± 2 SD, with a floor on the SD so a very steady fortnight does not make a hair-trigger:

| Vital | Bad direction | SD floor |
|---|---|---|
| Resting heart rate | up | 2 bpm |
| Systolic / diastolic pressure | up | 4 / 3 mmHg |
| SpO2 | down | 1 point |
| HRV | down | 4 ms |
| Sleep hours | down | 0.4 h |
| Sleep quality | down | 0.6 |

A rolling band follows slow changes on its own (they are layer 2's job) and makes layer 1 about **acute** change: a cold, a bad week, stress. Before 10 days of data there is no band, and the page says so.

### Status of each vital

- `in_range`: the latest value is inside the band.
- `out`: outside, in either direction. The page shows which side; it is not a deviation yet.
- `deviation`: the **mean of the last 3 days** is beyond 2.5 SD of a 3-day mean (mean ± 2.5·SD/√3) in the bad direction, and each of those 3 days is on the worse side of the usual mean. This is the watch's notice. Why the 3-day mean: a watch's daily resting heart rate moves about ±6 % from one day to the next, so a single day says little; three days together have √3 times less noise. One big day alone is not enough.
- `no_band` / `no_data`.

SpO2 has one absolute rule on top: under **92 %** is `low_now` at once, without waiting three days. 92 % is the usual target floor for pulse oximetry in adults; it is not a NASA threshold and is documented as ours.

### Patterns

When resting heart rate is up, HRV is down and sleep is short, all beyond their bands on the same day, the result carries the pattern `fatigue`. It is a plain-language hint ("these three together often mean fatigue or a coming illness"), not a diagnosis.

### Findings for the Planner

When a vital enters `deviation`, the demo worker publishes on the event queue:

```json
{"type": "finding", "source": "watch", "crew_id": "CM-3", "measure": "resting_hr", "state": "suspected",
 "basis": "3 days beyond the personal band", "change_pct": 11.8, "mission_day": 134.0, "synthetic": true}
```

When the vital is no longer in deviation and its last 2 days are back in the daily band: the same with `"state": "cleared"`. Dedupe: one `suspected` per crew member, vital and episode.

### `GET /api/v1/vitals?crew=CM-3&day=`

```json
{
  "version": 1, "crew": {"id": "CM-3"}, "simulated": true,
  "mission": {"today": 134.2, "todayLabel": "FD135", "landing": 180},
  "vitals": [
    {"measure": "resting_hr", "name": "Resting heart rate", "unit": "bpm", "decimals": 0, "direction": "up",
     "latest": {"value": 74, "day": 134.5, "at": "2027-..."},
     "band": {"low": 59.1, "high": 68.3, "mean": 63.7, "days": 14, "sustainedLow": 60.9, "sustainedHigh": 66.5},
     "status": "deviation", "daysBeyond": 2, "recentMean": 71.3, "changePct": 16.2,
     "text": "Higher than usual for the last 3 days",
     "series": [{"day": 104.5, "value": 62}, "... last 30 days"],
     "weekly": [{"week": -2, "day": -10.5, "mean": 61.2}, "... whole mission, weekly means"]}
  ],
  "patterns": [{"id": "fatigue", "text": "Higher resting heart rate, lower HRV and short sleep together: often fatigue or a coming illness."}],
  "day": {
    "unit": "bpm",
    "curves": {"today": [{"minute": 0, "value": 58}, "..."], "yesterday": [], "week_ago": [], "preflight": []},
    "context": [{"start": 0, "end": 360, "activity": "sleep"}, "... minutes of today"]
  },
  "notice": "Synthetic data. Compared with your own last two weeks; not a health assessment."
}
```

`day.curves` are the watch's 15-minute values: today (so far), yesterday, 7 days ago, and the average pre-flight day (minute by minute over the 14 pre-flight days). `context` comes from the crew timeline, so the page can shade sleep, exercise and spacewalks.

## 4. Planner

- The **sleep log** (OCHMO-STD-100.1A [6039]) closes itself when the watch reports the night (`sleep_hours`), like the other instrument routines.
- A watch finding with no instrument test to repeat books a **review by the flight surgeon** (the existing rule "no instrument in the routine retests this measure"), with the finding's text. A `cleared` finding cancels it.

## 5. Frontend

- **Health summary**, new first band "Now · watch":
  - one tile per vital: the value, a 7-day sparkline with the band shaded, and the status in words ("In your usual range", "Above your usual range for 3 days");
  - the heart rate of the day: today against yesterday, a week ago or the pre-flight day, with sleep, exercise and spacewalks shaded;
  - the fatigue pattern, when there is one.
- **"Vital signs" tab**: each vital over 30 days with its band and its deviation days marked, and the weekly means over the whole mission (layer 2 for the watch).

## 6. Assumptions (ours, not NASA's)

The 14-day window, the 3-day lag, ±2 SD for the daily band, 2.5 SD of a 3-day mean for a deviation, the SD floors, 2 days to clear it, SpO2 92 % and every number of the fatigue spell. SpO2 and HRV values in the simulator have no data behind them.
