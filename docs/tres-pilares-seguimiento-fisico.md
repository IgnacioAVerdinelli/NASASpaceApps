# Tres pilares del seguimiento físico

Documento interno para acordar qué hace el sistema y cómo explicarlo. Describe la implementación revisada el 15/11/2026; no es un pitch ni una validación clínica. Base de trabajo: `main` e77825e.

El objetivo es seguir la evolución física del tripulante y organizar su seguimiento: condición muscular, capacidad cardiorrespiratoria y plan de controles. El riesgo de referencia es la reducción de capacidad musculoesquelética y cardiorrespiratoria que puede afectar el desempeño en tareas de misión. NASA relaciona ese marco con los riesgos muscular y aeróbico ([Human Research Roadmap](https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=180)). El scheduler es el mecanismo que convierte el seguimiento de esas capacidades en acciones.

## 1. Condición muscular: fuerza y masa magra relacionadas

Seguimos cambios por grupo respecto de la referencia previa al vuelo. **Datos históricos:** MR079G aporta pruebas de fuerza y MR035G aporta masa magra regional por DXA. Hay una relación estadística implementada: `baseline_factors.size` en `sim/gravsim/params.json` documenta correlaciones de rango dentro de cada sexo sobre 65 sujetos presentes en ambos conjuntos, con mediana de correlaciones por pares de 0,66. El generador utiliza un factor compartido para producir valores basales relacionados; no genera fuerza y masa como variables independientes. Esto respalda hablar de un modelo que relaciona fuerza y masa magra. No encontré en el código una conversión que permita afirmar que una pérdida del X % de fuerza equivale a una pérdida del X % de masa. La masa magra regional tampoco identifica por sí sola la masa de cada músculo individual.

**Norma:** el calendario toma las rutinas de evaluación funcional [6024], seguimiento de fuerza [6025] y DXA [6013] de OCHMO-STD-100.1A Rev. A. En el perfil actual, las pruebas de fuerza tienen seguimiento en vuelo y DXA aparece antes y después. **Decisiones del equipo:** instrumentos simulados, correspondencia entre pruebas y regiones del cuerpo, curvas temporales, escalas visuales y reglas estadísticas de hallazgo. El HealthService ya calcula cambio porcentual, nivel y relación con el ruido de medición; la interfaz muestra esos resultados. En el mapeo actual, brazos usa `lean_arms` y otros grupos usan pruebas de fuerza: la unidad y el tipo de prueba deben acompañar su interpretación. El cuerpo 3D localiza resultados, no mide masa por sí mismo.

## 2. Capacidad cardiorrespiratoria: desempeño aeróbico y contexto diario

El eje principal es VO₂pico, su evolución respecto del basal y las reglas implementadas para detectar pérdida de capacidad aeróbica. **Datos históricos:** MR080G aporta las pruebas aeróbicas; el modelo incorpora distribuciones basales, variabilidad entre personas, efecto del ejercicio y ruido. **Norma:** el Planner toma la evaluación aeróbica [6028] de OCHMO-STD-100.1A Rev. A. El HealthService implementa una regla para VO₂pico basada en las referencias registradas por el proyecto (mínimo 32,9 ml/kg/min y pérdida del 20 %), aplicada al promedio de dos pruebas. El promedio de dos es una decisión de procesamiento del equipo, no debe atribuirse automáticamente a NASA.

**Decisiones del equipo:** generación de señales del reloj, bandas personales y persistencia de desvíos. El reloj complementa las pruebas periódicas: frecuencia cardíaca, sueño y otras señales pueden generar una revisión. No todas sus variables fueron ajustadas con datos históricos: SpO₂ y HRV, por ejemplo, usan supuestos documentados, y el episodio de fatiga es un escenario de demostración. El sistema entrega valores, cambios y estados respecto de parámetros; no una clasificación global «sano/enfermo». Tampoco la representación de corazón y pulmones constituye una evaluación completa de esos órganos. Fuentes de implementación: `health/healthservice/alerts.py`, `vitals.py`, `sim/README.md` y `docs/wearable.md`.

## 3. Plan de seguimiento: qué hacer, cuándo y por qué

El Planner combina el calendario de controles con hallazgos del HealthService y el contexto de misión. **Norma:** catálogo de 21 rutinas de OCHMO-STD-100.1A Rev. A, con citas y páginas verificadas por pruebas, usando el calendario de ejemplo de una misión ISS de 180 días. No es un calendario universal para cualquier misión. **Datos:** estudios ya realizados, lecturas disponibles, cronología de misión y hallazgos permiten actualizar el plan. **Decisiones del equipo:** tolerancia de ±3 días para fechas puntuales, ventana de 7 días para seguimientos y regla de 14 días para evitar repeticiones en bucle. Un hallazgo sospechado puede generar repetición; uno confirmado, revisión; un desvío del reloj genera revisión. Las reglas completas están en `docs/planner.md`.

