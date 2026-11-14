# Mapa de lo que hacen otros equipos

**NASA Space Apps Challenge 2026 · Documento de trabajo del equipo**  
**Fuente:** posts públicos de búsqueda de equipo en [GitHub Discussions de nasa/spaceapps](https://github.com/nasa/spaceapps/discussions) (categoría *!Find A Team* y otras)  
**Consulta:** 14 de noviembre de 2026

> **Límites de este mapa.** Solo incluye lo que cada equipo publicó para buscar integrantes. La mayoría de los equipos del desafío no publica nada, y lo publicado puede cambiar durante el hackathon. Sirve para ver qué enfoques ya aparecen y dónde puede haber espacio, **no para copiar ideas ajenas**. No se registran datos personales.

## 1. Equipos con enfoque declarado

| Equipo | Enfoque que declaran | Tecnología mencionada | Post |
| --- | --- | --- | --- |
| **MedVital** | Misión a Marte con demora de hasta 20 minutos por trayecto: el astronauta no puede esperar al médico. App que sigue frecuencia cardíaca, sueño, exposición a radiación y ánimo, con un modelo de IA **que corre offline** en el dispositivo para detectar cambios temprano y decir qué hacer. | Python/Flask, C/C++, LLM locales | [#1968](https://github.com/nasa/spaceapps/discussions/1968) |
| **CrewCheck** | Misión a Marte con demora de hasta 20 minutos. Signos vitales automáticos desde un wearable simulado, **menos de un minuto de carga manual por día**, cada tripulante en un **mapa corporal**. Para cada señal indica **quién actúa: el astronauta, el oficial médico de a bordo o Tierra**. "La IA aconseja, las reglas deciden". | No especificada | [#2081](https://github.com/nasa/spaceapps/discussions/2081) |
| **K'in Nova** (Guatemala) | Prototipo que **combina datos fisiológicos y ambientales** para monitorear el bienestar y dar alertas a tiempo **aunque la comunicación con Tierra tenga demora**. Combinan software, diseño de wearable e investigación en salud. | Software y diseño de wearable | Comentario en [#1784](https://github.com/nasa/spaceapps/discussions/1784) |
| **ARES Health AI** (Astronaut Risk Evaluation System) | Prototipo que visualiza datos fisiológicos simulados, analiza tendencias individuales y detecta cambios inusuales con **métodos explicables**. | Python | [#2084](https://github.com/nasa/spaceapps/discussions/2084) |
| **CosmosX** | Plataforma que combina ciencia espacial, salud e IA para monitorear la salud **física y mental** durante la misión. | Web (React), backend, IA/ML | [#1923](https://github.com/nasa/spaceapps/discussions/1923) |
| **The Voyage** | Software que reúne indicadores en misiones largas para que el astronauta detecte cambios y actúe. Buscan perfiles para **detección de anomalías y tendencias**, un panel claro de un vistazo y, opcionalmente, **prototipos con sensores reales**. | Web o app, ML | [#2003](https://github.com/nasa/spaceapps/discussions/2003) |
| **Space-Pulse** (equipo CodeCell) | **Panel de monitoreo** de salud para astronautas. | Django, Tailwind, Chart.js, SQLite | [#1979](https://github.com/nasa/spaceapps/discussions/1979) |
| Sin nombre | App para monitorear métricas de salud **offline**. | No especificada | [#1922](https://github.com/nasa/spaceapps/discussions/1922) |
| Sin nombre | Preguntan qué datos entregan los **sensores de soporte de vida** y de monitoreo de salud, y si hay datasets de prueba. | No especificada | [#2118](https://github.com/nasa/spaceapps/discussions/2118) |
| Sin nombre | Debaten entre plataforma amplia o un problema puntual; mencionan **redistribución de fluidos** y **fatiga cognitiva** como candidatos. | No especificada | [#2138](https://github.com/nasa/spaceapps/discussions/2138) |

También buscan integrantes para este desafío, sin describir su enfoque: VitalisX ([#1876](https://github.com/nasa/spaceapps/discussions/1876)), Astro Health de BoredtoMARS ([#2117](https://github.com/nasa/spaceapps/discussions/2117)), spaceOverflow ([#1883](https://github.com/nasa/spaceapps/discussions/1883)) y Astromed Industries ([#1862](https://github.com/nasa/spaceapps/discussions/1862)). Algunas personas sueltas mencionan intereses puntuales: funcionar con **conectividad limitada** ([#1873](https://github.com/nasa/spaceapps/discussions/1873)) y **análisis de exposición a radiación** ([#1976](https://github.com/nasa/spaceapps/discussions/1976)).

## 2. Patrones que se repiten

- **La demora de comunicación con Tierra** como punto de partida: el astronauta tiene que arreglarse sin el médico (MedVital y CrewCheck con Marte y 20 minutos; K'in Nova en general). Es el mismo marco del informe de salud autónoma de nuestro repo.
- **IA para detectar anomalías o cambios** (MedVital, ARES, CosmosX, The Voyage). Varios aclaran que debe ser explicable o que las reglas deciden.
- **Funcionamiento offline o con poca conectividad** (MedVital, [#1922](https://github.com/nasa/spaceapps/discussions/1922), [#1873](https://github.com/nasa/spaceapps/discussions/1873)).
- **Paneles de tendencias** con datos simulados (ARES, Space-Pulse, The Voyage).
- **Mapa corporal**, que es el ejemplo que da el propio enunciado (CrewCheck).

## 3. Superposiciones con nuestra idea

| Elemento de nuestra idea | Quién más lo menciona |
| --- | --- |
| Escalar según quién debe actuar (astronauta, responsable de a bordo, Tierra) | CrewCheck lo declara como eje del producto. |
| Misión a Marte con demora de comunicación | MedVital y CrewCheck. |
| Registro diario breve más sensores | CrewCheck (menos de un minuto por día y wearable simulado). |
| Seguimiento de ánimo además de lo físico | MedVital y CosmosX. |
| Radiación como dato de contexto | MedVital. |
| Cruzar datos fisiológicos con datos ambientales | K'in Nova lo declara como objetivo. El equipo de [#2118](https://github.com/nasa/spaceapps/discussions/2118) investiga sensores de soporte de vida. En [#1787](https://github.com/nasa/spaceapps/discussions/1787) otro participante sugiere monitorear temperatura, humedad y CO₂ de la cabina. |

## 4. Lo que no apareció en ningún post

Con la advertencia de que la mayoría de los equipos no publica su enfoque, ningún post menciona:

- Cruzar datos de cabina específicamente con el **estado emocional** de cada tripulante (el cruce físico y ambiental en general sí aparece, ver sección 3).
- Detectar **situaciones compartidas por la tripulación** a partir de los datos de varias personas.
- Un **informe consolidado para Tierra** pensado para reducir mensajes, bytes o rondas de consulta.
- Elegir **la próxima medición útil** según lo que se va encontrando en un episodio.

Que no aparezcan acá no prueba que nadie más lo esté haciendo.
