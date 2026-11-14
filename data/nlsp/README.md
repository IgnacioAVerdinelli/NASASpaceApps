# Datos de reposo en cama (NASA Life Sciences Portal)

Descargados el 14-11-2026 desde el [NASA Life Sciences Portal (NLSP)](https://nlsp.nasa.gov). Los cuatro experimentos están marcados en NLSP como *"All datasets are publicly available"* (acceso abierto, sin solicitud).

## Qué es un estudio de reposo en cama

Voluntarios sanos pasan entre 30 y 90 días acostados con la cabeza inclinada 6° hacia abajo (*head-down tilt bed rest*). Así se quita la carga de la gravedad sobre hueso, músculo y sistema cardiovascular, igual que en la ingravidez. Es el análogo en Tierra que usa NASA para estudiar la pérdida de condición física en vuelos largos y para probar contramedidas. **No es un vuelo real**: en la web hay que indicarlo así.

## Experimentos

| Carpeta | Experimento | Mide | Equipo | DOI |
|---|---|---|---|---|
| `MR035G_bone_densitometry/` | MR035G, Bone Densitometry Assessment | Densidad mineral ósea (cadera, cuello femoral, trocánter, columna lumbar, talón, antebrazo, cuerpo entero), T-score y Z-score, masa magra y grasa por brazo y pierna | DXA Hologic Discovery; GE Lunar iDXA desde la Campaign 11 | [10.83263/7myc-5j86](https://doi.org/10.83263/7myc-5j86) |
| `MR079G_isokinetic_muscle/MR079G_CFT70/` | MR079G, Isokinetic Muscle Function (**solo el estudio CFT70**) | Torque máximo, trabajo total e isométrico de rodilla, tobillo y tronco, en N·m (ver sección "Fuente de datos de músculo") | Dinamómetro isocinético Biodex | [10.83263/bk5h-r757](https://doi.org/10.83263/bk5h-r757) |
| `MR080G_aerobic_capacity/` | MR080G, Aerobic Capacity | VO₂pico, frecuencia cardíaca, presión arterial, VCO₂, RER, ventilación y esfuerzo percibido (Borg) por etapa de una prueba en cicloergómetro de 50 a 350 W | Cicloergómetro, analizador de gases (MGAS), ECG | [10.83263/w056-8t76](https://doi.org/10.83263/w056-8t76) |
| `MR001G_tilt_orthostatic/` | MR001G, Neuroendocrine and Cardiovascular Response to Tilt | Frecuencia cardíaca, presión, volumen sistólico, gasto cardíaco y resistencia periférica minuto a minuto, acostado y luego inclinado a 80° durante 30 min; tiempo tolerado de pie; hormonas en sangre (noradrenalina, adrenalina, renina, aldosterona, angiotensina, vasopresina, ANP, ACTH) | Mesa basculante, Doppler/ecocardiografía, manguito de presión | [10.83263/gz1q-a824](https://doi.org/10.83263/gz1q-a824) |

| Carpeta | Archivos | Tamaño |
|---|---|---|
| MR035G | 1.063 | 4,1 MB |
| MR079G (solo CFT70) | 9 | 0,2 MB |
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

## Fuente de datos de músculo: CFT70

La web usa **un solo dataset de músculo: CFT70** (`MR079G_isokinetic_muscle/MR079G_CFT70/`). Las demás carpetas de MR079G (Campaigns 1, 3, 11 y 17, HDT30, MEDES y AG) se quitaron del repositorio el 14-11-2026. Siguen en el historial de git y en NLSP (DOI 10.83263/bk5h-r757).

**Por qué CFT70:** es el de más personas (42), con 70 días de reposo y grupos identificados (CONTROL 12, EXERCISE 21, FLY 9). Tiene dos mediciones antes y dos después (R+2–4 y R+10–13), y cubre 6 grupos musculares. Usa las mismas unidades (N·m), la misma máquina (Biodex) y el mismo set de pruebas que NASA aplica a los astronautas de la ISS (protocolo *Medical Volume B 5.3*, estudio Sprint). El 86 % de los pares antes/después está completo.

**Archivos:**

| Archivo | Contenido |
|---|---|
| `MR079G_CFT70_PRE1/PRE2/POST1/POST2_strength_ALL` | `Subject, Group, Test_Type, Angle, Value`: una fila por persona, prueba y velocidad |
| `MR079G_CFT70_Demographics_ALL` | Grupo, sexo, edad, altura, peso y día de reposo de cada medición (`Test`, `Iteration`, `BR_Day`) |
| `MR079G_CFT70_*_verifiers_ALL` | Control de calidad (quién verificó cada registro) |

**Métrica.** `Value` es el torque máximo en N·m: la mayor fuerza de giro en 3–5 repeticiones a velocidad fija. En las pruebas `KEE` y `KFE` es el trabajo total de 20 repeticiones a 180°/s (resistencia). `Angle` es la velocidad en °/s: 0 = isométrico.

**Códigos:**

| Código | Prueba | Grupo muscular |
|---|---|---|
| `KES` / `KFS` | Rodilla, extensión / flexión (concéntrica) | Cuádriceps / isquiotibiales |
| `KEE` / `KFE` | Rodilla, resistencia (trabajo total, 180°/s) | Cuádriceps / isquiotibiales |
| `APFCS` / `APFES` | Tobillo, flexión plantar concéntrica / excéntrica | Pantorrilla |
| `ADFCS` / `ADFES` | Tobillo, flexión dorsal concéntrica / excéntrica | Tibial anterior |
| `TES` / `TFS` | Tronco, extensión / flexión | Espalda / abdominales |

Las definiciones y unidades salen del archivo de referencia de parámetros de la Campaign 17, que usa los mismos códigos (Biodex, N·m).

**Cuidados:**
- 41 de las 42 personas son hombres.
- No hay mediciones durante el reposo.
- El grupo `FLY` no está descrito en los archivos. Probablemente es un grupo que entrenó con un equipo compacto de volante de inercia (*flywheel*); hay que confirmarlo en la ficha de NLSP antes de rotularlo.

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
