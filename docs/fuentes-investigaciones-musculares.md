# Fuentes: equipos e investigaciones sobre masa muscular en el espacio

Este documento reúne los equipos, estudios y documentos de NASA, ESA y JAXA sobre la pérdida de masa y fuerza muscular en vuelo. También indica si cada fuente tiene **datos abiertos** que se puedan usar en la herramienta.

Complementa la sección 5.5.2 (fuerza muscular) de [`investigacion-gravedad.md`](investigacion-gravedad.md).

Revisado el 14-11-2026.

> **Decisión (14-11-2026): método de medición muscular en vuelo para la herramienta.**
> - **Método:** dinamómetro isocinético a bordo, tipo **MARES** (ESA). Se menciona como **método propuesto**, no como procedimiento actual de NASA: hoy en vuelo solo se monitorea el entrenamiento en ARED.
> - **Métrica:** torque máximo por articulación (N·m), con el mismo set de pruebas que NASA aplica antes y después del vuelo (protocolo *Medical Volume B 5.3*): rodilla, tobillo y tronco.
> - **Referencia de datos:** CFT70 (NLSP MR079G, `data/nlsp/MR079G_isokinetic_muscle/MR079G_CFT70/`), que mide con la misma métrica y las mismas unidades.
> - **Antecedente en vuelo:** Sarcolab-3 usó MARES en FD9, FD49 y FD131 (2016–2017), pero sus datos no se archivaron.
> - **Otros métodos:** la ecografía panorámica autoguiada (Tele-SUS), MyotonPRO y el tirón isométrico (CIPHER) quedan como alternativas documentadas, no como la medición que muestra la web.

---

## 1. Resumen: ¿hay datos abiertos?

| Fuente | ¿Datos abiertos? | Cómo se accede | Qué se puede usar hoy |
|---|---|---|---|
| Ecógrafo de la ISS: **Sprint** (NASA) | **No** | Solicitud de datos en NLSP/LSDA | Medias por grupo publicadas en el paper (masa magra de pierna por DXA) |
| Ecógrafo de la ISS: **Sarcolab** (ESA) | **No** encontrados | Los papers solo publican resultados; no se encontró un repositorio | Porcentajes publicados (sóleo −10 % y −21 %, n = 2) |
| **SLAMMD**: masa corporal en vuelo (NASA) | **No** | El experimento figura en NLSP, sin descarga abierta confirmada. El estudio ENERGY: "a pedido de los autores" | Medias y rangos publicados en ENERGY (n = 11) |
| **Reposo en cama NLSP** (MR035G, MR079G), ya en `data/nlsp/` | **Sí** | Descarga directa, ya hecha | Masa magra por segmento (DXA) y fuerza isocinética, por sujeto |

**Conclusión:** no hay series públicas de ecografía muscular ni de masa corporal tomadas **en vuelo**. La única fuente de datos crudos por sujeto sigue siendo el reposo en cama que ya está en el repo. Los estudios de vuelo sirven como **valores de referencia publicados** (medias y porcentajes) para dibujar la banda "ISS".

---

## 2. Datos abiertos: detalle por equipo

### 2.1 Ecógrafo de la ISS (Sprint y Sarcolab)

**Qué mide:** el área de sección transversal y el volumen de los músculos de muslo y pantorrilla durante el vuelo. Lo opera el astronauta con guía remota desde Tierra.

#### Sprint (NASA), *Integrated Resistance and Aerobic Training Study*

- **Diseño:** entrenamiento de alta intensidad con menos volumen (n = 9) frente al ejercicio estándar de la ISS (n = 17). La planificación incluía ecografía en vuelo de muslo y pantorrilla, para compararla con la RM.
- **Lo que se publicó:**
  - El paper principal (English y col., *npj Microgravity* 2020) **no informa los datos de ecografía en vuelo**.
  - La masa muscular la informa solo con DXA de cuerpo entero, antes y después del vuelo:

  | Grupo | Masa magra de pierna, antes → después |
  |---|---|
  | Control (CON) | 18,77 → 18,64 kg |
  | SPRINT | 18,37 → 18,28 kg |

  - Sin diferencia significativa entre grupos.
