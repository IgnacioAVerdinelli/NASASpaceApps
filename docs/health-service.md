# HealthService: diseño (borrador)

**Responsable:** Valen. **Estado (14/11/2026):**

- Hay una primera versión en [`health/`](../health/README.md).
- Por ahora usa gravsim en lugar del DataService.
- Ya sirve al front de Enzo (probado de punta a punta) y da los mismos números que el `build_dashboard` de gravsim.
- La regla de alertas está medida contra el `truth` de gravsim (pregunta 9).

Juan, dueño del DataService, publicó su estado en [data-service-status.md](data-service-status.md):

- El `HealthService` que hoy está dentro de gravsim es un mock de este servicio. Lo va a mover a `sim/mocks/healthservice/` para que la página 3D siga andando en la demo.
- Su API HTTP, el contexto de la tripulación y los eventos todavía no están pusheados.
- Ese doc respondió varias de las preguntas abiertas, marcadas abajo.

Es la pieza "HealthService (Python)" de [architecture.md](architecture.md): procesa los datos del astronauta y entrega los resultados al front, a la base (a través del DataService) y a las notificaciones.

## Qué hace

1. **Lee** las lecturas de cada tripulante desde el DataService, y recalcula cuando el DataService anuncia datos nuevos en la cola de eventos.
2. **Procesa:** calcula la referencia previa al vuelo, el cambio de cada medida y su score, y lo compara con lo que se vio en los estudios de reposo en cama.
3. **Sirve al front** `GET /api/v1/dashboard`, con la versión 1 del contrato de Enzo (`docs/frontend-backend.md` en `design-body`).
4. **Guarda lo que calcula** a través del DataService, para poder compararlo después.
5. **Publica hallazgos** en la cola de eventos, así el planificador de análisis puede pedir un estudio extra.
6. **Decide a quién avisar** según el contexto del tripulante (dónde está y qué está haciendo), y publica la alerta ya ruteada en la cola de notificaciones. Ejemplo de la arquitectura: si el astronauta está en una caminata espacial o en el baño, se le avisa a otro tripulante.

## Qué no hace

- No limpia ni unifica unidades: eso lo hace el DataService.
- No genera datos: eso es gravsim.
- No entrega las alertas: eso es el sistema de notificaciones. El HealthService decide a quién van y el sistema de notificaciones las hace llegar.
- No decide cuándo toca cada estudio: eso es el planificador de análisis, con la Tabla 8 de OCHMO-STD-100.1A.
- No diagnostica ni da un porcentaje global de degradación ([contexto-final-seguimiento-muscular.md](contexto-final-seguimiento-muscular.md), §9).
- Todavía no tiene modelos: la arquitectura los ubica acá, pero quedan para después.

## Con quién habla

| Con quién | Dirección | Qué | Estado |
|---|---|---|---|
| DataService | HealthService lee | Lecturas de un tripulante: `GET /api/v1/readings` (filtros `crew`, `measures`, `day`) y `GET /api/v1/latest` (la última lectura usable de cada medida) | API planeada por Juan, sin pushear. Faltan la misión y los tripulantes (pregunta 1) |
| DataService | HealthService lee | **Contexto actual de cada tripulante:** qué hace y dónde está, `GET /api/v1/context/current` (pregunta 10) | Planeado por Juan, sin pushear. gravsim va a simular una rutina diaria y caminatas espaciales |
| DataService | HealthService escribe | Resultados procesados: `POST /api/v1/results` (ver abajo) | API planeada por Juan, sin pushear |
| Front (Enzo) | El front lee del HealthService | `GET /api/v1/dashboard`, contrato v1 | El contrato existe |
| Cola de eventos | HealthService se suscribe | `data.readings_stored`, que publica el DataService (nombre provisorio) | El DataService ya tiene dónde publicarlo; falta cómo llega a otro proceso (pregunta 13) |
| Cola de eventos | HealthService publica | Hallazgos, para el planificador de análisis | Planeada; en la demo se simula |
| Cola de notificaciones | HealthService publica | Alertas ya ruteadas (ver abajo) | Planeada; en la demo se simula |

## Punto de partida: `build_dashboard` de gravsim

