# Selección de tripulante (`/crew.html`)

Página previa al **Health overview**: muestra a toda la tripulación, deja elegir a una persona y abre su overview
(`/vuelo.html?crew=<id>#summary`). Está en inglés, como el resto de GraviTal.

## Qué se ve

En una sola vista, sin scroll en una pantalla de escritorio:

- **Izquierda: carrusel 3D.** Los tripulantes están de pie sobre un anillo. El elegido queda adelante, centrado y
  con un aro azul en el piso; dos vecinos a cada lado se van alejando y el resto queda oculto atrás. Se gira:
  - arrastrando la escena (mouse o dedo); al soltar queda elegido el que terminó adelante;
  - con las flechas ‹ › a los costados o ← → del teclado;
  - con la **tira de tripulantes** de abajo (avatar, ID y un punto con el estado), que salta directo a cualquiera.

  Clic en un vecino: el anillo gira hasta traerlo adelante. Clic en el de adelante: abre su overview.
- **Derecha: card compacta del elegido.** Avatar, ID y rol; chip de estado con el título del aviso
  principal; VO₂peak, mayor pérdida muscular y FC en reposo; los 3 signos vitales del reloj más relevantes (alterados
  primero, con el tono del overview); lo próximo del plan; botones **Open health overview** y **Mission plan**.
  El resto del detalle queda en el overview.
- **Arriba:** título "Crew aboard", conteo por estado (`action needed` / `check needed` / `no alerts`) y la misión
  (nombre y día de misión del simulador).

Por debajo de ~980 px de ancho, la card pasa debajo del carrusel.

### Animaciones

Siempre activas (decisión de producto: no siguen `prefers-reduced-motion`).

- El anillo se mueve con un resorte críticamente amortiguado: arranca suave, se desliza y frena sin rebote. Las
  figuras se inclinan un poco con la velocidad del giro.
- La card entra deslizándose desde el lado hacia el que giró el anillo; encabezado, estado, números y vitales
  aparecen escalonados; los números cuentan desde cero.
- En la tira, una pastilla se desliza hasta el tripulante elegido.
- Al abrir el overview, la página se desvanece (~0,4 s) **sin zoom de cámara**; el overview entra con un fundido.

## Estados

| Caso | Qué muestra |
|---|---|
| Cargando | Esqueletos en la tira y "Loading the crew…" sobre la escena |
| HealthService caído, sin datos previos | "Unable to reach the HealthService. Retrying automatically…" |
| Conexión perdida con datos previos | Aviso "Connection lost. Showing the last available data." y los últimos datos |
| Tripulante sin lecturas | Chip "No readings yet" y "No measurements yet." |
| Navegador sin WebGL | "3D is not available in this browser"; la tira y la card siguen funcionando |
| `VITE_DASHBOARD_MODE=example` | Aviso: la página necesita el HealthService; link al overview de ejemplo |

## De dónde salen los datos

No calcula nada clínico: arma un resumen por persona con las mismas funciones que el Health summary
(`summary/data.js`), así el estado coincide con el del overview.

| Dato | Endpoint | Función |
|---|---|---|
| Lista de tripulantes | `GET /api/v1/health` (`crew`) | `loadCrew` (`data/dashboard.js`) |
| Estado, avisos, VO₂peak, mayor pérdida | `GET /api/v1/analyses?crew=<id>` | `alertsOf`, `overallStatus`, `aerobicLatest`, `muscleRows` |
| Signos del reloj | `GET /api/v1/vitals?crew=<id>` | `watchNotices`, `tiles`, `side` (`data/vitals.js`) |
| Próximo ítem del plan | Planner `GET /api/v1/plan?crew=<id>` | `upcoming`, `timing` (`data/plan.js`) |

Cada fuente es opcional por tripulante: si una falla, la card muestra lo que haya. Si todas fallan para todos, la
página muestra el error. Se refresca con `useDashboard`, igual que el overview.

### Tono de los signos vitales en la card

| `status` del HealthService | Tono | Significado |
|---|---|---|
| `low_now` | `crit` | SpO₂ bajo ahora |
| `deviation` | `warn` | Cambio sostenido varios días |
| `out` | `info` | Hoy fuera del rango habitual |
| `in_range`, `no_band` | sin tono | Normal |

