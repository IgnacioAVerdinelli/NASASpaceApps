# Selección de tripulante (`/crew.html`)

Página previa al **Health overview**: muestra a toda la tripulación, deja elegir a una persona y abre su overview
(`/vuelo.html?crew=<id>#summary`). Está en inglés, como el resto de GraviTal.

## Qué se ve

En una sola vista, sin scroll en una pantalla de escritorio:

- **Izquierda: carrusel 3D.** Los tripulantes están de pie sobre un anillo. El elegido queda adelante, centrado y
  con un aro azul en el piso; dos vecinos a cada lado se van alejando y el resto queda oculto atrás. Se gira:
  - arrastrando la escena (mouse o dedo); al soltar queda elegido el que terminó adelante;
  - con las flechas ‹ › a los costados o ← → del teclado;
  - con la **tira de retratos** de abajo (foto, apellido y un punto con el estado), que salta directo a cualquiera.

  Clic en un vecino: el anillo gira hasta traerlo adelante. Clic en el de adelante: abre su overview.
- **Derecha: card compacta del elegido.** Foto, nombre, rol y agencia; chip de estado con el título del aviso
  principal; VO₂peak, mayor pérdida muscular y FC en reposo; los 3 signos vitales del reloj más relevantes (alterados
  primero, con el tono del overview); lo próximo del plan; botones **Open health overview** y **Mission plan**.
  El resto del detalle queda en el overview.
- **Arriba:** título "Crew aboard", conteo por estado (`action needed` / `check needed` / `no alerts`) y la misión
  ("ISS · Expedition 75", día de misión del simulador).

Por debajo de ~980 px de ancho, la card pasa debajo del carrusel.

### Animaciones

Siempre activas (decisión de producto: no siguen `prefers-reduced-motion`).

- El anillo se mueve con un resorte críticamente amortiguado: arranca suave, se desliza y frena sin rebote. Las
  figuras se inclinan un poco con la velocidad del giro.
- La card entra deslizándose desde el lado hacia el que giró el anillo; encabezado, estado, números y vitales
  aparecen escalonados; los números cuentan desde cero.
- En la tira, una pastilla se desliza hasta el retrato elegido.
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

## Roster de ejemplo (`data/roster.js`)

Los IDs simulados (`CM-1`…`CM-7`) se muestran con los nombres, roles y retratos de la tripulación de la
**ISS Expedición 75** (noviembre de 2026), solo como ejemplo. **Ningún dato de salud es de ellos**; el pie de la
página lo aclara.

| ID | Nombre | Rol | Agencia | Llegó |
|---|---|---|---|---|
| CM-1 | Pyotr Dubrov | Expedition 75 commander | Roscosmos | Soyuz MS-29, 14 jul 2026 |
| CM-2 | Anna Kikina | Flight engineer | Roscosmos | Soyuz MS-29, 14 jul 2026 |
| CM-3 | Anil Menon | Flight engineer | NASA | Soyuz MS-29, 14 jul 2026 |
| CM-4 | Jessica Watkins | Crew-13 commander | NASA | SpaceX Crew-13, 1 oct 2026 |
| CM-5 | Luke Delaney | Crew-13 pilot | NASA | SpaceX Crew-13, 1 oct 2026 |
| CM-6 | Joshua Kutryk | Mission specialist | CSA | SpaceX Crew-13, 1 oct 2026 |
| CM-7 | Sergey Teteryatnikov | Mission specialist | Roscosmos | SpaceX Crew-13, 1 oct 2026 |

- `person(id)` devuelve `{ id, name, role, agency, vehicle, aboardSince, photo }`; un ID desconocido cae en el ID
  mismo, sin foto.
