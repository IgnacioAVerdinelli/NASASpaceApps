# Investigación: salud ocular en vuelo (SANS)

Base para la pestaña **Eyes**: por qué se mide el ojo, qué se mide en la ISS y con qué equipo, qué números publicó la NASA y cómo los simulamos. Relevado el 15/11/2026.

> **Resumen:** no hay datos públicos por persona de OCT, presión del ojo ni ecografía ocular de astronautas. La pestaña usa **datos simulados** a partir de los promedios publicados (§3) y de los umbrales del consenso de 2026 (§4). En la página hay que decirlo.

## 1. Por qué hace falta

**El problema: SANS** (*Spaceflight-Associated Neuro-ocular Syndrome*, síndrome neuro-ocular asociado al vuelo espacial).

- **Qué lo causa:** en la Tierra, la gravedad tira de la sangre y del líquido cefalorraquídeo hacia los pies. Al estar de pie, la presión dentro del cráneo baja a la mitad (−51 % al pasar de acostado a parado; consenso 2026). En microgravedad unos 2 L de líquido suben hacia el tórax y la cabeza y **esa bajada diaria no ocurre nunca**. El ojo y el nervio óptico quedan con una carga continua de presión y congestión venosa durante toda la misión.
- **Qué le pasa al ojo:**
  - el disco óptico se hincha (**edema del disco**);
  - la coroides, la capa de vasos detrás de la retina, se engrosa;
  - aparecen **pliegues** en la coroides y la retina;
  - la parte de atrás del globo se **aplana**, el ojo se acorta y la visión se corre hacia la **hipermetropía**: cuesta ver de cerca.
- **Qué tan frecuente es:** el 81 % de los astronautas de la NASA en misiones largas tuvo al menos un signo (52 de 64). El 60 % refiere peor visión en misiones largas (cuestionario de unos 300 astronautas).
- **Por qué importa:**
  - **Durante la misión:** leer procedimientos, pantallas y etiquetas, y operar equipos depende de la visión de cerca. A bordo hay anteojos de distintas graduaciones por si la visión cambia (*Space Anticipation Glasses*); si el cambio supera la graduación más fuerte, es un problema operativo.
  - **Después:** algunos cambios **duran años** o no se recuperan (Mader 2011; el ojo sigue más corto un año después, Macias 2020).
  - **Para Marte:** el riesgo crece con la duración. En la misión de 1 año, un tripulante desarrolló edema recién en la segunda mitad y otro tuvo pliegues y edema que avanzaron todo el año (Macias 2021). No hay evacuación ni oftalmólogo, así que **detectarlo a bordo y temprano** es la única opción. Hoy no hay tratamiento probado; las contramedidas en estudio (presión negativa en la parte inferior del cuerpo, manguitos en los muslos) se deciden con estos datos.
- **Qué busca la pestaña:** detectar el cambio **antes** de que afecte la visión, con el OCT como primera señal, y convertirlo en una tarea concreta del Planner (revisión del médico de vuelo).

## 2. Qué se mide, con qué y cuándo

Norma OCHMO-STD-100.1A, requisito **6012** (*Specialized ocular assessment*): días de vuelo 30 y 90 y 30 días antes del regreso en misiones de 6 meses, más antes y después del vuelo. El consenso de 2026 confirma ese calendario.

