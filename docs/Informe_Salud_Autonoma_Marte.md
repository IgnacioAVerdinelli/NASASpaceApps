# Salud autónoma a bordo en misiones a Marte

**Informe para el equipo · NASA Space Apps Challenge 2026**

## 1. Propuesta

Construir un asistente de salud a bordo que reúna mediciones, síntomas, historial y contexto de actividad para orientar **la próxima medición útil**. Cada resultado puede cambiar el siguiente paso. La tripulación evalúa el episodio y actúa localmente. Cuando el episodio se cierra o ya existe una evaluación suficientemente informativa, el sistema prepara **un informe unificado para Tierra**.

El usuario principal es el astronauta. Si necesita ayuda, interviene el responsable médico de a bordo o la tripulación según la situación. El equipo médico en Tierra recibe el caso ya contextualizado y puede aportar seguimiento o resolver una pregunta concreta.

## 2. Problema y encaje con el desafío

Entre la Tierra y la Luna la propagación de ida y vuelta ronda los 2,6 segundos. Para una misión a Marte, NASA contempla demoras máximas del orden de 21–23 minutos por trayecto según la geometría de misión. Un intercambio puede sumar 42–46 minutos de propagación, además del tiempo de transmisión, análisis y respuesta. Si Tierra pide nuevas mediciones en rondas sucesivas, se acumula la demora. También puede haber períodos sin enlace.

La ISS sirve como antecedente porque la tripulación recibe capacitación médica y dispone de apoyo especializado en Tierra. NASA ya investigó asistencia autónoma. AMOS demostró orientación para procedimientos específicos de ecografía en la ISS. HERA es un hábitat análogo terrestre de NASA para investigar, entre otras cosas, autonomía, comunicaciones, factores humanos y capacidades médicas.

El track Health pide software que reúna indicadores y permita a los astronautas evaluar su salud y actuar. El aporte del proyecto es probar si **elegir la siguiente medición según el episodio** permite avanzar más rápido a bordo y si **consolidar la evidencia** reduce los intercambios necesarios para revisar el caso en Tierra.

