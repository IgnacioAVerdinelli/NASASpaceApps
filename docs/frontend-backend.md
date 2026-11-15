# Contrato frontend–backend

La página GraviTal consume un único estado completo del dashboard servido por [HealthService](../health/README.md), que a su vez lee el DataService. El frontend consulta la lista de tripulantes en `GET /api/v1/health` y solicita el dashboard elegido con `?crew=...`. Para trabajar sin backend se puede activar explícitamente el archivo [dashboard.example.json](../src/front/sketch/data/dashboard.example.json) con `VITE_DASHBOARD_MODE=example`.

## Transporte

- Método: `GET` a `VITE_DASHBOARD_URL`, o `/api/v1/dashboard` por defecto. La URL debe terminar en `/dashboard`; el cliente usa la ruta hermana `/health` para obtener la tripulación.
- Respuesta: `200 OK`, `Content-Type: application/json`, con el objeto completo de la versión 1. No se usan parches parciales. Un ejemplo completo y válido está en [dashboard.example.json](../src/front/sketch/data/dashboard.example.json).
- Errores: códigos HTTP no 2xx, respuesta no JSON o contenido inválido se consideran error. El backend puede devolver un cuerpo de error propio; el frontend no muestra sus detalles como texto de producto.
- El frontend solicita `Accept: application/json` y desactiva el caché de la solicitud. Consulta al abrir y vuelve a consultar 3 segundos después de que termina cada intento, sin peticiones superpuestas. Una petición se cancela después de 8 segundos. Si hay un último estado válido, se conserva con un aviso de desconexión; antes de la primera respuesta se muestra carga o error y se reintenta.
- La variable `VITE_DASHBOARD_URL` es opcional y se establece al arrancar Vite o generar el build. En desarrollo Vite redirige `/api` al HealthService local; el build necesita un proxy equivalente o una URL accesible. Los errores no vuelven al ejemplo. Para orígenes diferentes, el backend debe configurar CORS para el origen real de la página. No se define autenticación en este prototipo.
- Para revisar la respuesta del backend: `curl -i http://localhost:3000/api/v1/dashboard`.

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

## Mediciones en vuelo: `GET /api/v1/analyses`

La página principal `/` (pestañas "Muscle strength" y "Aerobic capacity") consume un segundo JSON del mismo HealthService, test por test. El frontend no calcula nada: cada valor, nivel, banda de ruido y alerta viene de acá, y son los mismos que el HealthService guarda y manda a la cola. El frontend solo los pasa a colores y texto.

- **Transporte:** el mismo que el dashboard (sondeo cada 3 s, sin caché, cancelación a los 8 s, se conserva el último estado válido). La URL sale de `VITE_DASHBOARD_URL` cambiando `/dashboard` por `/analyses` y conservando sus parámetros; `?crew=` elige tripulante y `?day=` mira un día pasado sin guardar nada. Un tripulante desconocido devuelve `404` con la lista de tripulantes. Con `VITE_DASHBOARD_MODE=example` se usa [analyses.example.json](../src/front/sketch/data/analyses.example.json) (CM-1, semilla 7, día 170).
- **Validador:** `validateAnalyses` en `src/front/sketch/data/contract.js`, con su copia en `health/healthservice/contract.py` para los tests.

| Campo | Tipo y significado |
| --- | --- |
| `version`, `updatedAt`, `simulated` | Igual que en el dashboard. |
| `notice` | Texto fijo para mostrar ("Synthetic data, …", "Not a health assessment."). |
| `crew` | `{ id, body }`; `body` es `male` o `female`, para el modelo 3D. |
| `mission` | `{ name, today, todayLabel, landing }`: día de misión actual (número, 0 = FD1), su etiqueta (`L-30`, `FD15`, `R+5`) y el día del aterrizaje. |
| `levels` | Los 4 niveles, en orden: `{ level, label, range }`. Nivel 1 = menos de 5% peor que antes del vuelo, 2 = 5 a 10%, 3 = 10 a 20%, 4 = 20% o más, o por debajo de un mínimo de NASA. |
| `strength.evaluations` | Una por sesión de dinamómetro: `{ id, day, label, phase }`. La primera es siempre `id: "pre"` (la referencia, promedio de los tests previos); las demás `id: "d14"`, `"d44"`… `phase` es `pre`, `flight` o `post`. |
| `strength.groups` | Un grupo muscular por medida del dinamómetro (cuádriceps, isquiotibiales, gemelos, tibiales, espalda): `key`, `measure`, `name`, `test`, `region`, `muscleKeys` (claves del catálogo, abajo), `unit`, `baseline` (número o `null`), `referenceTests` (tests previos promediados), `noiseBandPct`, `alert` y `points`. |
| `strength.groups[].points` | Un punto por evaluación, en el mismo orden, con `evaluation` (su `id`) y los campos de punto (abajo). |
| `strength.upcoming`, `aerobic.upcoming` | Tests por venir: `{ day, label, reason }`, `reason` es `routine` o `retest` (pedido tras un hallazgo). Salen del plan del Planner (`kind=plan`, [planner.md](planner.md)); sin el Planner, la lista está vacía. |
| `aerobic` | VO2peak del test en bicicleta: `measure`, `name`, `test`, `unit`, `baseline`, `referenceTests`, `noiseBandPct`, `minimum` (32.9 ml/kg/min, NASA-STD-3001 [V1 4001]), `standardLossPct` (20), `alert`, `upcoming` y `evaluations`. |
| `aerobic.evaluations` | Una por test: los campos de evaluación y los de punto juntos, más `test`: los datos propios del test (FC pico, RER, Borg, motivo de corte). Hoy siempre `null`, porque el DataService no los registra; la página muestra "Not recorded". |

