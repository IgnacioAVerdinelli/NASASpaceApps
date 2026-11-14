# Contexto del desafío: monitoreo de salud de astronautas

**NASA Space Apps Challenge 2026 · Documento de referencia del equipo**  
**Última consulta:** 14 de noviembre de 2026  
**Desafío:** [Create Health Monitoring Software for Astronauts on Space Missions — Details](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details) · [Resources](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources)

> **Estado de verificación:** el 13 y el 14 de noviembre de 2026 se leyeron directamente las pestañas oficiales [Details](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details) y [Resources](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources), y las guías oficiales [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) y [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/). El brief y los cinco recursos coinciden con la [reproducción del evento local HackAthlone](https://hackathlone.com/challenges/health-monitoring-software), que se usó en la primera versión de este documento porque la página oficial devolvía un error 502.

## 1. El desafío en una mirada

| Aspecto | Descripción |
| --- | --- |
| Objetivo central | Crear software que reúna indicadores de salud y permita a los astronautas evaluar su estado y actuar en consecuencia. |
| Usuario principal | El astronauta, que debe poder evaluar su propia salud durante una misión. |
| Forma de la solución | Una herramienta visual de autoevaluación que también ofrezca orientación sobre tratamientos y mejoras de salud. |
| Contexto | Misiones espaciales prolongadas, con exposición a condiciones que afectan la salud física y mental. |
| Dificultad y temas | Intermedia; exploración humana, software y exploración espacial. |
| Agencia asociada | Agencia Espacial Canadiense (CSA), según la reproducción del desafío. |

Fuente: [página oficial del desafío](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/), pestañas Details y Resources.

## 2. Problema y contexto de misión

Las misiones más largas aumentan la exposición a las condiciones del espacio y exigen que la tripulación participe en el seguimiento de su propia salud. El brief relaciona esas condiciones con cambios inmunitarios, pérdida de densidad ósea, eventos cardiovasculares, nutrición insuficiente y problemas de salud conductual. Estos son ejemplos de riesgos, no una lista de condiciones que necesariamente desarrollará cada astronauta. [Fuente: brief oficial](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details).

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

Esta sección resume la [pestaña Details oficial](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details).

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

Además, el brief destaca que el diseño de la interfaz es importante para presentar métricas y diagnósticos con claridad. Menciona animaciones, interacción y una figura humana con partes seleccionables como un ejemplo de presentación; no prescribe ese diseño.

### Consideraciones explícitamente opcionales

El texto indica que se pueden considerar, sin obligación:

- Diferentes entornos: nave espacial, estación, rover o base en otro planeta o luna.
- Recordatorios para tomar mediciones o realizar acciones como parte de la rutina de misión.
- Gamificación de tareas de salud, gráficos dinámicos de evolución y colores para facilitar la interpretación.
- Instrucciones y explicaciones simples sobre mediciones, indicadores y riesgos, sin asumir que el astronauta sabe evaluar todo por sí mismo.

La orientación sobre tratamientos figura en el objetivo; las fuentes revisadas no proporcionan por sí mismas protocolos clínicos, umbrales validados ni autorización para hacer afirmaciones médicas. Cualquier regla o indicación concreta requiere su propia evidencia y contexto.

## 4. Recursos del desafío

La [pestaña Resources oficial](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources) enumera estos cinco recursos: tres de NASA y dos de la CSA. Son páginas informativas, no datasets descargables. Todos los enlaces siguientes respondieron durante la consulta.

### NASA

1. **[5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/).** Introduce los cinco peligros y enlaza a material adicional sobre cada uno. Sirve para entender las condiciones de misión y justificar qué factores se estudian. Es contexto general, no un conjunto de mediciones ni una tabla de umbrales.
2. **[Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/).** Catálogo de riesgos investigados por el HRP, entre ellos aspectos inmunitarios, cardiovasculares, musculoesqueléticos, vestibulares, nutricionales, de sueño y de salud mental. Sirve para profundizar en un riesgo concreto y seguir sus fuentes; no implica que cada riesgo sea medible con los mismos instrumentos.
3. **[Ongoing HRP Research](https://www.nasa.gov/hrp/ongoing-hrp-research/).** Reúne investigaciones en curso, incluyendo estudios sobre movimiento, luz, sueño y bienestar; biomarcadores inmunitarios; mediciones fisiológicas y psicológicas; y ultrasonido. Ayuda a identificar qué se investiga y cómo; los resúmenes no garantizan acceso público a datos individuales ni definen umbrales clínicos.

### Agencia Espacial Canadiense

4. **[Monitoring radiation for astronaut health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp).** Describe el desarrollo de CANS, un instrumento compacto y autónomo diseñado para medir radiación de neutrones de manera continua. Aporta contexto sobre medición ambiental de radiación; el artículo no es un dataset médico ni establece que el instrumento mida la dosis personal total.
5. **[Why do we conduct science experiments in space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp).** Explica por qué la investigación espacial ayuda a preparar misiones lejanas y puede producir beneficios en la Tierra. Aporta contexto sobre autonomía y dificultades de misión; no especifica requisitos del software.

La pestaña oficial aclara que NASA no avala entidades ajenas al gobierno de EE. UU. y que, en los sitios de otras agencias, hay que respetar sus condiciones de uso de datos. Revisar permisos, licencias, atribución y restricciones de acceso de cada recurso antes de reutilizarlo.

## 5. Datos y evidencia para investigar

En una [respuesta de un Navigator de Space Apps](https://github.com/nasa/spaceapps/discussions/2025) a una consulta específica sobre este desafío se indica que **no parece haber un dataset descargable obligatorio**. Es orientación de un Navigator, no una confirmación definitiva de las reglas del desafío. También señala que no necesariamente existe un único dataset público que reúna todos los indicadores y que algunas fuentes pueden tener restricciones.

Puntos de partida adicionales sugeridos en esa respuesta:

- [NASA Open Science Data Repository (OSDR)](https://osdr.nasa.gov/): estudios biológicos y fisiológicos relevantes para el espacio. Un estudio puede contener muestras o resultados procesados, no telemetría continua de astronautas.
- [NASA Life Sciences Portal (NLSP)](https://nlsp.nasa.gov/): investigación humana espacial y terrestre; algunos datos pueden requerir una solicitud o tener acceso restringido.
- [Preguntas frecuentes de OSDR](https://science.nasa.gov/reference/osdr-faq/): guía para buscar y acceder a datos.
- [Datos de salud de Inspiration4 en el repositorio de NASA](https://science.nasa.gov/humans-in-space/nasas-repository-supports-research-of-commercial-astronaut-health/): ejemplo de investigación disponible para examinar su pertinencia y condiciones.

El Navigator considera razonable complementar investigación accesible con datos simulados claramente identificados. También recomienda no trasladar automáticamente rangos clínicos terrestres a límites seguros para astronautas, y documentar la fuente y el carácter experimental de cualquier umbral. Estas son recomendaciones para evaluar, no requisitos obligatorios ni validación clínica. [Fuente: respuesta del Navigator](https://github.com/nasa/spaceapps/discussions/2025).

**Regla oficial sobre datos.** La [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) exige usar **al menos un dato o recurso de NASA** para ser elegible a un premio global, y detallarlo en el campo *NASA Data* del formulario. Además, el criterio de Relevancia premia integrar los datos de NASA como componente central de la solución, no como agregado superficial (ver sección 6). También se alienta usar datos de las agencias socias de 2026, entre ellas la CSA y la Comisión Nacional de Actividades Espaciales de Argentina (CONAE).

## 6. Participación, entrega y evaluación

Fuentes: [Participant FAQs](https://www.spaceappschallenge.org/resources/participant-faqs/), [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) y [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/).

### Fechas y equipo

- El hackathon se realiza el **14 y 15 de noviembre de 2026**.
- La entrega abre el **sábado 14 a las 9:00** y cierra el **domingo 15 a las 23:59**, en la hora local del evento del equipo. En el Universal Event (virtual) rige la hora local del lugar de residencia del dueño del equipo (*Team Owner*).
- Los equipos tienen hasta **seis integrantes**; en el Universal Event, al menos dos. Todos deben estar registrados en el mismo evento y figurar en la pestaña *Members* del equipo. No se pueden sumar integrantes después del cierre de la entrega.
- La sede local puede tener horarios propios de evaluación y premiación: consultarlos con el *Local Lead*.

### Qué se entrega

La página del proyecto y todo el material vinculado deben estar **en inglés**. Campos del formulario:

- **Project Name** y **High-Level Project Summary**: qué se desarrolló, cómo responde al desafío y por qué importa.
- **Link to Project Demo**: presentación de **hasta 7 diapositivas** (incluidas portada e introducción) o **video de hasta 30 segundos**. El video puede hablarse en otro idioma si tiene subtítulos en inglés. El link debe ser público, sin contraseña, permisos ni registro.
- **Link to Final Project**: link público al proyecto (sitio, repositorio, carpeta en la nube, etc.).
- **Detailed Project Description**: qué hace, cómo funciona, beneficios, objetivos y herramientas o lenguajes usados.
- **Use of Super Intelligence (SI)**: si se usaron herramientas de IA y cómo.
- **NASA Data**: qué datos y recursos de NASA se usaron.
- **Space Agency Partner Data and Other References**: todos los datos, recursos, código, textos e imágenes externos usados, aunque sean abiertos o gratuitos.

Al enviar hay que confirmar que el trabajo es original y que todas las fuentes externas figuran en las referencias.

### Uso de IA

La guía permite usar IA (*Super Intelligence*, SI) para acelerar el desarrollo, pero indica que **no debe usarse para idear la solución** del desafío. Hay que identificar lo generado: imágenes y videos con marca de agua visible; audio, código y datos reconocidos en el texto descriptivo y en los metadatos. El contenido generado no puede usar ni modificar logos ni elementos de marca de NASA. Los jueces no ven la respuesta del campo SI, pero sí las marcas y aclaraciones incluidas en el proyecto.

### Criterios de evaluación

En todas las instancias, cada proyecto se califica de 1 a 5 en cinco criterios:

| Criterio | Qué evalúa |
| --- | --- |
| Impacto | Magnitud del problema que aborda y alcance de su efecto. |
| Creatividad | Originalidad e innovación del enfoque. |
| Validez | Fundamento científico, factibilidad técnica y usabilidad. |
| Relevancia | Alineación con el desafío e integración de datos de NASA como parte central. |
| Presentación | Claridad y narrativa al comunicar el desafío, la solución y su importancia. |

La mayor parte de la evaluación se basa en la página del proyecto; una buena demo puede subir el puntaje de Presentación.

## 7. Pendientes de verificación

Resuelto el 14 de noviembre: el brief y los recursos se contrastaron con las pestañas oficiales, y los criterios, el formato de entrega y la regla de datos de NASA se confirmaron en las guías oficiales (secciones 3 a 6).

- Confirmar la sede del equipo (o el Universal Event) y sus horarios de evaluación local; comprobar que todos los integrantes estén registrados en el mismo evento y figuren en *Members*.
- Para cada indicador que el equipo estudie más adelante, investigar viabilidad de medición, contexto de misión, calidad y disponibilidad de datos, y respaldo de cualquier interpretación o acción.
- Verificar licencias, atribución y acceso de cada dataset o material elegido. Mantener diferenciados datos reales, datos sintéticos y reglas experimentales.

Este documento es una síntesis de investigación para el hackathon; no sustituye las páginas oficiales, publicaciones originales ni asesoramiento médico.
