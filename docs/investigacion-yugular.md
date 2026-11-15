# Investigación: ecografía de las venas yugulares en vuelo (trombosis)

Base para una pestaña **Neck veins**: por qué se mira la yugular, qué pide la norma, qué se mide y con qué equipo, qué números publicó la NASA, qué datos abiertos hay y cómo mostrarlo en 3D con el código que ya tenemos. Relevado el 15/11/2026.

> **Resumen:** no hay datos públicos por persona de ecografía yugular de astronautas. Los estudios con estos datos (Fluid Shifts, Vascular Echo) están en NLSP **por solicitud** o no se archivaron allí. La pestaña tendría que usar **datos simulados** a partir de los números publicados (§3) y decirlo en la página, igual que Eyes.

## 1. Por qué hace falta

**El problema: sangre quieta en la yugular izquierda.**

- **Qué lo causa:** en la Tierra, al estar sentado o de pie, la yugular interna se aplasta y la sangre del cerebro baja sobre todo por las venas de la columna. Acostado, la yugular se llena y pasa a ser la vía principal. En microgravedad la sangre sube hacia la cabeza y **la yugular queda todo el día como si estuviéramos acostados**, distendida y con presión alta, sin el vaciado que da la gravedad varias horas por día.
- **Qué le pasa a la vena:**
  - se agranda (área de 9,8 mm² sentado en Tierra → 70 mm² en vuelo);
  - el flujo se hace lento, se detiene (**estancado**) o se invierte (**retrógrado**, hacia la cabeza);
  - en la ecografía aparece "humo" dentro de la vena (**ecogenicidad**), señal de sangre lenta;
  - puede formarse un **coágulo** (trombosis venosa, *DVT* en la norma).
- **Qué tan frecuente es:**
  - 6 de 11 astronautas tuvieron flujo estancado o retrógrado cerca del día de vuelo 50 (Marshall-Goebel 2019);
  - hubo un trombo oclusivo y otro parcial, este último encontrado después, al revisar las imágenes;
  - en el programa de vigilancia que vino después no hubo trombos (0 de 11), pero 6 de 11 tenían ecogenicidad en la yugular izquierda y 2 flujo retrógrado (Pavela 2022);
  - en 2026 se publicó un tercer caso documentado (Zamboni 2026).
- **Por qué importa:**
  - **Durante la misión:** el primer trombo se encontró **por casualidad**, en un estudio de investigación, y el astronauta no tenía síntomas. Se trató con anticoagulantes que había a bordo, guiados desde Tierra, y después se envió un anticoagulante oral en una nave de carga.
  - **El riesgo:** que el coágulo crezca o viaje al pulmón (**embolia pulmonar**). La norma lo llama un riesgo para la vida o la misión.
  - **Para Marte:** no hay nave de carga que traiga el medicamento ni evacuación. Hay que **detectar el flujo anormal antes del trombo**, con lo que haya a bordo y sin ecografista. La norma ya prevé hacer la ecografía de forma **autónoma**.
- **Qué busca la pestaña:**
  - mostrar en cada control cómo está la sangre en las dos yugulares;
  - marcar a quien tiene flujo estancado o retrógrado como persona en riesgo;
  - convertir un posible trombo en una tarea inmediata del Planner (consulta con el médico de vuelo).

## 2. Qué pide la norma

OCHMO-STD-100.1A Rev. A, requisito **6041** (§6.3.2, pág. 50, *Screening for Deep Vein Thrombosis and Venous Flow Anomalies*):

- **Requisito:** a cada tripulante se le busca trombosis y flujo anormal en las yugulares internas.
- **Razones que da la norma:**
  - la trombosis primaria de la yugular **izquierda** se vio con más frecuencia en microgravedad;
  - el flujo anormal es frecuente y probablemente marca riesgo de trombosis;
  - detectarlo temprano permite tratar antes de una embolia.