- **Disponibilidad (cita textual del paper):** *"Data from this study may be obtained through a data request in the NASA Life Science Data Archive"*. En la solicitud hay que escribir el título *"Integrated Resistance and Aerobic Training Study—Sprint"*.
- **Formulario de solicitud:** https://lsda.jsc.nasa.gov/Request/dataRequest (redirige a NLSP).
- **Análogo abierto:** el grupo de ejercicio integrado de la **Campaign 11 / CFT70 (iRAT)** es la versión en reposo en cama de Sprint. Sus datos sí son abiertos y ya están en `data/nlsp/MR079G_isokinetic_muscle/MR079G_CFT70/` y en las carpetas `MR080G_CFT70`.
- **Fuentes:**
  - [English y col. 2020, *High intensity training during spaceflight: results from the NASA Sprint Study*, npj Microgravity (PMC7434884)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7434884/)
  - [EurekAlert – ecografía en Sprint](https://www.eurekalert.org/multimedia/624974)
  - [Danish Aerospace – Sprint](https://danishaerospace.com/en/sprint-vo2max)

#### Sarcolab (ESA, después Sarcolab3 con NASA y Roscosmos)

- **Diseño:** RM, ecografía con el equipo de MARES, electroestimulación y biopsia del sóleo, antes y después del vuelo.
- **Lo que se publicó:**
  - Piloto con 2 astronautas y 6 meses en la ISS: el volumen del sóleo cayó **~21 % (A) y ~10 % (B)**. El astronauta A entrenó con menos intensidad.
  - No hubo cambio en el tipo de miosina.
- **Disponibilidad:** no se encontró un repositorio de datos. Para pedir datos individuales habría que escribir a los autores o a ESA.
- **Fuentes:**
  - [Rittweger y col. 2018, *Sarcolab pilot study into skeletal muscle's adaptation to long-term spaceflight*, npj Microgravity](https://link.springer.com/10.1038/s41526-018-0052-1)
  - [Capri y col. 2019, FASEB J (microARN y proteómica)](https://air.unimi.it/retrieve/handle/2434/804916/1691078/fj.201801625R.pdf)
  - [Danish Aerospace – Sarcolab (texto de NASA)](https://danishaerospace.com/en/sarcolab)

### 2.2 SLAMMD (masa corporal)

- **Cómo funciona:** aplica la 2.ª ley de Newton (m = F/a). Dos juegos de resortes empujan al astronauta por un riel, y la masa se calcula a partir de la aceleración.
- **Especificaciones:**
  - rango de 41 a 109 kg;
  - exactitud de ±227 g;
  - se toman 5 mediciones y se promedian las 3 mejores (según el estudio ENERGY).
- **Historia:** se probó en el STS-69 y se instaló en el HRF-1 en la Expedición 11. Según un artículo de 2019, el equipo principal de la ISS es el ruso **M08** y SLAMMD quedó de reserva. En 2024 todavía se le hacía mantenimiento en el módulo Columbus.
- **Registros en NLSP:**
  - experimento *Space Linear Acceleration Mass Measurement Device Evaluation* (STS-69, variable: masa corporal);
  - ficha del hardware.
  
  El portal es una aplicación web y no se pudo comprobar de forma automática si los datos se descargan libremente. La política general de NLSP para datos de tripulación es **por solicitud**, por privacidad.
- **Estudio con datos de SLAMMD: ENERGY** (Bourdier y col., *npj Microgravity* 2024):
  - 11 astronautas varones, con una sesión en Tierra y otra en vuelo;
  - en vuelo, la masa se midió con SLAMMD; la composición corporal, por hidrometría;
  - publica medias por grupo y los rangos de cambio individual: masa libre de grasa de **−5,4 a +1,3 kg** y masa grasa de **−3,5 a +5,3 kg**;
  - disponibilidad (cita textual): *"Data are accessible upon request to the authors."*
- **Fuentes:**
  - [NLSP – experimento SLAMMD](https://nlsp.nasa.gov/search/data/details/206e5bb2-a8ec-539a-86c8-c6eee861dcd7?dataType=EXPERIMENTS)
  - [NLSP – hardware SLAMMD](https://nlsp.nasa.gov/search/data/details/IDP-LSDA_HARDWARE-0000000000000097?dataType=HARDWARE)
  - [SAE 981652 – paper técnico de SLAMMD](https://saemobilus.sae.org/papers/space-linear-acceleration-mass-measurement-device-slammd-human-research-facility-hrf-981652)
  - [Wikipedia – Human Research Facility 1](https://en.wikipedia.org/wiki/Human_Research_Facility_1)
  - [AMHP 2019 – M08 frente a SLAMMD](https://meridian-asma-published.prime-prod-local.pubfactory.com/downloadpdf/view/journals/amhp/90/6/article-p587.pdf)
  - [Estudio ENERGY, npj Microgravity 2024 (PMC10973451)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10973451/)
  - [Blog de ESA – cómo se mide la masa en el espacio](https://blogs.esa.int/promisse/2012/02/10/measure-body-mass-in-space/)

### 2.3 Otros repositorios revisados

| Repositorio | Resultado |
|---|---|
| **NASA OSDR** (Open Science Data Repository) | Casi todo es de animales, plantas o *tissue chips*. Lo humano abierto es Inspiration4 (3 días: sangre, piel, hisopados), sin masa muscular ni ecografía. Hay estudios de músculo **en ratones** (por ejemplo, miostatina/activina A) |
| **NLSP/LSDA** | Los datos de vuelo de la tripulación son **por solicitud**. Solo los estudios de reposo en cama marcados *"All datasets are publicly available"* se descargan directo |
| data.gov | Un dataset abierto de microARN muscular en reposo en cama con hipoxia (biopsias del vasto lateral). No tiene medidas de tamaño muscular |

Fuentes: [NLSP en data.gov](https://catalog.data.gov/dataset/nasa-life-sciences-portal-nlsp) · [NLSP en re3data](https://www.re3data.org/repository/r3d100012480) · [OSDR – SOMA](https://www.nasa.gov/osdr-latest-news-soma-publications) · [Acceso a datos de Inspiration4 en OSDR (PMC11094041)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11094041/) · [Miostatina/activina A en vuelo (ratones)](https://catalog.data.gov/dataset/targeting-myostatin-activin-a-protects-against-skeletal-muscle-and-bone-loss-during-spacef) · [microARN en reposo en cama con hipoxia](https://catalog.data.gov/dataset/effects-of-bedrest-and-hypoxia-on-human-skeletal-muscle-mirna-expression-40cdb)

---

## 3. Equipos de medición muscular en vuelo

| Equipo | Agencia | Qué mide y cómo | Fuentes |
|---|---|---|---|
| **MARES** (Muscle Atrophy Research and Exercise System) | ESA; fabricante Sener | Dinamómetro: aplica velocidad o torque programables a 11 grupos musculares, en modo isométrico, concéntrico y excéntrico. Se lanzó el 5-4-2010 (STS-131) y está en el módulo Columbus. Se usa para investigación, no para el ejercicio diario | [ESA – MARES](https://esa.int/Our_Activities/Human_Spaceflight/Columbus/Muscle_Atrophy_Research_and_Exercise_System) · [ESA – MARES measuring muscle strength](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Research/a_style_color_000_href_http_www.esa.int_ESApod_SEMZWC8ZMRE_0.html_MARES_-_measuring_muscle_strength_in_space_a) · [Blog ESA "Taming a monster"](https://outpost42.esa.int/blog/taming-a-monster-esa-mares-experiment/) · [Sener](https://www.group.sener/en/project/muscle-atrophy-research-and-exercise-system-mares) |
| **MyotonPRO** (experimento Myotones) | ESA, DLR y UKSA; Charité de Berlín | Equipo de mano: da un pulso mecánico sobre la piel y mide la oscilación del músculo (tono, rigidez y elasticidad). Se lanzó en abril de 2018 | [DLR – Myotones](https://www.dlr.de/en/images/missions/cosmic-kiss/myotonpro-device/) · [Myoton – lanzamiento](https://www.myoton.com/news/myotonpro-successfully-launched-iss/) · [U. Southampton](https://www.southampton.ac.uk/research/projects/muscle-tone-in-space-myotones-experiment-on-the-iss-ilsra-2014-0015) |
| **Ecógrafo de la ISS** | NASA y ESA | Área y volumen muscular en vuelo (Sprint y Sarcolab). Ver 2.1 | Ver 2.1 |
| **SLAMMD** | NASA | Masa corporal por m = F/a. Ver 2.2 | Ver 2.2 |

## 4. Equipos de contramedida

| Equipo | Qué hace | Fuentes |
|---|---|---|
| **ARED** (NASA) | Cilindros de vacío y volantes de inercia que simulan pesas libres. En 16 semanas en Tierra dio aumentos de masa y fuerza similares a los de las pesas libres | [Loehr y col., MSSE 2011](https://www.pubmed.gov/20473227/) · [NTRS 20090005240](https://ntrs.nasa.gov/api/citations/20090005240/downloads/20090005240.pdf) |
| **Hybrid Training System** (JAXA) | Electroestimulación del músculo antagonista durante el movimiento. En 1 astronauta, en 4 semanas: tríceps **+11,7 %** de volumen (RM) y densidad ósea **+4,6 %**, contra −0,1 % y −1,2 % en el brazo de control | [PLoS ONE 2015 (PMC4546678)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4546678/) · [JAXA](https://humans-in-space.jaxa.jp/en/biz-lab/experiment/theme/detail/000923.html) |
| **EasyMotion / EasyMotion-2** (ESA, DLR y Charité) | Traje con electrodos en la tela (electroestimulación). Lo probó Maurer (2021); la versión 2 planea 8 astronautas. Los resultados van a tardar años | [ESA – EasyMotion-2](https://www.esa.int/articles/easymotion-2-using-electrical-stimulation-to-preserve-astronaut-muscles-in-space) · [DLR 2021](https://www.dlr.de/de/aktuelles/nachrichten/2021/04/20211222_matthias-maurer-unter-strom) · [Charité / HealthCapital](https://www.healthcapital.de/en/news/article/charite-forschung-auf-der-iss-hilft-muskelstimulation-im-all) |
| Electroestimulación de NASA (2025), cinta de correr y cicloergómetro | Estudio de electroestimulación en piernas y evaluaciones físicas en cinta | [Blog NASA ISS, 16-7-2025](https://www.nasa.gov/blogs/spacestation/2025/07/16/muscle-and-exercise-studies-to-maintain-crew-health-in-space/) |

## 5. Investigaciones con resultados

Ninguna publica datos crudos abiertos. Las cifras sirven como **valores de referencia de vuelo** (banda "ISS").

| Estudio | n y duración | Método | Resultado | Fuente |
|---|---|---|---|---|
| LeBlanc y col. 2000, Mir y Shuttle | Shuttle 17 d; Mir de 4 a 6 meses | RM antes y después del vuelo | Volumen muscular **−5 a −17 %**. Se estabiliza hacia los 4 meses y se recupera en 30–60 días | *J Appl Physiol* 89:2158 ([registro](https://scilit.com/publications/84d3c9fc39aca4988352fc55e5b64c97)) |
| LeBlanc y col. 1992, reposo en cama | 8 hombres, 17 semanas | RM y DPA | Pérdida de masa magra de 3,9 kg, casi toda en las piernas | [PubMed 1474100](https://pubmed.ncbi.nlm.nih.gov/1474100/) |
| Trappe y col. 2009 | 9 tripulantes, 6 meses en la ISS | RM de pantorrilla y biopsias | Pantorrilla **−13 %** (sóleo −15 %, gastrocnemio −10 %) y potencia pico **−32 %** | *J Appl Physiol* 106:1159 ([Marquette](https://epublications.marquette.edu/bio_fac/24/), [NTRS](https://ntrs.nasa.gov/api/citations/20090020693/downloads/20090020693.pdf)) |
| Fitts y col. 2010 | 9 tripulantes, ~180 días | Biopsias de fibras | Fibras tipo I del sóleo **−20 %**, fuerza de la fibra −35 % y potencia −55 % | *J Physiol* 588:3567, DOI 10.1113/jphysiol.2010.188508 ([PMC2988519](https://pmc.ncbi.nlm.nih.gov/articles/PMC2988519/)) |
| Genc, Gopalakrishnan y col. 2010 | 4 tripulantes, ~181 días | RM, fuerza y cargas de ejercicio | Bajan el volumen y la fuerza en las piernas pese al ejercicio | *Aviat Space Environ Med* 81:91 ([NTRS](https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20110015001.pdf)) |
| English y col. 2015 | 37 tripulantes | Fuerza isocinética | Fuerza **−8 a −17 %**. Con ARED se pierde hasta 7 % menos que con iRED | [PubMed 26630197](https://pubmed.ncbi.nlm.nih.gov/26630197/) |
| Sprint, English y col. 2020 | 9 frente a 17 tripulantes | Alta intensidad con menos volumen frente al estándar | Resultados similares con menos tiempo de ejercicio. Masa magra de pierna casi sin cambio | [PMC7434884](https://pmc.ncbi.nlm.nih.gov/articles/PMC7434884/) |
| Sarcolab, piloto 2018 | 2 tripulantes, 6 meses | RM, ecografía y biopsia | Sóleo **−10 % y −21 %** | [npj Microgravity 2018](https://link.springer.com/10.1038/s41526-018-0052-1) |
| Myotones, Schoenrock y col. 2024 | 12 tripulantes | MyotonPRO antes, durante y después del vuelo | La rigidez se conserva en la mayoría de los músculos. Cae en el sóleo y el tibial anterior | *Sci Rep* 14:4196, DOI 10.1038/s41598-024-54759-6 ([ScienceDaily](https://sciencedaily.com/releases/2024/03/240320122443.htm), [Myoton](https://myoton.com/publication/muscle-stiffness-indicating-mission-crew-health-in-space/)) |
| ENERGY, 2024 | 11 tripulantes | SLAMMD, hidrometría y calorimetría | Masa libre de grasa de −5,4 a +1,3 kg (rango individual) | [PMC10973451](https://pmc.ncbi.nlm.nih.gov/articles/PMC10973451/) |
| Músculos de la columna y del cuello | 6 a 9 tripulantes | RM 3T | Atrofia lumbar con recuperación incompleta | [Frontiers 2019](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2019.01115/pdf) · [NASA](https://www.nasa.gov/feature/astronauts-spines-under-scrutiny) |

## 6. Documentos de síntesis de NASA

- **Evidence Report 2022**, riesgo muscular y aeróbico: [NTRS 20220019338](https://ntrs.nasa.gov/citations/20220019338)
- **Página del riesgo** en NASA HHP: [Risk of Impaired Performance due to Reduced Muscle Size, Strength and Endurance](https://www.nasa.gov/directorates/esdmd/hhp/risk-of-impaired-performance-due-to-reduced-muscle-size-strength-and-endurance/)
- **Evidence Report 2015** (Ploutz-Snyder y col.): [NTRS 20150006969](https://ntrs.nasa.gov/citations/20150006969)

---

## 7. Qué implica para la herramienta

1. **Datos crudos por sujeto:** solo los de reposo en cama que ya están en `data/nlsp/`. Para la masa muscular sirve la masa magra por segmento de MR035G; para la fuerza, MR079G.
2. **Banda "ISS":** se arma con los porcentajes publicados de la sección 5:
   - volumen de pantorrilla de −10 a −15 % en 6 meses con el ejercicio de la época de iRED;
   - fuerza de −8 a −17 %;
   - con ARED las pérdidas son menores.
3. **Si se quieren datos de vuelo reales:** hay que hacer una solicitud en NLSP (Sprint, SLAMMD) o escribirles a los autores (ENERGY, Sarcolab). No es viable en los plazos del hackathon.
4. **Corrección a `investigacion-gravedad.md`:** la cifra de sóleo −5,8 % y gastrocnemio −4,0 % (OCHMO-TB-031) corresponde al ejercicio actual con ARED. Los estudios con iRED o anteriores muestran −10 a −20 %, y conviene aclararlo.

## 8. Limitaciones de esta revisión

- El portal NLSP es una aplicación web que no se pudo consultar de forma automática. Antes de descartar del todo los datos de SLAMMD, conviene **revisar a mano** la ficha del experimento SLAMMD y la de Sprint, para ver si alguna dice *"publicly available"*.
- Algunos datos de los papers (Sarcolab, LeBlanc 2000, Genc 2010) vienen del resumen o del registro bibliográfico, no del texto completo. Hay que verificarlos antes de citarlos en la entrega.
