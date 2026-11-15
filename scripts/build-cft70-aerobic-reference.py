"""Resume NLSP MR080G (CFT70, capacidad aeróbica) en un JSON de referencia para el frontend.

Uso: python scripts/build-cft70-aerobic-reference.py <carpeta MR080G_CFT70> <salida.json>

Métrica principal: VO2pico relativo (columna REL VO2PK, ml/kg/min). Es la que NASA usa para su mínimo
operativo (32,9 ml/kg/min, NASA-STD-3001 Vol 1 [V1 4001]).

Corrección de datos: en 4 sujetos (5210, 9682, 7036, 6791) las columnas desde HRPK están corridas un
lugar a la derecha: la FC pico real está en MAX WKLD, HRPK tiene el VO2 redondeado y VO2PK tiene el VCO2.
REL VO2PK sí es correcta en las 38 filas (se verificó contra VO2PK x 1000 / peso en los sujetos sin
corrimiento). Para esos 4 sujetos no se usan RER ni FC de las columnas originales.
"""
import csv
import json
import statistics as st
import sys
from pathlib import Path

SHIFTED = {"5210", "9682", "7036", "6791"}
FLOOR = 32.9
GROUPS = ("CONTROL", "EXERCISE", "FLY")


def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def load(folder: Path, phase: str) -> dict:
    with open(folder / f"MR080G_CFT70_{phase}_ALL", encoding="utf-8-sig") as fh:
        return {row["SUBJECT"].strip(): row for row in csv.DictReader(fh)}


def hr_peak(row):
    return num(row["MAX WKLD"]) if row["SUBJECT"].strip() in SHIFTED else num(row["HRPK"])


def rer_peak(row):
    return None if row["SUBJECT"].strip() in SHIFTED else num(row["RERPK"])


def stats(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return {"mean": round(st.mean(values), 1), "sd": round(st.stdev(values), 1) if len(values) > 1 else 0.0, "n": len(values)}


def main(folder: str, out: str) -> None:
    folder = Path(folder)
    pre, post1, post2 = (load(folder, p) for p in ("PRE", "POST1", "POST2"))
    groups = {}
    for group in GROUPS:
        subjects = [s for s, r in pre.items() if r["GROUP"].strip().upper() == group]
        rel = lambda table, s: num(table[s]["REL VO2PK"]) if s in table else None
        change = lambda table: [(rel(table, s) / rel(pre, s) - 1) * 100 for s in subjects if rel(table, s) and rel(pre, s)]
        paired = [s for s in subjects if rel(post1, s) and rel(pre, s)]
        groups[group] = {
            "pre_ml_kg_min": stats([rel(pre, s) for s in subjects]),
            "post1_ml_kg_min": stats([rel(post1, s) for s in paired]),
            "post1_pct": stats(change(post1)),
            "post2_pct": stats(change(post2)),
            "below_floor": {"pre": sum(rel(pre, s) < FLOOR for s in paired), "post1": sum(rel(post1, s) < FLOOR for s in paired), "n": len(paired)},
            "drop_20pct_or_more": sum((rel(post1, s) / rel(pre, s) - 1) <= -0.20 for s in paired),
            "hr_peak_change_bpm": stats([hr_peak(post1[s]) - hr_peak(pre[s]) for s in paired if hr_peak(post1[s]) and hr_peak(pre[s])]),
            "workload_change_pct": stats([num(post1[s]["WKLD @ VO2PK"]) / num(pre[s]["WKLD @ VO2PK"]) * 100 - 100
                                          for s in paired if num(post1[s]["WKLD @ VO2PK"]) and num(pre[s]["WKLD @ VO2PK"])]),
            "valid_max_tests_post1": {"rer_ge_1_1": sum((rer_peak(post1[s]) or 0) >= 1.1 for s in paired),
                                      "with_rer": sum(rer_peak(post1[s]) is not None for s in paired)},
        }
    reference = {
        "source": "NASA Life Sciences Portal, MR080G Aerobic Capacity, estudio CFT70 (UTMB, 70 días de reposo en cama a −6°). DOI 10.83263/w056-8t76",
        "metric": "REL VO2PK",
        "unit": "ml/kg/min",
        "bedRestDays": 70,
        "post1": "R+0 a R+1",
        "post2": "R+9 a R+11",
        "nasaFloor": FLOOR,
        "groups": {"CONTROL": "Sin contramedida", "EXERCISE": "Con ejercicio", "FLY": "FLY"},
        "dataFixes": "4 sujetos con columnas corridas desde HRPK; se usó MAX WKLD como FC pico y no se usó su RER.",
        "byGroup": groups,
    }
    Path(out).write_text(json.dumps(reference, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({g: (v["post1_pct"], v["below_floor"]) for g, v in groups.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main(*sys.argv[1:3])
