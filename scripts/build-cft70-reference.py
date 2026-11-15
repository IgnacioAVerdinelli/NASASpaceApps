"""Genera la referencia muscular de CFT70 (NLSP MR079G) para la web de fuerza.

Uso: python scripts/build-cft70-reference.py <carpeta MR079G_CFT70> <salida.json>
     (en el repo: data/nlsp/MR079G_isokinetic_muscle/MR079G_CFT70 src/front/sketch/data/cft70-reference.json)

Por cada prueba y grupo calcula el cambio % por persona respecto del promedio
de PRE1/PRE2, en POST1 (R+2 a R+4) y POST2 (R+10 a R+13). Devuelve media, DE y n.
Cada prueba lleva el id de la medida del DataService y del HealthService (`measure`), que es por
donde la busca la página. Los textos salen en inglés, como el resto de la página.
"""
import csv, json, os, statistics as st, sys
from collections import defaultdict

src, out = sys.argv[1], sys.argv[2]
TESTS = [  # código, velocidad °/s, grupo muscular (clave del visor), prueba, medida del DataService
    ('KES', '60', 'quadriceps', 'Knee extension, 60°/s', 'knee_extension_60'),
    ('KFS', '60', 'hamstrings', 'Knee flexion, 60°/s', 'knee_flexion_60'),
    ('APFCS', '30', 'calf', 'Ankle plantarflexion, 30°/s', 'ankle_plantarflexion_30'),
    ('ADFCS', '30', 'shin_muscles', 'Ankle dorsiflexion, 30°/s', 'ankle_dorsiflexion_30'),
    ('TES', '60', 'back_muscles', 'Trunk extension, 60°/s', 'trunk_extension_60'),
    ('TFS', '60', 'abdominal_muscles', 'Trunk flexion, 60°/s', 'trunk_flexion_60'),
]

def load(phase):
    rows = {}
    with open(os.path.join(src, f'MR079G_CFT70_{phase}_strength_ALL'), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            try: rows[(r['Subject'], r['Test_Type'], r['Angle'])] = float(r['Value'])
            except ValueError: pass
            groups[r['Subject']] = (r.get('Group') or r.get('GROUP') or '').strip()
    return rows

groups = {}
data = {p: load(p) for p in ('PRE1', 'PRE2', 'POST1', 'POST2')}
summary = lambda xs: {'mean': round(st.mean(xs), 1), 'sd': round(st.stdev(xs), 1), 'n': len(xs)} if len(xs) > 1 else None
result = []
for code, angle, muscle, label, measure in TESTS:
    entry = {'code': f'{code}{angle}', 'measure': measure, 'muscle': muscle, 'test': label, 'unit': 'N·m', 'groups': {}}
    for g in ('CONTROL', 'EXERCISE', 'FLY'):
        subjects = [s for s, gg in groups.items() if gg == g]
        pre_abs, post = [], {'POST1': [], 'POST2': []}
        for s in subjects:
            pre = [data[p][(s, code, angle)] for p in ('PRE1', 'PRE2') if (s, code, angle) in data[p]]
            if not pre: continue
            base = st.mean(pre); pre_abs.append(base)
            for p in post:
                if (s, code, angle) in data[p]: post[p].append(100 * (data[p][(s, code, angle)] / base - 1))
        entry['groups'][g] = {'pre_Nm': summary(pre_abs), 'post1_pct': summary(post['POST1']), 'post2_pct': summary(post['POST2'])}
    result.append(entry)

json.dump({
    'source': 'NASA Life Sciences Portal, MR079G Isokinetic Muscle Function, CFT70 study (UTMB, 70 days of −6° head-down bed rest). DOI 10.83263/bk5h-r757',
    'bedRestDays': 70, 'post1': 'R+2 to R+4', 'post2': 'R+10 to R+13',
    'groups': {'CONTROL': 'No countermeasure', 'EXERCISE': 'Exercise', 'FLY': 'FLY group (to be confirmed: probably a compact flywheel device)'},
    'tests': result,
}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', out)
