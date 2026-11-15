# Notification Center

Microservicio local de notificaciones para la demo. Consume `health.notice` de HealthService, `plan.reminder` / `plan.missed` del Planner y `study.due` del scheduler anterior por el canal `notifications` de `gravsim.queue`. Persiste antes de confirmar el cursor del broker, distribuye a cada destinatario y conserva reintentos, recepciones y confirmaciones independientes.

## Ejecutar con el equipo

Desde la raíz, con un entorno Python que tenga instalados `./sim` y `./health` (y sus dependencias):

```bash
export NASA_QUEUE=/ruta/absoluta/shared-queue.sqlite3
PYTHONPATH=services/notification_center:sim:health python -m notification_center.server \
  --queue "$NASA_QUEUE" --data-url http://localhost:8000 \
  --db services/notification_center/.local/notifications.sqlite3
```

El archivo de `--queue` es el mismo que usan DataService y HealthService. **No es el archivo de `--db`**, que pertenece exclusivamente a Notification Center. Cursor propio: `notification-center-v1`; no compite con el consumidor de muestra de HealthService. Sin `--queue` funciona únicamente el ingreso HTTP y los fixtures locales.

Arrancar primero DataService, luego HealthService y Notification Center. El bridge de scheduler usa DataService para completar ubicación/fecha/contexto y el resolver compartido de HealthService para destinos; no decide prioridades clínicas. La política de calendario y anticipación de recordatorios pertenece al scheduler. Si DataService no responde, conserva el mensaje sin confirmar y reintenta.

Frontend existente:

