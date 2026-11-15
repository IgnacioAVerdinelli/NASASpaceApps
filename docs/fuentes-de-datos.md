# Fuentes de datos: nave, astronauta, historial y Bio-Monitor

**Investigación · NASA Space Apps Challenge 2026 · 14 de noviembre de 2026**

Esta selección parte de equipos y prácticas documentados en la ISS para diseñar un sistema que pueda recibir los datos ya recopilados. Distinguir capacidad de medición, frecuencia de uso, acceso público al dato y utilidad para entrenar un modelo. La existencia de un sensor no garantiza una API ni uso permanente por toda la tripulación.

## 1. Datos de la nave

| Datos | Equipo o sistema documentado | Cómo y cuándo se miden | Dónde conseguir datos |
| --- | --- | --- | --- |
| CO₂, O₂, N₂, H₂, CH₄ y vapor de agua | Major Constituent Analyzer (MCA) y red de toma de muestras | Espectrometría de masas de muestras de distintos módulos. Documentación técnica describe monitoreo automático continuo; falta comprobar intervalo de actualización por módulo y exportación. | EDA publica CO₂ de misiones seleccionadas; no se verificó una descarga pública de todos los gases del MCA. [NASA: MCA](https://ntrs.nasa.gov/citations/20060023360). |
| Temperatura y humedad relativa | Sensores de cabina y de hardware | Telemetría con tiempo y ubicación; la cadencia debe comprobarse en cada dataset. | [NASA Environmental Data App](https://visualization.osdr.nasa.gov/eda/), pestaña Data Tables: datos crudos y resúmenes descargables. |
| Presión total y oxígeno de cabina | Sistemas de control atmosférico | Monitoreo operativo; no se verificó aquí una frecuencia de exportación ni una serie pública concreta. | Capacidad documentada en [NASA-STD-3001, ambiente](https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2/); simular si no se consigue una fuente compatible. |
| Radiación ambiental | Monitores de área | Tasa o dosis en una ubicación; frecuencia según instrumento. | [NASA RadLab y su API](https://visualization.osdr.nasa.gov/radlab/gui/data-api/). No representa automáticamente dosis personal. |
| Contaminantes, ruido y eventos de soporte de vida | Instrumentos específicos y registros operativos | Mediciones o campañas según equipo; no asumir una única variable de calidad del aire. | [NASA: toxicología ambiental](https://www.nasa.gov/directorates/esdmd/hhp/toxicology-and-environmental-chemistry/). Queda pendiente localizar archivos adecuados. |

La [EDA](https://visualization.osdr.nasa.gov/eda/) contiene datos de cabina, hardware experimental y controles terrestres. Elegir la tabla comprobando ubicación, misión, unidad y procedencia: una medición del interior de un equipo o de una cámara terrestre no equivale a la cabina. No extrapolar su atmósfera a una futura nave marciana. Primer conjunto propuesto: **CO₂, temperatura y humedad**; presión y oxígeno quedan como entradas admitidas cuando estén disponibles.

## 2. Datos del astronauta: reloj y otros instrumentos

### El reloj documentado: Actiwatch Spectrum/Plus

NASA documenta Actiwatch Spectrum y variantes Plus en investigaciones de sueño. El Spectrum tiene **acelerómetro y fotodetectores**: mide movimiento y luz cerca de la muñeca. El sueño/vigilia y su duración se estiman mediante análisis; no son una medición directa de fases de sueño. No atribuirle frecuencia cardíaca, presión, ECG ni SpO₂: esas capacidades no están documentadas para este equipo. [NASA: wearables](https://www.nasa.gov/missions/station/iss-research/wearable-tech-for-space-station-research/) · [NASA: Actiwatch Plus](https://www.nasa.gov/blogs/stationreport/2023/11/03/iss-daily-summary-report-11-03-2023/).

Se usa durante los períodos definidos por cada investigación, que pueden abarcar la misión. Un protocolo describe actividad por minuto y uso prolongado; esto no confirma un intervalo universal. Los datos se guardan en el reloj y se descargan para análisis: no asumir una API en tiempo real. [NASA: protocolo de actigrafía](https://ntrs.nasa.gov/api/citations/20200001281/downloads/20200001281.pdf) · [NASA: descarga del reloj](https://www.nasa.gov/blogs/stationreport/2024/02/22/iss-daily-summary-report-2-22-2024/).

### Otros datos personales disponibles a bordo

| Datos | Fuente | Momento de medición |
| --- | --- | --- |
| Frecuencia cardíaca, duración, velocidad y carga de ejercicio | Monitor cardíaco y equipos CEVIS/T2/ARED | Durante la sesión de ejercicio; conservar tipo e intensidad. [NASA: ejercicio](https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/). |
| Pulso, presión arterial, temperatura corporal y frecuencia respiratoria | Equipo médico y tripulante entrenado | Evaluaciones periódicas o según necesidad. El estándar consultado programa evaluaciones alrededor de los días 14–21, 90, 180 y 270, antes del regreso y según indicación. [NASA: estándar médico, §6.1.2](https://ntrs.nasa.gov/api/citations/20240006194/downloads/OCHMO%20STD%20100%201A%2005142024.pdf). |
| SpO₂ y ECG | Oxímetro y electrocardiógrafo | Según evaluación o protocolo; no se comprobó medición diaria universal. [NASA: equipos médicos](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/human-health-performance/exploration-medical-technologies/multifunctional-integrated-medical-devices/). |
| Masa corporal | Medidor de masa en ingravidez | Primera semana y luego mensualmente, o según necesidad. [Estándar médico, §6.1.15](https://ntrs.nasa.gov/api/citations/20240006194/downloads/OCHMO%20STD%20100%201A%2005142024.pdf). |
| Síntomas, descanso percibido y bienestar | Autorreporte/cuestionario | Según protocolo o al aparecer un síntoma. El check-in diario del prototipo será una decisión de diseño propia. |

**Datos para desarrollar:** [MESA Sleep](https://sleepdata.org/datasets/mesa/pages/actigraphy-introduction.md) tiene CSV de Actiwatch Spectrum terrestre en épocas de 30 segundos; requiere solicitar acceso. [PhysioNet Sleep Accel](https://physionet.org/content/sleep-accel/1.0.0/) ofrece archivos abiertos de movimiento, pulso y sueño etiquetado de 31 personas, obtenidos con **Apple Watch**. Estos archivos de texto se pueden transformar a CSV; no son datos de astronautas ni autorizan a atribuir pulso al Actiwatch. [BIDMC](https://physionet.org/content/bidmc/1.0.0/) ofrece CSV hospitalarios de ECG, PPG, respiración, pulso y SpO₂: útil para procesar señales, con población y contexto diferentes.

## 3. Historial personal de cada uno

El historial reúne datos previos y observaciones acumuladas. NASA establece una línea de base antes del vuelo mediante cuestionario, exámenes y pruebas; el equipo médico tiene acceso a registros electrónicos. [NASA: evaluación médica](https://ntrs.nasa.gov/api/citations/20240006194/downloads/OCHMO%20STD%20100%201A%2005142024.pdf) · [NASA: operaciones médicas](https://www.nasa.gov/wp-content/uploads/2025/08/ochmo-tb-044-medical-operations.pdf).

Para nuestro modelo de datos, separar cuatro componentes:

- **Antecedentes:** condiciones conocidas, alergias, medicación y restricciones relevantes.
- **Línea de base personal:** valores y variabilidad previos, con dispositivo, contexto y período. Diferenciar reposo, sueño y ejercicio.
- **Historia durante la misión:** síntomas, mediciones, episodios, acciones, respuesta y evolución.
- **Procedencia:** fecha, autor, dispositivo y permisos de acceso.

No hay un historial clínico público completo por astronauta para descargar. El [NASA Life Sciences Portal](https://nlsp.nasa.gov/) permite buscar estudios; algunos requieren solicitud. NASA protege los datos de salud mediante una [política de acceso](https://www.nasa.gov/directorates/esdmd/hhp/human-health-and-performance-data-sharing/). Para la demo se proponen perfiles sintéticos identificados como tales. [OSDR Inspiration4 OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) aporta resultados reales de laboratorio antes y después de un vuelo corto; no equivale a un historial ni a signos vitales continuos durante la misión.

## 4. Bio-Monitor canadiense: coincidencias y diferencias

La [CSA](https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp) describe una camiseta, banda de cabeza y aplicación de tableta. El sistema reúne pulso y ECG, presión arterial, frecuencia y volumen respiratorio, temperatura de piel, SpO₂ y actividad. Puede usarse durante sueño y ejercicio. Al terminar se conecta el módulo a una base para descargar datos. El estudio [Space Health](https://www.asc-csa.gc.ca/eng/sciences/space-flight-improve-monitor-health-earth.asp) describe sesiones de **48 horas**, con ejercicio y cuestionario de bienestar. No se verificaron la frecuencia de cada canal, el método específico de cada estimación, la precisión ni una descarga pública de registros personales.

| Variable de Bio-Monitor | Coincidencia con otras fuentes | Qué cambia |
| --- | --- | --- |
| Actividad | Actiwatch y registro de ejercicio | Otra ubicación/sensor: las escalas no son intercambiables sin comprobarlas. |
| Pulso y ECG | Monitor de ejercicio y equipo médico | Puede registrar durante la sesión del wearable. El reloj Actiwatch no aporta estos canales. |
| Presión y SpO₂ | Equipos médicos puntuales | Puede reunirlos en el protocolo; no suponer continuidad ni equivalencia con otro instrumento. |
| Frecuencia y volumen respiratorio | La frecuencia puede tomarse en evaluación médica | El volumen añade una variable; falta verificar método y unidad del archivo original. |
| Temperatura de piel | Hay temperatura corporal en evaluaciones médicas | Son magnitudes diferentes. Conservar lugar y método de medición. |

Bio-Monitor es una fuente de investigación documentada, no un requisito para todos los usuarios del sistema. La aplicación debe seguir funcionando con los canales que existan y registrar los ausentes.

## 5. Qué puede entrar al modelo

Propuesta de entradas iniciales: **CO₂, temperatura y humedad de cabina; movimiento, luz y sueño estimado; pulso, respiración y SpO₂ cuando estén disponibles; síntomas y línea de base personal**. Presión arterial y temperatura corporal serían mediciones puntuales solicitables. ECG crudo, volumen respiratorio y radiación requieren una tarea y procesamiento propios antes de incorporarlos al primer modelo.

Cada observación debe conservar persona o ubicación, variable, valor, unidad, hora o intervalo, fuente/dispositivo, contexto, calidad y origen (`real_iss`, `real_terrestre`, `sintetico`). No rellenar un canal ausente con cero ni presentar un valor viejo como actual. El dato histórico y el dato ambiental tienen tiempos y ubicaciones diferentes de la lectura personal.

Los CSV de NASA EDA, BIDMC y estudios de sueño pertenecen a misiones, personas y fechas diferentes. Se pueden usar para desarrollar componentes separados o construir una historia explícitamente simulada; no constituyen observaciones conjuntas reales. Para entrenamiento supervisado, primero definir la salida buscada y comprobar que existan etiquetas: sueño etiquetado permite investigar sueño; respiraciones anotadas permiten evaluar estimación respiratoria. No se identificó un dataset espacial etiquetado que permita entrenar decisiones médicas o la próxima medición del episodio completo. Estas decisiones se implementarán inicialmente con reglas documentadas y escenarios revisados.

## 6. Acceso y pendientes concretos

| Fuente | Estado comprobado en esta investigación | Próximo paso |
| --- | --- | --- |
| NASA EDA | El portal documenta descarga de tablas; no se descargó ni inspeccionó un archivo en esta sesión. | Elegir misión y tabla, verificar cabina frente a hardware/control, unidades y cadencia. |
| NASA RadLab | API documentada y variables por instrumento. | Elegir instrumento y período si la historia necesita radiación. |
| MESA Sleep | CSV de Actiwatch Spectrum documentados; acceso por solicitud. | Tramitar acceso si se elige esta tarea; no depender de aprobación para la demo. |
| PhysioNet Sleep Accel | Archivos abiertos y licencia ODC-BY 1.0 documentados. | Descargar una muestra, comprobar columnas y limitar el modelo a entradas disponibles. |
| PhysioNet BIDMC | CSV abiertos y licencia ODC-BY 1.0 documentados. | Descargar una muestra; revisar faltantes y procedencia hospitalaria. |
| Historial personal/Bio-Monitor de astronautas | Sin CSV público concreto verificado. | Perfiles y sesiones sintéticos con variables documentadas. |

Antes de entrenar, registrar versión, licencia, atribución, archivos utilizados, transformaciones y partición por persona para evitar que datos de un mismo sujeto se filtren entre entrenamiento y evaluación. La integración con dispositivos reales sigue pendiente: este documento verifica capacidades y rutas de datos, no una conexión a telemetría operacional.