Fuentes: [Desafío oficial](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) · [Arquitectura Luna–Marte](https://www.nasa.gov/wp-content/uploads/2024/01/acr23-white-papers-compiled-v10.pdf) · [Comunicaciones médicas de exploración](https://ntrs.nasa.gov/api/citations/20250002660/downloads/Communications%20for%20Exploration%20Poster.pdf) · [NASA AMO](https://www.nasa.gov/directorates/stmd/game-changing-development-program/autonomous-medical-operations-amo/) · [NASA AMOS](https://ntrs.nasa.gov/citations/20240012964) · [HERA](https://www.nasa.gov/hera-about-hera/)

## 3. Flujo de un episodio

1. **Detectar y registrar.** Una señal se aparta de lo habitual o el tripulante registra un síntoma. Se abre un episodio con hora, actividad, datos disponibles y calidad de las lecturas.
2. **Interpretar en contexto.** El sistema compara con el perfil personal y distingue una desviación fisiológica, una lectura dudosa y un dato faltante como estados diferentes de la evidencia.
3. **Elegir el siguiente paso.** Puede pedir corroborar una toma, incorporar una medición distinta, solicitar asistencia local o marcar evidencia insuficiente. La decisión depende de lo que pasó, de qué duda sigue abierta y de qué instrumentos hay disponibles. Una indicación de escalamiento local tiene prioridad sobre completar mediciones.
4. **Actualizar con cada resultado.** Se registra qué se pidió, por qué, qué se obtuvo y cómo cambió la evaluación. El responsable de a bordo puede intervenir y registrar su decisión.
5. **Consolidar y transmitir.** Al cerrar el episodio, o cuando el responsable ya puede resumir la situación y lo que sigue incierto, se genera un informe. Si el caso continúa, el informe indica su estado al momento del envío. Durante un corte, queda en cola y se envía al recuperar el enlace.

### Qué recibe Tierra

Un informe con identificador y versión del episodio, inicio, actividad, síntomas, mediciones relevantes con hora y calidad, comparación con el historial, verificaciones que se hicieron y su motivo, acciones de la tripulación, evolución y dudas pendientes. Puede incluir una pregunta concreta para el equipo médico y adjuntar tramos de señal cruda cuando aporten evidencia. El registro original queda disponible a bordo. Si aparece información material después del envío, una actualización referenciada al mismo episodio conserva la trazabilidad.

**Política de la demo.** La detección abre el episodio a bordo. El envío a Tierra se dispara cuando hay una síntesis útil del caso. Cualquier regla extraordinaria de aviso a Tierra en una misión real dependería del protocolo de esa misión y queda como decisión pendiente.

### Dónde se ahorran recursos

Los avisos internos usan la red de a bordo. El ahorro que vale demostrar está en el enlace con Tierra y en la coordinación médica. Un informe puede pesar más que un aviso corto. La comparación relevante suma **bytes, mensajes y rondas de consulta hasta que Tierra recibe evidencia suficiente**. El sistema puede ahorrar tiempo local aunque el tiempo físico de propagación siga siendo el mismo. La cola de salida puede simular almacenamiento y reenvío al estilo DTN, con estados visibles de pendiente, transmitido y recibido.

Fuente: [NASA Delay/Disruption Tolerant Networking](https://www.nasa.gov/reference/delay-disruption-tolerant-networking-overview/)

## 4. Arquitectura para repartir trabajo

| Módulo | Responsabilidad | Entregable |
| --- | --- | --- |
| Adquisición y calidad | Leer señales y registrar unidad, hora, dispositivo, canal y calidad. Reconocer lecturas viejas, faltantes o ruidosas. | Reproductor de CSV y fallas simuladas. |
| Perfil y contexto | Mantener una línea de base por persona y actividad. Incorporar síntomas y antecedentes relevantes. | Perfiles sintéticos y contexto de reposo o actividad. |
| Evaluación y próxima medición | Actualizar la evidencia y decidir qué verificación o intervención local corresponde según el escenario. | Reglas versionadas y explicación de cada paso. |
| Interfaz y alertas | Mostrar evidencia y estado, elegir destinatario según el episodio y registrar confirmaciones. | Vista personal, vista médica a bordo y aviso operativo. |
| Informe y enlace | Construir el informe, persistir la cola y simular demora, capacidad y cortes. | Bandeja en Tierra y registro de entrega. |

El contrato compartido es **el registro del episodio**. Incluye observaciones, procedencia y calidad, contexto, decisión, motivo, acción tomada y estado del informe. Así el equipo puede implementar cada módulo con los mismos escenarios de prueba.

### Sensores y cruce de datos

Como referencia, NASA documenta ECG, frecuencia cardíaca y estimaciones metabólicas durante EVA en procedimientos de la ISS, equipamiento de seguimiento con presión arterial y ECG, y ecografía guiada. La disponibilidad, frecuencia y acceso al flujo de datos se verifican para cada vehículo, traje y fase de misión.

Para la demo usar frecuencia cardíaca, SpO₂, actividad y un síntoma ingresado. El pulso y la SpO₂ de un mismo oxímetro comparten la señal óptica PPG. Si el movimiento degrada esa señal, ambos números pueden verse afectados por un solo artefacto. Un ECG disponible ofrece un canal distinto para corroborar la frecuencia cardíaca. Alinear los tiempos y conservar la procedencia permite reconocer esa diferencia.

Para el MVP usar reglas explícitas y una línea de base personal simple. Las reglas pueden ordenar verificaciones según incertidumbre, disponibilidad y tiempo estimado. La calidad de señal y la elección de mediciones son candidatos posteriores para un modelo entrenado con casos anotados. Los criterios de actuación clínica y los textos de escalamiento requieren revisión profesional antes de probarse con personas.

Fuentes: [NASA Medical Operations](https://www.nasa.gov/reference/6-0-medical-operations/) · [Equipamiento ISS](https://ntrs.nasa.gov/api/citations/20250005232/downloads/International%20Space%20Station%20Familiarization.pdf) · [Estándar NASA para trajes](https://www.nasa.gov/reference/11-0-spacesuits-vol-2/) · [PhysioNet BIDMC](https://physionet.org/content/bidmc/1.0.0/)

### Quién recibe el aviso

| Contexto | Interacción propuesta |
| --- | --- |
| Rutina en la nave | Aviso privado con el cambio observado y la verificación sugerida. |
| Necesidad de asistencia | Aviso al astronauta y al responsable médico a bordo. Si falta confirmación, derivación a un suplente. |
| Emergencia que requiere movilizar a la tripulación | Aviso operativo con ubicación, ayuda requerida y rol. El detalle clínico queda en la vista autorizada. |
| Sueño | Los avisos de rutina pueden quedar pendientes. Los urgentes llegan también a alguien capaz de responder. |
| Caminata espacial | Para la demo, aviso breve por voz simulada al astronauta y, según el escenario, a su compañero y al operador interno. Detalle en consola. |

La voz y la consola en EVA son decisiones del prototipo. La interfaz real depende del programa, el traje y los canales disponibles. El estándar de NASA contempla visualización de datos metabólicos y delega al programa la definición de destinatarios.

Fuente: [Estándar NASA para trajes](https://www.nasa.gov/reference/11-0-spacesuits-vol-2/)

## 5. Datos públicos y dónde investigar

| Fuente | Qué aporta | Uso propuesto |
| --- | --- | --- |
| [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Efemérides y tiempo de luz de ida. En salida vectorial, VEC_TABLE=3 o 4 incluye ese valor. | Descargar perfiles de latencia Tierra–Marte y reproducirlos localmente. Modelar cortes y capacidad del enlace como parámetros propios. |
| [PhysioNet BIDMC](https://physionet.org/content/bidmc/1.0.0/bidmc_csv/) | 53 registros hospitalarios abiertos de ocho minutos con ECG, PPG, respiración y parámetros como frecuencia cardíaca y SpO₂. | Reproducir señales alineadas y probar el manejo de fallas. Su población y contexto son hospitalarios. |
| [NASA OSDR](https://osdr.nasa.gov/bio/repo) y [NASA Open APIs](https://api.nasa.gov/) | Catálogo y API de búsqueda, metadatos y archivos. Incluye investigaciones humanas, fisiológicas, conductuales y ambientales. | Buscar human, heart rate, cardiovascular, actigraphy y sleep. Revisar Files, unidades, cohortes, frecuencia de medición, licencia y acceso. |
| [NASA OSD-575, Inspiration4](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) | Panel metabólico sérico y otros estudios de laboratorio de una misión orbital corta. | Candidato para una vista longitudinal espacial si las observaciones descargables resultan adecuadas. |
| [NASA RadLab API](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) | Dosimetría por hora e instrumento. | Posible extensión para contextualizar exposición ambiental a lo largo de la misión. |
| [NASA Medical Operations](https://www.nasa.gov/reference/6-0-medical-operations/), [AMOS](https://ntrs.nasa.gov/citations/20240012964) y [HERA](https://www.nasa.gov/hera-about-hera/) | Operaciones, procedimientos guiados y pruebas en entornos análogos. | Fundamentar roles, inventario y escenarios de interacción. |

**Primera combinación.** Usar datos NASA/JPL para la latencia, BIDMC para reproducir señales y datos sintéticos identificados como tales para actividad, síntomas, perfiles y desenlaces. Descargar los insumos antes de la demo para poder mostrar funcionamiento sin conexión. En el README registrar fuente, versión, licencia, archivos utilizados y transformaciones.

**Pendiente del track.** Se verificó el enunciado público, pero no se pudo comprobar la sección completa de recursos. Revisar si exige un dataset específico o datos NASA de salud. Horizons aporta datos NASA al enlace. Si la exigencia se refiere a datos de salud, integrar un estudio pertinente de OSDR y documentar dónde se usa. En la búsqueda previa no se identificó una serie pública de astronautas con ECG, SpO₂, actividad, síntomas y resolución clínica sincronizados para validar el flujo completo.

## 6. Demo y evaluación

Elegir un episodio dentro del hábitat y mostrar tres variantes que comienzan con la misma lectura anómala.

1. **Artefacto de señal.** Una toma de mejor calidad aclara la discrepancia. El episodio conserva la lectura inicial y explica cómo se resolvió.
2. **Anomalía persistente.** Un síntoma reportado cambia la siguiente medición y activa revisión a bordo dentro del escenario simulado.
3. **Instrumento indisponible.** El sistema refleja qué falta, cambia el recorrido y registra la incertidumbre. El informe conserva ese límite.

La interfaz puede mostrar dos vistas en paralelo, **A bordo** y **Tierra**, con reloj acelerado y estado del enlace. Así se ve que la evaluación avanza a bordo y que Tierra recibe el caso consolidado. Agregar una prueba con el enlace caído para verificar que el informe se conserva y llega cuando se restablece.

| Hipótesis | Comparación | Métricas |
| --- | --- | --- |
| El flujo adaptativo reduce el trabajo de evaluación. | Checklist fijo frente a selección adaptativa, con los mismos escenarios e instrumentos. | Tiempo hasta una decisión local, mediciones solicitadas, decisiones erróneas o indeterminadas frente al resultado esperado del escenario. |
| Consolidar el episodio reduce la coordinación con Tierra. | Mensajes parciales y pedidos sucesivos frente al informe unificado, bajo las mismas condiciones del enlace. | Tiempo desde el inicio hasta el primer reporte suficiente, bytes y rondas de consulta. Incluir el tiempo de evaluación previo al envío. |

Antes de la prueba, definir qué campos hacen que el reporte sea suficiente y quién anota la acción esperada por escenario. Los resultados del MVP permiten evaluar el flujo, el transporte y la interfaz bajo simulación. La validación clínica requeriría datos y revisión adicionales.

## 7. Decisiones pendientes y próximo paso

- Confirmar con las bases del track el alcance de la exigencia de datos públicos y NASA.
- Elegir el episodio, los instrumentos simulados y los criterios de revisión con asesoramiento clínico.
- Acordar cuándo el informe resulta suficientemente informativo, quién puede liberarlo y qué ocurre si el episodio sigue activo.
- Definir quién recibe avisos de rutina y qué suplencia se activa si nadie confirma.
- Elegir el contexto de nave o hábitat del MVP. Dejar sueño y EVA como variantes de interfaz hasta verificar el hardware y los canales de una misión de referencia.
- Implementar primero el recorrido completo con un episodio. Usar ese mismo contrato para incorporar las otras variantes y medir los resultados.

## Pitch para contarle al equipo

En una misión a Marte, una consulta médica con Tierra puede sumar unos 40 minutos de viaje de la señal. Nuestro asistente permite que la tripulación avance durante ese tiempo. Cruza las mediciones con el historial y la actividad del astronauta, propone la próxima verificación según lo que va encontrando y activa ayuda a bordo si hace falta. Cuando hay información suficiente, reúne en un informe qué pasó, qué se midió, cómo evolucionó el episodio y qué queda por resolver. La demo mide cuánto trabajo puede resolver la tripulación localmente y cuántos intercambios necesita Tierra para entender el caso.
