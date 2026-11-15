# HealthService: diseño (borrador)

**Responsable:** Valen. **Estado (14/11/2026):**

- El código está en [`health/`](../health/README.md).
- Lee del DataService de Juan por HTTP (en `main` desde el PR #7, puerto 8000) y guarda ahí sus resultados.
- Sirve al front de Enzo; probado de punta a punta con el DataService, el HealthService y el front levantados por separado.
- La regla de alertas está medida contra el `truth` de gravsim (pregunta 9).
- El PR #7 y [data-service-status.md](data-service-status.md) respondieron las preguntas 1, 2, 3, 10, 12 y 14. Quedan abiertas la 4 y la 13 para Juan, y las del resto del equipo.

Es la pieza "HealthService (Python)" de [architecture.md](architecture.md): procesa los datos del astronauta, entrega los resultados al front y a la base (a través del DataService), y publica las alertas en la cola de notificaciones. Las alertas las envía el sistema de notificaciones, no el HealthService.

## Qué hace

1. **Lee** las lecturas de cada tripulante desde el DataService, y recalcula cuando el DataService anuncia datos nuevos en la cola de eventos.
2. **Procesa:** calcula la referencia previa al vuelo, el cambio de cada medida y su score, y lo compara con lo que se vio en los estudios de reposo en cama.
3. **Sirve al front** `GET /api/v1/dashboard`, con la versión 1 del contrato de Enzo ([frontend-backend.md](frontend-backend.md), en `main`).
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
| DataService | HealthService lee | Misión y tripulantes: `GET /api/v1/mission` (fecha de lanzamiento, fases con su gravedad, el día "ahora" de su reloj y el sexo de cada tripulante) | En `main`. Lo usa al arrancar, y en cada consulta para saber el día |
| DataService | HealthService lee | Lecturas de un tripulante: `GET /api/v1/readings` (filtros `crew`, `measures`, `day`) | En `main`. Pide solo las 8 medidas que muestra y usa las de calidad `ok` |
| DataService | HealthService lee | **Contexto actual de cada tripulante:** qué hace y dónde está, `GET /api/v1/context/current` (pregunta 10) | En `main`. Todavía no lo usa: hace falta para rutear las alertas (pregunta 11) |
| DataService | HealthService escribe | Resultados procesados: `POST /api/v1/results` (ver abajo) | En `main`. Lo usa |
| Front (Enzo) | El front lee del HealthService | `GET /api/v1/dashboard`, contrato v1 | El contrato existe |
| Cola de eventos | HealthService se suscribe | `data.readings_stored`, que publica el DataService (nombre provisorio) | El DataService ya tiene dónde publicarlo; falta cómo llega a otro proceso (pregunta 13) |
| Cola de eventos | HealthService publica | Hallazgos, para el planificador de análisis | Planeada; en la demo se simula |
| Cola de notificaciones | HealthService publica | Alertas ya ruteadas (ver abajo) | Planeada; en la demo se simula |

## Punto de partida: `build_dashboard` de gravsim

El cálculo sale del `build_dashboard` que tenía gravsim 0.1.0 (de CookieD, rama `feat/sensor-simulator`), que después pasó a ser un mock de este servicio y no entró a `main`. Lo que calcula:

- **Referencia:** el promedio de las lecturas antes del vuelo.
- **Cambio:** el % de la última lectura contra esa referencia.
- **Score de 0 a 100:** cuánto se perdió en comparación con lo que perdieron, sin ejercicio, los sujetos de los estudios de reposo en cama.
- **`insight`:** un texto que compara con la curva típica con y sin ejercicio, sacada de `params.json`.

Del simulador solo tomaba `crew.id`, `crew.sex`, `mission.label()`, `mission.timestamp()` y `mission.unloaded_days()`. El HealthService los calcula con lo que da `GET /api/v1/mission`, así que no importa gravsim. Las curvas de referencia (`params.json`) las lee del repo por ahora (pregunta 4).

## Cuándo calcula (propuesta)

El front consulta cada 3 segundos. Si el HealthService calculara y guardara un resultado en cada consulta, la base se llenaría de resultados repetidos. Propuesta:

- Guardar los resultados y revisar las alertas solo cuando llegan lecturas nuevas.
- Armar el dashboard en cada consulta del front, porque es barato.

Hoy el código detecta las lecturas nuevas comparándolas con las que ya vio. Cuando exista la cola de eventos, eso pasa a ser el manejador del evento `data.readings_stored` que publica el DataService.

**Límite actual:** el HealthService solo calcula cuando alguien pide un dashboard, y solo para ese tripulante. Si nadie mira la página de CM-3, no se guardan sus resultados ni salen sus alertas. Hasta que los eventos lleguen entre procesos (pregunta 13), lo puede resolver un ciclo que actualice a toda la tripulación cada pocos segundos.

## Resultado que se guarda

Se guarda con `POST /api/v1/results` del DataService, un resultado por tripulante y momento de cálculo:

- `crew_id`: el tripulante.
- `kind`: `"measure_results"`.
- `timestamp`: el momento de la misión al que corresponde el resultado.
- `model_version`: la versión de las curvas usadas.
- `payload`: `{"mission_day": ..., "measures": {"knee_extension_60": {...}, ...}}`. `mission_day` es hasta qué día de misión llegan los datos; cada una de las 8 medidas lleva los campos de la tabla de abajo.

El DataService agrega `computed_at` y guarda un resultado por tripulante, `kind`, momento y versión: si se vuelve a calcular, lo reemplaza. Por eso van todas las medidas en un solo resultado: con uno por medida en el mismo momento, se pisarían entre sí. Hay un ejemplo real en [`health/README.md`](../health/README.md#what-it-saves).

Campos de cada medida:

| Campo | Nota |
|---|---|
| `unloaded_days` | Días equivalentes sin gravedad hasta ese día |
| `reference_value` | Promedio antes del vuelo |
| `last_value`, `last_reading_at`, `last_mission_day` | Última lectura usada |
| `change_pct`, `score` | |
| `reference_n` | Cuántas lecturas previas al vuelo se promediaron en la referencia |
| `previous_change_pct`, `previous_mission_day` | La lectura anterior desde el lanzamiento, que usa la regla de alertas |
| `typical_no_exercise_pct`, `typical_exercise_pct` | Comparación con los estudios |
| `extrapolated`, `synthetic` | Se heredan de las lecturas |

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

Alerta, ruteada por contexto. El HealthService la publica en la cola de notificaciones y el sistema de notificaciones es quien la envía. En este ejemplo CM-2 está afuera, en una caminata espacial, y se le avisa a CM-3:

```json
{
  "type": "alert",
  "subject_crew_id": "CM-2",
  "notify": ["CM-3", "ship_center"],
  "routing_reason": "CM-2 unavailable: eva",
  "context": {
    "CM-2": {"activity": "eva", "location": "outside", "source": "suit",
             "start": "2027-06-29T11:00:00Z", "end": "2027-06-29T14:00:00Z", "synthetic": true},
    "CM-3": {"activity": "work", "location": "Destiny", "source": "timeline",
             "start": "2027-06-29T09:00:00Z", "end": "2027-06-29T13:00:00Z", "synthetic": true}
  },
  "phase": {"name": "flight", "gravity_g": 0.0},
  "measure": "knee_extension_60",
  "severity": "warning",
  "message": "Knee extension strength −22% since pre-flight, beyond the typical loss without exercise.",
  "mission_day": 120,
  "created_at": "2027-06-29T12:00:00Z",
  "synthetic": true
}
```

El ruteo está en `health/healthservice/demo.py` y usa `GET /api/v1/context/current` del DataService:

- **A quién.** Si el tripulante está en `eva`, `hygiene` o `sleep`, `notify` pasa a ser otro tripulante disponible más el centro de la nave, y `routing_reason` lo explica.
- **`context`.** Qué está haciendo y dónde está ahora el tripulante de la alerta y cada tripulante de `notify` (`ship_center` no tiene). Es el registro del DataService sin `crew_id`:
  - `activity`: `sleep`, `exercise`, `work`, `meal`, `hygiene` o `eva`.
  - `location`: un módulo de la ISS, u `outside` durante una caminata espacial.
  - `source`, `start`, `end` y `synthetic`.

  Si no hay registro para ese momento, el valor es `null`.
- **`phase`.** La fase de la misión ahora y su gravedad, de `/api/v1/mission`.

Con `context` y `phase`, el sistema de notificaciones puede decir dónde está cada uno, por ejemplo: "CM-2 está afuera, en una caminata espacial, hasta las 14:00; se le avisa a CM-3, que está en Destiny".

**Cuándo alertar.** La regla implementada (detalle y números en la pregunta 9 y en [`health/README.md`](../health/README.md#alert-rule)):

- Mira las **dos últimas pruebas** de una medida desde el lanzamiento.
- Calcula cuánto se pasan, en promedio, de la pérdida típica sin ejercicio de los estudios de reposo en cama para esos mismos días sin gravedad.
- Alerta si se pasan por más de 1,645 veces el ruido de medición de ese promedio. Solo por ruido, eso pasa 1 de cada 20 veces.
- Solo alertan las medidas cuya pérdida típica en la misión es más grande que el ruido de una prueba. Quedan afuera la dorsiflexión del tobillo (−7 % contra 12 % de ruido) y la masa magra de los brazos (no cambia en reposo en cama). Se siguen mostrando en la página.

Ahora que un hallazgo puede generar un estudio extra, una regla con falsas alarmas cuesta más: cada falsa alarma puede terminar en un estudio innecesario.

## Preguntas abiertas

**Respondidas por Juan** en [data-service-status.md](data-service-status.md) (14/11, 18:50) y en el PR #7 (mergeado el 14/11):

- **1 (API, misión y tripulantes).** Se lee por HTTP, en el puerto 8000:
  - `GET /api/v1/mission`: nombre, fecha de lanzamiento, fases con su gravedad, el día "ahora" de su reloj (`now_day`) y los tripulantes con su sexo. Lo agregó a pedido nuestro en el PR #7;
  - `GET /api/v1/readings`, con los filtros `crew`, `measures` y `day`;
  - `GET /api/v1/latest`;
  - `GET /api/v1/results` y `POST /api/v1/results`, con `crew_id`, `kind`, `timestamp`, `payload` y `model_version` opcional.
- **2 (`truth`).** La API no manda `truth` ni `status` salvo que se pida con `?truth=1`, para puntuar un detector. El HealthService no lo pide, y lo descartaría igual; solo lo usa la evaluación de alertas, en el mismo proceso.
- **3 (procesos).** Son dos. El DataService tiene su propia API HTTP (`gravsim.serve`) y los demás servicios leen por ahí, no directo desde gravsim.
- **12 (puertos).** El DataService en el 8000 y el HealthService en el 3000, donde lo espera el front.
- **14 (día de misión).** El filtro `day` es el día de misión que se usa como "ahora". Si una lectura no trae `mission_day`, como puede pasar con un sensor real, el HealthService lo calcula con el `timestamp` y la fecha de lanzamiento.
- **10 (contexto y "datos nuevos").**
  - El contexto es un `ContextRecord` con `crew_id`, `start`, `end`, `activity`, `location`, `source` y `synthetic`.
  - `activity` puede ser `sleep`, `exercise`, `work`, `meal`, `hygiene` o `eva`.
  - `location` es un módulo de la ISS, u `outside` durante una caminata espacial.
  - El contexto actual de cada tripulante sale de `GET /api/v1/context/current`.
  - Los eventos van a ser `data.readings_stored`, `data.context_updated` y `data.result_saved`. Los nombres son provisorios hasta que el README del DataService documente los mensajes.

**Para Juan (DataService)**

- **4 (curvas de referencia, `params.json`).** ¿Las sirve el DataService, como dato histórico importado (así lo dice la arquitectura), o el HealthService las lee del repo? Hoy las lee de `sim/gravsim/params.json`, que está en `main`.
- **13 (eventos entre procesos).** `DataService(publisher=...)` publica dentro del proceso del DataService. ¿Cómo le llega `data.readings_stored` al HealthService, que corre en otro proceso? Mientras no haya cola, el HealthService detecta las lecturas nuevas comparando, con el límite de "Cuándo calcula".

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

   Con gravsim 0.2.0, el que está en `main`:

   | Tripulación | Regla vieja: alertas (falsas) | Regla nueva: alertas (falsas) |
   |---|---|---|
   | La de la demo (semilla 7, 4 personas) | 28 (26) | 0 (0) |
   | 50 misiones al azar (200 personas) | 1489 (1340) | 11 (6) |
   | Las mismas, con 1 de cada 10 pruebas del dinamómetro corrida un 20 % | 1555 (1419) | 27 (19) |
   | 7 casos armados × 25 personas | 1494 (1023) | 87 (11) |

   Por persona, durante el vuelo:

   - De las 25 personas que no hacen ejercicio y pierden rápido, avisa a 23 (mediana: día 74).
   - De las 9 que no hacen ejercicio y tienen una pérdida clara, avisa a 6.
   - No avisa a ninguna de las 25 que siguen la rutina.

   Con gravsim 0.1.0 los números eran parecidos: 16 alertas (11 falsas) en las 200 personas al azar y 117 (15) en los casos armados.

   **Límites, para decidir en equipo:**

   - Necesita dos pruebas y el dinamómetro es mensual, así que la primera alerta llega como pronto el día 44. Propuesta: después de una sola prueba fuera de lo esperado (por ejemplo, a más de 1 vez el ruido), publicar un **hallazgo** en la cola de eventos para que el planificador pida una prueba extra antes. La alerta sale cuando esa segunda prueba lo confirma.
   - Una lesión en alguien que hace ejercicio casi nunca pasa la línea de "sin ejercicio", y se recupera entre pruebas mensuales: de las 19 con una pérdida clara, avisó a 1. Para eso habría que comparar con la propia tendencia de la persona, no con los grupos de reposo en cama.
   - El umbral (1,645) es configurable: `check(..., confidence=...)`. Con 2 hay menos alertas falsas y llegan más tarde.