- **Cómo:** ecografía **dúplex** (imagen más Doppler) de las dos yugulares internas, fuera del cráneo, con **maniobras de respiración y de compresión**. Se hace **guiada desde Tierra o de forma autónoma con entrenamiento justo a tiempo**, con el ecógrafo de a bordo.
- **Calendario de ejemplo (misión de 180 días en la ISS, Tablas 7 y 8):**

| Momento | Días |
|---|---|
| Antes del vuelo | L-12/3 meses |
| En vuelo | **L+30, L+60, R-42** |
| Después del vuelo | R+0/45 días, y cuando haga falta clínicamente |

La norma aclara que el calendario es **un ejemplo** basado en la ISS ("for informational purposes only"). Para una misión a Marte hay que extenderlo, por ejemplo cada 60 días; eso sería un supuesto nuestro.

**Otras ecografías de la norma** (no son de esta pestaña):

| Requisito | Qué | Cuándo |
|---|---|---|
| 6012 | Ecografía 2-D del ojo (vaina del nervio óptico) | En vuelo L+30, L+90, L+180, L+270, R-30. Ya está en Eyes |
| 6014 | Tiroides, abdomen y pelvis, carótida (grosor íntima-media y placa), ecocardiograma | Antes del vuelo. En vuelo solo "cuando se necesite" |
| Tabla 6 | Ecocardiograma con Doppler, carótida, tiroides, abdomen | Selección y examen anual, en Tierra |

## 3. Qué se mide y con qué

| Medida | Cómo | Qué indica | Fuente |
|---|---|---|---|
| **Área de la vena** (mm²) | Modo B, corte transversal debajo de la unión con la vena tiroidea superior, al final de la espiración | Cuánto se llenó la vena (desplazamiento de fluidos) | Marshall-Goebel 2019 |
| **Patrón de flujo**, grado 1 a 4 | Doppler en corte longitudinal | 1: continuo hacia el corazón. 2: pulsátil, que puede volver a 0. 3: **estancado** (sin flujo neto). 4: **retrógrado**, hacia la cabeza | Marshall-Goebel 2019, fig. 3 |
| **Velocidad máxima** (cm/s) | Doppler pulsado | Baja en vuelo, sobre todo en la izquierda | Pavela 2022 (el resumen no da valores) |
| **Ecogenicidad** (ninguna, leve, moderada) | Modo B | "Humo" de sangre lenta | Pavela 2022 |
| **Compresibilidad** | Se aprieta la vena con la sonda | Si no colapsa, sugiere un trombo | Norma 6041; criterio clínico estándar |
| Maniobras de respiración | Doppler durante la inspiración y Valsalva | Si el flujo responde | Norma 6041; Pavela 2022 |
| Presión de la vena (mmHg) | Compresión con una bolsa con manómetro (VeinPress) | Solo en investigación; sobreestima el valor absoluto | Marshall-Goebel 2019 |

**Equipo en la ISS:**
- **Ecógrafo:** GE **Vivid q** (el de Marshall-Goebel 2019), reemplazado por el **Vivid iq**, que llegó en septiembre de 2025 (ver `investigacion-ojos.md`).
- **Sonda:** lineal de 12 a 5 MHz.
- **Quién la hace:** el tripulante, guiado en tiempo real desde Tierra.

## 4. Números publicados

### Marshall-Goebel y col. 2019

*JAMA Netw Open*, 11 astronautas, 210 ± 76 días en el espacio. Se midió **solo la yugular izquierda**.

| Momento | Área (mm², IC 95 %) | Presión (mmHg, IC 95 %) |
|---|---|---|
| Antes del vuelo, sentado | 9,8 (−1,2 a 20,7) | 5,1 (2,5 a 7,8) |
| Antes del vuelo, acostado | 80,7 (69,9 a 91,5) | 17,3 (14,8 a 19,8) |
| Antes del vuelo, cabeza abajo 15° | 107,7 (96,7 a 118,7) | 20,7 (17,8 a 23,5) |
| **Vuelo, día ~50** | **70,3** (59,3 a 81,2) | **21,1** (18,5 a 23,7) |
| Vuelo, día ~150 | 60,0 (48,8 a 71,2) | 15,8 (13,0 a 18,6) |
| Día ~50 con presión negativa en la parte inferior del cuerpo (LBNP) | 44,7 (33,2 a 56,2) | — |
| Después del vuelo (~R+40) | Responde a la postura como antes del vuelo | — |

