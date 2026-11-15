# Investigación: degradación fisiológica por falta de gravedad

Este documento resume el trabajo de la rama `Feat/gravityEffectsInvestigation`: el enfoque elegido, las fuentes revisadas, los datos descargados, los hallazgos y el prototipo.

**Desafío:** NASA Space Apps 2026, *Create Health Monitoring Software for Astronauts*. Se pide una herramienta visual para que los astronautas evalúen su propio estado de salud durante la misión y reciban orientación sobre tratamientos y mejoras.

**Enfoque elegido:** el peligro **Campos de gravedad** (*Gravity Fields*) del programa NASA HRP. La herramienta muestra cómo cambia el cuerpo del astronauta en misiones largas, a partir de sus propias mediciones, y lo compara con datos históricos de estudios reales.

---

## 1. Contenido de la rama

| Ruta | Qué es | Estado |
|---|---|---|
| `data/nlsp/` | Datos abiertos de reposo en cama del NASA Life Sciences Portal: 4 experimentos (de MR079G solo CFT70), 2.716 archivos, ~13 MB | En commit; carpetas no-CFT70 de MR079G quitadas sin commit |
| `data/nlsp/README.md` | Descripción de los datasets, sus estudios, formato y DOI | Sin commit |
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
| `MR079G_isokinetic_muscle/MR079G_CFT70/` (solo CFT70; las demás carpetas se quitaron) | Isokinetic Muscle Function | Torque máximo, resistencia e isométrico de rodilla, tobillo y tronco (N·m), grupos control / ejercicio / FLY | 9 (de 400) | [10.83263/bk5h-r757](https://doi.org/10.83263/bk5h-r757) |
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

#### Mediciones antes y después del vuelo (en Tierra)

Las mediciones previas al vuelo son la **línea base**: todo cambio se calcula contra ellas. Las posteriores muestran **cuánto se perdió y cuánto tarda en recuperarse**.

| Medición | Antes del vuelo | Después del vuelo |
|---|---|---|
| Densidad ósea (DXA) | L-21/18 m y L-180/30 d | R+<30 d, luego seguimiento hasta recuperar |
| Capacidad aeróbica (VO₂pico) | L-12 m, L-90/30 d | R+5, R+30 |
| Examen ocular especializado (OCT, fondo de ojo) | L-21/18 m, L-9/6 m | R+1/3 d |
| Ecografía de trombosis venosa | L-12/3 m | R+0/45 |
| Análisis de sangre y orina | L-90/30 d | R+0/1, R+3/7, R+14/30 |
| Tolerancia ortostática (prueba de pie) | — | R+0, luego diario hasta estabilizarse |
| Equilibrio y vestíbulo | L-9/6 m, L-90/30 d | R+7/10 |
| Prueba funcional física | L-9/6 m, L-90/30 d | R+5/7, R+30 |
| Sueño (actígrafo) | 2 semanas de base | Hasta R+7 |
| Standard Measures (investigación) | L-180, L-90 | R+10/15, R+30 |

#### Mediciones durante el vuelo (a bordo)

Son las que la herramienta puede seguir **en tiempo real** durante la misión.

| Medición | Frecuencia en vuelo |
|---|---|
| Fuerza (strength & conditioning) | L+14 d y luego al menos cada 30 días |
| Capacidad aeróbica | FD14, FD75, FD165, FD255, R-14 |
| Masa corporal | L+7 d y luego mensual |
| Examen ocular (OCT, fondo de ojo) | L+30, L+90, L+180, L+270, R-30 |
| Ecografía de trombosis venosa | L+30, L+60, R-42 |
| Análisis de sangre y orina | L+180 (y ante síntomas) |
| Sueño (actígrafo) | Continuo |
| Evaluación de salud por el médico de a bordo | L+14/21, L+90, L+180, L+270, R-21/14 |
| Conferencia médica privada | Semanal (diaria los últimos 5 días) |
| Cuestionario de dieta | Semanal |
| Standard Measures (investigación) | FD30 y R-30 |

**En vuelo no se miden** la densidad ósea, porque no hay DXA a bordo, ni la tolerancia ortostática, el equilibrio o la prueba funcional, que solo tienen sentido con gravedad. Por eso la herramienta tiene que **estimar** esos valores durante el vuelo.

**Contramedida diaria:** unos **600 min de ejercicio por semana** (~2,5 h/día, 6 días/semana). Incluye aeróbico en CEVIS o T2 al 70–100 % del VO₂pico o de la frecuencia cardíaca máxima, y fuerza en ARED (sentadilla, peso muerto, elevación de talones).

### 5.5 Cada medición: método, cómo funciona y qué le hace el espacio

#### 1. Densidad ósea (DXA)
- **Método:** absorciometría de rayos X de doble energía (DXA), en cadera, columna, talón, antebrazo y cuerpo entero.
- **Cómo funciona:** el equipo emite rayos X con dos energías distintas. El hueso y el tejido blando los atenúan de forma diferente, y con esa diferencia se separa la masa mineral del resto. El resultado es la densidad mineral ósea en g/cm². Dos índices la comparan:
  - **T-score**, contra un adulto joven;
  - **Z-score**, contra personas de la misma edad.
- **Detalle técnico:**
  - **Principio físico (ley de Beer-Lambert):** la intensidad que atraviesa el cuerpo es I = I₀·e^(−μ·m), donde μ es el coeficiente de atenuación del tejido y m su masa por unidad de área. Con una sola energía hay dos incógnitas (hueso y tejido blando) y una sola ecuación. Con **dos energías** hay dos ecuaciones y se pueden despejar las dos masas. Hologic alterna el voltaje del tubo (~100/140 kVp); GE Lunar filtra el haz para obtener picos de ~40 y ~70 keV.
  - **Calibración por píxel:** los píxeles sin hueso dan la relación de atenuación del tejido blando de ese sujeto. Con ella se resta el tejido blando en los píxeles con hueso.
  - **Resultado:** contenido mineral óseo (BMC, en g) dividido por el área proyectada da la **densidad areal** (aBMD, g/cm²). Es una densidad **2D**: no separa hueso cortical de trabecular ni corrige por el tamaño del hueso. Por eso los estudios de vuelo agregan **QCT**, una tomografía que da densidad volumétrica (g/cm³) separando cortical y trabecular.
  - **Índices clínicos:** T-score = (BMD − media de adulto joven) / desvío estándar. Se considera osteopenia entre −1 y −2,5, y osteoporosis desde ≤ −2,5. El Z-score usa la media de la misma edad y sexo.
  - **Dosis y precisión:** la dosis es muy baja (unos pocos µSv, menos que un día de radiación natural). La precisión de medidas repetidas es de ~1–2 %. Una pérdida de 1–1,5 %/mes **queda dentro del error de medición durante los primeros meses**, así que una sola DXA no detecta cambios cortos. La herramienta tiene que trabajar con tendencias y modelos.
  - **Mecanismo biológico:** la carga mecánica mueve el fluido dentro de los canalículos del hueso, y los **osteocitos** detectan ese flujo. Sin carga:
    - aumenta la **esclerostina**, que bloquea la vía Wnt y frena la formación ósea (osteoblastos);
    - sube la relación **RANKL/OPG**, que activa a los osteoclastos.
  - **Datos de vuelo con QCT:** el hueso trabecular de la cadera pierde más que el promedio que mide la DXA, del orden de 2–2,5 %/mes (Lang y col., 2004).
- **Qué hace el espacio:** sin peso, el hueso deja de recibir carga mecánica. Las células que la detectan (osteocitos) reaccionan, y aumenta la **resorción**, es decir, la destrucción de hueso, mientras la formación no aumenta. Se pierde **1–1,5 % por mes** en cadera y columna, sobre todo en hueso trabecular. El calcio liberado se elimina por la orina.
- **Efecto en la salud:** mayor riesgo de **fractura**, por ejemplo al aterrizar o al trabajar en Marte, y osteoporosis temprana. La recuperación tarda meses o años y a veces no es completa. El calcio en la orina aumenta el riesgo de **cálculos renales**.

#### 2. Fuerza muscular
- **Método:**
  - En Tierra, **dinamómetro isocinético** (Biodex).
  - En vuelo, cargas en **ARED**, el equipo de pesas con cilindros de vacío.
- **Cómo funciona:** el dinamómetro mantiene la articulación a una velocidad angular constante, por ejemplo 60°/s o 180°/s, y mide el **torque máximo** que genera el músculo en extensión y flexión de rodilla y tobillo.
- **Detalle técnico:**
  - **Dinamómetro isocinético:** un servomotor fija la velocidad angular. Si la persona empuja más, la máquina no acelera: aumenta la resistencia. Así el músculo trabaja al máximo en todo el rango de movimiento.
  - **Medición:** un sensor de deformación (galga extensiométrica) en el brazo de palanca mide el **torque** (τ = F × r, en N·m o ft-lb; 1 ft-lb = 1,356 N·m). El software corrige el peso del propio miembro.
  - **Variables:**
    - **torque pico**;
    - ángulo en que aparece;
    - trabajo total (J);
    - potencia (W);
    - índice de fatiga, por ejemplo la caída del trabajo entre las primeras y las últimas repeticiones de una serie larga a 180°/s.
  - **Modos:** el **concéntrico** mide el músculo al acortarse y el **excéntrico** al alargarse, como al frenar una caída. MR079G incluye los dos.
  - **ARED (en vuelo):** cilindros de vacío dan una resistencia de hasta ~270 kg (600 lb), y unos volantes de inercia simulan la masa de una barra. La "evaluación de fuerza" en vuelo se basa en las cargas y repeticiones que el astronauta logra, no en un torque isocinético. **MARES** (ESA) es un dinamómetro que se usó en la ISS para investigación.
  - **Mecanismo biológico:**
    - sin carga cae la señalización anabólica (vía mTOR);
    - se activan las enzimas de degradación de proteínas (MuRF1 y atrogina-1, sistema ubiquitina-proteasoma);
    - disminuye el área de las fibras, sobre todo las lentas (tipo I) de los músculos posturales.
  - **Fuerza frente a masa:** la fuerza cae **más que la masa**, porque también se pierde activación neural.
- **Qué hace el espacio:** los músculos antigravitatorios (sóleo, gastrocnemio, cuádriceps y los de la columna) ya no sostienen el cuerpo. Baja la síntesis de proteínas y aparece **atrofia**. Aun con ejercicio, el sóleo pierde ~5,8 % y el gastrocnemio ~4 %. Sin ejercicio, en reposo en cama, la fuerza de rodilla cayó **27 %** en 70 días (Campaign 11).
- **Efecto en la salud:** menos capacidad para tareas exigentes como caminatas espaciales (EVA), salida de emergencia de la nave o trabajo en superficie. También aumenta el riesgo de caídas y lesiones al volver a la gravedad.

#### 3. Capacidad aeróbica (VO₂pico)
- **Método:** prueba en cicloergómetro con carga creciente. A bordo se hace en el **CEVIS**: se registra la frecuencia cardíaca por etapa y, con el **PFS**, se miden los gases respirados.
- **Cómo funciona:** se mide el O₂ consumido en cada respiración. El VO₂pico es el máximo alcanzado y depende de cuánta sangre bombea el corazón y de cuánto oxígeno extraen los músculos. Cuando no se miden gases, se estima por la relación entre frecuencia cardíaca y carga.
- **Detalle técnico:**
  - **Ecuación de Fick:** VO₂ = Q × (CaO₂ − CvO₂). El gasto cardíaco Q = FC × volumen sistólico es el componente **central**. La diferencia arteriovenosa de O₂, que indica cuánto extrae el músculo, es el componente **periférico**.
  - **Medición directa (calorimetría indirecta respiración a respiración):**
    - un flujómetro mide la ventilación;
    - analizadores de gases miden las fracciones de O₂ y CO₂;
    - VO₂ = V̇ᵢ·FᵢO₂ − V̇ₑ·FₑO₂, donde el volumen inspirado se obtiene del espirado con la **transformación de Haldane**, asumiendo que el N₂ no se consume.
    - El **PFS** de la ISS usa un analizador fotoacústico de gases.
  - **Criterios de esfuerzo máximo:**
    - meseta del VO₂ pese a más carga;
    - **RER** (VCO₂/VO₂) > 1,1;
    - frecuencia cardíaca cercana a la máxima;
    - Borg ≥ 17.
  - **Protocolo:** cicloergómetro con aumentos de carga por etapa. MR080G va de 50 a 350 W. En el CEVIS la carga es independiente de la cadencia.
  - **Estimación submáxima:** cuando no se miden gases, se usa la relación casi lineal entre frecuencia cardíaca y VO₂ por debajo del máximo y se extrapola a la FC máxima. Es menos precisa y en vuelo se altera, porque cambia la FC para una misma carga.
  - **Mecanismo:** el volumen sistólico cae por menos plasma y menos llenado, lo que reduce el gasto cardíaco máximo; además disminuye la capacidad oxidativa del músculo.
  - **Datos de la ISS:** la mayor caída se ve en las primeras semanas de vuelo, del orden de ~15–17 %, con recuperación parcial gracias al ejercicio (Moore y col., 2014).
- **Qué hace el espacio:**
  - se pierde **10–15 % del volumen de plasma**;
  - el corazón se atrofia un poco y bombea menos sangre por latido;
  - el músculo pierde mitocondrias.
- **Efecto en la salud:**
  - Una caída **≥20 %** se asocia con peor rendimiento en tareas críticas; entre el 12 y el 21 % de la tripulación de la ISS la sufre en algún momento.
  - El mínimo operativo es **32,9 ml/kg/min**.
  - Se recupera en unos 30 días después de volver.

#### 4. Masa corporal
- **Método:** **SLAMMD**. En ingravidez una balanza no funciona.
- **Cómo funciona:** aplica la 2.ª ley de Newton (m = F/a). Unos resortes ejercen una fuerza conocida sobre el astronauta, el equipo mide la aceleración que produce y de ahí calcula la masa.
- **Detalle técnico:**
  - **SLAMMD (Space Linear Acceleration Mass Measurement Device):** dos resortes generan una fuerza conocida en función del desplazamiento y empujan al astronauta a lo largo de un riel de ~1 m. Un sensor óptico registra la posición en el tiempo; derivándola se obtiene la aceleración, y m = F/a.
  - **BMMD (equipo anterior):** era una silla oscilante con resortes. Medía el período de oscilación T = 2π·√(m/k), así que m = k·T²/(4π²).
  - **Condiciones de medición:** el astronauta debe mantenerse rígido. Los movimientos y los fluidos que se desplazan dentro del cuerpo agregan error, por lo que se promedian varias mediciones.
  - **Qué no mide:** no distingue músculo de grasa. Para la composición corporal hacen falta DXA (en Tierra) o ecografía muscular (en vuelo).
- **Qué hace el espacio:** suele haber un **déficit calórico** por menos apetito, alteración del gusto y mucha carga de trabajo. Se suma a la pérdida de músculo y hueso.
- **Efecto en la salud:** una pérdida de masa no planificada acelera la atrofia muscular y la pérdida ósea, y reduce el rendimiento. El **cuestionario semanal de dieta** sirve para corregirlo; vigila energía, proteína, vitamina D y sodio, ya que el exceso de sodio aumenta la pérdida ósea.

#### 5. Examen ocular: SANS
- **Método:**
  - **OCT** (tomografía de coherencia óptica);
  - fotografía de **fondo de ojo**;
  - **tonometría**, que mide la presión dentro del ojo;
  - **ecografía ocular**.
- **Cómo funciona:**
  - La OCT usa luz infrarroja de baja coherencia y mide cómo se refleja, como una "ecografía con luz". Así obtiene cortes de la retina y del nervio óptico con resolución de micrómetros.
  - La ecografía mide el diámetro de la vaina del nervio óptico, que indica la presión alrededor del cerebro.
- **Detalle técnico:**
  - **OCT de dominio espectral:** es un interferómetro de Michelson.
    - La fuente es un diodo superluminiscente de banda ancha en el infrarrojo cercano (~840–870 nm; el Spectralis usa 870 nm).
    - La luz reflejada por cada capa del ojo interfiere con la de un brazo de referencia.
    - La transformada de Fourier del espectro de interferencia da el perfil de reflectividad en profundidad (A-scan); varios A-scans forman un corte (B-scan).
    - La resolución axial depende del ancho de banda de la fuente: l_c ≈ (2 ln2/π)·λ₀²/Δλ, de unos 4–7 µm.
  - **Variables de OCT que se siguen en SANS:**
    - espesor de la capa de fibras nerviosas de la retina (RNFL);
    - espesor retiniano total;
    - **ancho mínimo del borde del nervio en la apertura de la membrana de Bruch (BMO-MRW)**, el marcador más sensible del edema del disco óptico;
    - espesor de la coroides;
    - pliegues coroideos y retinianos.
  - **Fondo de ojo:** el edema del disco óptico se gradúa con la escala de **Frisén** (0 a 5).
  - **Tonometría:** mide la presión intraocular (PIO, mmHg), con tonómetros de rebote o de aplanación portátiles.
  - **Ecografía ocular:** mide el **diámetro de la vaina del nervio óptico** a 3 mm detrás del globo. Valores por encima de ~5–6 mm sugieren presión intracraneal elevada. También muestra el aplanamiento posterior del globo.
  - **Mecanismo:** sin gravedad se desplazan unos ~2 L de fluido de las piernas hacia el tórax y la cabeza. La presión intracraneal en vuelo no es más alta que acostado en la Tierra, pero **nunca baja** como cuando uno está de pie, así que el ojo queda expuesto a una carga continua (Lawley y col., 2017). Cambia el gradiente de presión a través de la lámina cribosa (presión intracraneal − PIO) y se congestiona la coroides. Hay factores que agravan el cuadro: el CO₂ de cabina y diferencias genéticas en el metabolismo de vitaminas B (ciclo de un carbono).
- **Qué hace el espacio:** sin gravedad, los fluidos se desplazan hacia la cabeza (**desplazamiento cefálico**). Aumenta la congestión venosa y desaparece la bajada de presión intracraneal que ocurre en la Tierra al estar de pie. Esto produce el **SANS** (Spaceflight-Associated Neuro-ocular Syndrome):
  - edema del disco óptico;
  - pliegues en la coroides;
  - aplanamiento del globo ocular;
  - cambio hacia la hipermetropía.
- **Efecto en la salud:** visión borrosa de cerca. Es frecuente en misiones largas y algunos cambios **persisten años**. Es uno de los mayores riesgos sin resolver para un viaje a Marte.

#### 6. Ecografía venosa (trombosis)
- **Método:** **ecografía con compresión y Doppler** de la vena yugular interna del cuello.
- **Cómo funciona:**
  - Se presiona la vena con la sonda: si no colapsa, puede haber un coágulo.
  - El Doppler mide la velocidad y la dirección de la sangre por el cambio de frecuencia del ultrasonido reflejado.
- **Detalle técnico:**
  - **Efecto Doppler:** Δf = 2·f₀·v·cos θ / c, donde c ≈ 1540 m/s es la velocidad del sonido en tejido blando y θ el ángulo entre el haz y el vaso. De Δf se obtiene la velocidad v de la sangre.
  - **Modos de ecografía:**
    - **Doppler color:** muestra la dirección del flujo en el mapa.
    - **Doppler pulsado:** da la curva de velocidad en un punto.
    - **Modo B:** mide el área transversal de la vena.
  - **Compresión:** si la vena no colapsa con presión suave, sugiere un trombo.
  - **Operación en vuelo:** los astronautas no son ecografistas. Operan el ecógrafo con **guía remota** de un experto en Tierra, ayudados por marcas en la piel y tarjetas de referencia.
  - **Estudio en la ISS:** Marshall-Goebel y col. (2019) estudiaron a 11 astronautas. 6 tenían flujo estancado o invertido en la yugular izquierda, y uno tenía un trombo oclusivo. Fue tratado con anticoagulantes enviados a la ISS.
- **Qué hace el espacio:** por el desplazamiento de fluidos, las yugulares se dilatan. En un estudio de la ISS, varios astronautas tenían **flujo estancado o invertido**, y en uno se encontró un **trombo** que se descubrió de forma inesperada.
- **Efecto en la salud:** riesgo de **embolia**. Tratarla en vuelo es difícil porque hay pocos anticoagulantes a bordo y no hay evacuación rápida.

#### 7. Análisis de sangre y orina
- **Método:**
  - **Sangre:** hemograma, panel metabólico y marcadores óseos (fosfatasa alcalina, CTX/NTX).
  - **Orina:** de 24 h, con calcio, oxalato, citrato y volumen.
  - En la ISS las muestras se congelan en el **MELFI** y se analizan en la Tierra.
- **Cómo funciona:** son análisis clínicos estándar. En la orina se calcula la **sobresaturación**, la tendencia de las sales a cristalizar y formar cálculos.
- **Detalle técnico:**
  - **Hemograma:** los contadores cuentan y miden las células por **impedancia** (método Coulter: cada célula que pasa por un orificio cambia la resistencia eléctrica) y por **citometría óptica**. Dan hematocrito, hemoglobina y recuento de glóbulos rojos, blancos y plaquetas.
  - **Marcadores óseos:**
    - **de resorción:** CTX y NTX, fragmentos del colágeno tipo I que se liberan al destruir hueso;
    - **de formación:** fosfatasa alcalina ósea y P1NP.
    - Responden en días, mucho antes que la DXA, por eso sirven de **alerta temprana**.
  - **Riesgo de cálculos:** a partir de la orina de 24 h (calcio, oxalato, citrato, ácido úrico, pH, volumen), un programa de equilibrio químico calcula la **sobresaturación relativa** de oxalato de calcio, fosfato de calcio y ácido úrico. Si es mayor que 1, hay tendencia a cristalizar.
  - **Hemólisis en vuelo:** se midió por el **monóxido de carbono exhalado**, que se libera al degradarse la hemoglobina. En vuelo se destruyen ~54 % más glóbulos rojos que en Tierra (Trudel y col., 2022).
  - **Calcio y hormonas:** la resorción ósea libera calcio a la sangre. Eso **baja la PTH y la vitamina D activa (1,25-OH₂-D)**, y con ellas cae la absorción intestinal de calcio, que termina en la orina.
  - **Futuro:** para Marte se apunta a analizadores **portátiles en el punto de atención** (cartuchos tipo i-STAT, tiras de orina), porque no se pueden congelar muestras y esperar el regreso.
- **Qué hace el espacio:**
  - Al principio la sangre se concentra, porque se pierde plasma.
  - Después aparece la **"anemia espacial"**, por mayor destrucción de glóbulos rojos.
  - Aumenta el calcio en orina por la pérdida ósea, y hay tendencia a la deshidratación.
- **Efecto en la salud:**
  - Los **cálculos renales** serían una emergencia lejos de la Tierra.
  - La anemia causa fatiga.
  - Estos análisis también son la base para controlar la función renal y el sistema inmune.

#### 8. Tolerancia ortostática (prueba de pie o de inclinación)
- **Método:** **prueba de pie** de 10 minutos, o **mesa basculante a 80°**. Se mide:
  - la frecuencia cardíaca con **ECG**;
  - la presión latido a latido con un **Finapres**, un manguito de dedo que sigue la presión de forma continua mediante pletismografía;
  - el volumen sistólico por Doppler.
- **Cómo funciona:** al pasar de acostado a de pie, la gravedad lleva sangre a las piernas. Normalmente el **barorreflejo** compensa: acelera el corazón y contrae los vasos. La prueba mide si esa compensación alcanza, con la caída de presión, la subida de frecuencia cardíaca y el tiempo que la persona tolera de pie.
- **Detalle técnico:**
  - **Finapres (método de pinzamiento de volumen, de Peñáz):**
    - Un manguito en el dedo tiene un fotopletismógrafo infrarrojo que mide el volumen de la arteria.
    - Un servocontrol ajusta la presión del manguito en cada instante para mantener ese volumen constante.
    - Así, la presión del manguito es igual a la presión arterial, latido a latido. Luego se reconstruye la presión braquial.
  - **Volumen sistólico (VS):**
    - por **Modelflow**, un modelo de la forma de la onda de pulso;
    - o por **Doppler** del flujo en la aorta.
  - **Variables derivadas:**
    - gasto cardíaco = FC × VS;
    - resistencia periférica total (RPT) = presión arterial media / gasto cardíaco.
    - MR001G trae todas estas variables minuto a minuto.
  - **Fisiología de la prueba:** al ponerse de pie se desplazan unos **500–800 mL de sangre** hacia las piernas y el abdomen. Baja el retorno venoso, y con él el VS. Los barorreceptores del seno carotídeo y del arco aórtico detectan la caída de presión y activan el sistema simpático: sube la FC, sube la RPT y se libera noradrenalina. A más largo plazo responde el eje hormonal (renina, angiotensina, aldosterona, vasopresina), que también mide MR001G.
  - **Criterios de fracaso:** presíncope, o una caída de la presión sistólica por debajo de ~70–80 mmHg. Se registra el tiempo tolerado de pie.
  - **Por qué falla después del vuelo:**
    - hipovolemia;
    - menor VS;
    - en algunos astronautas, una **vasoconstricción insuficiente**, con menos liberación de noradrenalina (Meck y col., 2004).
  - **Contramedidas al regreso:** carga de líquidos y sal antes del reingreso, y prendas de compresión.
- **Qué hace el espacio:**
  - hay menos volumen de sangre;
  - el corazón está algo atrofiado;
  - el barorreflejo está "desentrenado", porque en ingravidez nunca tuvo que actuar.
- **Efecto en la salud:** al volver a la gravedad, **mareo, presíncope o desmayo**, sobre todo en los primeros días. Es crítico al llegar a Marte, donde no hay equipo de apoyo y puede ser necesario salir de la nave en una emergencia. En vuelo no se puede medir; por eso los datos de MR001G sirven para **predecirla**.

#### 9. Equilibrio y función vestibular
- **Método:**
  - **posturografía dinámica computarizada** (Sensory Organization Test);
  - pruebas de campo después del aterrizaje (Field Test): levantarse, caminar, esquivar obstáculos.
- **Cómo funciona:** una plataforma con sensores de fuerza mide el balanceo del cuerpo. La plataforma y el entorno visual se mueven a la par con la persona para "anular" la información de los pies o de la vista, y así se aísla el **sistema vestibular**, el oído interno.
- **Detalle técnico:**
  - **Sensory Organization Test (SOT):** se hace en 6 condiciones, que combinan:
    - ojos abiertos, ojos cerrados o entorno visual que se mueve con el cuerpo;
    - plataforma fija o plataforma que se mueve con el cuerpo.
  - **Puntaje:** los sensores de fuerza calculan el centro de presión y el ángulo de balanceo anteroposterior. El **puntaje de equilibrio** (0–100) compara el balanceo pico a pico con el límite teórico de estabilidad (~12,5°).
  - **Condiciones clave:** las **5 y 6** (sin información fiable de la vista ni de los pies) dependen casi solo del sistema vestibular. Son las más afectadas después del vuelo.
  - **Mecanismo:** en la Tierra los otolitos no pueden distinguir una inclinación de la cabeza de una aceleración lineal; el cerebro usa la gravedad como referencia. En ingravidez, todas las señales de los otolitos se interpretan como traslación (**reinterpretación inclinación-traslación**). Al volver, una inclinación de la cabeza se percibe como movimiento, lo que causa ilusiones, vértigo y ataxia.
  - **Pruebas funcionales:** el **Field Test** se hace el mismo día del aterrizaje e incluye levantarse, caminar en tándem y recuperarse de una caída. El **Functional Task Test** simula tareas de exploración (subir una escalera, abrir una escotilla, cargar herramientas). Su rendimiento se relaciona con la fuerza de piernas y con la tolerancia ortostática.
- **Qué hace el espacio:** los **otolitos** del oído interno detectan la gravedad y la aceleración lineal. Sin gravedad, el cerebro **reinterpreta** sus señales para adaptarse. Al volver, esa adaptación falla por un tiempo.
- **Efecto en la salud:**
  - al principio de la misión, mareo espacial;
  - al regresar, vértigo, marcha inestable, desorientación y dificultad para conducir u operar equipos.
  - Se recupera en días o semanas.

#### 10. Prueba funcional física
- **Método:** una batería de pruebas: fuerza de prensión, flexiones, abdominales, flexibilidad (*sit-and-reach*), agilidad con conos y salto.
- **Cómo funciona:** son pruebas de campo simples y repetibles que integran fuerza, potencia, coordinación y resistencia.
- **Detalle técnico:**
  - **Componentes de la evaluación:**
    - fuerza de prensión con dinamómetro de mano (kg);
    - repeticiones de flexiones y abdominales en tiempo fijo (resistencia muscular);
    - *sit-and-reach* en cm (flexibilidad);
    - tiempo en un circuito de conos (agilidad, que integra equilibrio y coordinación);
    - salto vertical (**potencia**, que se pierde más rápido que la fuerza).
  - **Interpretación:** cada resultado se compara con la propia línea base del astronauta, no con normas poblacionales. La recuperación se sigue en R+5/7 y R+30.
- **Qué hace el espacio:** combina todos los efectos anteriores: músculo, hueso, corazón y equilibrio.
- **Efecto en la salud:** indica si el astronauta está **apto para tareas físicas reales** y cuándo puede volver a la actividad normal.

#### 11. Sueño
- **Método:** **actígrafo**, un sensor en la muñeca con acelerómetro y sensor de luz, más diarios de sueño.
- **Cómo funciona:** un algoritmo clasifica cada minuto como sueño o vigilia según el movimiento. Con eso estima la duración, la eficiencia y los despertares. El sensor de luz sirve para evaluar el ritmo circadiano.
- **Detalle técnico:**
  - **Registro:** un acelerómetro triaxial muestrea a decenas de Hz. La señal se resume en "cuentas" de actividad por intervalo (*epoch*) de 30 s o 1 min.
  - **Clasificación:** algoritmos validados (Cole-Kripke, Sadeh) clasifican cada intervalo como sueño o vigilia según la actividad ponderada de los intervalos vecinos.
  - **Variables:**
    - tiempo total de sueño;
    - eficiencia (tiempo dormido / tiempo en cama);
    - latencia;
    - despertares (WASO).
  - **Limitación:** detecta bien el sueño pero mal la vigilia quieta, así que tiende a **sobreestimar el sueño**. Por eso se combina con diarios de sueño.
  - **Sensor de luz (lux):** estima la exposición a la luz y la fase circadiana.
  - **Datos de vuelo:** en la ISS el promedio fue de ~6 h por noche, y la mayoría de la tripulación reportó usar somníferos (Barger y col., 2014).
- **Qué hace el espacio:** no lo causa la gravedad, pero afecta a todos los astronautas:
  - la ISS ve unos 16 amaneceres por día;
  - hay ruido, CO₂ y una agenda exigente;
  - el promedio ronda las ~6 h de sueño, y es común usar somníferos.
- **Efecto en la salud:** fatiga, errores, peor rendimiento cognitivo y estado de ánimo. Además empeora la recuperación muscular.

#### Mediciones operativas (no son mediciones físicas)
- **Conferencia médica privada y evaluación del médico de a bordo:** son entrevistas y exámenes clínicos con el cirujano de vuelo en Tierra. Ahí se integran los síntomas y todos los datos anteriores.
- **Standard Measures:** una batería de investigación que se aplica igual a todos los astronautas (sangre, cognición, microbioma, etc.). Sirve para construir una base de datos comparable entre misiones.

#### Qué implica para la herramienta
- **Se puede seguir en vuelo con datos reales:**
  - fuerza (ARED);
  - capacidad aeróbica (CEVIS);
  - masa (SLAMMD);
  - ojo (OCT);
  - ecografía venosa;
  - sueño;
  - dieta.
- **Hay que estimar con modelos y datos históricos:**
  - hueso, a partir de la pendiente de MR035G y la adherencia al ejercicio;
  - tolerancia ortostática al regresar, con MR001G y la tendencia del VO₂ y la masa;
  - equilibrio.

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

## 7. Prototipo GravTrack

El primer prototipo descartable (un HTML con Chart.js y datos falsos) se usó para validar la idea y ya no está en el repositorio. La aplicación actual vive en `src/front/sketch/`.

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

**Literatura fisiológica citada en la sección 5.5.** Son referencias de conocimiento general: no se descargaron en esta rama y conviene verificarlas antes de citarlas.
- Lang T y col. Cortical and trabecular bone mineral loss from the spine and hip in long-duration spaceflight. *J Bone Miner Res* 2004; 19(6):1006-12.
- Moore AD y col. Peak exercise oxygen uptake during and following long-duration spaceflight. *J Appl Physiol* 2014; 117(3):231-8.
- Lawley JS y col. Effect of gravity and microgravity on intracranial pressure. *J Physiol* 2017; 595(6):2115-27.
- Marshall-Goebel K y col. Assessment of jugular venous blood flow stasis and thrombosis during spaceflight. *JAMA Netw Open* 2019; 2(11):e1915011.
- Trudel G y col. Hemolysis contributes to anemia during long-duration space flight. *Nat Med* 2022; 28:59-62.
- Meck JV y col. Mechanisms of postspaceflight orthostatic hypotension. *Am J Physiol Heart Circ Physiol* 2004; 286(4):H1486-95.
- Barger LK y col. Prevalence of sleep deficiency and use of hypnotic drugs in astronauts. *Lancet Neurol* 2014; 13(9):904-12.
