# Contexto del desafío: monitoreo de salud de astronautas

**NASA Space Apps Challenge 2026 · Documento de referencia del equipo**  
**Última consulta:** 13 de noviembre de 2026  
**Desafío:** [Create Health Monitoring Software for Astronauts on Space Missions — Details](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details) · [Resources](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources)

> **Estado de verificación:** las páginas oficiales del desafío devolvieron un error 502 durante la consulta. El resumen oficial indexado confirma el título, la dificultad, los temas y el objetivo general. El desarrollo del brief y la lista de recursos se contrastaron con la [reproducción del evento local HackAthlone](https://hackathlone.com/challenges/health-monitoring-software), que indica que la página oficial prevalece. Los cinco recursos se consultaron directamente. Revisar ambas pestañas oficiales cuando vuelvan a estar disponibles.

## 1. El desafío en una mirada

| Aspecto | Descripción |
| --- | --- |
| Objetivo central | Crear software que reúna indicadores de salud y permita a los astronautas evaluar su estado y actuar en consecuencia. |
| Usuario principal | El astronauta, que debe poder evaluar su propia salud durante una misión. |
| Forma de la solución | Una herramienta visual de autoevaluación que también ofrezca orientación sobre tratamientos y mejoras de salud. |
| Contexto | Misiones espaciales prolongadas, con exposición a condiciones que afectan la salud física y mental. |
| Dificultad y temas | Intermedia; exploración humana, software y exploración espacial. |
| Agencia asociada | Agencia Espacial Canadiense (CSA), según la reproducción del desafío. |

Fuente: [página oficial del desafío](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) para el resumen general; [HackAthlone](https://hackathlone.com/challenges/health-monitoring-software) para el desarrollo del objetivo y la agencia asociada.

## 2. Problema y contexto de misión

Las misiones más largas aumentan la exposición a las condiciones del espacio y exigen que la tripulación participe en el seguimiento de su propia salud. El brief relaciona esas condiciones con cambios inmunitarios, pérdida de densidad ósea, eventos cardiovasculares, nutrición insuficiente y problemas de salud conductual. Estos son ejemplos de riesgos, no una lista de condiciones que necesariamente desarrollará cada astronauta. [Fuente: brief reproducido](https://hackathlone.com/challenges/health-monitoring-software).

El Programa de Investigación Humana de NASA (**HRP**, por *Human Research Program*) agrupa los peligros del vuelo espacial en cinco categorías. Un **peligro** es una fuente de exposición; un **riesgo** es un posible resultado para la salud o el rendimiento. Los peligros pueden interactuar y sus efectos dependen de la misión. [Fuentes: peligros de NASA](https://www.nasa.gov/hrp/hazards/) y [riesgos de NASA](https://www.nasa.gov/hrp/risks/).

| Peligro | Qué implica para el contexto |
| --- | --- |
| Radiación espacial | Exposición a radiación fuera de la protección terrestre; su medición y sus efectos son temas de investigación. |
| Aislamiento y confinamiento | Tripulaciones pequeñas conviven durante períodos prolongados en espacios limitados y alejadas de su entorno habitual. |
| Distancia de la Tierra | Aumentan las demoras de comunicación y disminuye la posibilidad de recibir suministros o asistencia médica de emergencia desde Tierra. |
| Campos gravitatorios | La exposición a gravedad alterada y las transiciones entre ambientes gravitatorios afectan la adaptación del organismo. |
| Ambiente hostil y cerrado | La tripulación depende del entorno controlado de la nave o hábitat y sus sistemas de soporte. |

La CSA describe cómo las misiones lejanas combinan más tiempo en ingravidez, radiación y aislamiento con mayores demoras de comunicación y menor acceso a apoyo terrestre. [Fuente: por qué se hacen experimentos en el espacio](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp).

## 3. Qué pide el brief

Esta sección resume la [reproducción de HackAthlone](https://hackathlone.com/challenges/health-monitoring-software); la redacción detallada sigue pendiente de contraste directo con la pestaña oficial.

### Resultado buscado

Crear una herramienta visual que ayude a los astronautas a evaluar su propia salud durante la misión y proporcione orientación sobre tratamientos y mejoras de salud. El reto enfatiza tanto la captura de indicadores como la interpretación y las acciones posteriores: mostrar números por sí solo no expresa todo el objetivo.

El brief permite considerar cualquier tipo de entrada, por ejemplo texto mediante teclado, clics o imágenes de cámara, y cualquier dato que represente un indicador de salud. Menciona glucosa en sangre en mg/dL e imágenes de ultrasonido como ejemplos. No establece que deban usarse esas entradas o indicadores concretos.

Los indicadores mencionados como útiles son presión arterial, frecuencia cardíaca, glucosa en sangre, temperatura corporal, horas diarias de sueño y estado de ánimo. Son ejemplos del brief, no una lista obligatoria ni una especificación de sensores disponibles en una misión.

### Preguntas para orientar el análisis

El desafío propone considerar:

1. ¿Qué mediciones se pueden realizar en el espacio y por qué sería necesario cada examen?
2. ¿Cómo afectan los peligros del vuelo espacial a los indicadores elegidos?
3. ¿Cuándo podría un resultado requerir atención de la tripulación o de los médicos de vuelo en Tierra?
4. ¿Qué acciones podrían prevenir que una condición de salud se vuelva crítica?
5. ¿Cómo presentar métricas y resultados con una interfaz clara y comprensible?

El brief menciona animaciones, interacción y una figura humana con partes seleccionables como un ejemplo de presentación; no prescribe ese diseño.

### Consideraciones explícitamente opcionales

El texto indica que se pueden considerar, sin obligación:

- Diferentes entornos: nave espacial, estación, rover o base en otro planeta o luna.
- Recordatorios para tomar mediciones o realizar acciones como parte de la rutina de misión.
- Gamificación de tareas de salud, gráficos dinámicos de evolución y colores para facilitar la interpretación.
- Instrucciones y explicaciones simples sobre mediciones, indicadores y riesgos, sin asumir que el astronauta sabe evaluar todo por sí mismo.

La orientación sobre tratamientos figura en el objetivo; las fuentes revisadas no proporcionan por sí mismas protocolos clínicos, umbrales validados ni autorización para hacer afirmaciones médicas. Cualquier regla o indicación concreta requiere su propia evidencia y contexto.

## 4. Recursos del desafío

El [espejo de HackAthlone](https://hackathlone.com/challenges/health-monitoring-software) enumera estos cinco recursos: tres de NASA y dos de la CSA. Todos los enlaces siguientes respondieron durante la consulta. La composición de la pestaña oficial aún debe verificarse directamente.

### NASA

1. **[5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/).** Introduce los cinco peligros y enlaza a material adicional sobre cada uno. Sirve para entender las condiciones de misión y justificar qué factores se estudian. Es contexto general, no un conjunto de mediciones ni una tabla de umbrales.
2. **[Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/).** Catálogo de riesgos investigados por el HRP, entre ellos aspectos inmunitarios, cardiovasculares, musculoesqueléticos, vestibulares, nutricionales, de sueño y de salud mental. Sirve para profundizar en un riesgo concreto y seguir sus fuentes; no implica que cada riesgo sea medible con los mismos instrumentos.
3. **[Ongoing HRP Research](https://www.nasa.gov/hrp/ongoing-hrp-research/).** Reúne investigaciones en curso, incluyendo estudios sobre movimiento, luz, sueño y bienestar; biomarcadores inmunitarios; mediciones fisiológicas y psicológicas; y ultrasonido. Ayuda a identificar qué se investiga y cómo; los resúmenes no garantizan acceso público a datos individuales ni definen umbrales clínicos.

### Agencia Espacial Canadiense

4. **[Monitoring radiation for astronaut health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp).** Describe el desarrollo de CANS, un instrumento compacto y autónomo diseñado para medir radiación de neutrones de manera continua. Aporta contexto sobre medición ambiental de radiación; el artículo no es un dataset médico ni establece que el instrumento mida la dosis personal total.
5. **[Why do we conduct science experiments in space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp).** Explica por qué la investigación espacial ayuda a preparar misiones lejanas y puede producir beneficios en la Tierra. Aporta contexto sobre autonomía y dificultades de misión; no especifica requisitos del software.

El espejo recuerda respetar las condiciones de uso de los sitios y datos externos. Revisar permisos, licencias, atribución y restricciones de acceso de cada recurso antes de reutilizarlo. [Fuente: HackAthlone](https://hackathlone.com/challenges/health-monitoring-software).

## 5. Datos y evidencia para investigar

En una [respuesta de un Navigator de Space Apps](https://github.com/nasa/spaceapps/discussions/2025) a una consulta específica sobre este desafío se indica que **no parece haber un dataset descargable obligatorio**. Es orientación de un Navigator, no una confirmación definitiva de las reglas del desafío. También señala que no necesariamente existe un único dataset público que reúna todos los indicadores y que algunas fuentes pueden tener restricciones.

Puntos de partida adicionales sugeridos en esa respuesta:

- [NASA Open Science Data Repository (OSDR)](https://osdr.nasa.gov/): estudios biológicos y fisiológicos relevantes para el espacio. Un estudio puede contener muestras o resultados procesados, no telemetría continua de astronautas.
- [NASA Life Sciences Portal (NLSP)](https://nlsp.nasa.gov/): investigación humana espacial y terrestre; algunos datos pueden requerir una solicitud o tener acceso restringido.
- [Preguntas frecuentes de OSDR](https://science.nasa.gov/reference/osdr-faq/): guía para buscar y acceder a datos.
- [Datos de salud de Inspiration4 en el repositorio de NASA](https://science.nasa.gov/humans-in-space/nasas-repository-supports-research-of-commercial-astronaut-health/): ejemplo de investigación disponible para examinar su pertinencia y condiciones.

El Navigator considera razonable complementar investigación accesible con datos simulados claramente identificados. También recomienda no trasladar automáticamente rangos clínicos terrestres a límites seguros para astronautas, y documentar la fuente y el carácter experimental de cualquier umbral. Estas son recomendaciones para evaluar, no requisitos obligatorios ni validación clínica. [Fuente: respuesta del Navigator](https://github.com/nasa/spaceapps/discussions/2025).

## 6. Participación y evaluación

La [página oficial de Space Apps 2026](https://www.spaceappschallenge.org/2026/), consultada mediante su contenido indexado porque la apertura directa falló, indica que el hackathon se realiza el **14 y 15 de noviembre de 2026**, con equipos de hasta **seis integrantes**. El registro individual es necesario para la elegibilidad de evaluación global. La ventana general de envío en la pestaña **Project** figura desde el 14 de noviembre a las 09:00 hasta el 15 de noviembre a las 23:59, en hora local. Confirmar esta información y las condiciones vigentes en el sitio oficial.

La [sede oficial de Ajmer](https://www.spaceappschallenge.org/2026/local-events/ajmer/) enumera impacto, creatividad, validez, relevancia y presentación como criterios de evaluación. Esa fuente corresponde a una sede concreta: verificar criterios, formato de pitch, horarios y posibles entregas anticipadas de la sede del equipo. No se han verificado ponderaciones específicas para este desafío.

## 7. Pendientes de verificación

- Abrir las pestañas oficiales de [Details](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details) y [Resources](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources); cotejar el brief y los cinco recursos y registrar cambios.
- Confirmar la sede, sus horarios, requisitos de presentación y criterios vigentes; comprobar también las reglas generales y el estado del registro de cada integrante.
- Para cada indicador que el equipo estudie más adelante, investigar viabilidad de medición, contexto de misión, calidad y disponibilidad de datos, y respaldo de cualquier interpretación o acción.
- Verificar licencias, atribución y acceso de cada dataset o material elegido. Mantener diferenciados datos reales, datos sintéticos y reglas experimentales.

Este documento es una síntesis de investigación para el hackathon; no sustituye las páginas oficiales, publicaciones originales ni asesoramiento médico.