**Flujo:**
- **Antes del vuelo:** todos con grado 1 sentados; 10 de 11 con grado 2 acostados o cabeza abajo; ninguno estancado ni retrógrado.
- **Día 50:**
  - grado 3 en 5 de 11 (45 %);
  - grado 4 en 1 de 11;
  - en total, **6 de 11 (55 %)** con flujo anormal.
- **Día 150:**
  - grado 3 en 2 de 10 (20 %);
  - otro tripulante pasó a grado 4.
- **Del día 50 al 150:** 5 de 10 igual, 3 mejor, 2 peor.

**LBNP:** se asoció con mejor flujo en 10 de 17 sesiones (59 %). Es una asociación en pocas personas, no una prueba de que funcione.

**Trombo:**
- 1 trombo oclusivo en el día ~50, en la yugular izquierda, sin síntomas;
- al revisar después las imágenes, apareció 1 trombo parcial en otro tripulante.

**En limpio:** en vuelo, el área y la presión de la yugular se parecen a las de una persona **acostada** en la Tierra. Lo que cambia es el **flujo**. Por eso la referencia útil no es "sentado antes del vuelo", sino la misma persona acostada.

### Pavela y col. 2022

*Vascular Medicine*. Es el programa operativo que dio origen al requisito 6041.

- **Cómo:** ecografía dúplex de las dos yugulares, en Tierra y en 3 momentos del vuelo, con maniobras de respiración.
- **Quiénes:** 11 astronautas con ecografía en Tierra y en vuelo.
- **Resultados:**
  - **ningún trombo**;
  - velocidad máxima menor en vuelo, más baja en la izquierda;
  - ecogenicidad leve a moderada en la izquierda en **6 de 11**, y nunca más que leve en la derecha;
  - **2 de 11** con flujo retrógrado en la izquierda.

### Otros

| Estudio | Qué aporta |
|---|---|
| Auñón-Chancellor 2020 (*NEJM*), el caso del trombo | Hallado ~2 meses después del lanzamiento. Recibió enoxaparina, que había a bordo, con la dosis reducida para que alcanzara. Luego apixabán, que llegó en una nave de carga y se suspendió 4 días antes del regreso. El trombo se achicó, pero con ~90 días de tratamiento todavía no había flujo espontáneo en ese segmento. *Detalles tomados de notas de prensa; la carta no tiene resumen público. Verificar con el texto.* |
| Arbeille 2015 (Vessel Imaging, 10 astronautas, 6 meses) | El tripulante hace la ecografía solo, en volumen 3D. Área de la yugular **+178 %** en el día 15 y **+225 %** a los 4–5,5 meses. Vena porta +36/+45 %, vena femoral +124/+169 %, venas de la pantorrilla −45/−52 % y −68/−55 %. **Todo vuelve a lo normal 4 días después del regreso** |
| Arbeille 2021 (*J Appl Physiol*) | La LBNP reduce el volumen de la yugular y de la vena porta en vuelos largos |
| Zamboni 2026 (*Sci Rep*, 4 astronautas) | Pulso yugular sincronizado con el ECG y medido con IA. Después del vuelo el área cayó 46–48 % en 3 de 4. En un caso, el patrón opuesto se atribuyó a una **trombosis, el tercer caso documentado** |
| Pentinat-Llurba 2026 (vuelo parabólico, 1 persona) | **Índice de dirección del flujo (FDI)**: el tiempo con flujo hacia el corazón, estancado y retrógrado, en un número continuo. Más fino que los grados 1 a 4. Mejora con LBNP de −20 y −30 mmHg |
| Premasiri 2026 (revisión, 21 estudios en análogos) | En reposo en cama, cabeza abajo, inmersión seca y vuelo parabólico, el área, el volumen y la presión de la yugular suben con la intensidad y la duración. La LBNP es lo que mejor lo revierte; los manguitos de muslo ayudan poco tiempo |
| Lan 2021 (*Physiol Rep*) | Propone por qué el flujo baja en la izquierda: la anatomía del tronco venoso izquierdo, más largo y comprimido |

