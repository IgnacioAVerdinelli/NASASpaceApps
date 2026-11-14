# Discusiones de GitHub sobre el desafío

**NASA Space Apps Challenge 2026 · Documento de trabajo del equipo**  
**Fuente:** [GitHub Discussions de nasa/spaceapps](https://github.com/nasa/spaceapps/discussions) (Space Apps Connect)  
**Consulta:** 14 de noviembre de 2026. Se revisaron 59 hilos (los que mencionan salud o astronautas, más los hilos oficiales que esos citan) y se resumen acá los que aportan al desafío *Create Health Monitoring Software for Astronauts on Space Missions*.

> **Cómo leer este documento.** Solo las respuestas del **GO Team** (Global Organizing Team, usuarios terminados en `-GO-Team` y etiqueta *GO Team Answered*) son **oficiales**. Los *Navigators* y *Collaborators* son voluntarios: sus respuestas orientan, pero no son reglas. Cuando una respuesta voluntaria contradice una oficial, prevalece la oficial.

## 1. Lo más importante

1. **Los recursos del desafío ya cumplen el requisito de datos de NASA.** No hace falta un dataset descargable. *(Oficial, [#1994](https://github.com/nasa/spaceapps/discussions/1994))*
2. **Conviene enfocarse en un problema de salud específico** antes que en una plataforma amplia, y presentar lo demás como evolución futura con ejemplos concretos. *(Oficial, [#2138](https://github.com/nasa/spaceapps/discussions/2138))*
3. **Datos simulados o una API simulada están permitidos.** Se espera un avance demostrable, no un producto terminado. *(Oficial, [#1787](https://github.com/nasa/spaceapps/discussions/1787), [#1871](https://github.com/nasa/spaceapps/discussions/1871))*
4. **Hay que citar todo**: datos de NASA, de terceros, código, textos e imágenes, aunque sean abiertos. *(Oficial, [#1827](https://github.com/nasa/spaceapps/discussions/1827), [#1777](https://github.com/nasa/spaceapps/discussions/1777))*
5. **Para interpretar valores, se sugiere comparar con la línea de base de cada astronauta** y no usar rangos clínicos terrestres como límites. *(Voluntario, [#2025](https://github.com/nasa/spaceapps/discussions/2025))*

## 2. Reglas y requisitos (respuestas oficiales)

| Tema | Qué dijo el GO Team | Hilo |
| --- | --- | --- |
| Requisito de datos de NASA | Para premios globales hay que usar al menos un dato o recurso de NASA incluido en la pestaña Resources del desafío. En este desafío, esos recursos (páginas del HRP y de la CSA) cumplen el requisito aunque no sean datasets. Otros datos de NASA, de agencias socias y de terceros están permitidos y se alientan, pero no reemplazan el requisito. | [#1827](https://github.com/nasa/spaceapps/discussions/1827), [#1994](https://github.com/nasa/spaceapps/discussions/1994) |
| Referencias | Al enviar se listan todos los datos, recursos y herramientas usados, incluido código, textos e imágenes abiertos o gratuitos. Material con copyright solo con permiso. | [#1827](https://github.com/nasa/spaceapps/discussions/1827), [#1777](https://github.com/nasa/spaceapps/discussions/1777) |
| Prototipo o producto | No se espera una solución terminada, sino un avance demostrable. Datos ficticios o una API simulada están bien. Los jueces están entrenados para evaluar proyectos hechos en dos días. | [#1787](https://github.com/nasa/spaceapps/discussions/1787), [#1871](https://github.com/nasa/spaceapps/discussions/1871) |
| Alcance | Mejor un problema de salud específico, resuelto en profundidad, que una plataforma amplia con funciones a medias. Se puede diseñar escalable y mencionar en la entrega cómo sumaría otras métricas, con ejemplos concretos. | [#2138](https://github.com/nasa/spaceapps/discussions/2138) |
| Demo y video | La demo de la entrega tiene un límite de 30 segundos si es video. Un video más largo (por ejemplo, una animación completa) puede ir aparte como link del proyecto, sin límite de duración. La demo es de lo primero que miran los jueces. No incluir nombres, voces ni imágenes reconocibles de menores de 18 años. | [#1857](https://github.com/nasa/spaceapps/discussions/1857) |
| Trabajo previo | No se podía trabajar en el proyecto antes del sábado 14 a las 9:00 (hora local del evento); antes solo se permitía elegir desafío, revisar recursos, investigar y armar el equipo. Trabajar antes puede llevar a la descalificación. | [#1827](https://github.com/nasa/spaceapps/discussions/1827), [#1777](https://github.com/nasa/spaceapps/discussions/1777), [#1871](https://github.com/nasa/spaceapps/discussions/1871) |

## 3. Orientación de voluntarios

### 3.1 Datos disponibles

- **No hay un dataset oficial obligatorio** ni uno público que reúna todos los indicadores. Se sugiere combinar investigación accesible con datos simulados identificados como tales. [#2025](https://github.com/nasa/spaceapps/discussions/2025)
- **Fuentes sugeridas** (no las revisamos todavía):
  - [NASA OSDR](https://osdr.nasa.gov/bio/repo/): estudios biológicos, fisiológicos y conductuales. La mayoría se descarga sin autenticación; algunos datos humanos son restringidos.
  - [NASA Life Sciences Portal (NLSP)](https://nlsp.nasa.gov/): investigación humana en vuelo y en análogos terrestres; algunos datos requieren solicitud formal.
  - Estudios de la misión Inspiration4 en OSDR: [OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) (suero sanguíneo, panel metabólico y citoquinas), [OSD-656](https://osdr.nasa.gov/bio/repo/data/studies/OSD-656) (panel inflamatorio en orina) y [OSD-53](https://osdr.nasa.gov/bio/repo/data/studies/OSD-53) (expresión génica en sangre de seis astronautas). **Son muestras biológicas antes y después del vuelo, no lecturas continuas** como frecuencia cardíaca o SpO₂.
  - [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/): eventos de clima espacial (fulguraciones, eyecciones de masa coronal, partículas energéticas), útil para contextualizar radiación. En [#2026](https://github.com/nasa/spaceapps/discussions/2026) se reportó que el endpoint de fulguraciones de su API devolvía 404 el 13 de noviembre; el 14 el GO Team lo derivó a los expertos y seguía sin resolver.
  
  Fuentes: [#2010](https://github.com/nasa/spaceapps/discussions/2010), [#2025](https://github.com/nasa/spaceapps/discussions/2025), [#2133](https://github.com/nasa/spaceapps/discussions/2133), [#2118](https://github.com/nasa/spaceapps/discussions/2118).
- **Los datos simulados no cumplen por sí solos el requisito de datos de NASA**: hay que usar y citar al menos un recurso de la pestaña Resources. [#2090](https://github.com/nasa/spaceapps/discussions/2090), [#2138](https://github.com/nasa/spaceapps/discussions/2138)

### 3.2 Criterio para interpretar valores y alertar

Propuesta de un voluntario en [#2025](https://github.com/nasa/spaceapps/discussions/2025):

- No usar umbrales arbitrarios ni asumir que los rangos clínicos de la Tierra son límites seguros en microgravedad.
- Comparar cada medición con la **línea de base personal** del astronauta. Un cambio sostenido puede alertar aunque el valor siga dentro del rango terrestre normal.
- Tres niveles: **normal** (sin desvío relevante de la línea de base), **advertencia** (cambio sostenido o inusual) y **crítico** (condición de alto riesgo predefinida que requiere revisión inmediata).
- Respaldar cada umbral con fuentes citadas y presentarlo como regla del prototipo, no como límite médico validado.

En [#2138](https://github.com/nasa/spaceapps/discussions/2138), otro usuario propone un flujo completo para un solo problema: **lecturas → línea de base y tendencia → alerta que se explica sola → acción sugerida**.

### 3.3 Sensores

En [#2118](https://github.com/nasa/spaceapps/discussions/2118) un voluntario explica que los sensores pueden entregar **señal cruda** o **valores procesados**, según el dispositivo:

| Medición | Qué puede entregar |
| --- | --- |
| ECG | Onda eléctrica cruda, frecuencia cardíaca, variabilidad (HRV), ritmo |
| Oxímetro de pulso | SpO₂, pulso y, a veces, la onda de pulso (PPG) |
| Presión arterial | Sistólica, diastólica y presión arterial media |
| Respiración | Frecuencia, patrón y flujo |
| Temperatura | De piel o central, según el sensor |
| Acelerómetros y giroscopios | Movimiento, aceleración, orientación, nivel de actividad |
| Sueño | Duración, movimiento y patrones |
| CO₂ | Concentración en la cabina |

Menciona **AstroSkin**, prenda de monitoreo de la CSA que registra presión arterial, SpO₂, ECG de tres derivaciones, HRV, intervalos QRS y RR, frecuencia y volumen respiratorio, actividad y temperatura de piel. Los registros fisiológicos de astronautas son sensibles: no todos los registros crudos son públicos y algunos requieren autorización.

### 3.4 Qué construir

En [#2090](https://github.com/nasa/spaceapps/discussions/2090) los voluntarios coinciden en:

- No hace falta resolver todas las consideraciones del desafío: es mejor una parte bien acotada y explicada, aclarando qué se resuelve y por qué.
- El formato (web, app móvil u otro) es libre.
- Preguntas para diferenciarse: ¿qué problema de salud específico resolvemos?, ¿quién lo usa y cómo lo ayuda?, ¿qué tiene de distinto?, ¿cómo mostramos su valor con el tiempo disponible?

### 3.5 Repositorio

No hace falta hacer fork del repositorio `nasa/spaceapps`: se puede usar un repositorio propio y compartir el link en la entrega. [#1979](https://github.com/nasa/spaceapps/discussions/1979)

## 4. Qué aportan a nuestras preguntas abiertas

| Pregunta del equipo | Qué aportan las discusiones |
| --- | --- |
| ¿Con qué criterio la app marca un valor como preocupante? | Línea de base personal y tres niveles, con umbrales citados y presentados como reglas del prototipo (sección 3.2). |
| ¿Cuánto abarca el proyecto? | El GO Team recomienda enfocarse en un problema específico y presentar lo demás como evolución futura (sección 2). |
| ¿Qué datos usamos? | Recursos del desafío para el requisito; datos simulados para lecturas continuas; estudios de OSDR como complemento (sección 3.1). |
| ¿Qué entra por sensor y en qué formato? | Tabla de señales crudas y procesadas, y AstroSkin como referencia (sección 3.3). |
| ¿Qué hay que citar? | Todo lo externo, incluidos datos abiertos, código e imágenes (sección 2). |

## 5. Índice de hilos revisados

| Hilo | Tema | Tipo de respuesta |
| --- | --- | --- |
| [#1772](https://github.com/nasa/spaceapps/discussions/1772) | Disponibilidad de recursos antes del evento | Participante |
| [#1777](https://github.com/nasa/spaceapps/discussions/1777) | Trabajo previo y materiales de terceros | **Oficial** |
| [#1787](https://github.com/nasa/spaceapps/discussions/1787) | Prototipo o producto; datos simulados | **Oficial** |
| [#1827](https://github.com/nasa/spaceapps/discussions/1827) | Reglas de trabajo previo y requisito de datos | **Oficial** |
| [#1857](https://github.com/nasa/spaceapps/discussions/1857) | Video de demo y video completo | **Oficial** |
| [#1871](https://github.com/nasa/spaceapps/discussions/1871) | Proyectos hechos antes del evento; qué se espera en dos días | **Oficial** |
| [#1922](https://github.com/nasa/spaceapps/discussions/1922) | Datos para el desafío (antes de publicar recursos) | **Oficial** |
| [#1979](https://github.com/nasa/spaceapps/discussions/1979) | Repositorio propio o fork | Voluntario |
| [#1994](https://github.com/nasa/spaceapps/discussions/1994) | Requisito de datos de NASA en este desafío | **Oficial** |
| [#2010](https://github.com/nasa/spaceapps/discussions/2010) | Dónde encontrar datos reales | Voluntario |
| [#2025](https://github.com/nasa/spaceapps/discussions/2025) | Datasets, datos simulados y umbrales | Voluntario |
| [#2026](https://github.com/nasa/spaceapps/discussions/2026) | API de DONKI caída | Voluntario y GO Team (sin resolver) |
| [#2090](https://github.com/nasa/spaceapps/discussions/2090) | Qué hay que construir | Voluntario |
| [#2118](https://github.com/nasa/spaceapps/discussions/2118) | Sensores: señal cruda o valores procesados | Voluntario |
| [#2133](https://github.com/nasa/spaceapps/discussions/2133) | Dónde están los recursos | Voluntario |
| [#2138](https://github.com/nasa/spaceapps/discussions/2138) | Alcance: plataforma amplia o problema específico | **Oficial** |

Los posts de equipos que buscan integrantes se resumen en [mapa-otros-equipos.md](mapa-otros-equipos.md).
