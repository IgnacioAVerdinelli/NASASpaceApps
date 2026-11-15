# Trama: documentación y guía para completar la entrega

Documento de trabajo del equipo · 15 de noviembre de 2026

Este archivo explica el proyecto en español y reúne borradores en inglés para completar la página de NASA Space Apps. La documentación técnica completa en inglés está en [Project documentation](project-documentation.md). Los textos marcados **[COMPLETAR]** necesitan información del equipo; los marcados **[VERIFICAR]** deben contrastarse antes del envío.

> **Estado del proyecto:** Trama es un prototipo con tripulación y mediciones sintéticas. Los estudios de reposo en cama que usamos se hicieron en la Tierra, no son datos de astronautas en vuelo. El sistema no es un dispositivo médico ni ha sido validado para diagnóstico o tratamiento.

## 1. Qué problema abordamos y qué hicimos

En una misión prolongada, una persona de la tripulación necesita entender cómo cambia su salud y qué información requiere atención. Las comunicaciones demoradas y el acceso limitado a especialistas hacen valioso contar con información comprensible y organizada a bordo.

Trama reúne en una interfaz las tendencias de un reloj simulado, pruebas periódicas de fuerza y capacidad aeróbica, un cuerpo 3D y un plan de tareas. Compara las mediciones con referencias personales y con datos de estudios de reposo en cama de NASA; muestra cambios, incertidumbre y posibles seguimientos. Busca apoyar la autonomía y la revisión humana, sin reemplazar al equipo médico.

El [desafío oficial](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) plantea una herramienta visual para que astronautas evalúen su salud y reciban orientación. Nuestra interpretación y las fuentes consultadas están en [contexto del desafío](contexto-challenge.md).

### Qué se puede mostrar hoy

- **Health summary y cuerpo 3D:** resumen por tripulante y exploración de regiones anatómicas. Los colores son una representación visual, no un diagnóstico; las regiones de superficie son aproximadas.
- **Vital signs:** signos diarios simulados del reloj, comparación con la historia reciente de esa persona y tendencias. Los umbrales del reloj son supuestos del prototipo.
- **Muscle strength y Aerobic capacity:** pruebas simuladas, comparación con valores previos al vuelo, bandas de ruido, niveles, alertas y próximos estudios. Una sola medición y su nivel no constituyen una alerta confirmada.
- **Mission plan:** estudios de rutina, controles y revisiones derivados de los hallazgos; permite marcar tareas como realizadas. No es un plan médico completo ni prescribe ejercicio.
- **Avisos:** se generan y registran entregas simuladas. No hay conexión real con relojes, pantallas de la nave, radio ni Tierra.

## 2. Cómo funciona

![Diagrama de arquitectura](img/architecture.svg)

1. Un proceso prepara parámetros y referencias a partir de los estudios de NASA. **gravsim** genera una misión ficticia, mediciones y contexto; no reproduce telemetría real de astronautas.
2. **DataService** recibe los datos, normaliza unidades y fechas, conserva marcas de calidad y guarda lecturas, contexto y resultados en SQLite. Publica eventos para los demás servicios.
3. **HealthService** compara mediciones válidas con referencias personales y curvas de reposo en cama. Produce resultados, hallazgos, alertas y avisos. Un proceso consumidor atiende los eventos en la demo.
4. **Planner** toma los hallazgos y el contexto para organizar estudios y controles. Usa una selección de rutinas interpretadas de la norma OCHMO-STD-100.1A y guarda el plan mediante DataService.
5. El **frontend React** presenta el resumen, las tendencias, el cuerpo 3D y el plan. Consulta los servicios periódicamente; si falla una consulta conserva el último estado válido y muestra un aviso.
6. Una cola SQLite conecta los procesos y registra entregas simuladas. La opción `--run-booked` permite que el simulador genere las mediciones de controles programados.

La comparación de fuerza y capacidad aeróbica considera la referencia previa al vuelo y el ruido de medición. Los hallazgos sospechosos pueden surgir antes de la confirmación; las reglas de alertas periódicas documentadas utilizan evidencia adicional, incluido el promedio de dos pruebas. Para el reloj se comparan patrones recientes con una referencia personal. Las reglas son experimentales y su evaluación se hizo con simulaciones, no con pacientes reales. Ver [arquitectura](architecture.md), [HealthService](../health/README.md), [reloj](wearable.md) y [planificador](planner.md).

## 3. Datos, fuentes y cómo los usamos

