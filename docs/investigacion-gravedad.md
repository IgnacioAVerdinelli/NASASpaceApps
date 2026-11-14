# Investigación: degradación fisiológica por falta de gravedad

Este documento resume el trabajo de la rama `Feat/gravityEffectsInvestigation`: el enfoque elegido, las fuentes revisadas, los datos descargados, los hallazgos y el prototipo.

**Desafío:** NASA Space Apps 2026, *Create Health Monitoring Software for Astronauts*. Se pide una herramienta visual para que los astronautas evalúen su propio estado de salud durante la misión y reciban orientación sobre tratamientos y mejoras.

**Enfoque elegido:** el peligro **Campos de gravedad** (*Gravity Fields*) del programa NASA HRP. La herramienta muestra cómo cambia el cuerpo del astronauta en misiones largas, a partir de sus propias mediciones, y lo compara con datos históricos de estudios reales.

---

## 1. Contenido de la rama

| Ruta | Qué es | Estado |
|---|---|---|
| `data/nlsp/` | Datos abiertos de reposo en cama del NASA Life Sciences Portal: 4 experimentos, 3.107 archivos, ~27 MB | Sin commit |
| `data/nlsp/README.md` | Descripción de los datasets, sus estudios, formato y DOI | Sin commit |
| `prototype/index.html` | Prototipo descartable "GravTrack" (HTML + Chart.js) **con datos falsos** | En stage, sin commit |
| `docs/investigacion-gravedad.md` | Este documento | Sin commit |