| Prueba | Equipo en la ISS | Qué da | Para qué |
|---|---|---|---|
| **OCT** (tomografía de coherencia óptica) | Heidelberg **Spectralis** (OCT1; luego OCT2, más rápido). Sus imágenes infrarrojas y MultiColor reemplazan la foto de fondo de ojo de rutina | Espesor retiniano total peripapilar (TRT), ancho mínimo del borde del nervio (BMO-MRW), capa de fibras nerviosas (RNFL), espesor de la coroides, pliegues | **La prueba principal.** Detecta edema que el examen clínico todavía no ve |
| **Fondo de ojo** | Cámara de fondo de ojo / imágenes del OCT | Grado de edema (escala de **Frisén**, 0 a 5), pliegues, manchas algodonosas | Confirmar lo que ve el OCT. Poco sensible para cambios leves |
| **Agudeza visual, rejilla de Amsler y cuestionario** | Laptop de la estación | Líneas de la cartilla, distorsiones, síntomas | Lo que nota el tripulante |
| **Tonometría** (presión del ojo) | Tonómetro portátil; en la presentación de 2018, solo la tripulación de la ESA | Presión intraocular (mmHg) | Contexto. **No sirve** para estimar la presión dentro del cráneo |
| **Ecografía ocular** | GE **Vivid q** ("Ultrasound-2", desde 2011), reemplazado por el **Vivid iq** (llegó en septiembre de 2025) | Diámetro de la vaina del nervio óptico (ONSD) a 3 mm detrás del globo; aplanamiento del globo | Indicador indirecto de la presión dentro del cráneo |
| Campo visual | Desde fines de 2025 en la ISS | Mancha ciega agrandada, escotomas | Solo en casos que ya preocupan |
| Resonancia (MRI) | Solo en Tierra, antes y después | Aplanamiento del globo, nervio óptico | Fuera de la pestaña |

## 3. Números publicados

| Medida | Valor | n | Fuente |
|---|---|---|---|
| Borde del nervio óptico (MRW) | **+35,7 µm** en el día de vuelo 150 (IC 95 %: 28,5–42,9) | 11, misión de 170 ± 19 días | Macias 2020 |
| Espesor de la coroides | **+43 µm** en el día de vuelo 150 (IC 95 %: 35–46) | 11 | Macias 2020 |
| Evolución | Ambos suben desde el comienzo del vuelo; el máximo suele estar cerca del final | 11 | Macias 2020 |
| Largo del ojo | **−0,08 mm** después del vuelo; −0,05 mm al año | 11 | Macias 2020 |
| TRT en vuelo frente a reposo en cama, 30 días | El reposo en cama hincha la retina 37 µm **más** que el vuelo; la coroides no cambia en reposo y en vuelo crece 27 µm más | 20 astronautas, 11 en reposo | Laurie 2020 |
| Misión de 1 año, tripulante 1 | MRW 561 µm (**+149**) en el día 270; TRT 547 µm (**+135**) en el día 90; edema y pliegues progresivos | 1 | Macias 2021 |
| Misión de 1 año, tripulante 2 | MRW 539 µm (**+56**) en el día 270; TRT 528 µm (**+45**) en el día 210; edema leve tardío | 1 | Macias 2021 |
| RNFL circumpapilar | +2,9 µm de mediana después del vuelo | 15 | Patel 2018 |
| Signos de SANS en misiones largas | Edema del disco **69 %** (48); pliegues **25 %** (64); aplanamiento del globo **37 %** (43); cambio de graduación **20 %** (45); cualquiera **81 %** (64) | 64 | Consenso 2026, tabla 1 |
| Edema clínico (Frisén 1–3) | ~**15 %** de los astronautas | — | Lee 2020 (revisión), comunicación personal |
| Cambio de graduación | Hipermetropía de +0,50 a +1,75 D en 5 de 7 casos | 7 | Mader 2011 |
| Visión referida | 60 % en misiones largas y 29 % en cortas notan peor visión | ~300 | Mader 2011 |
| Vaina del nervio (ONSD) | 5,98 mm antes del vuelo; estable después. En vuelo, +0,91 mm frente al regreso (retrospectivo) | — | Revisión ONSD 2022 |
| ONSD según signos | 7,2 ± 1,5 mm con aplanamiento del globo frente a 5,8 ± 0,6 mm sin él | — | Revisión ONSD 2022 |
| Presión dentro del cráneo | Estimada en +6 mmHg tras misiones largas (por cambios en la hipófisis en la MRI) | — | Consenso 2026 |
| Repetición | Haber tenido SANS predice tenerlo en la misión siguiente, con gravedad parecida | 16 | Consenso 2026 |
| Presión del ojo en reposo en cama, 70 días | 12,90 → 13,86 mmHg | — | NTRS 2014 |