**Campos de punto:** `value` (número o `null`), `changePct` (% contra la referencia, `null` sin dato), `level` (1–4 o `null`), `withinNoise` (si el cambio cabe en el ruido de un solo test), `belowMinimum` (solo VO2peak; `null` en fuerza) y `quality`: `ok`, `not measured`, `no reference` o la marca del DataService (`out_of_range`, …). Un test marcado conserva su lugar sin valor.

**Banda de ruido (`noiseBandPct`):** `1.645 × ruido de un test` contra una referencia de `referenceTests` tests, en puntos porcentuales. Un test cae ahí por puro ruido de medición el 90% de las veces. Ejemplo: extensión de rodilla con 2 tests previos, ±16.8.

**`alert`:** `null`, o `{ severity, rule, message }`. `critical` / `nasa_standard`: VO2peak cruzó el estándar de NASA en vuelo (promedio de los dos últimos tests 20% o más por debajo, o por debajo de 32.9). `warning` / `beyond_typical`: la pérdida es más rápida que la típica sin ejercicio en reposo en cama. Las reglas están en [health/README.md](../health/README.md#alert-rules). El nivel de un solo test es descriptivo y no dispara alertas: por eso un test puede tener nivel 4 sin alerta.

## Puesta en marcha del frontend

Seguir las instrucciones de arranque del [README](../README.md) para levantar DataService, HealthService y Vite. Para usar el ejemplo sin backend, iniciar Vite con `VITE_DASHBOARD_MODE=example npm run dev`.

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

## Recomendaciones y alertas

La página principal muestra las alertas de ambos análisis y los estudios próximos del planificador desde `/api/v1/analyses`. Los retests se distinguen de las evaluaciones de rutina; el contrato agrupa los estudios por análisis y no identifica el músculo concreto de cada retest. Los cambios de estado son locales a la demo y no se envían al planificador.

## Estudios por imagen: `GET /api/v1/eyes` y `GET /api/v1/veins`

Las pestañas "Eyes" y "Neck veins" leen un JSON cada una. Mismo transporte que `/analyses` (sondeo, sin caché, `?crew=` y `?day=`, `404` para un tripulante desconocido). El frontend no calcula nada clínico: clases, niveles, signos y textos vienen del HealthService; `data/eyes.js` y `data/veins.js` solo los convierten en formas.

- **`/eyes` (versión 2, [investigacion-ojos.md](investigacion-ojos.md)):** `status` `{class, text, eyes: {right, left}, signs[], examLabel, worstClass, worstLabel}` con clases `none`, `A`, `B`; `exams[]` `{day, label, at, values, changes, eyes, class, signs}` con `values` y `changes` por ojo; `measures[]` con `eyes.{right,left}.{baseline, latest, series}`; `thresholds`, `notice`.
- **`/veins` (versión 1, [investigacion-yugular.md](investigacion-yugular.md)):** `status` `{level, text, sides: {right, left}, signs[], scanLabel, worstLevel, worstLabel}` con niveles `normal`, `check`, `alarm`; `scans[]` `{day, label, at, values, changes, sides, level, signs}` por vena; `measures[]` (`ijv_flow_grade`, `ijv_compressible`, `ijv_echogenicity`, `ijv_csa`, `ijv_peak_velocity`) con `sides.{right,left}.{baseline, latest, series}`; `grades` y `echo` (textos de cada grado), `reference` (áreas publicadas de Marshall-Goebel 2019: sentado, acostado, cabeza abajo, días 50 y 150), `notice`.

## Signos vitales del reloj: `GET /api/v1/vitals`

La capa "Ahora" del Health summary y la pestaña "Vital signs" leen un tercer JSON del HealthService. Diseño, reglas y ejemplo completo en [wearable.md](wearable.md), sección 3.

- **Transporte:** el mismo que `/analyses` (sondeo, sin caché, `?crew=` y `?day=`, `404` con la lista de tripulantes).
- **`vitals[]`:** uno por signo (`resting_hr`, `resting_sbp`, `resting_dbp`, `spo2`, `hrv_rmssd`, `sleep_hours`, `sleep_quality`) con `name`, `unit`, `decimals`, `direction` (`up` o `down`: hacia dónde es peor), `latest` `{value, day, at}`, `band` `{low, high, mean, days, sustainedLow, sustainedHigh}` o `null`, `status` (`in_range`, `out`, `deviation`, `low_now`, `no_band`, `no_data`), `daysBeyond`, `recentMean`, `changePct`, `text` (frase lista para mostrar), `series` (últimos 30 días `{day, value}`) y `weekly` (promedios semanales de toda la misión `{week, day, mean}`).
- **`patterns[]`:** `{id, text}`; hoy solo `fatigue`.
- **`day`:** `curves.today`, `yesterday`, `week_ago` y `preflight`, cada una `[{minute, value}]` en minutos desde las 00:00 UTC; `context` `[{start, end, activity}]` con `sleep`, `exercise` o `eva` de hoy.
- El frontend no calcula nada: estado, banda y texto vienen del HealthService.