El `build_dashboard` de `sim/gravsim/dashboard.py` (rama `feat/sensor-simulator`, gravsim 0.1.0) es la primera versión del HealthService, y su salida ya pasa la validación del contrato de Enzo. En gravsim 0.2.0 ese código pasó a `gravsim/health.py`, y Juan lo va a mover a `sim/mocks/healthservice/` como mock de este servicio. Lo que calcula:

- **Referencia:** el promedio de las lecturas antes del vuelo.
- **Cambio:** el % de la última lectura contra esa referencia.
- **Score de 0 a 100:** cuánto se perdió en comparación con lo que perdieron, sin ejercicio, los sujetos de los estudios de reposo en cama.
- **`insight`:** un texto que compara con la curva típica con y sin ejercicio, sacada de `params.json`.

Para moverlo al HealthService sin depender del simulador hay que reemplazar lo único que toma de él: `crew.id`, `crew.sex`, `mission.label()`, `mission.timestamp()` y `mission.unloaded_days()`. Todo eso se puede calcular con los datos del tripulante y de la misión que entregue el DataService. Las curvas de referencia (`params.json`) se pueden usar como dato fijo del HealthService o guardar en la base como dato histórico importado, como dice la arquitectura.

## Cuándo calcula (propuesta)

El front consulta cada 3 segundos. Si el HealthService calculara y guardara un resultado en cada consulta, la base se llenaría de resultados repetidos. Propuesta:

- Guardar los resultados y revisar las alertas solo cuando llegan lecturas nuevas.
- Armar el dashboard en cada consulta del front, porque es barato.

Hoy el código detecta las lecturas nuevas comparándolas con las que ya vio. Cuando exista la cola de eventos, eso pasa a ser el manejador del evento `data.readings_stored` que publica el DataService.

## Resultado que se guarda (propuesta)

Se guarda con `POST /api/v1/results` del DataService:

- `crew_id`: el tripulante.
- `kind`: propuesta `"measure_result"`.
- `timestamp`: el momento de la misión al que corresponde el resultado.
- `payload`: los campos de la tabla de abajo.

El DataService agrega `computed_at` y `model_version`, y guarda un resultado por tripulante, `kind`, momento y versión: si se vuelve a calcular, lo reemplaza.

Una fila por tripulante, medida y momento de cálculo:

| Campo | Nota |
|---|---|
| `crew_id`, `measure` | |
| `computed_at`, `mission_day` | Cuándo se calculó y hasta qué día de misión llegan los datos |
| `reference_value` | Promedio antes del vuelo |
| `last_value`, `last_reading_at` | Última lectura usada |
| `change_pct`, `score` | |
| `reference_n` | Cuántas lecturas previas al vuelo se promediaron en la referencia |
| `previous_change_pct`, `previous_mission_day` | La lectura anterior desde el lanzamiento, que usa la regla de alertas |
| `typical_no_exercise_pct`, `typical_exercise_pct` | Comparación con los estudios |
| `extrapolated`, `synthetic` | Se heredan de las lecturas |
| `model_version` | Versión de las curvas usadas |

## Hallazgo y alerta (propuesta)

Un **hallazgo** es el dato analítico: va a la cola de eventos, para el planificador. Una **alerta** es el mensaje para personas: va a la cola de notificaciones, con los destinatarios ya decididos.

Hallazgo:

```json
{
  "type": "finding",
  "crew_id": "CM-2",
  "measure": "knee_extension_60",
  "change_pct": -22.1,
  "typical_no_exercise_pct": -18.4,
  "mission_day": 120,
  "synthetic": true
}
```

Alerta, ruteada por contexto:

```json
{
  "type": "alert",
  "subject_crew_id": "CM-2",
  "notify": ["CM-2", "ship_center"],
  "routing_reason": "CM-2 available",
  "measure": "knee_extension_60",
  "severity": "warning",
  "message": "Knee extension strength −22% since pre-flight, beyond the typical loss without exercise.",
  "mission_day": 120,
  "created_at": "2027-06-29T12:00:00Z",
  "synthetic": true
}
```

El contexto que va a dar el DataService trae `activity` (`sleep`, `exercise`, `work`, `meal`, `hygiene`, `eva`) y `location` (un módulo de la ISS, o `outside` durante una caminata espacial). Si CM-2 está en `eva` o en `hygiene` (el ejemplo del baño de la arquitectura), `notify` pasaría a ser otro tripulante disponible y el centro de la nave. En ese caso `routing_reason` lo explicaría, por ejemplo `"CM-2 on EVA"`.