**Lo que no encontramos:** valores de presión del ojo **en vuelo** y series por persona. La presión del ojo de la pestaña es un supuesto.

## 4. Umbrales de alerta: consenso de 2026

Tabla 2 del consenso de expertos (*Eye*, 2026), con valores del OCT Spectralis. Alcanza con un criterio para entrar en cada clase.

| Signo | Clase A: primera señal | Clase B: preocupa clínicamente | Clase C: impacto funcional agudo | Clase D: posible daño a largo plazo |
|---|---|---|---|---|
| Edema del disco | TRT **≥ +20 µm** promedio, o edema leve sin llegar a Frisén 1 | TRT **≥ +55 µm** o Frisén ≥ 1 | Pérdida de campo visual (mancha ciega agrandada) | Pérdida permanente de campo visual o RNFL más fina |
| Pliegues coroideos o retinianos | Cualquier pliegue | Pliegues marcados cerca de la mácula | Visión central distorsionada | Distorsión permanente, atrofia o neovasos |
| Aplanamiento del globo | Cualquier aplanamiento o ojo más corto | Cambio moderado | Sin definir | Sin definir |
| Cambio de graduación | **> +0,50 D** | Cerca del límite de los anteojos de a bordo | Más allá del límite de los anteojos | Sin definir |

El umbral de +20 µm se eligió para tener poco riesgo de error de medición o de variación normal. Con ese umbral, alrededor del 66 % de los astronautas en misiones largas tendría edema por SANS.

**Cómo lo usamos:**
- **Clase A** → aviso "Check needed" y el Planner agenda una revisión del médico de vuelo.
- **Clase B o más** → alarma.
- La comparación es siempre **contra la referencia previa al vuelo de la misma persona**, como en fuerza y VO2.

## 5. Datos abiertos: qué hay y qué no

