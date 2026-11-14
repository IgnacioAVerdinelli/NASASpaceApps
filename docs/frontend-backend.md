# Contrato frontend–backend

La página Trama consume un único estado completo del dashboard. El backend todavía no está implementado en este repositorio: esta especificación es el acuerdo para quien lo desarrolle. Para trabajar sin backend, el frontend usa el archivo [dashboard.example.json](../src/front/sketch/data/dashboard.example.json), con valores simulados; no inicia ningún servidor de datos.

## Transporte

- Método: `GET` a la URL definida en `VITE_DASHBOARD_URL`; ruta sugerida: `/api/v1/dashboard`.
- Respuesta: `200 OK`, `Content-Type: application/json`, con el objeto completo de la versión 1. No se usan parches parciales. Un ejemplo completo y válido está en [dashboard.example.json](../src/front/sketch/data/dashboard.example.json).
- Errores: códigos HTTP no 2xx, respuesta no JSON o contenido inválido se consideran error. El backend puede devolver un cuerpo de error propio; el frontend no muestra sus detalles como texto de producto.
- El frontend solicita `Accept: application/json` y desactiva el caché de la solicitud. Consulta al abrir y vuelve a consultar 3 segundos después de que termina cada intento, sin peticiones superpuestas. Una petición se cancela después de 8 segundos. Si hay un último estado válido, se conserva con un aviso de desconexión; antes de la primera respuesta se muestra carga o error y se reintenta.
- La variable `VITE_DASHBOARD_URL` debe establecerse al arrancar Vite o al generar el build. Al omitirla se usan datos locales de ejemplo, claramente marcados. Una URL configurada que falla **no** vuelve al ejemplo. Para orígenes diferentes, el backend debe configurar CORS para el origen real de la página. No se define autenticación en este prototipo.
- Para revisar una respuesta del backend cuando exista: `curl -i http://localhost:3000/api/v1/dashboard`. La dirección es solo un ejemplo, no implica que haya un servidor disponible aquí.

## Respuesta

Todos los campos indicados deben existir, incluso cuando admiten `null`. Cada respuesta es una instantánea completa; enviar un objeto nuevo cuando cambien los datos. Los nombres y valores enumerados son sensibles a mayúsculas.

| Campo | Tipo y significado |
| --- | --- |
| `version` | Número fijo `1`. |
| `updatedAt` | Fecha/hora de actualización en ISO 8601 con zona, por ejemplo `2026-11-14T12:00:00Z`. |
| `simulated` | Booleano. `true` identifica explícitamente datos ficticios. |
| `body.body` | `male` o `female`: modelo anatómico. |
| `body.layer` | `surface`, `muscles` o `skeleton`: piel, músculos o huesos. |
| `body.selected` | Clave muscular existente o `null` si no hay selección. |
| `body.scores` | Objeto `{ "clave_muscular": número }` con valores 0–100, o `null` si no hay dato. Una clave omitida también significa sin dato. El color y los indicadores muestran intensidad visual, no diagnóstico. |
| `body.viewRequest` | `null` o `{ "direction": "front" \| "back", "request": 1 }`. `request` es un entero no negativo que debe cambiar cada vez que se quiera ordenar otra orientación, incluso si se repite la dirección. No incrementar en cada consulta si no hay una nueva orden. |
| `summary.title`, `summary.description`, `summary.notice` | Textos a mostrar en el panel. |
| `summary.items` | Lista de objetos con `id` único no vacío, `muscleKeys` (lista de claves), `title`, `description` y `changePercent` (número o `null`). La variación es distinta de `scores`: `-8` se muestra como `-8%`; `null` como sin datos. |
| `charts` | Lista de gráficos. Cada uno contiene `id` único no vacío, `muscleKeys`, `title`, `description`, `unit`, `reference`, `insight` y `points`. |
| `charts[].muscleKeys` | Mostrar el gráfico cuando la selección coincide con alguna clave. Una lista vacía lo muestra para cualquier selección; sin selección se muestran todos. |
| `charts[].unit` | Unidad textual asociada a la escala y al valor de referencia. |
| `charts[].reference` | Número de referencia o `null` si no hay referencia. |
| `charts[].insight` | Texto explicativo o `null` si no está disponible. El frontend no crea interpretaciones médicas. |
| `charts[].points` | Lista de `{ "at": "fecha ISO con zona", "value": número o null }`. Se ordena por fecha; `null` interrumpe la línea. Sin puntos válidos se muestra «No data available»; con un solo punto se dibuja un punto. |