```bash
cd src/front/sketch
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir http://localhost:5173/alerts/. Vite conserva el proxy `/api` de HealthService y agrega `/notifications-api` hacia puerto 3002. El reloj consulta cada 800 ms; en una desconexión conserva los últimos mensajes recibidos y avisa. La lista de tripulantes incorpora los IDs recibidos desde HealthService (incluye CM-4 si aparece), además de los tres actores iniciales de demo.

## Flujo y responsabilidades

HealthService decide prioridad, canales, destinatarios y contenido. Contrato del productor: [health-notices.md](../../docs/health-notices.md). El centro valida, deduplica, persiste y entrega; no interpreta scores anatómicos ni hace diagnósticos.

- Leve `info`: reloj personal y Tierra; puede retenerse el reloj upstream si el astronauta está indisponible.
- `warning`: rutas de asistencia indicadas por HealthService; su productor pide ACK.
- Crítico: rooms y Ship Center desde el primer despacho, con los respondedores indicados; no espera confirmación del afectado. Si todos están en EVA, no inventa compañeros disponibles.
- EVA: radio dirigida cuando lo indica el productor.
- Recordatorio: publicación del scheduler; ACK no significa realizar la actividad.

Solo el afectado y Tierra reciben detalle personal. Los compañeros reciben texto operacional y título genérico si el productor los marca con `audience: operational`. Las salidas compartidas reciben exclusivamente su `content`, sin todo el aviso clínico.

## Demoras y valor de retorno

`mission_location` llega desde HealthService. Se acepta `mode: body` con `body_id` y `epoch` ISO con zona. Se consulta [NASA/JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html): vectores relativos al centro de Tierra, `VEC_TABLE=3`, `OUT_UNITS=KM-S`, columna LT. La época se normaliza a UTC y se conserva como snapshot del aviso; no representa seguimiento continuo de navegación.

La escala es **600 segundos físicos por segundo de demo**. Para 1200 segundos físicos de ida:

- Recepción terrestre: 2 segundos después de iniciar el tránsito simulado.
- Confirmación recibida a bordo: 4 segundos después de iniciarlo.

El viaje de vuelta se aproxima usando el mismo tiempo de ida: es un modelo de propagación, no una medición de latencia de red completa. La consulta a NASA puede demorar antes de iniciar ese tránsito; sus errores mantienen Tierra pendiente sin bloquear el despacho a bordo. Hay timeout de 15 segundos, consultas serializadas y caché acotada por cuerpo/época.

Tierra `399` se aproxima con ambos extremos en el centro terrestre (cero propagación geométrica); no modela la órbita de la ISS. Ubicación ausente, inválida o `unavailable` (tránsito sin trayectoria) deja Tierra pendiente. No se inventa demora cero. La ubicación actual del productor es una aproximación por fase, con procedencia explícita.

Las salidas locales usan tiempos de demo configurables mediante `HorizonsLatency(local_seconds=...)`: reloj 0,05 s; rooms, Ship Center y radio 0,10 s. Esos valores son supuestos de simulación, no datos NASA.

Los temporizadores están persistidos en SQLite, no son sleeps por destino: un viaje no ocupa un worker durante toda su demora y se recupera tras reinicio. Si el enlace está apagado no confirma; al restaurarlo procesa los temporizadores vencidos. `destination_received` representa aceptación por el receptor simulado; `return: true` representa confirmación de transporte, no ACK humano ni resolución clínica.

## Endpoints

API local en `127.0.0.1:3002`. JSON, datos exclusivamente sintéticos, sin autenticación de producción.

| Método / ruta | Resultado |
| --- | --- |
| `POST /api/v1/messages` | Publica contrato v1 a la cola local; 202 (`queued`, `duplicate`, `stale`), no confirma entrega |
| `GET /api/v1/notifications?crew=CM-1` | Bandeja activa del reloj |
| `POST /api/v1/deliveries/{id}/ack` | `{"crew_id":"CM-1"}` confirma explícitamente recepción cuando se requiere |
| `GET /api/v1/deliveries` | IDs, destinos, intentos y estados de todas las entregas |
| `GET /api/v1/outputs/earth/{id}` | Resultado y demora de una entrega terrestre |
| `GET /api/v1/outputs/wearable/{id}` | Resultado de entrega a reloj |
| `GET /api/v1/outputs/room/{id}` | Resultado de entrega a rooms |
| `GET /api/v1/outputs/ship_center/{id}` | Resultado de entrega a pantalla central |
| `GET /api/v1/outputs/radio/{id}` | Resultado de entrega a radio |
| `GET /api/v1/demo/outputs?channel=room&recipient=onboard` | Receptor simulado por canal/destinatario |
| `GET /api/v1/rejected` | Mensajes de cola inválidos retenidos para inspección/republicación corregida |
| `GET /api/v1/demo/state` | Roster, escenarios e interruptores de canales |
| `POST /api/v1/demo/scenarios` | `{"scenario":"eva","crew_id":"CM-1"}`; otros: mild, reminder, assistance, critical |
| `POST /api/v1/demo/channels` | `{"channel":"earth","available":false}` |
| `GET /api/v1/health` | Liveness del servidor |

Ejemplo de resultado pendiente:

```json
{"delivery_id": 42, "channel": "earth", "status": "in_transit", "return": null, "destination_received": false}
```

A la recepción terrestre `destination_received` pasa a true; al regresar la confirmación, `status` es `delivered` y `return` es true. Una entrega cancelada devuelve false; una pendiente/fallida reintentable devuelve null, nunca un falso éxito. El endpoint no mantiene abierta una petición durante minutos: el cliente consulta el mismo ID hasta el estado final. El objeto incluye además `delay`, `confirmed_at` y `last_error`. Un ID de otro canal o inexistente devuelve 404.

## Revisiones, fallos y transportes

ID/revisión iguales y contenido idéntico se deduplican; contenido contradictorio se rechaza. Revisiones nuevas invalidan pendientes locales antiguos y retiran sus tarjetas. Resolución/cancelación se transmite a los destinos incluidos por el productor. Tierra conserva el historial completo de revisiones; las proyecciones a bordo muestran únicamente la última revisión activa.

Los mensajes inválidos de la cola se conservan en `rejected_messages` antes de avanzar el cursor. Fallos de persistencia o conexión no avanzan el cursor. El bridge consume un mensaje a la vez y debe tener una sola instancia por cursor. Reiniciar recupera entradas y temporizadores; los interruptores de conectividad de demo vuelven a disponibles.

Las salidas tienen ejecutores independientes y reintentos exponenciales de 2 a 60 segundos. El contrato de transporte externo es `transports={"earth": sender}` al construir `NotificationCenter`: sender recibe un sobre dirigido con clave de idempotencia estable, identidad, revisión, canal, destinatario, prioridad, estado, contenido, época y marca sintética. Una excepción o false activa el reintento; debe devolver éxito solo tras la confirmación acordada. El adaptador externo asume sus propios timeout, demora e idempotencia; los canales no reemplazados siguen simulados. Semántica al menos una vez, no exactly-once.

No hay pantallas nuevas de rooms/Ship Center ni radio/audio físico; son receptores simulados consultables. No se implementan escalamiento por timeout humano, navegación en tránsito, autenticación productiva o broker de red. La cola compartida SQLite ya permite integrar procesos locales. Las pantallas remotas futuras deben aplicar identidad/revisión y cancelaciones correctamente.

## Verificar

Desde la raíz, con dependencias de HealthService/sim instaladas:

```bash
PYTHONPATH=services/notification_center:sim:health:planner python -m unittest discover -s services/notification_center/tests -v
cd src/front/sketch
npm run build
```

Pruebas incluyen cinco endpoints con demora, equivalencia 40 min → 4 s, ubicación desconocida, contrato real del productor por cola compartida, aislamiento de contenido, persistencia, revisiones y reintentos. También se verificó el flujo entre procesos DataService/HealthService/Notification Center, con consulta real a Horizons y fixture EVA: las cinco salidas confirmaron y no hubo rechazos.

## Compatibilidad con main actual

Notification Center usa puerto **3002**; Planner conserva **3001**, HealthService **3000** y DataService **8000**. Vite conserva los proxies del plan y agrega el de notificaciones. El bridge adapta los payloads actuales del Planner con el resolver de HealthService y completa geometría desde DataService. `plan.missed` respeta la salida Ship Center indicada por el productor; ambos tipos incluyen Tierra. Esta adaptación es transitoria hasta que Planner publique avisos v1 ya enrutados. No agrega un motor clínico.