Búsqueda del 15/11/2026 en los portales que indica la discusión del challenge ([#2133](https://github.com/nasa/spaceapps/discussions/2133)).

- **NLSP** (de donde vienen nuestros datos de reposo en cama). 109 experimentos con humanos sobre ojos, venas o fluidos; ninguno con datos públicos útiles:
  - `Ocular_Health`, el estudio de la ISS: todavía en curso, sin publicar;
  - `ESA_BRSM_Ocular` (envihab) y `CO2_Head_Down_Tilt`: por solicitud formal;
  - `SD_OCT`, `Risk_Factors_HDT`, `NNX16AG96G` y `80NSSC20K0920`: todavía en curso, sin publicar;
  - los 14 públicos son de las épocas del Shuttle y de Gemini, o artículos del boletín de LSAH.
- **OSDR:** los datos de ojos con descarga libre son de **animales** (ratones en vuelo: OSD-715, 397, 758 y 759; ratas en reposo simulado con OCT, tonometría y ecografía: OSD-679, 680 y 681) o de **tejido humano de donante** (OSD-816).
- **LSAH** (seguimiento médico de astronautas): tiene los OCT de casi todos los astronautas, pero solo con solicitud.

## 6. Modelo de simulación

Para cada tripulante, igual que el resto de `gravsim`. Todo lo marcado **supuesto** es nuestro, no de la NASA.

| Parámetro | Valor | Base |
|---|---|---|
| Momentos | Antes del vuelo, días 30 y 90, 30 días antes del regreso y después del regreso | Norma 6012 y consenso 2026 |
| Referencia de TRT y MRW | Según la persona, del orden de 400–480 µm | Valores previos al vuelo de Macias 2021 (MRW 412 y 483 µm) |
| Cambio de MRW | Sube desde el inicio del vuelo y llega a **+36 µm** de promedio en el día 150 | Macias 2020 |
| Cambio de coroides | Sube de forma parecida, **+43 µm** de promedio en el día 150 | Macias 2020 |
| Cambio de TRT | Sigue al MRW; la variación entre personas hace que ~2 de cada 3 superen +20 µm al final | Consenso 2026 (66–69 %) |
| Variación entre personas | Se elige para reproducir las proporciones de §3: ~15 % llega a Frisén ≥ 1, ~25 % tiene pliegues | Consenso 2026 y Lee 2020; el reparto exacto es **supuesto** |
| Ruido del OCT | ~5 µm entre mediciones repetidas | **Supuesto**, menor que el umbral de +20 µm, como dice el consenso |
| Graduación | Hacia la hipermetropía; ~20 % supera +0,50 D | Consenso 2026; Mader 2011 |
| Largo del ojo | −0,08 mm al regreso, sin recuperación completa | Macias 2020 |
| Vaina del nervio (ONSD) | ~6,0 mm antes del vuelo; sube cerca de 0,9 mm en vuelo; más en quienes tienen aplanamiento del globo | Revisión ONSD 2022 |
| Presión del ojo | ~13 mmHg, sin tendencia clara | **Supuesto**; no hay valores públicos en vuelo |
| Agudeza visual | Cae algo en quienes tienen cambio de graduación; ~60 % lo refiere en el cuestionario | Mader 2011 |
| Persistencia | Quien tuvo SANS en una misión anterior tiene más riesgo | Consenso 2026 |

## 7. La pestaña "Eyes"

Una sola pestaña que resume todas las pruebas oculares:

1. **Estado arriba:** la clase de SANS del tripulante (sin signos, A, B, C) con una frase simple.
2. **OCT, la señal principal:** el cambio de TRT, MRW y coroides contra la referencia previa en cada control, con las líneas de +20 y +55 µm.
3. **Tarjetas de las otras pruebas:** fondo de ojo (Frisén y pliegues), agudeza visual y graduación, vaina del nervio, presión del ojo, cada una con su valor, su referencia y su fecha.
4. **Próximo control:** del Planner (rutina 6012).
5. **Aclaración:** datos simulados a partir de publicaciones de la NASA; las imágenes son ilustrativas.

## 8. Implementación (rama `feat/eye-tab`)

| Parte | Dónde | Qué hace |
|---|---|---|
| Simulador | `sim/gravsim/ocular.py` (`OcularExam`, `SansProfile`, `set_sans`) | Un perfil de SANS por tripulante con los números de §6; 11 medidas, ruido propio en unidades absolutas |
| Calendario | `sim/gravsim/schedule.py`, instrumento `ocular` | Antes del vuelo, FD30, FD90, cada 90 días, R−30; R+3, R+30, R+180 |
| Medidas | `params.json` (vía `sim/fit/fit_params.py`, `ASSUMED_OCULAR`), `units.py`, `pipeline.py` | Unidades µm, mm, D, logMAR, grade y flag, con sus límites |
| Demo | `gravsim.serve --sans CM-1:1.5`; `SANS=` en `scripts/demo.sh` | Un tripulante con susceptibilidad alta (clase B cerca de FD90) |
| Análisis | `health/healthservice/eyes.py`; `GET /api/v1/eyes?crew=&day=` | Cada examen contra el previo al vuelo; clases A y B del consenso de 2026 |
| Hallazgos | Worker (`healthservice.demo`), `source: ocular`, medida `eyes` | Clase A: sospechado; clase B: confirmado; sin signos: cerrado |
| Planner | `plan.py`, rutina 6012 en el catálogo | La rutina se cierra sola con el examen; un hallazgo ocular agenda una revisión del médico de vuelo |
| Página | `src/front/sketch/ojos/` (`EyesView`, `EyeDiagram`), `data/eyes.js`, pestaña "Eyes" en `vuelo/Shell.jsx` | Estado, ojo animado por examen, gráfico OCT con las líneas de +20 y +55 µm y una tarjeta por prueba |

El dibujo del ojo exagera los cambios unas 40 veces para que se vean; los valores están en las tarjetas. Las clases C y D no se simulan: requieren campo visual y seguimiento a largo plazo.

Tests: `sim/tests/test_ocular.py` (las proporciones publicadas se reproducen), `health/tests/test_eyes.py`, `planner/tests/test_plan.py` y `tests/eyes.test.mjs`.

## Fuentes

- Gew J, Brunstetter T, Tarver W, Mason SS, Gibson CR y col., 2026. *Spaceflight-associated neuro-ocular syndrome (SANS): expert consensus on diagnosis and management.* Eye. [PMC13462731](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13462731/fullTextXML)
- Macias BR y col., 2020. *Association of Long-Duration Spaceflight With Anterior and Posterior Ocular Structure Changes in Astronauts and Their Recovery.* JAMA Ophthalmol 138(5):553–559. [doi:10.1001/jamaophthalmol.2020.0673](https://doi.org/10.1001/jamaophthalmol.2020.0673)
- Laurie SS y col., 2020. *Optic Disc Edema and Choroidal Engorgement in Astronauts During Spaceflight and Individuals Exposed to Bed Rest.* JAMA Ophthalmol. [doi:10.1001/jamaophthalmol.2019.5261](https://doi.org/10.1001/jamaophthalmol.2019.5261)
- Macias BR y col., 2021. *Changes in the Optic Nerve Head and Choroid Over 1 Year of Spaceflight.* JAMA Ophthalmol. [doi:10.1001/jamaophthalmol.2021.0931](https://doi.org/10.1001/jamaophthalmol.2021.0931)
- Mader TH y col., 2011. *Optic disc edema, globe flattening, choroidal folds, and hyperopic shifts observed in astronauts after long-duration space flight.* Ophthalmology 118(10):2058–69. [doi:10.1016/j.ophtha.2011.06.021](https://doi.org/10.1016/j.ophtha.2011.06.021)
- Patel N y col., 2018. *Optical Coherence Tomography Analysis of the Optic Nerve Head and Surrounding Structures in Long-Duration ISS Astronauts.* JAMA Ophthalmol. [doi:10.1001/jamaophthalmol.2017.6226](https://doi.org/10.1001/jamaophthalmol.2017.6226)
- Lee AG y col., 2020. *Spaceflight associated neuro-ocular syndrome (SANS) and the neuro-ophthalmologic effects of microgravity: a review and an update.* npj Microgravity. [PMC7005826](https://pmc.ncbi.nlm.nih.gov/articles/PMC7005826)
- Fall DA, Lee AG y col., 2022. *Optic nerve sheath diameter and spaceflight: defining shortcomings and future directions*. npj Microgravity. [PMC9537149](https://pmc.ncbi.nlm.nih.gov/articles/PMC9537149)
- Meer E, Church y col., 2025. *Non invasive monitoring for spaceflight associated neuro ocular syndrome*. npj Microgravity. [PMC12402340](https://pmc.ncbi.nlm.nih.gov/articles/PMC12402340)
- Zwart SR, Macias BR y col., 2023. *Optic disc edema during strict 6° head-down tilt bed rest is related to one-carbon metabolism pathway genetics and optic cup volume*. Front Ophthalmol. [PMC11182205](https://pmc.ncbi.nlm.nih.gov/articles/PMC11182205)
- NASA NTRS: [pruebas de SANS a la tripulación, 2018](https://ntrs.nasa.gov/api/citations/20180004916/downloads/20180004916.pdf); [actualización a OCT2](https://ntrs.nasa.gov/api/citations/20170009598/downloads/20170009598.pdf); [presión del ojo en reposo de 70 días](https://ntrs.nasa.gov/api/citations/20140008716/downloads/20140008716.pdf)
- Equipos: [NASA, Ultrasound-2](https://www.nasa.gov/ames/space-biosciences/ultrasound-2-sts-135); [GE HealthCare, Vivid iq a la ISS](https://www.gehealthcare.com/en/about/newsroom/press-releases/taking-innovative-technology-to-the-final-frontier-ge-healthcares-vivid-iq-ultrasound-system-launches-to-the-international-space-station)
- Norma: OCHMO-STD-100.1A Rev. A, requisito 6012 (`docs/references/`)