Las claves de músculos son las del catálogo `muscles` exportado por `src/front/body-3d/anatomy.js`, por ejemplo `quadriceps_l`, `quadriceps_r`, `chest_muscles_l` y `calf_r`; `_l` y `_r` representan izquierda y derecha anatómicas. El catálogo contiene 41 grupos y algunos agrupan varios músculos. Solo 27 cuentan con una región de piel; los profundos se muestran en la capa muscular.

Los textos admiten hasta 1000 caracteres. Las listas de resultados y gráficos admiten hasta 100 elementos cada una y cada gráfico hasta 10 000 puntos. Los IDs de cada lista no pueden repetirse. El validador ejecutable del contrato está en `src/front/sketch/data/contract.js`; si un campo requerido o un valor es inválido, se rechaza toda la respuesta y se conserva el último estado válido.

## Puesta en marcha del frontend

Desde la raíz del proyecto, instalar las dependencias raíz con `npm install`. Luego ejecutar `cd src/front/sketch`, `npm install` y `npm run dev`. Para utilizar la API en vez del ejemplo, iniciar el último comando con `VITE_DASHBOARD_URL=http://localhost:3000/api/v1/dashboard npm run dev`, usando la dirección real que implemente el equipo.

La integración es solo de lectura: el frontend no envía cambios al backend. La rotación y el zoom hechos por la persona son locales. Ningún dato de ejemplo ni color constituye una medición o interpretación clínica.

## Claves musculares admitidas

- `abdominal_muscles`: Abdominal Wall Muscles
- `back_muscles_l`: Back Muscles (L)
- `back_muscles_r`: Back Muscles (R)
- `calf_l`: Calf Muscles (L)
- `calf_r`: Calf Muscles (R)
- `chest_muscles_l`: Chest (Pectoral) Muscle (L)
- `chest_muscles_r`: Chest (Pectoral) Muscle (R)
- `deltoid_l`: Deltoid (Shoulder) (L)
- `deltoid_r`: Deltoid (Shoulder) (R)
- `diaphragm`: Diaphragm
- `foot_muscles_l`: Foot Muscles (L)
- `foot_muscles_r`: Foot Muscles (R)
- `forearm_muscles_l`: Forearm Muscles (L)
- `forearm_muscles_r`: Forearm Muscles (R)
- `gluteal_l`: Gluteal Muscles (L)
- `gluteal_r`: Gluteal Muscles (R)
- `hamstrings_l`: Hamstrings (Back Thigh) (L)
- `hamstrings_r`: Hamstrings (Back Thigh) (R)
- `hand_muscles_l`: Hand Muscles (L)
- `hand_muscles_r`: Hand Muscles (R)
- `iliopsoas_l`: Hip Flexor (Iliopsoas) (L)
- `iliopsoas_r`: Hip Flexor (Iliopsoas) (R)
- `adductors_l`: Inner Thigh (Adductors) (L)
- `adductors_r`: Inner Thigh (Adductors) (R)
- `intercostals_l`: Intercostal Muscles (L)
- `intercostals_r`: Intercostal Muscles (R)
- `neck_muscles_l`: Neck Muscles (L)
- `neck_muscles_r`: Neck Muscles (R)
- `pelvic_floor`: Pelvic Floor
- `quadriceps_l`: Quadriceps (Front Thigh) (L)
- `quadriceps_r`: Quadriceps (Front Thigh) (R)
- `rotator_cuff_l`: Rotator Cuff (L)
- `rotator_cuff_r`: Rotator Cuff (R)
- `shin_muscles_l`: Shin Muscles (L)
- `shin_muscles_r`: Shin Muscles (R)
- `shoulder_muscles_l`: Shoulder Girdle Muscles (L)
- `shoulder_muscles_r`: Shoulder Girdle Muscles (R)
- `trapezius_l`: Trapezius (L)
- `trapezius_r`: Trapezius (R)
- `upper_arm_muscles_l`: Upper Arm Muscles (L)
- `upper_arm_muscles_r`: Upper Arm Muscles (R)