**Cuándo alertar.** La regla implementada (detalle y números en la pregunta 9 y en [`health/README.md`](../health/README.md#alert-rule)):

- Mira las **dos últimas pruebas** de una medida desde el lanzamiento.
- Calcula cuánto se pasan, en promedio, de la pérdida típica sin ejercicio de los estudios de reposo en cama para esos mismos días sin gravedad.
- Alerta si se pasan por más de 1,645 veces el ruido de medición de ese promedio. Solo por ruido, eso pasa 1 de cada 20 veces.
- Solo alertan las medidas cuya pérdida típica en la misión es más grande que el ruido de una prueba. Quedan afuera la dorsiflexión del tobillo (−7 % contra 12 % de ruido) y la masa magra de los brazos (no cambia en reposo en cama). Se siguen mostrando en la página.

Ahora que un hallazgo puede generar un estudio extra, una regla con falsas alarmas cuesta más: cada falsa alarma puede terminar en un estudio innecesario.

## Preguntas abiertas

**Respondidas por Juan** en [data-service-status.md](data-service-status.md) (14/11, 18:50). Lo que describe todavía no está pusheado: lo sube cuando le pasen los tests.

- **1, en parte (API).** Se lee por HTTP:
  - `GET /api/v1/readings`, con los filtros `crew`, `measures` y `day`;
  - `GET /api/v1/latest`;
  - `GET /api/v1/results` y `POST /api/v1/results`, con `crew_id`, `kind`, `timestamp` y `payload`.

  Falta cómo leer la misión y los tripulantes: queda en la pregunta 1, abajo.
- **2 (`truth`).** Las lecturas lo traen, para que cada servicio pueda medir su propia detección. El HealthService lo descarta al leer, y solo lo usa la evaluación de alertas.
- **3 (procesos).** Son dos. El DataService tiene su propia API HTTP (`gravsim.serve`) y los demás servicios leen por ahí, no directo desde gravsim.
- **10 (contexto y "datos nuevos").**
  - El contexto es un `ContextRecord` con `crew_id`, `start`, `end`, `activity`, `location`, `source` y `synthetic`.
  - `activity` puede ser `sleep`, `exercise`, `work`, `meal`, `hygiene` o `eva`.
  - `location` es un módulo de la ISS, u `outside` durante una caminata espacial.
  - El contexto actual de cada tripulante sale de `GET /api/v1/context/current`.
  - Los eventos van a ser `data.readings_stored`, `data.context_updated` y `data.result_saved`. Los nombres son provisorios hasta que el README del DataService documente los mensajes.

**Para Juan (DataService)**

- **1 (misión y tripulantes).**
  - La API no tiene cómo leer la fecha de lanzamiento ni las fases con su gravedad. El HealthService las necesita para calcular los días sin gravedad y las etiquetas FD/R+.
  - Tampoco tiene la lista de tripulantes con su sexo, que define qué cuerpo muestra el modelo 3D.

  ¿Agregamos `GET /api/v1/mission` y `GET /api/v1/crew`?
- **4 (curvas de referencia, `params.json`).** ¿Las sirve el DataService, como dato histórico importado (así lo dice la arquitectura), o el HealthService las lee del repo? El PR a `main` incluye `sim/gravsim/`, así que la segunda opción ya funciona.
- **12 (puertos).** El front espera el dashboard en el puerto 3000, y hoy `gravsim.serve` también usa el 3000.
  - Propuesta: el HealthService en el 3000 y el DataService en otro, por ejemplo el 8000.
  - El mock de `sim/mocks/healthservice/` y el HealthService no deberían estar levantados a la vez, porque los dos sirven `/api/v1/dashboard`.
- **13 (eventos entre procesos).** `DataService(publisher=...)` publica dentro del proceso del DataService. ¿Cómo le llega `data.readings_stored` al HealthService, que corre en otro proceso? Mientras no haya cola, el HealthService puede seguir pidiendo las lecturas y detectar las nuevas comparando, como hace hoy.
- **14 (día de misión).**
  - ¿El filtro `day` de `/api/v1/readings` es el día de misión?
  - Una lectura de un sensor real puede no traer `mission_day`. El HealthService lo puede calcular con el `timestamp` y la fecha de lanzamiento (pregunta 1).

**Para quien hace las notificaciones**

5. **Colas y formato de alerta.**
   - Las dos colas son publicar/suscribir y en la demo se simulan. ¿Con qué las simulamos: en memoria dentro del mismo proceso, una tabla, Redis…?
   - ¿El formato de alerta de arriba les sirve?
   - Enzo armó una maqueta de alertas en el reloj (`/alerts/` en el front), con `priority`, `level`, `title` y `short`. Para que muestre las del HealthService, la alerta podría traer un título y un texto corto además de `message`.

**Para el equipo**

11. **Reglas de ruteo:** ¿a quién se le avisa cuando el astronauta no está disponible?
    - Propuesta: si está en `eva`, `hygiene` o `sleep`, a otro tripulante que no esté en `eva` ni en `sleep`, más el centro de la nave.
    - A Tierra, solo si la severidad es alta, porque hay demora de comunicación.
    - Una pérdida muscular no es urgente, así que otra opción es esperar a que el astronauta esté disponible.

**Para Enzo**

6. **Bandas históricas:** hoy la comparación con los estudios va solo como texto en `insight`. ¿Agregamos un campo a `charts` para dibujarla?
7. **Datos por medición:** el §9 pide mostrar fecha, fuente y calidad, y el contrato no tiene dónde.
8. **Sin dato en el 3D:** en el modelo 3D, una región con score `null` y una con `0` se ven igual de grises.

**Para el equipo**

9. **Regla de alertas: propuesta con números.** La regla provisoria alertaba cuando una sola prueba pasaba la pérdida típica sin ejercicio. Al principio del vuelo la pérdida típica es chica (alrededor de −9 % en el día 14) y una prueba del dinamómetro tiene 8–12 % de ruido, así que alertaba casi siempre por ruido. La reemplacé por la regla de arriba.

   `health/evaluation/alert_rule.py` compara la regla vieja y 7 variantes sobre tripulaciones de gravsim, puntuando cada alerta con `truth`. Una alerta cuenta como falsa si el cambio real de la persona no pasó la pérdida típica sin ejercicio. Resultados:

   | Tripulación | Regla vieja: alertas (falsas) | Regla nueva: alertas (falsas) |
   |---|---|---|
   | La de la demo (semilla 7, 4 personas) | 28 (28) | 0 (0) |
   | 50 misiones al azar (200 personas) | 1421 (1214) | 16 (11) |
   | Las mismas, con 1 de cada 10 pruebas del dinamómetro corrida un 20 % | 1548 (1348) | 29 (20) |
   | 7 casos armados × 25 personas | 1459 (907) | 117 (15) |

   Por persona, durante el vuelo:

   - Avisa a las 25 personas que no hacen ejercicio y pierden rápido (mediana: día 74).
   - De las 17 que no hacen ejercicio y tienen una pérdida clara, avisa a 14.
   - No avisa a ninguna de las 25 que siguen la rutina.

   Esos números son con gravsim 0.1.0. Con gravsim 0.2.0, que trae las curvas nuevas de Juan y todavía no está integrado, la regla se sostiene:

   - La demo da 0 alertas.
   - Las 200 personas al azar dan 11 alertas, 6 de ellas falsas.
   - Los casos armados dan 87 alertas, 11 de ellas falsas.
   - Avisa a 23 de las 25 personas que no hacen ejercicio y pierden rápido.

   **Límites, para decidir en equipo:**

   - Necesita dos pruebas y el dinamómetro es mensual, así que la primera alerta llega como pronto el día 44. Propuesta: después de una sola prueba fuera de lo esperado (por ejemplo, a más de 1 vez el ruido), publicar un **hallazgo** en la cola de eventos para que el planificador pida una prueba extra antes. La alerta sale cuando esa segunda prueba lo confirma.
   - Una lesión en alguien que hace ejercicio casi nunca pasa la línea de "sin ejercicio", y se recupera entre pruebas mensuales: avisó a 1 de 16. Para eso habría que comparar con la propia tendencia de la persona, no con los grupos de reposo en cama.
   - El umbral (1,645) es configurable: `check(..., confidence=...)`. Con 2 hay menos alertas falsas y llegan más tarde.
