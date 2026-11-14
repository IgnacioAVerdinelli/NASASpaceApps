# Datos de reposo en cama (NASA Life Sciences Portal)

Descargados el 14-11-2026 desde el [NASA Life Sciences Portal (NLSP)](https://nlsp.nasa.gov). Los cuatro experimentos están marcados en NLSP como *"All datasets are publicly available"* (acceso abierto, sin solicitud).

## Qué es un estudio de reposo en cama

Voluntarios sanos pasan entre 30 y 90 días acostados con la cabeza inclinada 6° hacia abajo (*head-down tilt bed rest*). Así se quita la carga de la gravedad sobre hueso, músculo y sistema cardiovascular, igual que en la ingravidez. Es el análogo en Tierra que usa NASA para estudiar la pérdida de condición física en vuelos largos y para probar contramedidas. **No es un vuelo real**: en la web hay que indicarlo así.

## Experimentos

| Carpeta | Experimento | Mide | Equipo | DOI |
|---|---|---|---|---|
| `MR035G_bone_densitometry/` | MR035G, Bone Densitometry Assessment | Densidad mineral ósea (cadera, cuello femoral, trocánter, columna lumbar, talón, antebrazo, cuerpo entero), T-score y Z-score, masa magra y grasa por brazo y pierna | DXA Hologic Discovery; GE Lunar iDXA desde la Campaign 11 | [10.83263/7myc-5j86](https://doi.org/10.83263/7myc-5j86) |
| `MR079G_isokinetic_muscle/` | MR079G, Isokinetic Muscle Function | Fuerza concéntrica y excéntrica y resistencia de rodilla y tobillo (extensión y flexión a 60°/s y 180°/s) | Dinamómetro isocinético | [10.83263/bk5h-r757](https://doi.org/10.83263/bk5h-r757) |
| `MR080G_aerobic_capacity/` | MR080G, Aerobic Capacity | VO₂pico, frecuencia cardíaca, presión arterial, VCO₂, RER, ventilación y esfuerzo percibido (Borg) por etapa de una prueba en cicloergómetro de 50 a 350 W | Cicloergómetro, analizador de gases (MGAS), ECG | [10.83263/w056-8t76](https://doi.org/10.83263/w056-8t76) |
| `MR001G_tilt_orthostatic/` | MR001G, Neuroendocrine and Cardiovascular Response to Tilt | Frecuencia cardíaca, presión, volumen sistólico, gasto cardíaco y resistencia periférica minuto a minuto, acostado y luego inclinado a 80° durante 30 min; tiempo tolerado de pie; hormonas en sangre (noradrenalina, adrenalina, renina, aldosterona, angiotensina, vasopresina, ANP, ACTH) | Mesa basculante, Doppler/ecocardiografía, manguito de presión | [10.83263/gz1q-a824](https://doi.org/10.83263/gz1q-a824) |

| Carpeta | Archivos | Tamaño |
|---|---|---|
| MR035G | 1.063 | 4,1 MB |
| MR079G | 400 | 14 MB |
| MR080G | 1.505 | 8,0 MB |
| MR001G | 139 | 0,6 MB |

## Estudios incluidos

Cada carpeta interna lleva el nombre del estudio de origen:

| Estudio | Diseño |
|---|---|
| UTMB Campaign 1 | 60 días de reposo, 3 hombres (2004) |
| UTMB Campaign 3 | 60 o 90 días; 23 sujetos completaron (14 hombres, 9 mujeres). Fases C3A–C3H. Incluye seguimiento a 6 meses y 1 año en DXA |
| UTMB Campaign 5 | 90 días |
| UTMB Campaign 11 / CFT70 | 70 días; grupo **control** frente a grupo con **ejercicio integrado (iRAT)** |
| Campaign 17 | 14 días |
| HDT30 | 30 días |
| MEDES (WISE) | Reposo en cama solo con mujeres (Toulouse, Francia), con ejercicio y nutrición como contramedidas |
| AG Pilot | 21 días; grupo con **1 h diaria de centrífuga (gravedad artificial)** frente a control |

## Formato

- Son tablas CSV. **Muchos archivos no tienen extensión `.csv`**, pero son texto CSV.
- Columnas comunes: `SUBJECT` o `Subject`, `TEST_PHASE` (`PRE_TEST` / `POST_TEST`), `BR_DAY` (día relativo al reposo) y `SCAN_DATE` o `Date`.
- Algunos archivos empiezan con un BOM (`﻿`). Hay que leerlos con `encoding='utf-8-sig'`.
- Unidades: la densidad ósea está en g/cm², la fuerza en ft-lb y el VO₂ en L/min y ml/kg/min.
- Cada carpeta trae un archivo `.md5sum` del portal.

## Cuidado

- **DXA de la Campaign 3:** el escáner tuvo una falla entre el 9-6-2006 y el 10-8-2006. Los valores de ese período ya vienen corregidos (BMD ×1,0120). Ver `MR035G_Campaign_3_DXA_ReadMe/`.
- Los grupos son chicos (de 3 a 12 sujetos por estudio), así que las comparaciones son descriptivas.
- Los sujetos están anonimizados con códigos numéricos.

## Resultados publicados (para validar)

- **Hueso:** pérdida media de **~1 % por mes** en cadera, pelvis y talón. La recuperación es comparable a la observada después de vuelos espaciales (ficha de MR035G; Spector, Smith y Sibonga, *Aviat Space Environ Med* 2009; 80(5 Suppl):A23-8).
- **Aeróbico:** en el AG Pilot, el VO₂pico cayó un **12 % en el grupo control** y un **6 % con gravedad artificial** (ficha de MR080G).
- **Cardiovascular:** la gravedad artificial atenúa la intolerancia ortostática (Stenger y col., *Eur J Appl Physiol* 2012; 112(2):605-16).

## Créditos

Citar cada experimento por su DOI (tabla de arriba) y la fuente: NASA Life Sciences Data Archive, NASA Life Sciences Portal, https://nlsp.nasa.gov.
