# Seguimiento muscular y funcional con análisis a bordo

**Recopilación de evidencia · 14 de noviembre de 2026**

## 1. Alcance planteado por el equipo

Mostrar al astronauta cambios en su estado muscular y capacidad funcional respecto de mediciones personales anteriores, aun cuando no pueda consultar a Tierra. El resultado buscado es reconocer y comprender una tendencia, con su calidad y límites; no prescribir entrenamiento ni diagnosticar degradación de todos los órganos.

Distinguir **tamaño muscular**, **fuerza**, **resistencia**, **propiedades mecánicas** y **actividad realizada**. No son intercambiables: cumplir ejercicio, tener cierto pulso o perder masa corporal no permite calcular por sí solo un porcentaje de pérdida muscular. El reloj y Bio-Monitor aportan contexto fisiológico, pero no miden directamente masa muscular.

## 2. Qué aporta el hilo solicitado

La [discusión #2133](https://github.com/nasa/spaceapps/discussions/2133) recomienda OSDR, NASA Life Sciences Portal y HRP, además de tendencias personales y datos sintéticos identificados. Está marcada **Navigator answered**: es orientación voluntaria alojada en el repositorio de NASA; no es una respuesta del GO Team ni una especificación médica oficial.

Para este nicho, **HRP** sirve para justificar el riesgo; **NLSP/LSDA**, para localizar estudios humanos y solicitar registros; **OSDR**, para buscar estudios específicos y comprobar organismo, procedimiento y archivos. Que un estudio diga “muscle loss” no significa que entregue medidas utilizables por sensores a bordo: puede contener biopsias o expresión génica.

## 3. Cómo se trabaja actualmente

Antes del vuelo se establece una referencia de fuerza, condición aeróbica y composición corporal. Durante el vuelo se registran las sesiones de ejercicio y se realizan evaluaciones; especialistas en Tierra revisan los datos y ajustan las prescripciones. La [norma médica de NASA, §6.4.2](https://ntrs.nasa.gov/api/citations/20240006194/downloads/OCHMO%20STD%20100%201A%2005142024.pdf) describe envío de datos y videos de ejercicio a Tierra, revisión recurrente, video de ARED dentro de los primeros 14 días y luego al menos cada 30, y consultas privadas de ejercicio mensuales. Esto no significa que se mida masa muscular diariamente.

El [Technical Brief de ejercicio](https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/) describe ecografía guiada para vigilar tamaño muscular en vuelo y evaluaciones de fuerza antes/después del vuelo. Un [registro operativo de Sprint](https://www.nasa.gov/blogs/stationreport/2017/08/31/iss-daily-summary-report-8-31-2017/) documenta ecografías de muslo y pantorrilla con marcas anatómicas y orientación remota del equipo terrestre. Son capacidades de investigaciones concretas, no controles universales de todos los tripulantes.

El ejercicio es una contramedida importante, pero no garantiza igual protección en todas las personas. El [estudio de Scott et al. (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9898566/) analiza 46 astronautas y encuentra respuestas individuales diversas pese al ejercicio. No corresponde extrapolar una pendiente fija de pérdida a varios años de viaje marciano.

## 4. Mediciones que se adaptan

| Medición | Cómo se obtiene | Qué permitiría mostrar | Frecuencia y límites |
| --- | --- | --- | --- |
| Área transversal de músculos concretos | Ecografía panorámica con sitio y protocolo repetibles; imagen procesada para medir el área. | Cambio estructural de la zona medida respecto de una referencia comparable. | Sesiones de investigación; no se confirmó frecuencia clínica universal. El estudio Tele-SUS encontró que el espesor aislado no detectaba adecuadamente el cambio y validó el área panorámica frente a MRI. No convertir área local en masa corporal total. [Estudio Tele-SUS](https://pmc.ncbi.nlm.nih.gov/articles/PMC8047175/). |
| Fuerza isométrica | Isometric mid-thigh pull en ARED, bajo protocolo estandarizado. | Cambio de fuerza respecto de la referencia, conservando ensayo y condiciones. | CIPHER describe una evaluación hacia el día 14 y otra unas dos semanas antes del regreso. Es un calendario de investigación, no una medida diaria. [Protocolo SpacePhys/CIPHER](https://ntrs.nasa.gov/api/citations/20240000934/downloads/SpacePhys%20_IWS%20HRP%20poster_2024_final.pdf). |
| Tono, rigidez y elasticidad | MyotonPRO aplica un impulso breve sobre puntos anatómicos y analiza la respuesta del tejido. | Cambios mecánicos locales, con un panel propio. | Myotones se hace antes, durante y después del vuelo; no equivale a medir masa. [ESA: Myotones](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/epsilon/Myotones_measuring_muscle_health_in_space). |
| Ejercicio realizado | Carga, repeticiones, series, duración y tipo de ejercicio de ARED; velocidad/carga/tiempo de T2 y CEVIS. | Contexto y cumplimiento del plan registrado. | Por sesión; no es una medición directa de músculo conservado. [NASA: seguimiento](https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/). |
| Capacidad aeróbica | Prueba VO₂peak y protocolo de esfuerzo. | Evolución cardiorrespiratoria, en una dimensión separada de la fuerza. | SpacePhys describe días 14, 75 y unas dos semanas antes del regreso. [Protocolo](https://ntrs.nasa.gov/api/citations/20240000934/downloads/SpacePhys%20_IWS%20HRP%20poster_2024_final.pdf). |
| Masa corporal, alimentación y fatiga percibida | Medidor de masa, registro de ingesta y autorreporte. | Contextualizar los cambios y evidenciar datos faltantes. | Rutinas y periodicidades diferentes; no estimar pérdida muscular solo con estas variables. |

MRI, DXA y dinamometría isocinética aportan referencias y resultados antes/después del vuelo, pero no deben presentarse como equipos rutinarios de imagen disponibles a bordo de la ISS. La pérdida de fuerza y de tamaño puede seguir trayectorias distintas.

## 5. Fuentes y disponibilidad de datos

| Fuente específica | Datos o evidencia que aporta | Encaje y acceso comprobado |
| --- | --- | --- |
| [Scott et al. 2023: 46 astronautas](https://pmc.ncbi.nlm.nih.gov/articles/PMC9898566/) | Ejercicio, variables musculares, aeróbicas, óseas y de composición corporal; tablas y suplemento públicos. | Muy pertinente como fundamento. Los datos individuales requieren solicitud a LSDA, según la declaración del artículo. No es un CSV abierto confirmado. |
| [NASA Sprint Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7434884/) | Tablas de fuerza/resistencia y composición corporal; comparación entre protocolos de ejercicio. | Resultados agregados públicos, útiles como referencia; no tratar medias de grupos como registros individuales para entrenamiento. |
| [Teleguided self-ultrasound scanning](https://pmc.ncbi.nlm.nih.gov/articles/PMC8047175/) | Método de seguimiento longitudinal del tamaño muscular en vuelo mediante ecografía. | Fuente específica para profundizar en adquisición y medición; no se verificó una descarga de imágenes individuales etiquetadas. |
| [Myotones / estudio de rigidez muscular](https://pmc.ncbi.nlm.nih.gov/articles/PMC10879143/) | Mediciones mecánicas antes, durante y después del vuelo. | Corresponde a propiedades locales; falta verificar archivos reutilizables y condiciones de acceso. |
| [NASA NLSP](https://nlsp.nasa.gov/) | Catálogo de estudios humanos espaciales y análogos. | Buscar Sprint, muscle ultrasound, muscle strength, Myotones, Sarcolab y bed rest. Revisar el acceso de cada estudio; portal no implica descarga inmediata. |
| [OSDR OS-568: Exercise Countermeasure for Bedrest Deconditioning](https://osdr.nasa.gov/bio/repo/data/experiments/OS-568) | Análogo terrestre de 30 días con grupos de ejercicio y evaluación muscular. | Registro de experimento pertinente para localizar resultados; no se verificó un CSV numérico abierto. Es reposo terrestre, no vuelo espacial. |
| [OSDR OSD-195](https://data.nasa.gov/dataset/effects-of-21-days-of-bedrest-on-human-skeletal-muscle-gene-expression), [OSD-51](https://data.nasa.gov/dataset/woman-skeletal-muscle-transcriptome-with-bed-rest-and-countermeasures), [OSD-942](https://osdr.nasa.gov/bio/repo/data/studies/OSD-942) | Expresión génica de músculo humano en reposo en cama y contramedidas. | Datos biológicos pertinentes al mecanismo, pero no adecuados como entrada del MVP con reloj/ARED/ecografía: requieren muestras de tejido y otra tarea científica. |

Ninguna de estas búsquedas confirmó un CSV público individual que combine ecografía, fuerza y entrenamiento durante una misión. Los portales ambientales EDA/RadLab y los signos vitales BIDMC tampoco proporcionan por sí solos etiquetas de pérdida muscular. Si el acceso individual no llega para el hackathon, usar series sintéticas explícitas con magnitudes y protocolos documentados; no presentar ese entrenamiento como validación con astronautas.

## 6. Análisis local que encaja con la propuesta

Entrada principal: evaluaciones musculares comparables con su referencia personal. Contexto: ejercicio, alimentación y fatiga. Salida: cambio por músculo o prueba, evolución, calidad, fecha de la última evaluación y suficiencia de evidencia. Ejemplo ficticio: “El área medida en esta zona está por debajo de tu referencia; la segunda sesión confirma la tendencia”. Si solo hay registro de entrenamiento, informar qué ocurrió con el entrenamiento y que falta una medición estructural o funcional.

El cálculo básico de cambio porcentual no necesita entrenar un modelo. ML tendría sentido para una tarea específica con etiquetas, por ejemplo segmentar músculo en ecografías o detectar adquisiciones de mala calidad. Proyectar años de degradación o afirmar cuánto músculo queda requiere validación adicional. Comparar solo el mismo sitio, método y condiciones, considerando repetibilidad, incertidumbre y efectos de fluidos.

El aporte del prototipo sería hacer visible a bordo una interpretación longitudinal que hoy recibe apoyo terrestre, conservarla sin conexión y sincronizar un resumen cuando haya enlace. No se ha demostrado que los astronautas actuales carezcan de acceso a sus resultados; la necesidad defendible es sostener el análisis y seguimiento cuando falte el apoyo habitual.

## 7. Otros nichos para comparar sin ampliar el MVP

- **Fatiga y rendimiento cognitivo:** Actiwatch, diario de sueño y pruebas de reacción ofrecen medidas repetibles. [NASA Reaction Self Test](https://www.nasa.gov/wp-content/uploads/2022/03/iss_technical_publication_030116.pdf) describe una prueba de cinco minutos. Permite hablar de cambios de atención/rendimiento; no diagnosticar trastornos psicológicos a partir del reloj.
- **Cambios cardiovasculares:** ecografía y pruebas de capacidad aeróbica permiten seguir parámetros concretos. [ESA EchoFinder-2](https://www.esa.int/ESA_Multimedia/Images/2026/01/Finding_the_echo) investiga guía autónoma de adquisición usando referencias previas; estudiar un órgano requeriría elegir un parámetro y validar su interpretación.
- **Hueso/médula/sangre:** [CSA MARROW](https://www.asc-csa.gc.ca/eng/sciences/marrow.asp) combina muestras durante el vuelo con MRI antes/después. Tiene mayor dependencia de análisis de muestras e infraestructura; no es un sensor continuo de “degradación de órganos”.

Para el alcance muscular propuesto, el primer requisito de datos es una serie de **ecografías cuantificadas y/o pruebas de fuerza comparables**. Si solo se puede usar reloj y Bio-Monitor, conviene elegir una salida que estos midan con respaldo, como sueño/actividad o respuesta fisiológica al ejercicio.

## 8. Profundización: dependencia de Tierra y alcance informativo

La primera función acordada es **informar sobre cambios observados**, compararlos con la referencia personal y contextualizarlos con evidencia de estudios. Las recomendaciones de intervención quedan para una etapa posterior. La adquisición, cuantificación, interpretación y presentación son pasos distintos: hacer autónomo uno no demuestra autonomía de los demás.

El [estudio Tele-SUS de 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8047175/) documenta 74 sesiones en 11 astronautas durante vuelos de unos seis meses. El protocolo panorámico utilizó referencias previas y guías de posición; las imágenes se adquirían durante disponibilidad de enlace Ku y se repetían hasta obtener calidad comparable o terminar la ventana de adquisición. Las sesiones duraron entre 33 y 82 minutos. Se estudiaron músculos de muslo y pantorrilla: no constituye un escaneo continuo de todo el cuerpo. La variabilidad entre evaluadores también debe considerarse antes de interpretar pequeños cambios como pérdida real.

**Actualización respecto de la tabla inicial:** el área transversal obtenida mediante ecografía panorámica tiene respaldo específico en este estudio; el espesor aislado no detectó adecuadamente los cambios. Se debe seleccionar el parámetro y protocolo antes de decidir qué CSV recibe el sistema.

La [ESA documenta en marzo de 2026 sesiones de EchoFinder](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/epsilon/EchoFinder_Augmented_reality_and_artificial_intelligence_for_ultrasound_scans), que guía la colocación de la sonda y registra imágenes sin asistencia terrestre en tiempo real. La misma fuente mantiene el diagnóstico en equipos médicos de Tierra. No demuestra segmentación muscular autónoma ni cuantificación de atrofia: es un antecedente de independencia en la adquisición.

## 9. Qué representa el humano 3D

Usar el cuerpo como mapa anatómico seleccionable. Colorear solo regiones con datos y mostrar las demás como no evaluadas. Al seleccionar una región, indicar músculo, sitio, lado, magnitud, método, referencia, fecha y calidad. La figura preflight puede servir como referencia visual, pero una medida de área transversal no reconstruye el volumen tridimensional ni la silueta corporal real.

Si la demo deforma un músculo para comunicar un cambio, identificar esa deformación como ilustrativa. Para una primera versión es más fiel colorear la región y mostrar el cambio numérico con su incertidumbre que reducir proporcionalmente toda la pierna. Un porcentaje de área no equivale al mismo porcentaje de fuerza ni de masa. Evitar un único porcentaje de “degradación del astronauta”.

## 10. Comparación personal y estudios

Primera referencia: mediciones previas de la misma persona, músculo, sitio y técnica, idealmente repetidas. Mostrar cambio absoluto y relativo, fecha, variabilidad de referencia y calidad de adquisición. Una referencia preflight no tiene por qué coincidir con el día exacto de lanzamiento; indicar su fecha real.

Segunda referencia: una cohorte publicada comparable en técnica, músculo, fase y duración de misión y contramedidas. Los resultados de [Scott et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9898566/) muestran diferencias importantes entre personas y entre sistemas; no son valores que cada astronauta “debería tener”. No convertir un resultado después del aterrizaje en una medición del mismo día dentro de la nave.

| Disponibilidad del estudio | Representación adecuada |
| --- | --- |
| Datos individuales reutilizables | Distribución, histograma o puntos individuales con marcador de la persona; aclarar tamaño y selección de cohorte. |
| Medias y desviaciones, errores o intervalos publicados | Puntos y barras que conserven el significado estadístico original. No fabricar un histograma ni percentiles. |
| Datos por varios momentos comparables | Trayectoria de referencia junto a la trayectoria personal; distinguir mediciones durante vuelo y después de aterrizar. |

Los datos individuales del estudio de 46 astronautas se solicitan a LSDA. Antes de construir una comparación de cohortes, verificar acceso, variables, permisos y fechas. Si se genera una población sintética para la demo, etiquetarla; no presentarla como distribución observada en astronautas.

## 11. Mostrar evolución futura

Separar observación, tendencia y proyección. La primera versión puede informar “estas mediciones muestran un descenso” cuando la calidad y repetibilidad lo sostienen. Una proyección puede incorporarse como escenario condicionado, con horizonte e incertidumbre y evaluación retrospectiva; no como predicción clínica validada.

No extrapolar linealmente meses de ISS a años de viaje marciano: cambian gravedad, equipos, exposición y contramedidas. Tampoco deducir degradación estructural con solo datos de actividad. La ausencia de datos debe permanecer visible.

La función informativa mínima queda así: **región medida → comparación personal → contexto de estudios → evidencia e incertidumbre**. No necesita una recomendación de tratamiento para mostrar el aporte de un análisis local y disponible sin conexión.
