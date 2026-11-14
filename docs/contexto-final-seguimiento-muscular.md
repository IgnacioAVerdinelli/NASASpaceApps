# Contexto final de trabajo: seguimiento muscular con análisis a bordo

**NASA Space Apps Challenge 2026 · Acuerdos y evidencia recopilados con Nacho · 14 de noviembre de 2026**

Este documento consolida el enfoque acordado, sus fundamentos y los pendientes que condicionan la implementación. “Final” se refiere al cierre de esta conversación de contexto, no a una validación clínica ni a que las integraciones y datasets estén resueltos.

## 1. Decisión de alcance

Concentrarnos en un problema específico: **ayudar al astronauta a comprender cambios musculares y funcionales durante una misión, comparándolos con su referencia personal previa al vuelo y con estudios pertinentes, aun sin conexión con Tierra**.

La primera función es informar: qué cambió, en qué región, con qué medición, cuánto respaldo tiene y cómo evolucionó. Las recomendaciones de entrenamiento o tratamiento se consideran una etapa posterior. Tampoco intentaremos diagnosticar la degradación de todos los órganos.

El recorte es el interior de una nave o estación. Las caminatas espaciales sí tienen datos y estudios, pero constituyen otro contexto de esfuerzo, traje y sensores; no las usaremos como sustituto de datos de vida a bordo.

El principio del proyecto es **adaptarnos a equipos y procedimientos documentados**, identificando qué entradas producen y qué parte del proceso podemos ejecutar localmente. No asumir sensores nuevos ni disponibilidad continua de todas las variables.

## 2. Qué pide el desafío

El [desafío oficial](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) pide reunir indicadores para que los astronautas evalúen su salud y actúen. Nuestra primera entrega cubre la comprensión y seguimiento de cambios; no implementa todas las posibilidades del brief. Queda pendiente revisar si la entrega necesita alguna orientación procedimental adicional para expresar claramente su encaje con el objetivo completo.