Los datos provienen del [NASA Life Sciences Portal](https://nlsp.nasa.gov/). El detalle de archivos y limitaciones está en el [inventario de datasets](../data/nlsp/README.md).

| Fuente | Qué contiene | Uso en Trama |
|---|---|---|
| [MR079G: función muscular](https://doi.org/10.83263/bk5h-r757) | Mediciones de fuerza isocinética en estudios de reposo en cama. | Ajuste de parámetros del simulador y resumen de referencia CFT70 para fuerza en el frontend. Se usan estudios adicionales para el ajuste. |
| [MR035G: densitometría ósea](https://doi.org/10.83263/7myc-5j86) | DXA de densidad ósea y composición corporal. | Ajuste de parámetros simulados de hueso y masa magra. |
| [MR080G: capacidad aeróbica](https://doi.org/10.83263/w056-8t76) | Pruebas aeróbicas, incluido VO₂pico. | Ajuste del simulador y resumen de referencia CFT70 para capacidad aeróbica. |
| [MR001G: respuesta cardiovascular a la inclinación](https://doi.org/10.83263/gz1q-a824) | Mediciones cardiovasculares y neuroendocrinas. | Disponible como contexto de investigación. **No está confirmado que alimente el ajuste del simulador.** |

El [script de ajuste](../sim/fit/fit_params.py) produce los parámetros de gravsim a partir de MR079G, MR035G y MR080G. Otros scripts preparan los resúmenes CFT70 para [fuerza](../scripts/build-cft70-reference.py) y [capacidad aeróbica](../scripts/build-cft70-aerobic-reference.py). Las lecturas visibles en la demo se generan sintéticamente a partir de parámetros y supuestos: no son registros individuales reales de astronautas.

Los estudios tienen poblaciones y protocolos limitados. CFT70 no incluye mediciones durante el reposo y su muestra tiene un marcado predominio masculino. Las curvas extendidas más allá de la duración de los estudios son extrapolaciones. Por eso, estos resultados no prueban cómo respondería una persona concreta en una misión.

El planificador se apoya en la [norma OCHMO-STD-100.1A](references/OCHMO-STD-100.1A_RevA_2024-09-09.pdf); la regla aeróbica se documenta con referencias a NASA-STD-3001 y OCHMO-TB-031 en [HealthService](../health/README.md#nasa-standard-vo2peak). Son interpretaciones del prototipo que necesitan revisión experta. Los [peligros](https://www.nasa.gov/hrp/hazards/) y [riesgos](https://www.nasa.gov/hrp/risks/) de NASA aportan contexto. El modelo 3D usa [Open Anatomy 3D](https://github.com/MervinR07/open-anatomy-3d); los créditos y licencias de sus fuentes están en el [README](../README.md#créditos-y-licencias).

## 4. Cómo levantar y mostrar la demo

Se necesita Python 3.10+ y Node.js 20.19+ o 22.12+. Desde la raíz, en Linux/macOS:

```bash
python3 -m venv .venv
.venv/bin/pip install -e ./sim -e './health[dev]' -e './planner[dev]'
npm install
cd src/front/sketch && npm install && cd ../../..
bash scripts/demo.sh
```

La demo queda en `http://127.0.0.1:5190/vuelo.html` y se detiene con `Ctrl+C`. Para Windows, opciones y problemas frecuentes, consultar la [guía de demo](guia-demo.md). Un recorrido sugerido: mostrar CM-3 y su cambio en el reloj; abrir Vital signs; pasar a CM-2 para mostrar capacidad aeróbica y cuerpo 3D; abrir Mission plan y terminar con las pruebas de fuerza y capacidad aeróbica. Aclarar siempre que la misión y las mediciones son simuladas.

## 5. Formulario: respuestas en inglés para adaptar

La [guía oficial de entrega](https://www.spaceappschallenge.org/resources/project-submission-guide/) devolvió error 502 al consultarla el 15 de noviembre. Los campos de abajo provienen de las [notas del equipo](contexto-challenge.md#6-participación-entrega-y-evaluación), que registran una lectura de la guía el 14 de noviembre. **[VERIFICAR]** Confirmar los nombres, límites de caracteres, formato y requisitos en el formulario actual. Los textos son borradores: revisar que describan exactamente lo que el equipo entregue.

### Project Name

Nombre del proyecto. Confirmar el nombre definitivo.

> Trama — Astronaut Health Monitoring

### High-Level Project Summary

Resumen de qué hicimos, para quién y por qué importa:

> Trama is a research-informed prototype that helps astronauts explore changes in their health during long missions. It combines simulated wearable trends and periodic strength and aerobic measurements with an interactive body view and a mission plan. NASA bed-rest research informs the synthetic data and comparisons, while personal baselines and measurement uncertainty provide context. Trama highlights possible follow-up for human review; it is not a medical diagnosis or a validated clinical tool.

### Link to Project Demo

**[COMPLETAR]** Enlace público a la demo: `________________________`

Las notas del equipo indican una presentación de hasta 7 diapositivas o un video de hasta 30 segundos. **[VERIFICAR]** Confirmar formato y límite en la guía vigente. Revisar que el enlace no requiera contraseña, registro ni permisos, y que el material esté en inglés o tenga los subtítulos que corresponda.

### Link to Final Project

**[COMPLETAR]** Enlace público al repositorio, sitio o proyecto final: `________________________`

Abrir el enlace en una ventana privada para comprobar el acceso.

### Detailed Project Description

Descripción de la solución, funcionamiento, beneficios y herramientas:

> Long missions can make immediate medical support difficult. Trama brings information that would otherwise be spread across measurements and schedules into an interface designed for the crew. A synthetic mission generates watch readings, strength tests and aerobic assessments. The DataService cleans and stores these records; the HealthService compares them with the person's preflight or recent history and with research-derived references. Findings feed a Planner that displays routine studies and follow-up reviews. A React dashboard presents trends, an interactive 3D body and a mission plan.
>
> The prototype uses NASA Life Sciences Portal bed-rest datasets to fit simulation parameters and build comparison summaries, and selected NASA medical standards to inform the planner and an experimental aerobic rule. Bed rest is an Earth-based analog, not a record of astronauts in flight. All displayed crew readings are synthetic; notifications are simulated, and clinical performance has not been validated. Python services, SQLite, React, Vite and Three.js support the demonstration.

### NASA Data

Qué recursos de NASA usamos y para qué:

> We used NASA Life Sciences Portal experiments MR079G (Isokinetic Muscle Function, https://doi.org/10.83263/bk5h-r757), MR035G (Bone Densitometry Assessment, https://doi.org/10.83263/7myc-5j86), and MR080G (Aerobic Capacity, https://doi.org/10.83263/w056-8t76) to fit parameters for synthetic mission data and build selected bed-rest comparison summaries. MR001G (https://doi.org/10.83263/gz1q-a824) is retained as background research. We consulted OCHMO-STD-100.1A to inform selected routine-study scheduling and NASA Human Research Program resources for mission context. Bed-rest studies are ground analogs, not astronaut flight measurements.

### Space Agency Partner Data and Other References

Fuentes externas, recursos y créditos. **[COMPLETAR]** Revisar con todo el equipo y agregar cualquier recurso, código, imagen, publicación o licencia faltante.

> - Canadian Space Agency, Why do we conduct science experiments in space? https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp — mission and research context.
> - Open Anatomy 3D, https://github.com/MervinR07/open-anatomy-3d — anatomical models and catalog. Its credited sources include BodyParts3D (CC BY 4.0), HuBMAP Human Reference Atlas organs (CC BY 4.0), and MakeHuman (CC0). Trama adds derived surface-region maps; see the repository attribution for details.
> - Tele-SUS research, https://pmc.ncbi.nlm.nih.gov/articles/PMC8047175/ — background on muscle monitoring; ultrasound acquisition is not implemented in the prototype.
> - [COMPLETE: remaining sources, assets, libraries, licenses and attribution.]

### Use of Super Intelligence (SI)

**[COMPLETAR Y VERIFICAR]** El [README del HealthService](../health/README.md#ai-use) registra asistencia de Claude. Este documento también fue preparado con asistencia de IA. Consultar al equipo qué otras herramientas y aportes hubo antes de completar el campo; no afirmar que la lista está completa sin comprobarlo. Borrador adaptable:

> AI assistance was used during development and documentation, including assistance from Claude on the HealthService and an AI assistant in preparing project documentation and submission drafts. [COMPLETE: list all other tools and their actual contributions, including any code, text, data, images, audio or video.] The team reviewed and is responsible for the final project and its claims.

**[VERIFICAR]** Comprobar la guía oficial sobre declaración, metadatos y marcado del contenido generado por IA; aplicar lo que corresponda a cada material.

## 6. Antes de enviar

- [ ] Confirmar nombre del equipo, integrantes, roles y evento local; verificar que figuren correctamente en la plataforma.
- [ ] Completar enlaces públicos de demo y proyecto; comprobarlos sin iniciar sesión.
- [ ] Revisar la [guía oficial](https://www.spaceappschallenge.org/resources/project-submission-guide/) y el formulario: campos, límites, requisitos de idioma, formato de demo, elegibilidad y fecha y zona horaria aplicables.
- [ ] Revisar el inventario de fuentes, licencias y atribuciones, incluyendo librerías y recursos visuales; confirmar la licencia del código propio.
- [ ] Completar la declaración real de uso de IA y verificar las exigencias de identificación de cada contenido.
- [ ] Revisar que cada afirmación esté respaldada y que la entrega distinga claramente datos reales de investigación, datos sintéticos, funcionalidades implementadas y propuestas futuras.
- [ ] Confirmar que el proyecto y los materiales finales se ven correctamente y que la información presentada coincide con la demo.

Para más detalle técnico y bibliografía, consultar la [documentación maestra en inglés](project-documentation.md), la [investigación del desafío](contexto-challenge.md) y el [inventario de fuentes musculares](fuentes-investigaciones-musculares.md).
