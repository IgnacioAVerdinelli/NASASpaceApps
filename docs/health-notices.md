# Avisos de salud: contrato v1 (HealthService → Notification Center)

Respuesta a la [issue #11](https://github.com/IgnacioAVerdinelli/NASASpaceApps/issues/11). El código está en [`health/healthservice/notices.py`](../health/healthservice/notices.py) y los tests en [`health/tests/test_notices.py`](../health/tests/test_notices.py).

**Quién hace qué.** El HealthService **publica** cada aviso en la cola de notificaciones. El **Notification Center** es el que lo **envía**. El HealthService decide la prioridad y cada salida (canal, destinatario y el texto para ese destinatario). El Notification Center no elige destinatarios ni calcula la gravedad clínica.

## 1. Contrato del aviso

Un objeto JSON por revisión, en la cola `notifications` con el topic `health.notice`.

| Campo | Qué lleva |
|---|---|
| `schema_version` | `1` |
| `notification_id` | ID estable del episodio, que se conserva entre revisiones: `healthservice\|<misión>\|<tripulante>\|<medida>\|<creación>` |
| `revision` | 1, 2, 3… Se publica una revisión nueva solo cuando cambia lo que dice el aviso (ver "Revisiones"). |
| `source`, `source_event_id` | `healthservice` y el evento que generó la revisión: `readings:<tripulante>:<medida>:<lectura>`, `context:<tripulante>:<hora>`, `fixture:<nombre>:<hora>` o `manual:<estado>:<hora>`. |
| `mission_id`, `crew_id` | El `name` de `/api/v1/mission` (por ejemplo `iss_180` o `mars`) y el tripulante afectado. |
| `kind` | `health_notice` |
| `priority` | `info`, `warning` o `critical`; la decide el HealthService (ver "Prioridad"). |
| `title`, `message` | Título y descripción completa (con el detalle clínico). |
| `created_at` | ISO 8601 con zona, en el **reloj de la misión**. La revisión 1 lleva la fecha de la prueba que la disparó; las siguientes, la del cambio. |
| `state` | `active`, `resolved` o `cancelled` |
| `requires_ack` | `false` en `info` y en avisos resueltos o cancelados; `true` en `warning` y `critical` activos. Confirmar recepción no resuelve el episodio. |
| `synthetic` | `true` en todo lo que viene de gravsim y en los fixtures. |
| `activity` | Actividad del afectado en el momento de la revisión: `sleep`, `exercise`, `work`, `meal`, `hygiene` o `eva`. `null` si no se sabe. |
| `crew_location` | Dónde está el afectado **dentro de la nave**: un módulo (`Destiny`, `Unity`…) o `outside` en una caminata espacial. Es otra cosa que `mission_location`. |
| `phase` | Fase de la misión y su gravedad, por ejemplo `{"name": "mars_surface", "gravity_g": 0.38}`. |
| `mission_location` | Dónde está **la nave**, para el enlace con Tierra (sección 2). |
| `routing_reason` | Por qué esos destinatarios, en texto. |
| `deliveries` | `[{channel, recipient_id, audience, content}]`, sin pares canal-destinatario repetidos. `audience` (`personal`, `clinical`, `operational`) indica qué texto recibe; el Notification Center lo puede ignorar. |

`notices.validate(aviso)` devuelve los errores de contrato; `notices.publish()` no publica un aviso que no lo cumpla.

### IDs de destinatarios

Son los que usa la demo del Notification Center. **Hay que confirmarlos con Nacho.**

| Canal | `recipient_id` | Quién es |
|---|---|---|
| `earth` | `mission-control` | Médico de vuelo y control de misión, por el enlace con Tierra. Va en **todos** los avisos. |
| `wearable` | `CM-1`, `CM-2`… | El reloj de ese tripulante. |
| `room` | `onboard` | Anuncio en todos los módulos. |
| `ship_center` | `operations` | Consola de operaciones a bordo. |
| `radio` | `eva-CM-1` | Canal de radio de la caminata espacial de ese tripulante. Lo escucha también el compañero que está afuera. |

### Prioridad

- **`info` (leve):** reloj del afectado y Tierra, sin ACK.
- **`warning` (asistencia):** reloj del afectado y Tierra, más un compañero disponible para que lo vea. Si no hay ninguno disponible, va al Ship Center.
- **`critical`:** desde el primer despacho, el afectado, todos los tripulantes que no están en una caminata espacial (aunque estén durmiendo), todos los módulos, el Ship Center y Tierra. No depende del ACK del afectado. Si el afectado está en una caminata espacial, se agrega su canal de radio, y el equipo de apoyo son los tripulantes que están adentro.

"Disponible" quiere decir que no está en `eva`, `hygiene` ni `sleep`. En `info` y `warning`, si el afectado no está disponible, su reloj queda para una revisión siguiente, cuando lo esté.

**De dónde sale la prioridad.** Hoy el único productor clínico es la regla de pérdida muscular y aeróbica, y su severidad es `warning`. No hay un productor de críticos. Los casos críticos se prueban con fixtures sintéticos (ver "Fixtures"), sin umbrales clínicos inventados.

### Textos por salida

| `audience` | Quién | Texto |
|---|---|---|
| `personal` | Reloj del afectado | `message` completo |
| `clinical` | Tierra | `<tripulante>: message` |
| `operational` | Compañeros, módulos, Ship Center, radio | Sin detalle clínico. Crítico: `CRITICAL: CM-1 needs assistance now (in Destiny). Respond and report to the ship center.` Warning: `CM-1 has a health notice that needs a check-in…` |

Al resolver o cancelar, la revisión nueva va a todos los que tenían el aviso: `Resolved: <título>.` para el afectado y Tierra, y `Resolved: the notice about CM-1 needs no further action.` para el resto.

### Revisiones

- **Se publica una revisión nueva** cuando cambia el estado, la prioridad, el cuerpo de `mission_location` o alguna salida (destinatario o texto). Por ejemplo: el afectado vuelve de la caminata espacial y se suma su reloj; en un crítico, se mueve de módulo y cambia el texto operacional; o una prueba nueva cambia el mensaje.
- **No genera revisión** un cambio de contexto que no cambia a quién se avisa ni qué se le dice, como pasar de trabajar a comer. Por eso `activity` y `crew_location` muestran el momento de la última revisión.
- **Republicar** la misma revisión no agrega nada: la cola guarda un mensaje por `notification_id` y `revision` (`dedupe = notice:<id>:<revisión>`), y el contenido es el mismo.
- **Resolución:** cuando la medida deja de cumplir la regla de alertas.
- **Cancelación:** a mano (`state --to cancelled`); la regla de hoy no cancela sola.
- La última revisión de cada aviso queda en el DataService, como resultado de tipo `notice`. Así, si se reinicia el worker, sigue con la revisión que corresponde.

### Cuándo se publica

Al procesar el evento `data.readings_stored` del DataService, en `healthservice.demo`, **sin depender de que alguien abra el dashboard**. Cada 5 segundos ese worker además vuelve a rutear los avisos activos con el contexto del momento.

## 2. Ubicación y fecha de misión (`mission_location`)

```json
"mission_location": {
  "mode": "body", "body_id": "499", "body": "Mars",
  "epoch": "2027-10-28T12:00:00Z", "phase": "mars_surface",
  "source": "healthservice:phase-map", "synthetic": true
}
```

- **`mode: "body"`:** sitúa la nave en un cuerpo de Horizons, como aproximación para la demo; no es una trayectoria. `body_id` es el ID de Horizons y `body`, su nombre.
- **`mode: "unavailable"`:** no hay ubicación, y `reason` dice por qué. El consumidor tiene que dejar pendiente el enlace con Tierra, nunca asumir demora cero, y no bloquear a bordo.
  ```json
  {"mode": "unavailable", "reason": "phase transit: the spacecraft is in transit and there is no agreed mode for it yet",
   "epoch": "2027-04-11T12:00:00Z", "phase": "transit", "source": "healthservice:phase-map", "synthetic": true}
  ```
- **`epoch`:** el instante de la misión, en el reloj simulado del DataService, al que corresponde la ubicación. El aviso no lleva la hora real de publicación, para que republicar dé el mismo contenido.
- **`source` y `synthetic`:** de dónde sale la ubicación y que es simulada.

**De dónde la saca el HealthService.** `/api/v1/mission` todavía no trae ubicación. Mientras tanto, el HealthService la deduce de la fase de la misión con una tabla (`PHASE_BODIES`): solo la propaga, no navega.

| Fase | Cuerpo |
|---|---|
| `preflight`, `postflight`, `flight` (ISS, órbita baja) | `399` (Tierra) |
| `lunar_surface` | `301` (Luna) |
| `mars_surface` | `499` (Marte) |
| `transit`, `transit_return` | `unavailable`: sin modo acordado |

Lo correcto sería que la ubicación viniera del DataService (pregunta para Juan, abajo). Para una nave en tránsito no se implementó ningún modo: primero hay que acordar uno con un ejemplo concreto, como pide la issue.

La demora (600 s reales = 1 s de sistema) y la consulta a Horizons las hace el Notification Center. Solo se aplican a la salida `earth`, no a `room`, `ship_center` ni `radio`.

## 3. Publicación y cola

Hoy **no hay un broker compartido**. La demo usa la cola SQLite de gravsim ([`sim/gravsim/queue.py`](../sim/gravsim/queue.py)).

- **Archivo:** `--queue PATH` o la variable `NASA_QUEUE`. Tiene que ser el mismo para el DataService, el worker y el Notification Center. No tiene secretos.
- **Canal y topic:** canal `notifications`, topic `health.notice`. En ese mismo canal va `study.due` del planificador, que se puede ignorar.
- **Suscripción:** cada consumidor tiene su propio cursor, por nombre. Usar `notification-center` y no `notifications`, que es el que usa el sustituto de la demo. Así los dos reciben todos los mensajes y no compiten.
- **Entrega:** al menos una vez. El consumidor confirma (`ack`) **después de guardar** el mensaje. Si se cae antes, lo recibe de nuevo y lo deduplica por `notification_id` y `revision`.

Para probarlo entre procesos, con el DataService corriendo (`python -m gravsim.serve … --queue /tmp/nasa-queue.sqlite`):

```bash
export NASA_QUEUE=/tmp/nasa-queue.sqlite
health/.venv/bin/python -m healthservice.notices publish --example critical_eva --crew CM-1
health/.venv/bin/python -m healthservice.notices state --id 'healthservice|iss_180|CM-1|fixture-critical_eva|…' --to resolved
health/.venv/bin/python -m healthservice.notices consume --consumer notification-center --once   # otro proceso
```

`consume` imprime cada aviso como una línea JSON y lo confirma. Los avisos reales los publica `healthservice.demo`, como se explica en el README.

**Dependencia de infraestructura:** falta definir el broker compartido (tecnología, cola o topic, routing key y variables de conexión) y quién se encarga. Cuando esté, alcanza con reemplazar `Queue` por un cliente con `publish(topic, message, channel=…, dedupe=…)`.

### Fixtures

`notices.fixture(nombre, source, tripulante)` arma avisos de prueba: `info`, `warning`, `critical_internal` y `critical_eva` (este último pone al tripulante afuera, en una caminata espacial). Llevan `synthetic: true`, un `source_event_id` que empieza con `fixture:` y un título `SYNTHETIC TEST (…)`. No usan ningún umbral clínico. El worker no los vuelve a rutear.

## 4. Criterios de aceptación

| Criterio | Estado |
|---|---|
| Aviso leve personal | ✅ `test_info_goes_to_the_subjects_wearable_and_earth_without_ack`; fixture `info` |
| Crítico interno con todos sus destinos | ✅ `test_critical_inside_calls_everyone_from_the_first_dispatch`; fixture `critical_internal` |
| Crítico EVA con radio y respondedores | ✅ `test_critical_on_a_spacewalk_adds_the_radio_loop_and_the_support_crew`; fixture `critical_eva` |
| Repetición sin cambiar ID, revisión ni contenido | ✅ `test_publishing_the_same_revision_again_adds_nothing` |
| Cambio de ruta, resolución y cancelación con revisión creciente | ✅ `test_route_change_then_resolution_and_cancellation_make_new_revisions`, `test_worker_resolves_the_notice_when_the_measure_stops_alerting` |
| `mission_location` válido, y caso ausente | ✅ `test_mission_location` (ISS, Luna, Marte, tránsito) |
| IDs de destinatarios y significado de prioridad y contexto | ✅ en este doc; los IDs quedan para confirmar con Nacho |
| Publicación y consumo entre procesos | ✅ con la cola SQLite de la demo (`test_fixtures_are_marked_synthetic_and_published_between_processes`); ⏳ falta el broker compartido |
| Pruebas del productor y rama o PR | ✅ rama `health/notice-contract` |

## Para acordar

- **Nacho (Notification Center):** los IDs de destinatarios. Si `audience` y los campos extra (`crew_location`, `phase`, `routing_reason`) les sirven o molestan. Si el resuelto tiene que ir a todos los que tenían el aviso.
- **Juan (DataService):** si `/api/v1/mission` puede traer la ubicación de la nave (por fase o por momento). Así el HealthService la propagaría en lugar de deducirla.
- **Infraestructura:** el broker compartido y quién se encarga.
- **Equipo:** si la pérdida muscular y aeróbica debe ser `warning` (hoy) o `info`.