El contexto del equipo documenta que el GO Team recomienda profundidad en un problema específico y permite prototipos con datos simulados. Debemos usar y citar recursos de la pestaña Resources y atribuir todos los materiales externos. Consultar [contexto-challenge.md](contexto-challenge.md) y [discusiones-challenge.md](discusiones-challenge.md), especialmente los hilos [#1994](https://github.com/nasa/spaceapps/discussions/1994), [#2138](https://github.com/nasa/spaceapps/discussions/2138) y [#1787](https://github.com/nasa/spaceapps/discussions/1787).

La [respuesta #2133](https://github.com/nasa/spaceapps/discussions/2133), usada como punto de partida, es de un **Navigator voluntario**. Enlaza fuentes oficiales, pero no equivale a una regla del GO Team ni a un protocolo clínico validado.

## 3. Cómo funciona hoy y dónde está la dependencia terrestre

El seguimiento actual combina evaluaciones previas al vuelo, registros de ejercicio, evaluaciones durante la misión y pruebas posteriores al regreso. La [norma médica de NASA, §6.4.2](https://ntrs.nasa.gov/api/citations/20240006194/downloads/OCHMO%20STD%20100%201A%2005142024.pdf) describe datos y videos de ejercicio enviados a Tierra, revisión por especialistas y consultas privadas de ejercicio. El calendario incluye video de ARED dentro de los primeros 14 días y luego al menos cada 30, con seguimiento recurrente y consultas mensuales. Eso no significa una medición diaria de masa muscular.

El [estudio Tele-SUS](https://pmc.ncbi.nlm.nih.gov/articles/PMC8047175/) documenta seguimiento de músculos mediante ecografía panorámica en 11 astronautas y 74 sesiones. Utilizó referencias previas, guías de colocación y asistencia terrestre; las adquisiciones se realizaban durante disponibilidad de enlace Ku y se repetían buscando calidad comparable. Las sesiones duraron entre 33 y 82 minutos. Es un procedimiento de investigación, no una frecuencia universal de control de toda la tripulación.

**No corresponde dividir esto como “NASA depende durante y después; Europa solo después”.** Son diferencias entre proyectos y etapas, no una separación por agencia. NASA ya demostró [AMOS](https://ntrs.nasa.gov/citations/20240012964), con instrucción autónoma de ecografías de vejiga y riñón en la ISS. ESA/CNES documentan [EchoFinder](https://www.esa.int/articles/echofinder-augmented-reality-and-artificial-intelligence-for-ultrasound-scans), que guía la adquisición y registra imágenes sin apoyo terrestre en tiempo real; su descripción contempla análisis diagnóstico por equipos en Tierra. “Después de adquirir” no significa necesariamente “después de volver de la misión”. Ninguno de estos antecedentes demuestra por sí mismo el flujo muscular panorámico autónomo que necesitaríamos.

No hemos demostrado que los astronautas actuales desconozcan sus resultados. La necesidad defendible es sostener la adquisición y el análisis cuando el apoyo terrestre habitual no esté disponible.

## 4. Qué puede medirse y qué significa

| Dimensión | Entrada posible | Interpretación y límites |
| --- | --- | --- |
| Tamaño muscular local | Área transversal mediante ecografía panorámica, con sitio, lado y protocolo repetibles | Cambio estructural de la zona medida. No equivale automáticamente a volumen del músculo ni masa muscular total. |
| Fuerza | Prueba isométrica mid-thigh pull en ARED bajo protocolo específico | Cambio funcional de fuerza. No convertirlo directamente en pérdida de masa. |
| Propiedades mecánicas | MyotonPRO: tono, rigidez y elasticidad | Cambios locales del tejido, no masa muscular. |
| Entrenamiento | Ejercicio, carga, repeticiones, series y duración | Contexto de exposición al entrenamiento. Cumplir la rutina no demuestra conservación muscular. |
| Capacidad aeróbica | Prueba VO₂peak | Dimensión cardiorrespiratoria separada del tamaño o fuerza muscular. |
| Contexto personal | Alimentación, masa corporal, síntomas y fatiga percibida | Ayuda a interpretar; no permite calcular por sí solo pérdida muscular. |

**Corrección importante:** el estudio Tele-SUS encontró que el espesor aislado no detectaba adecuadamente los cambios y respaldó el área obtenida por ecografía panorámica frente a MRI. No tratar “cualquier ecografía muscular” como una entrada equivalente. [Publicación](https://www.sciencedirect.com/science/article/pii/S2589004221003126).

El [protocolo SpacePhys/CIPHER](https://ntrs.nasa.gov/api/citations/20240000934/downloads/SpacePhys%20_IWS%20HRP%20poster_2024_final.pdf) describe pruebas de fuerza durante el vuelo: mid-thigh pull hacia el día 14 y unas dos semanas antes del retorno; son momentos de ese estudio, no controles diarios. [ESA Myotones](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/epsilon/Myotones_measuring_muscle_health_in_space) documenta medición mecánica antes, durante y después de la misión. MRI, DXA y algunas pruebas de fuerza proporcionan referencias terrestres: no presentarlas como equipamiento rutinario de imagen a bordo.

## 5. Dos features conectadas

### Feature 1: análisis muscular local

Recibe mediciones cuantificadas y su procedencia; compara la persona consigo misma y con estudios compatibles; muestra evolución, incertidumbre y suficiencia de evidencia. No prescribe tratamiento en el alcance inicial.

Para el prototipo puede recibir un CSV de áreas musculares ya cuantificadas. Si recibe imágenes, necesita además un componente de segmentación y medición. No confundir una visualización funcional con una segmentación automática validada.

### Feature 2: adquisición muscular guiada a bordo

Ayuda a obtener una ecografía comparable sin guía terrestre en tiempo real. Tiene dos niveles:

1. **Guía de procedimiento:** preparación, referencias anatómicas personales, colocación de guías, instrucciones y registro de la sesión.
2. **Guía con verificación:** identifica músculo y plano, controla adquisición/barrido y calidad, detecta errores y solicita repetir cuando corresponde.

El primer nivel puede prototiparse con un flujo interactivo; no demuestra sustitución del especialista. El segundo requiere datos de imágenes, experiencia clínica y validación. EchoFinder y [ALISSE](https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Just_add_AI_for_expert_astronaut_ultrasound) son antecedentes de viabilidad, no componentes cuya disponibilidad o adaptación muscular hayamos confirmado.

La cadena completa es:

**Guía local → adquisición válida → cuantificación → análisis longitudinal → presentación.**

Si algún paso necesita Tierra, la autonomía demostrada es parcial. Para el hackathon, priorizar completar la feature de análisis y demostrar la guía para un único músculo/protocolo, explicitando qué funciona, qué es simulado y qué necesita intervención humana. El músculo concreto aún debe elegirse según datos y procedimiento disponibles.

## 6. Factibilidad computacional y diferenciación

Guardar datos, calcular diferencias y visualizar tendencias es viable en una computadora convencional. La inferencia de un modelo podría ejecutarse a bordo después de entrenarlo en Tierra, pero depende del tamaño del modelo, memoria, latencia y hardware: falta medirlo. No afirmamos compatibilidad con una computadora de vuelo concreta.

La dependencia de Tierra no se explica solo por capacidad computacional. NASA identifica [datos distribuidos e integración incompleta](https://humanresearchroadmap.nasa.gov/Gaps/gap.aspx?i=639), recursos y conocimientos especializados limitados, y [dificultades de datos y fiabilidad para sistemas autónomos](https://ntrs.nasa.gov/citations/20240000914). No hay evidencia suficiente para atribuir la situación simplemente a que “todavía no se necesitaba”.

NASA ya desarrolla [apoyo clínico para operaciones independientes de Tierra](https://www.nasa.gov/centers-and-facilities/ames/ames-science/ames-space-biosciences/a-clinical-decision-support-system-for-earth-independent-medical-operations/). **“Funciona offline”, “tiene IA” y “muestra un humano 3D” no constituyen por sí solos una diferenciación científica.**

El aporte a investigar y demostrar es un seguimiento muscular específico que compruebe comparabilidad, cuantifique cambios y explique evolución personal con evidencia histórica e incertidumbre a bordo. No afirmamos novedad mundial, superioridad clínica ni ausencia de sistemas equivalentes sin una revisión adicional.

## 7. Datos históricos y entrenamiento

Cada registro debe asociar: identificador de persona, músculo, lado, sitio anatómico, magnitud, valor, unidad, método/dispositivo, fecha o día de misión, fase, calidad y contexto. Conservar la referencia previa con fecha real; no llamarla medición del día de lanzamiento si se tomó semanas antes.

El objetivo es usar mediciones históricas vinculadas a cada región corporal. Pero **antes de entrenar se debe definir qué resultado aprenderá el modelo y verificar que haya datos y etiquetas suficientes**. El cambio porcentual personal se calcula sin ML. Las tareas posibles de ML son segmentación, calidad de imágenes o una trayectoria de una magnitud específica, cada una con etiquetas y validación propias. Separar personas entre entrenamiento y evaluación para evitar filtración.

| Fuente | Qué aporta y cómo encaja | Acceso comprobado |
| --- | --- | --- |
| [Scott et al. 2023, 46 astronautas](https://pmc.ncbi.nlm.nih.gov/articles/PMC9898566/) | Ejercicio y variables musculares, aeróbicas, óseas y de composición; referencia para cambios e individualidad. | Artículo y suplementos públicos; registros individuales mediante solicitud a LSDA. |
| [NASA Sprint Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7434884/) | Resultados de fuerza/resistencia y composición con distintos protocolos. | Tablas agregadas públicas; no tratarlas como datos individuales de entrenamiento. |
| [Tele-SUS](https://pmc.ncbi.nlm.nih.gov/articles/PMC8047175/) | Procedimiento y resultados de seguimiento muscular por imagen. | Publicación consultada; no se descargó un conjunto individual de imágenes etiquetadas. |
| [Myotones](https://pmc.ncbi.nlm.nih.gov/articles/PMC10879143/) | Propiedades mecánicas musculares durante el ciclo de misión. | Falta verificar archivos reutilizables y condiciones de acceso. |
| [NASA NLSP](https://nlsp.nasa.gov/) | Catálogo de estudios humanos y análogos. | Algunos registros requieren solicitud; el catálogo no garantiza CSV inmediato. |
| [OSDR OS-568](https://osdr.nasa.gov/bio/repo/data/experiments/OS-568) | Análogo de reposo en cama con ejercicio y evaluación muscular. | Registro de experimento localizado; no se confirmó un CSV utilizable. |
| [OSDR OSD-942](https://osdr.nasa.gov/bio/repo/data/studies/OSD-942) y otros estudios de expresión génica muscular | Mecanismos biológicos de desuso y ejercicio. | No son señales de reloj/ARED ni etiquetas directas de pérdida muscular; no encajan como entrada del MVP elegido. |

**No se confirmó ni descargó un dataset individual longitudinal suficiente para entrenar el flujo muscular completo.** Si no se consigue, la demo utilizará series sintéticas claramente identificadas y evidencia publicada para el procedimiento y la interpretación. Entrenar con simulación no valida rendimiento clínico en astronautas.

## 8. Fuentes de contexto ya investigadas

- **Nave:** [NASA Environmental Data App](https://visualization.osdr.nasa.gov/eda/) ofrece tablas de CO₂, temperatura, humedad y radiación de misiones seleccionadas; revisar si cada lectura corresponde a cabina, hardware o control terrestre. [RadLab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) ofrece datos de instrumentos de radiación. Son contexto, no medición muscular.
- **Reloj:** [Actiwatch Spectrum/Plus](https://www.nasa.gov/missions/station/iss-research/wearable-tech-for-space-station-research/) registra actividad y, según variante documentada, luz; sueño es una estimación. No atribuirle pulso, ECG, presión o SpO₂. [MESA](https://sleepdata.org/datasets/mesa/pages/actigraphy-introduction.md) documenta CSV terrestres de Spectrum con acceso solicitado.
- **Bio-Monitor:** la [CSA](https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp) enumera pulso/ECG, presión, respiración, temperatura de piel, SpO₂ y actividad. [Space Health](https://www.asc-csa.gc.ca/eng/sciences/space-flight-improve-monitor-health-earth.asp) describe sesiones de 48 horas. No se verificó CSV personal público ni medición de masa muscular.
- **Historial personal:** antecedentes, medicación, alergias, referencias y evolución. Los historiales identificables tienen acceso protegido; perfiles de demo sintéticos. [NASA: datos de salud](https://www.nasa.gov/directorates/esdmd/hhp/human-health-and-performance-data-sharing/).
- **Otros CSV:** [BIDMC](https://physionet.org/content/bidmc/1.0.0/) aporta señales hospitalarias, y [Sleep Accel](https://physionet.org/content/sleep-accel/1.0.0/) movimiento y sueño terrestre con Apple Watch. No contienen etiquetas de pérdida muscular espacial ni pueden unirse como si fueran un mismo astronauta.

## 9. Presentación en un humano 3D

Usar la figura como mapa anatómico. Mostrar regiones evaluadas, fecha de la medición y acceso a referencia, cambio absoluto/relativo, historial, fuente y calidad. Las regiones sin datos deben aparecer como no evaluadas.

Una medida de área transversal no reconstruye una anatomía tridimensional completa. Si se deforma el músculo o la silueta, indicar que es una ilustración, no una reconstrucción medida. No reducir toda la pierna según el porcentaje de una sección ni mostrar un porcentaje único de degradación de la persona.

Comparación con estudios:

- Con registros individuales compatibles: distribución, histograma o puntos con la medición personal señalada.
- Con medias e intervalos publicados: puntos y barras conservando el significado estadístico original; no fabricar histogramas ni percentiles.
- Con tiempos comparables: trayectorias personales y de referencia; distinguir durante vuelo, postaterrizaje y recuperación.

Una cohorte es contexto observado, no “lo que debería tener” cada astronauta. Comparar misma magnitud, músculo, técnica y momento, considerando duración de misión y contramedidas.

## 10. Tendencia y futuro

Separar medición observada, tendencia y proyección. Primero mostrar cambios respaldados por mediciones comparables y su incertidumbre. Una proyección futura será un escenario condicionado hasta contar con evaluación suficiente.

No extrapolar linealmente meses de ISS a años de viaje marciano: cambian gravedad, equipos, exposición y contramedidas. La variación entre personas es importante. El seguimiento puede ayudar a reconocer cambios; todavía no demostramos que el prototipo prevenga o minimice pérdidas reales.

## 11. Qué debe demostrar el prototipo

| Componente | Evidencia a buscar |
| --- | --- |
| Análisis | Acuerdo con resultados de referencia y tratamiento correcto de calidad, faltantes e incertidumbre. |
| Adquisición guiada | Qué pasos logra sin ayuda; si se evalúa con imágenes, proporción útil y necesidad de repetir. |
| Presentación | Que el usuario comprenda la magnitud, cambio y límites sin confundir simulación con medición. |
| Autonomía | Qué etapas funcionan sin Tierra y qué dependencias siguen pendientes. |
| Ejecución local | Medición de memoria, tiempo de inferencia y funcionamiento sin red en el equipo de demo. |

No basta con mostrar una animación o un modelo corriendo. Para una comparación de rendimiento clínico o adquisición real se necesita un protocolo y especialistas; no se ha realizado esa validación.

## 12. Pendientes y coordinación

1. Elegir músculo, sitio y magnitud; área por ecografía es el candidato estructural, fuerza una dimensión funcional diferente.
2. Confirmar acceso a datos individuales, etiquetas, permisos y formato. Preparar alternativa sintética si el acceso no llega.
3. Definir entrada de la primera versión: CSV cuantificado o imagen; especificar quién realiza la cuantificación.
4. Acotar la guía y distinguir instrucciones de verificación automática.
5. Elegir la salida del modelo y su evaluación antes de entrenarlo.
6. Integrar el mapa 3D con la magnitud real disponible y las regiones sin medición.
7. Mantener referencias, versiones, transformaciones y origen real/sintético de cada dato.

Al preparar este documento, `main` estaba en `9e48f85`; se detectaron las ramas remotas `design-body` y `Feat/gravityEffectsInvestigation`. El visor 3D se trabaja en una rama separada. Este documento aporta contexto de decisiones y no supone integración de esas ramas ni modifica su implementación.
