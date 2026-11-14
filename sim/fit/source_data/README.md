# Strength data for the fit

These are the NASA files `fit/fit_params.py` reads for muscle strength, apart from CFT70. They are the MR079G Isokinetic Muscle Function files from the NASA Life Sciences Portal, copied unchanged, in the same folders they had in `data/nlsp/` before 14 November 2026.

## Why they are here and not in `data/nlsp/`

The website uses one muscle dataset, CFT70, so `data/nlsp/` keeps only `MR079G_isokinetic_muscle/MR079G_CFT70/` (see `data/nlsp/README.md`). The fit needs more than that. It works out how fast strength falls by comparing bed-rest studies of different lengths, and CFT70 has a single length, 70 days. So the fit reads CFT70 from `data/nlsp/` and the other studies from this folder.

| Folder | Study | Days in bed | Files | What the fit uses it for |
|---|---|---|---|---|
| `MR079G_HDT30_DataSum/` | HDT30 | 30 | 47 | loss curve, spread between people, recovery, test-retest noise, baselines |
| `MR079G_Campaign_1_Muscle_Strength_Endurance/` | UTMB Campaign 1 | 60 | 1 | loss curve, spread, recovery, noise, baselines |
| `MR079G_Campaign_3_Isokinetic_Muscle_Function/` | UTMB Campaign 3 | 60 or 90 | 98 | loss curve, spread, recovery, noise, baselines |
| `MR079G_Campaign_11/` | UTMB Campaign 11, the control and exercise groups | 70 | 1 | loss curve, exercise effect, spread, recovery |
| `MR079G_AG_DATASUM/` | AG Pilot | 21 | 36 | noise, baselines |
| `MR079G_MEDES_C1/`, `MR079G_MEDES_C2/` | MEDES (WISE), women only | 60 | 72 | noise, baselines |
| `MR079G_Campaign_17_Isokinetic_DataSum/` | Campaign 17, the pre-bed-rest file only | 14 | 1 | baselines |

"Baselines" includes the data range in `gravsim/params.json` that generated readings are clipped to. Campaign 11's file repeats the CFT70 tests of 15 people, so for baselines the fit counts those people once, from CFT70.

That is 256 files, about 0.4 MB. Only the files the fit opens were copied; the rest of MR079G is in the repository's git history and on the portal.

The files are CSV text, most without a `.csv` extension, and some start with a byte-order mark. HDT30, Campaign 1, AG Pilot and MEDES label their values ft-lb, and Campaign 3 names its column `Measured_ft/lb`. The fit and `gravsim/params.json` keep strength in ft-lb; the DataService stores it in N·m.

## Source and credit

NASA Life Sciences Data Archive, via the NASA Life Sciences Portal (https://nlsp.nasa.gov): MR079G Isokinetic Muscle Function, doi:10.83263/bk5h-r757. Downloaded on 14 November 2026; the portal lists every MR079G dataset as publicly available. These are head-down bed-rest studies on Earth, not spaceflight.