**Lo que no encontramos:**
- velocidades máximas en vuelo con valores (Pavela da solo la tendencia);
- series por persona;
- datos de la yugular derecha con grados de flujo.

## 5. Datos abiertos: qué hay y qué no

Búsqueda del 15/11/2026 en los portales que indica la discusión del challenge ([#2133](https://github.com/nasa/spaceapps/discussions/2133)): OSDR, NLSP, HRP y la pestaña Resources.

**NLSP:** se consultó su API (`/api/v1/data/experiments?search=…`) con *jugular*, *thrombosis*, *venous flow*, *Fluid Shifts*, *Vascular Echo* y *ultrasound*. Aparecieron 89 experimentos con humanos sobre venas o flujo.

- **Fuente de nuestros números, sin datos públicos:**
  - **Fluid Shifts** ([10.83263/rxgv-ym60](https://doi.org/10.83263/rxgv-ym60)), el estudio de Marshall-Goebel 2019: protegido por privacidad, por **solicitud formal**. Mide venas del cuello, volumen venoso, vaina del nervio óptico, OCT y presión intracraneal estimada.
  - **Vascular Echo** ([10.83263/rwr5-ce97](https://doi.org/10.83263/rwr5-ce97)), de la CSA (Hughson): dimensiones y velocidad de la yugular, vena cava inferior, vena porta, grosor íntima-media femoral, tiroides. Es internacional y **no se archivó en LSDA**.
  - **ADUM** ([10.83263/1g11-5b68](https://doi.org/10.83263/1g11-5b68)), ecografía diagnóstica avanzada en la ISS con guía remota: por solicitud.
- **Análogos en Tierra con la yugular, todos por solicitud o todavía en curso:**
  - `BEDREST_NaVC`, Campaign 19 ([10.83263/cren-cz18](https://doi.org/10.83263/cren-cz18));
  - `Venous_Congestion_CM`, `Cephalad_Fluid`, `Impedance_Breathing`, `Exercise_Modality`, *Self-Generated LBNP*;
  - cinco estudios en curso sobre SANS y reposo en cama.
- **Públicos, pero poco útiles para esta pestaña:**
  - **DSO 462**, *Noninvasive Estimation of Central Venous Pressure During Space Flight* ([10.83263/s5eh-cf67](https://doi.org/10.83263/s5eh-cf67)). Época del Shuttle: 9 astronautas, vuelos de 5 a 8 días, **Doppler de bolsillo sobre la yugular** para estimar la presión venosa central. La presión bajó del día 1 al día 6. Los 6 archivos (`JMDSO_462_1..6`, "Available online") son **gráficos en TIF**, no tablas, y no logramos descargarlos por la API. Sirve como antecedente histórico: hace 35 años ya se miraba la yugular en vuelo.
  - **BEDREST0543**, UTMB Campaign 3 ([10.83263/wtxf-sf78](https://doi.org/10.83263/wtxf-sf78)). Es **la misma campaña** que nuestros datos de hueso y VO2. Tiene compliancia venosa de la pantorrilla, función venosa de mano y pie y grosor íntima-media de las arterias tibial y braquial, pero **no la yugular**.

**OSDR:** en la API de búsqueda (`/osdr/data/search`), *jugular*, *internal jugular* y *Fluid Shifts* devolvieron 0 resultados; *ultrasound* solo un estudio de ratones. Inspiration4 probó un ecógrafo de mano sobre vejiga, yugular y ojos (resumen de Baylor y TRISH), pero no encontramos esas imágenes entre sus datos en OSDR.

**LSAH** (seguimiento médico de astronautas): tiene la vigilancia operativa del requisito 6041, solo por solicitud.

## 6. Umbrales

No hay un consenso con clases, como el de SANS para el ojo. Proponemos tres niveles. **Es un supuesto nuestro**, apoyado en la conclusión de Pavela 2022 ("el flujo anormal puede señalar más riesgo de trombo") y en la razón de la norma.

| Nivel | Criterio (cualquier yugular) | Qué hace la app |
|---|---|---|
| **Normal** | Grado 1 o 2; la vena colapsa; ecogenicidad ausente o leve | Nada; el próximo control según 6041 |
| **Check needed** | Grado 3 (estancado), grado 4 (retrógrado), o ecogenicidad moderada | Aviso. El Planner agenda una revisión del médico de vuelo y adelanta la próxima ecografía; sugerimos ~14 días, **supuesto** |
| **Alarm** | La vena **no colapsa** o se ve una masa dentro (posible trombo) | Alarma. Consulta privada con el médico de vuelo **ese día** y seguimiento según lo indique |

- La comparación es siempre contra **la misma persona antes del vuelo, acostada**. Sentado, la vena está casi vacía y cualquier valor en vuelo parecería enorme.
- El área sola **no** dispara avisos: en vuelo siempre está agrandada. Se muestra como contexto del desplazamiento de fluidos.
- La app **no indica tratamiento** (anticoagulantes, LBNP). Muestra el hallazgo y lo deriva al médico de vuelo, como hace Eyes.

## 7. Modelo de simulación

Para cada tripulante, igual que el resto de `gravsim` (por ejemplo `sim/gravsim/ocular.py`). Todo lo marcado **supuesto** es nuestro, no de la NASA.

| Parámetro | Valor | Base |
|---|---|---|
| Momentos | L-12/3 meses, L+30, L+60, R-42, R+0/45; en misiones largas, cada 60 días (**supuesto**) | Norma 6041 |
| Área antes del vuelo | Sentado ~10 mm²; acostado ~80 mm², según la persona | Marshall-Goebel 2019 |
| Área en vuelo | Sube rápido (ya alta en el día 15), ~70 mm² cerca del día 50 y baja algo hacia ~60 mm² en el día 150 | Marshall-Goebel 2019; Arbeille 2015 |
| Área después del regreso | Vuelve a la de antes en ~4 días | Arbeille 2015 |
| Izquierda y derecha | La izquierda con peor flujo, más ecogenicidad y menor velocidad; la derecha casi siempre en grado 1 o 2 | Pavela 2022; Lan 2021 |
| Grado de flujo, izquierda, días 30 a 60 | ~45 % grado 3 y ~10 % grado 4 | Marshall-Goebel 2019, día 50 |
| Grado de flujo, izquierda, más adelante | ~20 % grado 3 y ~10 % grado 4; cambia entre controles (~50 % igual, 30 % mejor, 20 % peor) | Marshall-Goebel 2019, día 150 |
| Ecogenicidad, izquierda | Leve a moderada en ~55 %, más probable con grado 3 o 4 | Pavela 2022 |
| Velocidad máxima | Baja en vuelo, más en la izquierda; valores absolutos **supuestos** | Pavela 2022 (solo la tendencia) |
| Trombo | Raro: ~1 de cada 10–20 misiones largas, solo en quien tiene grado ≥ 3. **Supuesto**: 2 trombos en ~22 astronautas estudiados (Marshall-Goebel y Pavela) | Marshall-Goebel 2019; Pavela 2022 |
| Trombo a pedido | Para la demo, como las lesiones de `add_event`: `add_thrombus(day=…)` | Nuestro |
| Ruido del área | ~10 % entre mediciones (el control de calidad del estudio aceptaba hasta 10 % entre ecografistas) | Marshall-Goebel 2019 |

**Medidas nuevas** (grupo `veins` en `sim/gravsim/measures.py`):
- `ijv_csa_l` y `ijv_csa_r`, en mm²;
- `ijv_flow_grade_l` y `ijv_flow_grade_r`, de 1 a 4;
- `ijv_echo_l` y `ijv_echo_r`: 0 ninguna, 1 leve, 2 moderada;
- `ijv_compressible_l` y `ijv_compressible_r`, 1 o 0;
- `ijv_peak_velocity_l` y `ijv_peak_velocity_r`, en cm/s; valores **supuestos**.

**Catálogo del Planner** (`planner/catalog/ochmo-100.1a.json`, rutina 6041):
- `completion` pasa de `crew` a `auto`;
- `instrument` pasa a `ultrasound`;
- `measures`: las de arriba.

Igual que se hizo con 6012 en Eyes.

## 8. Cómo se muestra hoy en 3D y cómo lo adaptaríamos

### Lo que ya existe

**`src/front/body-3d/BodyViewer.jsx`** carga el modelo `open-anatomy-3d` (GLB masculino o femenino) con capas `surface`, `muscles`, `skeleton` y **`organs`**:
- En `organs`, la piel se vuelve una cáscara translúcida y solo se ven las estructuras que reciben color en `structureColors`, con claves que son nombres de nodos del modelo (`heart`, `lung_l`, `eye_l`, `carotid_l`…).
- `explorationRequest` acerca la cámara a una estructura y la hace girar lentamente.
- Un clic llama a `onSelect(key)`.

Así lo usan las dos pestañas de estudios:
- **Aeróbica** (`sketch/aerobica/AerobicView.jsx`) pinta el corazón y los pulmones.
- **Eyes** (`sketch/ojos/EyesView.jsx`) hace dos cosas:
  - un panel **"Where"** con el cuerpo en `organs` y los ojos coloreados por la clase de SANS;
  - una **vista de detalle propia**, `Eye3D.jsx`: un ojo cortado al medio con planos de corte (`clippingPlanes`), deformado con los cambios del examen y **ampliados ~40 veces (`GAIN`)** porque son micrómetros, con transición animada entre exámenes (`useTween`).

Debajo, la vista tiene un selector de examen con "▶ Play the mission", un gráfico Recharts con líneas de umbral, tarjetas por prueba y el aviso de datos simulados.

### Lo que falta en el modelo

El GLB **no tiene yugulares**. Revisamos los 22 nodos de `vessels`:
- hay `carotid_l` y `carotid_r` (en el modelo masculino, en el mundo, `carotid_l` va de x 0,011 a 0,038 m, y 1,386 a 1,616 m), `vena_cava_superior` (y 1,353 a 1,388 m), `veins_thorax` (hasta y 1,46 m) y `arteries_head`;
- en el modelo, +x es el lado izquierdo del cuerpo (`eye_l` está en x > 0).

La yugular interna va dentro de la vaina carotídea, **por fuera y un poco por delante de la carótida**, desde la base del cráneo hasta unirse con la subclavia sobre la clavícula.

**Propuesta:** un módulo `src/front/body-3d/jugularVeins.js` que construya las dos venas en el momento, como `surfaceEyes.js` construye los ojos.

1. Tomar la línea central de `carotid_l` y `carotid_r` (puntos medios de su malla por altura).
2. Correrla ~1,2 cm hacia afuera y ~0,5 cm hacia adelante, y extenderla abajo hasta la parte superior de `veins_thorax` (tronco braquiocefálico).
3. Armar un `THREE.TubeGeometry` sobre una `CatmullRomCurve3`. El radio sale del área medida: r = √(área/π). Son 1,8 mm sentado en Tierra y 4,7 mm en vuelo, así que se puede dibujar a escala real o ×1,5 para que se vea.
4. Registrarlas en `structureMeshes` con las claves `ijv_l` e `ijv_r`. Así `structureColors`, `onSelect` y `explorationRequest` funcionan sin otros cambios.

Son ~2 líneas en `BodyViewer.jsx` (llamar al módulo después de `addSurfaceEyes` y sumar sus mallas). Es el único cambio a un archivo compartido. La clave también le serviría a `fuerza` o a un resumen futuro.

### La pestaña "Neck veins" (`#venas`)

Misma estructura que Eyes, en su propia carpeta `sketch/venas/`:

1. **Introducción y etiqueta "SIMULATED DATA".** Por qué la yugular izquierda, en dos frases, con el requisito 6041 y los días de control.
2. **Estado:** Normal, Check needed o Alarm (§6), con la lista de signos ("Left vein: blood standing still", "Left vein: does not collapse") y la fecha del último control.
3. **Detalle 3D: `Vein3D.jsx`, "Tu cuello en el día 60".** Sigue el patrón de `Eye3D` (mismo renderer, luces, materiales y `useTween`):
   - **Corte transversal** a la altura de la tiroides, como se ve en la pantalla del ecógrafo: carótida redonda, de pared gruesa, y yugular ovalada, con **área a escala real** (no hace falta ampliar: el cambio es de ×7). En línea punteada, la misma vena **antes del vuelo sentada y acostada**, para ver que en el espacio la vena está "como acostada todo el día".
   - **Corte longitudinal** del tramo, abierto con un plano de corte, con **partículas de sangre** animadas:
     - grado 1: fluyen parejo hacia el corazón;
     - grado 2: avanzan a pulsos;
     - grado 3: tiemblan en el lugar;
     - grado 4: van hacia la cabeza.
   - La ecogenicidad se ve como densidad de "humo" dentro de la vena, y el trombo como una masa adherida a la pared.
   - **Botón "Compress"**: la sonda baja y la vena colapsa (normal) o no colapsa (trombo). Es exactamente la maniobra de la norma.
   - Selector de controles y "▶ Play the mission", reutilizando `ExamPicker` de Eyes. Conviene moverlo a `sketch/components/`.
4. **"Where":** `BodyViewer` en capa `organs` con `ijv_l` e `ijv_r` coloreadas por nivel, con la paleta de intensidad que ya usan Eyes y Aeróbica (`#9fc9ae`, `#ef9959`, `#d94d4b`). Para dar contexto, `carotid_l`, `carotid_r`, `vena_cava_superior` y `heart` van en gris. La cámara arranca en `ijv_l`. Así se ve en qué parte del cuerpo está la vena y hacia dónde debería ir la sangre.
5. **Doppler:** una tira con la curva de velocidad **dibujada a partir del grado** (no es una imagen real; hay que decirlo), por debajo de 0 hacia el corazón, con la escala de grados 1 a 4 al lado. Es lo que ve el tripulante en la pantalla, y ayuda a entender qué significa "estancado".
6. **Gráfico:** área de las dos yugulares por control (mm²), con bandas de referencia de Marshall-Goebel 2019 (antes del vuelo sentado ~10, acostado ~81, cabeza abajo ~108). Debajo, una fila de puntos por control con el grado de flujo de cada lado.
7. **Tarjetas:** yugular izquierda y derecha, con área, grado, ecogenicidad, compresión y velocidad, cada una con su referencia previa, el último control y el cambio. Es el mismo componente `TestCard` de Eyes.
8. **Próximo control** del Planner (rutina 6041) y el aviso de datos simulados.

**Lo que no tocaría:**
- **La piel del resumen** (capa `surface`): el cuello no es una región de `SURFACE_KEYS` y agregarla obliga a regenerar `surface-*.json`.
- En el resumen alcanza con la alerta del HealthService, como hace el reloj.

### Del lado del servidor

Mismo camino que Eyes:
- `gravsim/vascular.py`, la simulación;
- grupo `veins` en `measures.py`, con las conversiones de unidades que hagan falta;
- `health/healthservice/veins.py`, que calcula el nivel por control contra la referencia acostado;
- `GET /api/v1/veins?crew=…&day=…` en `api.py`;
- `sketch/data/veins.js` para cargarlo en el front.

El hallazgo **Alarm** genera un aviso que el Planner convierte en consulta el mismo día, igual que una alerta del reloj genera una revisión.

## Fuentes

- Marshall-Goebel K, Laurie SS, Alferova IV, Arbeille P, Auñón-Chancellor SM, Ebert DJ y col., 2019. *Assessment of Jugular Venous Blood Flow Stasis and Thrombosis During Spaceflight.* JAMA Netw Open 2(11):e1915011. [doi:10.1001/jamanetworkopen.2019.15011](https://doi.org/10.1001/jamanetworkopen.2019.15011) · [texto completo, PMC6902784](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6902784/fullTextXML)
- Pavela J, Sargsyan A, Bedi D, Everson A, Charvat J, Mason S y col., 2022. *Surveillance for jugular venous thrombosis in astronauts.* Vasc Med 27(4). [doi:10.1177/1358863X221086619](https://doi.org/10.1177/1358863X221086619)
- Auñón-Chancellor SM, Pattarini JM, Moll S, Sargsyan A, 2020. *Venous Thrombosis during Spaceflight.* N Engl J Med 382:89–90. [doi:10.1056/NEJMc1905875](https://doi.org/10.1056/NEJMc1905875); detalles del tratamiento según [LSU Health](https://www.lsuhsc.edu/newsroom/1ST%20Reported%20Occurrence%20and%20Treatment%20of%20Spaceflight%20Medical%20Risk.html) y [ScienceDaily](https://www.sciencedaily.com/releases/2020/01/200102143439.htm)
- Arbeille P, Provost R, Zuj K, Vincent N, 2015. *Measurements of jugular, portal, femoral, and calf vein cross-sectional area… (Vessel Imaging Experiment).* Eur J Appl Physiol. [doi:10.1007/s00421-015-3189-6](https://doi.org/10.1007/s00421-015-3189-6)
- Arbeille P, Zuj KA, Macias BR y col., 2021. *Lower body negative pressure reduces jugular and portal vein volumes… during long-duration spaceflight.* J Appl Physiol. [PMC8461809](https://pmc.ncbi.nlm.nih.gov/articles/PMC8461809)
- Zamboni P y col., 2026. *Physiological adaptation of the jugular venous pulse during long-duration spaceflight.* Sci Rep. [doi:10.1038/s41598-026-69054-9](https://doi.org/10.1038/s41598-026-69054-9)
- Pentinat-Llurba H, Whittle RS y col., 2026. *Case study: dose-dependent internal jugular vein response to lower body negative pressure in microgravity quantified by the flow directionality index.* J Appl Physiol. [doi:10.1152/japplphysiol.00018.2026](https://doi.org/10.1152/japplphysiol.00018.2026)
- Premasiri S y col., 2026. *Ultrasound-based Assessment of Jugular Vein Alterations in Response to Simulated Microgravity and Countermeasures: A Systematic Review.* Ultrasound Med Biol. [doi:10.1016/j.ultrasmedbio.2026.02.018](https://doi.org/10.1016/j.ultrasmedbio.2026.02.018)
- Lan M y col., 2021. *Proposed mechanism for reduced jugular vein flow in microgravity.* Physiol Rep. [PMC8087922](https://pmc.ncbi.nlm.nih.gov/articles/PMC8087922)
- David J, Scheuring RA y col., 2021. *Comparison of Internal Jugular Vein Cross-Section Area During a Russian Tilt-Table Protocol and Microgravity.* Aerosp Med Hum Perform. [doi:10.3357/AMHP.5600.2021](https://doi.org/10.3357/AMHP.5600.2021)
- NLSP: [Fluid Shifts](https://doi.org/10.83263/rxgv-ym60) · [Vascular Echo](https://doi.org/10.83263/rwr5-ce97) · [ADUM](https://doi.org/10.83263/1g11-5b68) · [BEDREST_NaVC](https://doi.org/10.83263/cren-cz18) · [DSO 462](https://doi.org/10.83263/s5eh-cf67) · [BEDREST0543, Campaign 3](https://doi.org/10.83263/wtxf-sf78)
- Inspiration4, ecógrafo de mano: [Baylor College of Medicine / TRISH](https://www.bcm.edu/news/trish-shares-new-health-data-from-first-all-civilian-orbital-space-mission)
- Discusión del challenge: [nasa/spaceapps #2133](https://github.com/nasa/spaceapps/discussions/2133)
- Norma: OCHMO-STD-100.1A Rev. A, requisito 6041 (§6.3.2, pág. 50) y Tablas 7 y 8 (`docs/references/`)
- Modelo 3D: [open-anatomy-3d](https://github.com/MervinR07/open-anatomy-3d), CC BY 4.0
