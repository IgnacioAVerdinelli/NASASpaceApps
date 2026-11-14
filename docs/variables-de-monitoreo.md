# Variables de monitoreo: tripulación, cabina y hazards

**Documento de trabajo · NASA Space Apps Challenge 2026**

Este documento reúne las variables que podríamos usar para observar el bienestar y la salud de la tripulación, entender su entorno y dar contexto a un episodio. Es un catálogo inicial para elegir el alcance del prototipo; no implica que debamos implementar todas las métricas ni que haya dispositivos confirmados para una futura misión a Marte.

La organización propuesta tiene tres secciones:

1. **Tripulación:** datos físicos, sueño, actividad, bienestar percibido y síntomas.
2. **Cabina:** condiciones ambientales y estado de los sistemas que afectan la habitabilidad.
3. **Hazards y misión:** exposiciones y condiciones generales del viaje espacial.

## 1. Tripulación: cuerpo, sueño y bienestar

### Fuentes elegidas como referencia

- **Bio-Monitor:** sistema de la Agencia Espacial Canadiense (CSA) compuesto por una camiseta con sensores, una banda para la cabeza y una aplicación de tableta. Se ha usado en investigaciones a bordo de la ISS y puede registrar variables durante sueño y ejercicio. En el estudio Space Health se describen sesiones de 48 horas; no suponemos que toda la tripulación lo use permanentemente. [CSA: Bio-Monitor](https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp) · [CSA: Space Health](https://www.asc-csa.gc.ca/eng/sciences/space-flight-improve-monitor-health-earth.asp).
- **Actiwatch Spectrum:** dispositivo de muñeca usado en investigación espacial que registra movimiento y luz ambiental. A partir de los registros se puede estimar el ciclo de sueño y vigilia. [NASA: wearables en la ISS](https://www.nasa.gov/missions/station/iss-research/wearable-tech-for-space-station-research/).
- **Check-in y registro personal:** respuestas voluntarias sobre ánimo, energía, descanso, carga y síntomas. El estudio Space Health combina mediciones, actividad y un cuestionario de bienestar. Un protocolo descrito por NASA también contempla cuestionarios antes y después del sueño. Nuestras preguntas son una propuesta propia, no la reproducción de un instrumento validado. [CSA: Space Health](https://www.asc-csa.gc.ca/eng/sciences/space-flight-improve-monitor-health-earth.asp) · [NASA: protocolo de sueño](https://ntrs.nasa.gov/api/citations/20220005716/downloads/AsMA%202022%20-%20Garbino%20-%20Exploration%20Atmospheres%20v2.pdf?attachment=true).

Para el prototipo suponemos acceso a datos simulados basados en las capacidades documentadas. Aún no verificamos una integración directa, el formato original de salida ni el acceso a registros personales de astronautas. Los dispositivos usados en investigaciones en la ISS no son necesariamente el equipamiento de una misión futura.

### 1.1 Cuerpo y actividad

Las unidades son propuestas para nuestro modelo de datos; hay que contrastarlas con la fuente concreta antes de integrar datos reales. La disponibilidad, duración y frecuencia de lectura dependen de la sesión y del canal.

| Variable | Fuente | Formato propuesto | Para qué puede servir | Prioridad inicial |
| --- | --- | --- | --- | --- |
| Frecuencia cardíaca | Bio-Monitor | Número en latidos/min, con hora | Observar tendencias personales y contextualizarlas con actividad, descanso o síntomas. | Alta |
| Actividad eléctrica cardíaca | Bio-Monitor | Señal ECG con unidad, intervalo y frecuencia de muestreo, o resumen asociado a un episodio | Agregar información cardíaca cuando esté disponible. La señal cruda es una posibilidad posterior. | A explorar |
| Presión arterial | Bio-Monitor | Sistólica y diastólica en mmHg, con hora | Aportar una medición a la tendencia o evaluación de un episodio. NASA describe lecturas periódicas; no asumir datos continuos. | Alta |
| Frecuencia respiratoria | Bio-Monitor | Respiraciones/min, con hora | Explorar tendencias durante descanso o actividad. | Alta |
| Volumen respiratorio | Bio-Monitor | Valor con unidad, intervalo y método documentados | Explorar patrones respiratorios; confirmar qué representa la medición antes de usarla. | A explorar |
| Temperatura de la piel | Bio-Monitor | °C, hora y ubicación del sensor | Observar cambios en la temperatura de piel. No equivale a temperatura corporal central. | Alta |
| Saturación de oxígeno | Bio-Monitor | Porcentaje SpO₂, con hora y calidad | Aportar contexto a una evaluación cuando la lectura esté disponible. | Alta |
| Actividad física | Bio-Monitor y/o Actiwatch | Nivel o señal por intervalo, con unidad o escala de la fuente | Entender el contexto de otras mediciones. Los niveles de dispositivos distintos no son automáticamente equivalentes. | Alta |
| Ejercicio | Registro de actividad y/o sesión del Bio-Monitor | Tipo, inicio, fin y duración; intensidad si está disponible | Relacionar mediciones con una sesión de ejercicio. | Alta |

El Bio-Monitor también registra ECG, a partir del cual se puede investigar el cálculo de **variabilidad de frecuencia cardíaca (HRV)** e intervalos entre latidos. Esto sería una variable derivada que requiere definir el algoritmo, el intervalo y la calidad de la señal; no asumimos un valor listo para usar ni que mida el estrés directamente. [NASA: biosensores en vuelo espacial](https://ntrs.nasa.gov/api/citations/20240000117/downloads/AI_and_Human_Spaceflight.pdf).

### 1.2 Sueño, movimiento y luz

| Variable | Fuente | Formato propuesto | Para qué puede servir | Prioridad inicial |
| --- | --- | --- | --- | --- |
| Movimiento | Actiwatch | Nivel de actividad por intervalo, duración y escala o unidad documentada | Observar actividad y apoyar la estimación de sueño y vigilia. | Alta |
| Exposición personal a la luz | Actiwatch | Valor por intervalo y unidad documentada | Explorar la relación entre iluminación, rutina y descanso. | A explorar |
| Sueño y vigilia estimados | Análisis de datos de Actiwatch | Intervalos de inicio y fin y duración estimada en minutos; método cuando se conozca | Ver tendencias de descanso a lo largo de la misión. | Alta |
| Descanso percibido | Check-in al despertar | Respuesta de 0 a 10, con pregunta y extremos de escala | Comparar cómo se sintió la persona con el sueño estimado. | Alta |
| Interrupciones del sueño | Check-in al despertar | Registro opcional, hora o descripción si se conoce | Entender posibles razones de un descanso percibido como insuficiente. | Media |

El Actiwatch mide movimiento y luz; **el sueño es una estimación**. No suponemos que identifique todas sus fases ni que reemplace una evaluación clínica. La luz medida en la muñeca describe exposición personal, no necesariamente la iluminación de todo el módulo.

### 1.3 Check-in de bienestar y síntomas

La propuesta es que el astronauta pueda responder antes de dormir y al despertar. Las respuestas son voluntarias y se pueden omitir.

| Pregunta o variable | Momento propuesto | Formato |
| --- | --- | --- |
| ¿Cómo estuvo tu ánimo hoy? | Antes de dormir | 0–10, con extremos claramente definidos. |
| ¿Cuánta energía sentiste durante el día? | Antes de dormir | 0–10. |
| ¿Cuánta carga o estrés percibiste hoy? | Antes de dormir | 0–10. |
| ¿Cómo sentiste tu último descanso? | Al despertar | 0–10. |
| ¿Tuviste interrupciones durante el sueño? | Al despertar | Respuesta y descripción opcionales. |
| ¿Sentiste algún síntoma? | En cualquier momento | Tipo, intensidad opcional, inicio y evolución cuando se conozcan. |
| ¿Querés agregar contexto? | En cualquier momento | Nota libre opcional, por ejemplo sobre una jornada exigente o ruido. |

Guardar la pregunta y el sentido de la escala junto con cada respuesta. Una respuesta omitida no es cero. El check-in no diagnostica una condición de salud mental; las respuestas y notas son información sensible y necesitan permisos de acceso definidos.

### 1.4 Vista e índice de bienestar

Para empezar, mostrar **sueño estimado, descanso percibido, ánimo, energía y carga** como dimensiones separadas, con su evolución personal. Más adelante se puede probar un índice de 0–100 si ayuda a leer la información. Para hacerlo habría que definir y mostrar la fórmula, el tratamiento de datos faltantes y las limitaciones; sería un indicador experimental, no una medida clínica validada.

Un promedio no debe ocultar un síntoma o una alerta relevante. La comparación con días anteriores puede ayudar a formular preguntas, pero una coincidencia temporal entre métricas no demuestra causalidad.

## 2. Cabina: condiciones del ambiente

Las condiciones de cabina afectan el lugar donde la tripulación vive, duerme y trabaja. Como punto de partida para investigar datos reales, la [Environmental Data App de NASA](https://visualization.osdr.nasa.gov/eda/) permite visualizar temperatura, CO₂, humedad relativa y radiación de misiones de investigación de la ISS, con tablas descargables. Revisar las características y condiciones de cada dataset: no asumir que representa una cabina de Marte ni que se puede vincular con datos individuales.

### Instrumentos y sistemas documentados

- **Major Constituent Analyzer (MCA):** analizador de la ISS que usa espectrometría de masas y una red de toma de muestras para monitorear oxígeno, nitrógeno, CO₂, hidrógeno, metano y vapor de agua. No representa por sí solo todos los sensores ambientales de la cabina. [NASA: descripción de la ISS](https://ntrs.nasa.gov/api/citations/20250005232/downloads/International%20Space%20Station%20Familiarization.pdf) · [NASA: componentes del MCA](https://www.nasa.gov/missions/station/commercial-resupply/ng-crs/nasas-northrop-grumman-crs-23-infographics-hardware/).
- **Monitores de CO₂:** NASA describe monitores infrarrojos de CO₂ y también probó un sensor personal para investigar las condiciones alrededor del tripulante. La medición de un punto de la cabina no necesariamente describe otro punto. [NASA: toxicología ambiental](https://www.nasa.gov/directorates/esdmd/hhp/toxicology-and-environmental-chemistry/) · [NASA: wearables](https://www.nasa.gov/missions/station/iss-research/wearable-tech-for-space-station-research/).
- **Air Quality Monitor (AQM):** monitor de la ISS para compuestos orgánicos volátiles específicos; no es un único valor universal de calidad del aire. Otros instrumentos y muestras abordan contaminantes o productos de combustión. [NASA: toxicología ambiental](https://www.nasa.gov/directorates/esdmd/hhp/toxicology-and-environmental-chemistry/).
- **ISS Acoustic Monitor:** sonómetro y dosímetro acústico; las mediciones documentadas incluyen campañas de medición, por lo que no se presupone un flujo continuo. [NASA: acústica de la ISS](https://ntrs.nasa.gov/api/citations/20240006442/downloads/ICES-2024-354%20ISS%20Acoustics.pdf).
- **Sistemas de control ambiental:** NASA describe en Orion el monitoreo de temperatura, humedad y presión, además de la gestión de oxígeno, CO₂ y ventilación. Orion es una referencia de exploración lunar, no una especificación de nave marciana. [NASA: sistemas de Orion](https://www.nasa.gov/reference/crew-systems/).

| Variable | Por qué puede ser útil | Fuente posible | Formato propuesto | Prioridad |
| --- | --- | --- | --- | --- |
| CO₂ de cabina | Describir el aire y contextualizar síntomas o descanso. | Sensor ambiental. | Concentración en ppm, hora y ubicación. | Alta |
| Temperatura ambiental | Relacionarla con confort, trabajo y descanso. | Sensor de cabina. | °C, hora y módulo. | Alta |
| Humedad relativa | Describir las condiciones ambientales. | Sensor de cabina. | %, hora y módulo. | Alta |
| Presión de cabina | Conocer el estado del entorno presurizado. | Sistema ambiental. | kPa, hora y módulo. | Media |
| Oxígeno de cabina | Describir la atmósfera de la nave. | Sensor ambiental o soporte de vida. | Presión parcial en kPa o concentración en %, aclarando cuál. | Media |
| Ruido | Explorar posibles molestias, exposición e interrupciones del descanso. | Sonómetro o dosímetro acústico; en la ISS se documentan mediciones periódicas. | Nivel en dBA, intervalo y ubicación; método de agregación si se conoce. | Incluida |
| Luz ambiental | Explorar su relación con rutina y descanso. | Sensor de iluminación; Actiwatch para exposición personal. | Lux, hora y ubicación; identificar sensor y si la medición es ambiental o personal. | Incluida |
| Estado de sistemas ambientales | Identificar una falla, mantenimiento o cambio operativo que dé contexto a las condiciones de cabina. | Telemetría o registro de eventos de soporte de vida. | Sistema, estado, inicio, fin y descripción del evento. | Incluida |
| Compuestos orgánicos volátiles | Identificar contaminantes específicos presentes en el aire. | AQM u otro analizador compatible. | Sustancia, concentración, unidad, intervalo y ubicación; no un único índice genérico. | Incluida |

NASA identifica temperatura, presión, luz y ruido entre los factores relevantes de habitabilidad. [NASA: peligros del vuelo espacial](https://www.nasa.gov/hrp/hazards/) · [NASA: sistemas de tripulación](https://www.nasa.gov/reference/crew-systems/).

**Recorte propuesto para el modelo de cabina:** presión total, presión parcial de oxígeno (ppO₂), presión parcial de CO₂ (ppCO₂), temperatura y humedad relativa. Un documento técnico de NASA identifica esos cinco parámetros para registro atmosférico y visualización en compartimentos habitables; esto respalda la selección, sin demostrar su disponibilidad en una misión concreta. [NASA: referencia de monitoreo de CO₂](https://www.nasa.gov/wp-content/uploads/2023/03/co2-technical-brief-ochmo.pdf). Para la demostración se puede priorizar un cruce de CO₂, temperatura y humedad con datos personales; presión y ppO₂ pueden ser simulados si no encontramos una fuente adecuada.

Guardar ppO₂ y ppCO₂ en kPa, o conservar el valor y la unidad originales junto con cualquier conversión documentada. La concentración en ppm o % no equivale numéricamente a presión parcial: convertir requiere conocer la presión total correspondiente. No asignar umbrales clínicos genéricos. La ubicación del punto de muestra y la de la persona aportan contexto, pero si no se conocen deben indicarse como faltantes. La Environmental Data App es un punto de partida para investigar datos, no una garantía de acceso a todas las variables de la tabla.

### Mediciones y eventos adicionales incluidos

Además de los cinco parámetros atmosféricos, el catálogo de cabina incluye **ruido, luz, contaminantes específicos y estado de sistemas ambientales**. Los incluimos para poder explorar tanto bienestar diario como el contexto de cambios en la cabina; la selección de cuáles mostrar en cada historia de la demo sigue abierta.

- **Ruido:** registrar cada medición con ubicación y período. Las fuentes sobre la ISS documentan mediciones acústicas periódicas; una serie continua en el prototipo sería una hipótesis simulada, no una capacidad que ya hayamos verificado para todos los módulos. [NASA: acústica de la ISS](https://ntrs.nasa.gov/api/citations/20240006442/downloads/ICES-2024-354%20ISS%20Acoustics.pdf).
- **Luz:** distinguir un sensor fijo de cabina de la exposición personal registrada por Actiwatch. Si se muestra en lux, comprobar que la fuente elegida entregue esa unidad o documentar la conversión.
- **Contaminantes:** registrar cada compuesto por separado. NASA describe el AQM de la ISS para compuestos orgánicos volátiles específicos; no presumir que mide todos los contaminantes ni inventar un índice general de calidad de aire. [NASA: toxicología ambiental](https://www.nasa.gov/directorates/esdmd/hhp/toxicology-and-environmental-chemistry/).
- **Estado de sistemas:** guardar eventos de ventilación, eliminación de CO₂ u otros sistemas cuando estén disponibles. Los nombres, estados y frecuencias concretos de la telemetría de una misión futura no están confirmados; en la demo se pueden simular e identificar como tales.

## 3. Hazards y contexto de misión

NASA agrupa los peligros del vuelo espacial en cinco categorías: radiación, aislamiento y confinamiento, distancia de la Tierra, gravedad alterada y ambiente hostil o cerrado. Un hazard es una fuente de exposición; no todos se miden directamente con un sensor. [NASA: cinco hazards](https://www.nasa.gov/hrp/hazards/).

| Hazard | Qué podríamos registrar | Fuente posible | Formato propuesto |
| --- | --- | --- | --- |
| Radiación | Dosis acumulada y, si existe, tasa de dosis o eventos de exposición. | Dosímetro personal o sensor ambiental. | Valor, unidad, período, ubicación y tipo de instrumento. |
| Aislamiento y confinamiento | Días de misión, contactos disponibles, carga percibida y check-in voluntario. | Calendario y autorreporte. | Números y eventos; no convertirlos automáticamente en un diagnóstico o nivel clínico de aislamiento. |
| Distancia de la Tierra | Demora estimada por trayecto y estado del enlace. | Sistema o simulación de misión. | Minutos por trayecto; disponible/interrumpido. |
| Gravedad alterada | Fase de misión, entorno gravitatorio y duración de exposición. | Plan de misión. | Categoría —por ejemplo, tránsito en microgravedad o superficie marciana— y período. |
| Ambiente hostil o cerrado | Condiciones y eventos de cabina. | Sensores y sistemas de la nave. | Referencias a los datos de la sección de cabina. |

### Radiación

La radiación se puede registrar mediante dosímetros personales y sensores ambientales. Algunos instrumentos registran información a lo largo del tiempo y otros integran la exposición durante un período. [NASA: Human Integration Design Handbook](https://www.nasa.gov/wp-content/uploads/2023/03/human-integration-design-handbook-revision-1.pdf).

Para conservar el significado del dato, distinguir **dosis absorbida** —por ejemplo, mGy—, **dosis equivalente** —por ejemplo, mSv, cuando corresponda— y **tasa de dosis** —dosis por unidad de tiempo—. No son intercambiables; una lectura ambiental tampoco es automáticamente una dosis personal. La demo podría usar un evento o tendencia simulados, con unidad, período y fuente visibles.

### Distancia y comunicación

Esta categoría conecta con la propuesta de salud autónoma: la tripulación puede evaluar un episodio a bordo y preparar un informe para Tierra. El prototipo puede mostrar una demora simulada por trayecto, disponibilidad del enlace y estado del informe: pendiente, enviado o recibido.

## 4. Cómo cruzar las tres secciones

Ejemplo ficticio: durante tres días baja el descanso percibido, el Actiwatch estima menos horas de sueño y se registran períodos de ruido en el módulo de descanso. La interfaz puede mostrar las tres tendencias, preguntar si el ruido interrumpió el sueño y guardar la respuesta. Esto plantea una hipótesis; no demuestra que el ruido causó el cambio.

Si una persona informa dolor de cabeza, el sistema puede mostrar el síntoma, su actividad reciente y las últimas mediciones ambientales disponibles. Si un dato falta o es antiguo, lo indica. Las reglas de atención y las acciones clínicas necesitan evidencia y revisión profesional; no se derivan automáticamente de estas coincidencias.

Cada registro debería conservar, cuando corresponda: identificador de persona o ubicación, variable, valor y unidad, hora o intervalo, fuente y dispositivo, actividad o contexto, y calidad o estado —válido, dudoso, faltante o simulado—. Para señales crudas agregar la frecuencia de muestreo. No asumir transmisión en tiempo real ni disponibilidad simultánea de todos los canales.

## 5. Recorte de trabajo para el hackathon

| Sección | Primer conjunto propuesto |
| --- | --- |
| Tripulación | Frecuencia cardíaca, presión arterial, respiración, SpO₂, temperatura de piel, actividad, sueño estimado, check-in y síntomas. |
| Cabina | Presión total, ppO₂, ppCO₂, temperatura y humedad, más ruido, luz, contaminantes específicos y eventos de sistemas ambientales. Elegir el subconjunto visible según la historia de la demo. |
| Hazards y misión | Radiación contextual, fase de gravedad, días de misión y demora o estado de comunicación. |
| Experiencia | Vista personal con tendencias, un episodio con próxima medición útil e informe consolidado. |
| Datos | Caso sintético coherente; explorar una serie ambiental real de NASA, identificando fuente y limitaciones. |

El siguiente paso es elegir la historia de la demo y reducir el conjunto a las variables que esa historia necesite. Quedan por comprobar el formato y la disponibilidad de datasets, los permisos de reutilización, los intervalos de uso de dispositivos y las reglas para interpretar o escalar cada escenario.