- `MISSION.name` es la etiqueta de la barra superior ("ISS · Expedition 75"), en esta página y en el overview.
- Retratos: fotos oficiales de NASA, dominio público (vía Wikimedia Commons), 330 px, en `crew/photos/`.
- Fuentes: [NASA – Crew-13](https://www.nasa.gov/news-release/nasa-shares-spacex-crew-13-assignments-for-space-station-mission/),
  [Space.com – Soyuz MS-29](https://www.space.com/space-exploration/launches-spacecraft/soyuz-ms-29-astronaut-launch-international-space-station-anil-menon).

**Trajes:** todos usan el mismo mono IVA azul. No hay un color oficial por agencia dentro de la estación (los trajes
de lanzamiento Sokol y de SpaceX son blancos para todos), así que no se diferencian por agencia.

## Figuras 3D

- `crew/astronaut.js`: cada figura es el cuerpo de `open-anatomy-3d` (masculino o femenino según
  `analyses.crew.body`) "vestido" como mono: la piel se suaviza (Taubin) y se separa unos milímetros, con costuras,
  parche de misión y cinta con el apellido como calcomanías (`DecalGeometry`). Manos y cabeza quedan con piel;
  el pelo es una capa simple. Son ilustraciones, **no parecidos** a las personas reales.
- `crew/data.js` → `LOOK_BY_ID`: tono de piel, pelo, peinado, altura y cinta de cada ID del roster.
- `crew/scene.js` (`CrewScene`): escena, anillo, arrastre, picking, aros del piso y anclas de pantalla. Expone
  `setCrew`, `setSelected`, `setReducedMotion`, `dispose`; en desarrollo queda en `window.__crewScene`.
- `crew/module.js`: interior de módulo de la ISS de una versión anterior (vista "Module", hoy fuera de uso). Sigue
  importado por la escena y oculto; se puede borrar en una limpieza.

## Cambios en otras partes del front

| Archivo | Cambio |
|---|---|
| `vite.config.js` | Entrada `crew` (`crew.html`) en el build |
| `vuelo/Shell.jsx` | Link "← All crew" a `crew.html?crew=<id>`; retrato y nombre en el selector de tripulante; etiqueta de misión desde `MISSION` |
| `vuelo/style.css` | Estilos de `.flight-back`, retrato en `.flight-avatar`, entrada con fundido de `.flight-content` |
| `summary/SummaryView.jsx` | La frase de "Mission status" usa el nombre de pila ("Jessica, …") en vez del ID |

## Cómo probarla

Con la demo oficial (`bash scripts/demo.sh`): `http://127.0.0.1:5190/crew.html`.

Para ver a los 7 del roster con el cuerpo que corresponde a cada uno, levantar el simulador con:

```bash
python -m gravsim.serve --crew 7 --seed 219 --day 175 --speed 0 --fatigue CM-3:171:7 ...
```

`--seed 219` es la semilla que da cuerpo femenino justo a CM-2 (Kikina) y CM-4 (Watkins). `--fatigue` deja un aviso
de sueño/HRV en CM-3 (Menon) como ejemplo de "Check needed".

## Pendiente para integrar

1. **Entrada del sitio.** `/` sigue abriendo el overview. Decidir si `crew.html` pasa a ser la portada (o un link
   desde `index.html`) en el deploy.
2. **Demo oficial con 5 tripulantes.** `scripts/demo.sh` usa `--demo-cases` (5 personas, cuerpos M F M M M). Con
   el roster actual, CM-4 (Jessica Watkins) aparece con cuerpo masculino. Opciones: reordenar el roster para esa
   demo, pasar los casos a 7 personas, o que el roster declare el cuerpo y el front lo use solo para la figura.
3. **Roster en el backend.** Hoy los nombres viven en el front (`data/roster.js`). Si el HealthService o el
   DataService expusieran nombre/rol/foto por tripulante, `person()` debería leerlos de ahí.
4. **Día de misión.** El encabezado muestra el día del simulador (p. ej. FD176/180), no los días reales a bordo de
   cada persona del roster.
5. **Limpieza.** `crew/module.js` y el código de la vista "Module" en `scene.js` ya no se usan.
6. **Tamaño del bundle.** La página carga three.js y los GLB de anatomía; el build avisa de chunks > 500 kB.