Orden: alterados primero (`low_now` > `deviation` > `out`), después el orden del overview.

## Tripulación (`data/roster.js`)

La tripulación es **ficticia**: cada ID simulado (`CM-1`…`CM-7`) se muestra con su propio ID como nombre y un rol
genérico (Commander, Pilot, Flight engineer, Mission specialist), sin nombres, fotos ni parecidos de personas reales.
Los datos de salud son sintéticos y muestran hallazgos (pérdidas, alertas, posibles coágulos): ponerlos junto al
nombre o la foto de un astronauta real le atribuiría problemas médicos inventados a una persona identificable, y el
sitio es público. Por eso no se usa un roster real, aunque el pie de página lo aclare.

- `person(id)` devuelve `{ id, name, role, agency, photo }` con `name = id` y `photo = null` (la card y el selector
  muestran el avatar genérico).
- `missionName(mission)` arma la etiqueta de la barra superior desde el simulador (`iss_180_demo_five` →
  "ISS 180 DEMO FIVE"), en esta página y en el overview, así cada preset (`artemis_30`, `mars`) muestra su nombre.

**Trajes:** todos usan el mismo mono IVA azul. No hay un color oficial por agencia dentro de la estación (los trajes
de lanzamiento Sokol y de SpaceX son blancos para todos), así que no se diferencian por agencia.

## Figuras 3D

- `crew/astronaut.js`: cada figura es el cuerpo de `open-anatomy-3d` (masculino o femenino según
  `analyses.crew.body`) "vestido" como mono: la piel se suaviza (Taubin) y se separa unos milímetros, con costuras,
  parche de misión y cinta con el ID como calcomanías (`DecalGeometry`). Manos y cabeza quedan con piel;
  el pelo es una capa simple. Son ilustraciones genéricas.
- `crew/data.js` → `LOOKS`: tono de piel, pelo, peinado y altura, rotando por posición en la lista.
- `crew/scene.js` (`CrewScene`): escena, anillo, arrastre, picking, aros del piso y anclas de pantalla. Expone
  `setCrew`, `setSelected`, `setReducedMotion`, `dispose`; en desarrollo queda en `window.__crewScene`.
- `crew/module.js`: interior de módulo de la ISS de una versión anterior (vista "Module", hoy fuera de uso). Sigue
  importado por la escena y oculto; se puede borrar en una limpieza.

## Cambios en otras partes del front

| Archivo | Cambio |
|---|---|
| `vite.config.js` | Entrada `crew` (`crew.html`) en el build |
| `vuelo/Shell.jsx` | Link "← All crew" a `crew.html?crew=<id>`; el selector usa `person()`; etiqueta de misión con `missionName()` |
| `vuelo/style.css` | Estilos de `.flight-back`, imagen en `.flight-avatar` (hoy sin uso), entrada con fundido de `.flight-content` |
| `summary/SummaryView.jsx` | La frase de "Mission status" usa `person(id).name` (hoy el ID, como antes) |

## Cómo probarla

Con la demo oficial (`bash scripts/demo.sh`): `http://127.0.0.1:5190/crew.html`.

Para ver 7 tripulantes: `python -m gravsim.serve --crew 7 --seed 219 --day 175 --speed 0 --fatigue CM-3:171:7 ...`
(`--fatigue` deja un aviso de sueño/HRV en CM-3 como ejemplo de "Check needed").

## Pendiente para integrar

1. **Entrada del sitio.** `/` sigue abriendo el overview. Decidir si `crew.html` pasa a ser la portada (o un link
   desde `index.html`) en el deploy.
2. **Roles en el backend.** Hoy los roles genéricos viven en el front (`data/roster.js`). Si el HealthService o el
   DataService los expusieran por tripulante, `person()` debería leerlos de ahí. Nombres, si alguna vez hacen falta,
   ficticios.
3. **Limpieza.** `crew/module.js` y el código de la vista "Module" en `scene.js` ya no se usan.
4. **Tamaño del bundle.** La página carga three.js y los GLB de anatomía; el build avisa de chunks > 500 kB.