Fuera del repositorio, en `D:\Tomas\NasaSpaceApps\.nlsp-staging\`, quedaron los zips originales de NLSP, los informes en Excel del Space Station Research Explorer y los PDF de NASA usados como referencia (OCHMO-STD-100.1A, OCHMO-TB-031, Standard Measures).

---

## 2. El peligro: campos de gravedad

Según la [página del peligro en NASA HRP](https://www.nasa.gov/hrp/hazard-gravity-fields/), una misión a Marte pasa por tres cambios de gravedad: unos 6 meses de ingravidez durante el viaje, un tercio de la gravedad terrestre en Marte y la vuelta a 1 g.

| Efecto | Qué ocurre | Dato clave |
|---|---|---|
| Hueso | Pérdida de densidad mineral en los huesos que cargan peso | **1 % a 1,5 % por mes** |
| Músculo | Atrofia de los músculos posturales (pantorrilla y muslo) y pérdida de fuerza | Sóleo −5,8 %, gastrocnemio −4,0 % en ~180 días, aun con ejercicio |
| Capacidad aeróbica | Cae el VO₂pico | Una caída ≥20 % empeora el rendimiento en tareas críticas |
| Sensoriomotor | Problemas de orientación, coordinación, equilibrio y marcha, y mareo espacial | — |
| Transiciones y aterrizaje | Mareo y desmayo al ponerse de pie al volver a la gravedad (intolerancia ortostática) | — |
| Fluidos | Los líquidos suben hacia la cabeza y presionan los ojos (SANS) | — |
| Riñón | Deshidratación y más calcio en la orina, con riesgo de cálculos | — |

---

## 3. Fuentes revisadas

| Sitio | Qué tiene | Utilidad |
|---|---|---|
| [NASA Life Sciences Portal (NLSP)](https://www.nasa.gov/hrp/nlsp/) | Acceso al LSDA, al LSAH, a las Standard Measures y a datasets abiertos de reposo en cama | **Fuente principal de datos** (sección 4) |
| [NLSP – LSAH](https://nlsp.nasa.gov/resources/lsah) | Vigilancia médica de por vida de los astronautas | Datos médicos protegidos; se piden por solicitud. No sirve para el hackathon |
| [Space Station Research Explorer](https://www.nasa.gov/mission/station/research-explorer/) | Catálogo de experimentos de la ISS con informes descargables en Excel | No tiene datos crudos. Sirve para justificar: de **374 experimentos humanos, unos 140 tratan efectos de la gravedad** (Hip QCT, TBone, Sarcolab, VO2max, Integrated Cardiovascular, Fluid Shifts, Field Test, etc.). El informe de publicaciones tiene ~8.300 citas |
| [NASA HRP](https://www.nasa.gov/hrp/) | Índice de recursos (NLSP, OSDR, LSAH, riesgos) | Solo enlaces |

**Datos restringidos** (solo por solicitud, no se usaron): las Bed Rest Standard Measures de la Campaign 11 (BRSMiDXA, BRSMPV, BRSMQCT), los datos de vuelo del LSDA y las Standard Measures de la ISS.

**Limitación central:** no hay series públicas de mediciones de astronautas tomadas **en vuelo**. Los datos abiertos son de **reposo en cama**, el análogo en Tierra que usa NASA. Por eso la herramienta compara al astronauta con esos estudios y con los valores de vuelo publicados.

---

## 4. Datos descargados (`data/nlsp/`)

### Qué es un estudio de reposo en cama

Voluntarios sanos pasan entre 14 y 90 días acostados con la cabeza inclinada 6° hacia abajo (*head-down tilt bed rest*). Así se quita la carga de la gravedad sobre hueso, músculo y sistema cardiovascular, como pasa en la ingravidez. **Es un análogo, no un vuelo real**, y la herramienta tiene que indicarlo.

### Experimentos

Los cuatro experimentos son de acceso abierto en NLSP (*"All datasets are publicly available"*). Se descargaron completos y la cantidad de archivos de cada uno coincide con la que publica el portal.

| Carpeta | Experimento | Mide | Archivos | DOI |
|---|---|---|---|---|
| `MR035G_bone_densitometry/` | Bone Densitometry Assessment | Densidad mineral ósea por DXA (cadera, cuello femoral, columna lumbar, talón, antebrazo, cuerpo entero), T-score y Z-score, masa magra y grasa por segmento | 1.063 | [10.83263/7myc-5j86](https://doi.org/10.83263/7myc-5j86) |
| `MR079G_isokinetic_muscle/` | Isokinetic Muscle Function | Fuerza concéntrica y excéntrica y resistencia de rodilla y tobillo (60°/s y 180°/s) | 400 | [10.83263/bk5h-r757](https://doi.org/10.83263/bk5h-r757) |
| `MR080G_aerobic_capacity/` | Aerobic Capacity | VO₂pico, frecuencia cardíaca, presión, VCO₂, RER, ventilación y Borg por etapa en cicloergómetro (50–350 W) | 1.505 | [10.83263/w056-8t76](https://doi.org/10.83263/w056-8t76) |
| `MR001G_tilt_orthostatic/` | Neuroendocrine and Cardiovascular Response to Tilt | Frecuencia cardíaca, presión, volumen sistólico, gasto cardíaco y resistencia periférica minuto a minuto, acostado y luego a 80°; hormonas (noradrenalina, adrenalina, renina, aldosterona, angiotensina, vasopresina, ANP, ACTH) | 139 | [10.83263/gz1q-a824](https://doi.org/10.83263/gz1q-a824) |

### Estudios incluidos

| Estudio | Diseño |
|---|---|
| UTMB Campaign 1 | 60 días, 3 hombres |
| UTMB Campaign 3 | 60 o 90 días; 23 sujetos (14 hombres, 9 mujeres); seguimiento por DXA a 6 y 12 meses |
| UTMB Campaign 5 | 90 días |
| UTMB Campaign 11 / CFT70 | 70 días; grupo **control** frente a **ejercicio integrado (iRAT)** |
| Campaign 17 | 14 días |
| HDT30 | 30 días |
| MEDES (WISE) | Solo mujeres (Toulouse), con ejercicio y nutrición como contramedidas |
| AG Pilot | 21 días; **1 h diaria de centrífuga (gravedad artificial)** frente a control |

Con estos grupos se puede comparar por **duración** (14 a 90 días), por **contramedida** (ninguna, ejercicio o gravedad artificial) y por **sexo**.

### Formato

- Son tablas CSV, y **muchas no tienen extensión `.csv`**.
- Columnas comunes: `SUBJECT`, `TEST_PHASE` (PRE/POST), `BR_DAY` (día relativo al reposo) y `SCAN_DATE` o `Date`. Con ellas se calcula el % de cambio de cada sujeto respecto de su valor previo.
- Algunos archivos empiezan con BOM: hay que leerlos con `encoding='utf-8-sig'`.
- Unidades: densidad ósea en g/cm², fuerza en ft-lb, VO₂ en L/min y ml/kg/min.
- **Cuidado:** el escáner DXA de la Campaign 3 falló entre el 9-6-2006 y el 10-8-2006. Esos valores ya vienen corregidos (BMD ×1,0120); ver `MR035G_Campaign_3_DXA_ReadMe/`.
- Los grupos son chicos (3 a 12 sujetos), así que las comparaciones son descriptivas.

El detalle completo está en [`data/nlsp/README.md`](../data/nlsp/README.md).

### Datos complementarios (otro repositorio)

El repositorio `space-apps-2026-astronaut-health` tiene en `data/inspiration4/` datos de **Inspiration4**: hemograma (OSD-569) y panel metabólico (OSD-575), con calcio, fosfatasa alcalina, creatinina, BUN, hematocrito y hemoglobina, antes y después del vuelo. La misión duró solo 3 días y no hay muestras en vuelo, así que sirven para ver cambios de fluidos y como rangos de referencia, **no como evidencia de pérdida ósea**.

---

## 5. Hallazgos

### 5.1 Ejemplos tomados de los datos descargados

- **Hueso (Campaign 1, talón):** el sujeto C1G0001 pasa de 0,561 a 0,543 g/cm² tras 60 días (**−3,2 %**) y 7 meses después vuelve a 0,549.
- **Músculo (Campaign 11, grupo control):** la fuerza de extensión de rodilla cae de 179 a 131 ft-lb tras 70 días (**−27 %**).

### 5.2 Resultados publicados (sirven para validar)

| Sistema | Resultado | Fuente |
|---|---|---|
| Hueso (reposo en cama) | ~**1 %/mes** de pérdida en cadera, pelvis y talón; recuperación comparable a la de después del vuelo | Ficha MR035G; Spector, Smith y Sibonga, *Aviat Space Environ Med* 2009 |
| Hueso (vuelo) | **1–1,5 %/mes** | NASA HRP, Gravity Fields; Human Research Roadmap, *Fracture* |
| Aeróbico | VO₂pico **−12 % en el control frente a −6 % con gravedad artificial** (AG Pilot) | Ficha MR080G |
| Aeróbico (ISS) | Una caída **≥20 %** del VO₂ es una pérdida de rendimiento; **12–21 % de la tripulación** cae por debajo en algún momento. Mínimo en misión: **32,9 ml/kg/min**. Se recupera en unos **30 días** | OCHMO-TB-031 |
| Músculo (ISS) | Sóleo **−5,8 %**, gastrocnemio **−4,0 %** en ~180 días con ejercicio | OCHMO-TB-031 |
| Cardiovascular | La gravedad artificial atenúa la intolerancia ortostática | Stenger y col., *Eur J Appl Physiol* 2012 |
| Volumen plasmático | Pérdida de ~10–15 % | Literatura de vuelo (dato BRSMPV restringido) |

### 5.3 Qué se puede medir, con qué y cómo se hace hoy

| Sistema | Medición | Instrumento | Cómo se hace hoy en la ISS | Dataset abierto |
|---|---|---|---|---|
| **Hueso** | Densidad mineral ósea, T-score y Z-score | DXA; QCT y HR-pQCT | **No hay DXA a bordo**; se mide antes y después del vuelo | MR035G |
| Hueso | Marcadores de recambio (calcio y N-telopéptido en orina, fosfatasa alcalina) | Sangre y orina de 24 h | Muestras en vuelo congeladas en MELFI y analizadas en Tierra | Inspiration4 OSD-575 |
| **Músculo** | Fuerza isocinética de rodilla y tobillo | Dinamómetro (Biodex); MARES (ESA) en vuelo | Antes y después del vuelo; en vuelo, fuerza en ARED | MR079G |
| Músculo | Masa magra por segmento | DXA de cuerpo entero, ecografía, RM | **Ecografía en vuelo** guiada desde Tierra | MR035G |
| Músculo | Masa corporal | SLAMMD (mide la masa por aceleración) | Periódica en vuelo | — |
| **Aeróbico** | VO₂pico, frecuencia cardíaca en ejercicio | Cicloergómetro + analizador de gases | **CEVIS + PFS** en vuelo | MR080G |
| **Cardiovascular** | Tolerancia ortostática | Mesa basculante, Finapres, ECG | **Después del aterrizaje** (CCISS, Field Test) | MR001G |
| Cardiovascular | Estructura y función del corazón, rigidez arterial | Ecocardiografía, ecografía vascular | Ecógrafo de la ISS con guía remota | Solo publicaciones |
| **Fluidos / SANS** | Grosor de retina, edema del disco óptico | OCT, fondo de ojo, tonómetro | **OCT y fondo de ojo a bordo** | — |
| Fluidos | Desplazamiento de fluidos, presión intracraneal | Ecografía yugular, sensores no invasivos | Ecografía en vuelo; manguitos de muslo y LBNP como contramedidas | Solo publicaciones |
| **Sensoriomotor** | Equilibrio, marcha, tiempo para levantarse | Posturografía, Field Test, Functional Task Test | Inmediatamente después del aterrizaje | — |
| **Riñón** | Riesgo de cálculos | Orina de 24 h | Recolección en vuelo (Renal Stone) | Inspiration4 OSD-575 |

Hoy se mide de tres formas:

1. **Antes y después del vuelo, en Tierra:** DXA, QCT, RM, fuerza, prueba de inclinación y Field Test. Es la mayor parte de los datos de hueso y músculo.
2. **En vuelo, con equipos compactos:** ecógrafo, OCT, CEVIS + PFS, SLAMMD, ECG/Holter y wearables (Bio-Monitor/Astroskin). La sangre y la orina se congelan.
3. **Análogos en Tierra (reposo en cama):** mediciones frecuentes con grupos con y sin contramedidas. De acá salen los datos abiertos.

### 5.4 Rutina documentada de mediciones

Sí existe, en tres fuentes oficiales:

1. **[OCHMO-STD-100.1A](https://www.nasa.gov/wp-content/uploads/2023/04/ochmo-std-100.1a.pdf), Tabla 8:** calendario médico clínico de ejemplo para una misión de 180 días en la ISS (*"for example only"*).
2. **Spaceflight Standard Measures:** protocolo de investigación con 6 momentos de medición: L-180, L-90, FD30, R-30, R+10/15 y R+30.
3. **[OCHMO-TB-031](https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/):** prescripción de ejercicio y resultados medidos en 46 astronautas.

Notación: L = lanzamiento, R = regreso, FD = día de vuelo, d = días, m = meses.

| Medición | Antes del vuelo | En vuelo | Después del vuelo |
|---|---|---|---|
| Densidad ósea (DXA) | L-21/18 m, L-180/30 d | ❌ No hay DXA | R+<30 d, después hasta recuperar |
| Fuerza | — | L+14 d, después al menos cada 30 d | — |
| VO₂pico | L-12 m, L-90/30 d | FD14, FD75, FD165, FD255, R-14 | R+5, R+30 |
| Masa corporal | — | L+7 d, después mensual | — |
| Examen ocular (OCT, fondo de ojo) | L-21/18 m, L-9/6 m | L+30, L+90, L+180, L+270, R-30 | R+1/3 d |
| Ecografía de trombosis venosa | L-12/3 m | L+30, L+60, R-42 | R+0/45 |
| Sangre y orina | L-90/30 d | L+180 (y ante síntomas) | R+0/1, R+3/7, R+14/30 |
| Tolerancia ortostática | — | — | R+0, después diaria hasta estabilizarse |
| Equilibrio y vestíbulo | L-9/6 m, L-90/30 d | — | R+7/10 |
| Prueba funcional física | L-9/6 m, L-90/30 d | — | R+5/7, R+30 |
| Sueño (actígrafo) | 2 semanas de base | Continuo | Hasta R+7 |
| Conferencia médica privada | — | Semanal (diaria los últimos 5 días) | — |
| Cuestionario de dieta | — | Semanal | — |

**Contramedida diaria:** unos **600 min de ejercicio por semana** (~2,5 h/día, 6 días/semana). Incluye aeróbico en CEVIS o T2 al 70–100 % del VO₂pico o de la frecuencia cardíaca máxima, y fuerza en ARED (sentadilla, peso muerto, elevación de talones).

---

## 6. Propuesta de herramienta

### 6.1 Métodos de entrada

La herramienta sigue el calendario de NASA: le pide al astronauta cada medición en su fecha y la compara con los datos históricos de la misma variable.

| Método | Datos | Frecuencia | Comparación histórica |
|---|---|---|---|
| 1. Línea base antes del vuelo | DXA, VO₂pico, fuerza isocinética, prueba de inclinación | Una vez | Es el 100 % contra el que se calcula el cambio (MR035G, MR080G, MR079G, MR001G) |
| 2. Pruebas guiadas en la app | Prueba aeróbica en CEVIS; evaluación de fuerza | FD14/75/165/255; cada 30 d | MR080G (mismas columnas: `Watts`, `HR bpm`, `VO2 ml/kg/min`, `RPE`); MR079G |
| 3. Importación desde equipos de ejercicio | Sesiones de CEVIS, T2 y ARED | Diaria | Prescripción de 600 min/semana; grupos control y ejercicio de la Campaign 11 |
| 4. Wearables | Frecuencia cardíaca, HRV, presión, SpO₂, actividad, sueño | Continuo | Valores en reposo de MR001G; base previa al vuelo |
| 5. Entrada manual | Masa (SLAMMD), síntomas, Borg, dieta | Masa mensual; síntomas y dieta semanal | Masa magra de MR035G; Borg de MR080G |
| 6. Carga de exámenes | Informes de OCT, ecografía, laboratorio | Según la Tabla 8 | Rangos de Inspiration4 y umbrales clínicos |
| 7. Estimación por modelo | Densidad ósea proyectada (no hay DXA a bordo) | Con cada dato nuevo | Pendiente de MR035G (~1 %/mes), ajustada por adherencia al ejercicio |

### 6.2 Cómo mostrar la progresión frente a lo histórico

1. **Métrica común:** % de cambio respecto de la línea base previa al vuelo, contra días en microgravedad.
2. **Bandas históricas** detrás de la línea del astronauta:
   - sin contramedida (grupos control de reposo en cama);
   - con ejercicio (Campaign 11 iRAT);
   - con gravedad artificial (AG Pilot);
   - solo mujeres (MEDES);
   - referencia de vuelo real (ISS).
3. **Semáforo por sistema:**
   - **Verde:** dentro de la banda con ejercicio o mejor.
   - **Amarillo:** se acerca a la banda control.
   - **Rojo:** cruza un umbral de NASA (por ejemplo, VO₂ −20 % o menos de 32,9 ml/kg/min).
4. **Orientación según el resultado.** Se presenta como orientación basada en protocolos publicados, no como prescripción médica:
   - VO₂ en baja: más intervalos en CEVIS o T2.
   - Fuerza u hueso en baja: más carga en ARED.
   - Masa en baja: revisar la ingesta.
   - Síntomas oculares: adelantar el OCT.
5. **Regreso a la gravedad:** riesgo de mareo al ponerse de pie (con MR001G) y recuperación esperada (VO₂ en ~30 días; hueso con el seguimiento a 6 y 12 meses de MR035G).

### 6.3 Supuestos y limitaciones

- Se toma **un día de reposo en cama como equivalente a un día de vuelo**. NASA usa el análogo así, pero hay que indicarlo en la herramienta.
- **No hay datos para 0,38 g** (Marte): esa parte de cualquier proyección es un supuesto del modelo.
- Los grupos son chicos y las comparaciones son descriptivas.

---

## 7. Prototipo `prototype/index.html` (GravTrack)

Es un prototipo **descartable** para validar la idea. Es un único HTML con Chart.js 4.4.1 desde cdnjs, así que necesita internet. Se abre con doble clic. **Todos los datos del astronauta son falsos** (tripulante CM-2, misión de 180 días, hoy FD112).

| Pestaña | Qué muestra |
|---|---|
| Resumen | Línea de tiempo de la misión, semáforo por sistema (hueso, aeróbico, fuerza, masa, ojo, ortostatismo, sueño) marcado como *medido* o *estimado*, minutos de ejercicio semanales contra 600 y las 3 recomendaciones principales |
| Progresión vs. histórico | Línea del astronauta sobre bandas que se pueden prender y apagar (control, ejercicio, AG, ISS, mujeres), con umbrales de NASA y proyección a FD180 |
| Cargar datos | Los 7 métodos de entrada; varios son interactivos y actualizan gráficos y alertas |
| Calendario | Tabla 8 de OCHMO-STD-100.1A con lo hecho y lo próximo según FD112 |
| Orientación | Recomendaciones calculadas según el estado de cada sistema, con su fuente |
| Regreso a la gravedad | Frecuencia cardíaca en la prueba de inclinación (antes, predicción R+0, historial MR001G) y curva de recuperación |
| Fuentes y supuestos | Datasets con DOI y advertencias |

**Importante:** las bandas históricas del prototipo son **aproximaciones a mano** de los valores publicados. Todavía no se calculan desde los CSV de `data/nlsp/`.

---

## 8. Próximos pasos

1. Procesar los CSV de `data/nlsp/` para calcular las bandas históricas reales (% de cambio por variable, día y grupo).
2. Decidir si `data/nlsp/` (~27 MB) se versiona en git o se descarga con un script.
3. Pasar del prototipo a la aplicación real con esas bandas.

---

## 9. Referencias

**Datos**
- NASA Life Sciences Data Archive / NASA Life Sciences Portal, https://nlsp.nasa.gov:
  - MR035G: [10.83263/7myc-5j86](https://doi.org/10.83263/7myc-5j86)
  - MR079G: [10.83263/bk5h-r757](https://doi.org/10.83263/bk5h-r757)
  - MR080G: [10.83263/w056-8t76](https://doi.org/10.83263/w056-8t76)
  - MR001G: [10.83263/gz1q-a824](https://doi.org/10.83263/gz1q-a824)
- Fichas de estudios en NLSP: [UTMB Campaign 1](https://nlsp.nasa.gov/explore/data/details/6eaf1654-72d4-5d71-a9dd-a02e674c6473?dataType=MISSIONS), [UTMB Campaign 3](https://nlsp.nasa.gov/explore/data/details/593a6726-8650-551a-8d67-0f03468de92f?dataType=MISSIONS), [UTMB Campaign 11](https://nlsp.nasa.gov/explore/data/details/8e583564-d124-58ce-b44a-a16bb5b5d981?dataType=MISSIONS)
- [Space Station Research Explorer](https://www.nasa.gov/mission/station/research-explorer/) e [informe de experimentos (xlsx)](https://www.nasa.gov/mission_pages/station/research/experiments/explorer/All_Experiments_Report.xlsx)

**Protocolos y estándares**
- [OCHMO-STD-100.1A, NASA Astronaut Medical Standards (Tabla 8)](https://www.nasa.gov/wp-content/uploads/2023/04/ochmo-std-100.1a.pdf)
- [OCHMO-TB-031, Exercise Overview](https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/)
- [Spaceflight Standard Measures, NTRS 20200001281](https://ntrs.nasa.gov/api/citations/20200001281/downloads/20200001281.pdf?attachment=true)
- [Standard Measures During Spaceflight, NTRS 20230014025](https://ntrs.nasa.gov/citations/20230014025)
- [Spaceflight Standard Measures, npj Microgravity 2025](https://www.nature.com/articles/s41526-025-00532-6)
- [NASA – Standard Measures](https://www.nasa.gov/reference/standard-measures/)

**Contexto**
- [NASA HRP – Hazard: Gravity Fields](https://www.nasa.gov/hrp/hazard-gravity-fields/)
- [NASA HRP](https://www.nasa.gov/hrp/) y [NLSP](https://www.nasa.gov/hrp/nlsp/)
- [NASA – What are bedrest studies?](https://www.nasa.gov/hrp/bedrest-faqs/)
- [Human Research Roadmap – Fracture (PDF)](https://humanresearchroadmap.nasa.gov/Evidence/reports/Fracture.pdf)
- [NASA HRP IWS 2026 – Tidy Data Presentation](https://ntrs.nasa.gov/api/citations/20260002548/downloads/IWS_Tidy_Data_Presentation_Update.pdf)
- Spector ER, Smith SM, Sibonga JD. *Aviat Space Environ Med* 2009; 80(5 Suppl):A23-8.
- Stenger MB y col. *Eur J Appl Physiol* 2012; 112(2):605-16.