El Planner no recalcula la interpretación fisiológica: recibe las conclusiones del HealthService. Las tareas se cierran por lecturas compatibles o por confirmación del tripulante; en la demo también existe finalización simulada. Las repeticiones agendadas pueden ser ejecutadas por el generador, cerrando el circuito de datos y seguimiento. Una revisión agendada no equivale a una revisión médica realizada. La programación adaptativa de sesiones de ejercicio queda pendiente y no forma parte de lo que afirmamos que ya funciona.

## Cómo obtenemos y manejamos los datos

No tenemos acceso operativo a los instrumentos ni a una API que entregue sus mediciones para este proyecto. Por eso implementamos un **generador funcional de lecturas sintéticas**, apoyado en históricos accesibles. Los servicios sí se comunican por APIs reales. No afirmamos que esos instrumentos carezcan de cualquier interfaz posible: la limitación es nuestro acceso a sus lecturas.

1. Los históricos permiten ajustar distribuciones iniciales, curvas de evolución, dispersión y relaciones entre variables. Los archivos y parámetros conservan su procedencia; lo asumido se documenta como tal.
2. Cada tripulante simulado tiene una referencia propia, respuesta individual y adherencia al ejercicio. La evolución depende de la misión y sus eventos, con variación diaria y ruido de instrumento. No se sortean valores independientes entre un mínimo y un máximo.
3. El DataService normaliza unidades, verifica calidad y guarda lecturas y contexto. Las lecturas incluyen metadatos de origen sintético, extrapolación y versión del modelo. `truth` representa el valor interno sin ruido para evaluar el simulador; no es una lectura disponible en un instrumento real.
4. El HealthService compara las variables con el basal, las referencias y las reglas implementadas. Ya devuelve porcentajes de cambio, niveles, bandas de ruido, hallazgos y alertas.
5. El Planner convierte esos resultados y el calendario en seguimiento; el frontend presenta mediciones, interpretación y tareas.

Esto aproxima un flujo instrumental coherente con los datos disponibles. No sustituye la validación con mediciones reales de vuelo: varios parámetros proceden de reposo en cama, un análogo terrestre, y otros son supuestos explícitos.

### ¿Hay mínimos y máximos? ¿También hay extrapolación?

Sí, ambas cosas existen. `CrewMember.change()` limita el cambio al rango histórico cuando la lectura está dentro de la cobertura. `reading_range()` limita las lecturas sin fallas a rangos derivados de los basales y cambios históricos. También se acotan factores individuales y ruido.

Pero `CrewMember.extrapolated()` devuelve verdadero después de **90 días de descarga**, para fases de gravedad parcial o para variables modeladas como constantes/derivadas sin datos propios. En esos casos `reading_range()` devuelve un rango sin límites históricos (`-inf, inf`), y `change()` deja de recortar al rango histórico; siguen existiendo otras restricciones físicas e instrumentales. La curva temporal sigue generando valores y la lectura se marca `extrapolated: true`. Por eso una misión simulada de 180 días sí contiene extrapolación, aunque muchos valores permanezcan numéricamente entre mínimos y máximos conocidos. Permanecer dentro de un rango de valores no demuestra que esa trayectoria temporal haya sido observada.

Referencias de código: `sim/gravsim/core.py` (`change`, `reading_range`, `extrapolated`), `sim/gravsim/instruments.py` y `sim/gravsim/params.json`.

## Referencias para revisar en equipo

- [OCHMO-STD-100.1A Rev. A](https://www.nasa.gov/wp-content/uploads/2023/04/ochmo-std-100.1a.pdf): calendario y evaluaciones; copia textual y citas en `docs/references/` y `planner/planner/catalog/ochmo-100.1a.json`.
- `sim/README.md` y `sim/gravsim/params.json`: datos, ajuste, correlaciones, rangos y supuestos.
- `docs/health-service.md`, `docs/wearable.md` y `docs/planner.md`: procesamiento y seguimiento implementados.
- [NASA-STD-3001 Vol. 2](https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_2): referencia de factores humanos para indicar disponibilidad de datos, priorizar alertas, acompañar colores con texto y mantener unidades consistentes. Usarlo como referencia de diseño no demuestra certificación ni cumplimiento completo.
