# Design system · GraviTal "Frosted glass" (claro)

Reglas del reestilizado del dashboard de tripulación (`src/front/sketch`). Todo lo que se toque en el front
sigue este documento. La referencia visual es el canvas de Claude Design
<https://claude.ai/artifact/75sgHM7bu3NScaEfTDiYKr>, página **v6 · Frosted (claro / oscuro)**, artboard
**Glass B · Frosted (claro)**. La versión oscura del mismo canvas es solo exploración: no se implementa todavía.

Los tokens y las clases viven en **`src/front/sketch/theme/glass.css`** (se importa una vez desde
`vuelo/main.jsx`). Una vista nunca redefine un color o un vidrio con valores sueltos: usa las variables.

---

## 1. Idea en una línea

Un fondo claro y vivo (manchas pastel difuminadas, puntos, órbitas y grano muy sutiles) y, encima, paneles de
**vidrio esmerilado neutro** tipo iOS: translúcidos, muy desenfocados, con un borde de luz arriba y radios
chicos. El color lo ponen los datos (estados, niveles, gráficos), nunca el fondo de las cards.

Lo que ya se probó y **no** va: cards de color sólido, una card de cada color (v5), cards oscuras sobre fondo
claro (v4), radios grandes (22px).

---

## 2. Tokens

### 2.1 Texto y acciones

| Token | Valor | Uso |
|---|---|---|
| `--ink-strong` | `#0E1630` | Títulos (h1, h2), marca |
| `--ink` | `#121A30` | Texto principal, números grandes |
| `--ink-2` | `#26324C` | Texto secundario, pestañas y controles inactivos |
| `--muted` | `#33405A` | Captions, unidades, labels de 11px. Es el gris **más claro permitido** para texto |
| `--link` / `--link-hover` | `#2238A8` / `#16257A` | Links y acciones de texto ("Open the mission plan →") |
| `--accent` | `#2F45C0` | Marca, rellenos de gráficos (con opacidad) |
| `--action` | `#17213D` | Fondo del botón primario (texto blanco). Uno por card como máximo |
| `--line` / `--line-soft` | `rgba(23,32,57,.12)` / `.08` | Divisores dentro de una card |

Contraste medido sobre el peor caso (vidrio sobre la mancha más oscura del fondo): `--ink` ≥ 10.5:1,
`--muted` ≥ 6.3:1, `--link` ≥ 5.8:1. Pasa WCAG AA. **No** usar grises más claros que `--muted` para texto.

### 2.2 Estados (chips, alertas, timeline)

Un estado siempre es **chip claro + punto de color + texto oscuro del mismo tono**. Nunca texto de color
claro sobre vidrio.

| Tono | Texto | Punto | Fondo | Borde | Cuándo |
|---|---|---|---|---|---|
| `ok` | `#145234` | `#23804F` | `rgba(255,255,255,.85)` | `#A9D8BB` | Sin cambio claro, dentro de la variación del test |
| `warn` | `#5C3600` | `#C27800` | `#FFE7B5` | `#EDBB5A` | "Check needed", cambio sostenido, revisión |
| `loss` | `#7A2E0B` | `#C2541F` | `rgba(255,255,255,.85)` | `#F0B595` | Pérdida moderada |
| `crit` | `#8C1D28` | `#A4242F` | `#FBE1E3` | `#E7A3AA` | Crítico, estándar NASA cruzado |
| `info` | `#1E2F86` | `#2F45C0` | `#CFD8FF` | `#A8B6F2` | Estudio, dato informativo |

- El ámbar (`warn`) es el color de "hay algo para mirar": no se usa como decoración.
- El rojo (`crit`) es solo para crítico.
- La caja de alerta dentro de una card usa `--warn-wash` (`rgba(255,231,181,.55)`) con borde `rgba(237,187,90,.6)`.

### 2.3 Escala de niveles (músculo)

Es `LEVEL_COLORS` de `fuerza/data.js` (verde → rojo, la luminosidad baja con la gravedad). Se usa en el modelo
3D, en las barras y en los puntos de la leyenda, **siempre con su texto** ("Moderate loss"), nunca solo color.
No se cambia en este reestilizado.

### 2.4 Tipos del plan de misión

| Tipo | Fondo | Texto | Borde |
|---|---|---|---|
| Review | `rgba(255,223,158,.9)` | `#5C3600` | `#EDBB5A` |
| Routine | `rgba(255,255,255,.8)` | `#1E2A46` | `#A9B5C8` |
| Study | `rgba(207,216,255,.9)` | `#1E2F86` | `#A8B6F2` |
| Treatment | `rgba(228,211,247,.9)` | `#4A2078` | `#C8AEE8` |

---

## 3. Vidrio (receta "Frosted")

| Token | Valor |
|---|---|
| `--r-card` | `12px` (cards) |
| `--r-sm` | `8px` (piezas chicas: callouts, leyendas, botones cuadrados, barras del timeline) |
| `--r-pill` | `999px` (pestañas, chips, botones redondos) |
| `--glass-bg` | `linear-gradient(160deg, rgba(255,255,255,.62), rgba(255,255,255,.40))` |
| `--glass-filter` | `blur(36px) saturate(150%)` |
| `--glass-ring` | `linear-gradient(180deg, rgba(255,255,255,.95), rgba(255,255,255,.45))` (borde de 1px) |
| `--glass-shadow` | `inset 0 1px 0 rgba(255,255,255,.9), 0 6px 20px -10px rgba(28,48,90,.22)` |
| `--glass-sm-bg` | `rgba(255,255,255,.66)` |
| `--glass-sm-shadow` | `0 4px 14px -8px rgba(28,48,90,.28)` |
| `--tabs-bg` | `rgba(255,255,255,.5)` |
| `--tab-on-bg` / `--tab-on-shadow` | `#FFFFFF` / `0 2px 8px -2px rgba(28,48,90,.3)` |
| `--seg-bg` | `rgba(23,32,57,.06)` |
| `--bar-bg` | `rgba(255,255,255,.45)` (header) |

El borde de luz se dibuja con un `::before` enmascarado (gradiente de blanco fuerte arriba a blanco tenue
abajo), no con `border`. Por eso los elementos de vidrio llevan `position: relative; isolation: isolate`.

### Clases

| Clase | Qué es |
|---|---|
| `.glass` | Card / panel. Radio `--r-card`, padding 18–22px |
| `.glass-sm` | Pieza flotante chica: callouts del cuerpo, leyenda, pills, título del mapa |
| `.glass-bar` | Header pegajoso |
| `.glass-tabs` + `[aria-selected=true]` | Selector de pestañas: cápsula de vidrio; la activa es una "lente" blanca |
| `.seg` + `[aria-pressed=true]` | Control segmentado (Internal/Surface, Front/Back, comparaciones) |
| `.chip` + `data-tone="ok|warn|loss|crit|info"` | Chip de estado de la tabla 2.2 |
| `.btn-primary` | Botón primario (`--action`, texto blanco, pill, alto ≥ 36px) |
| `.btn-link` | Acción de texto (`--link`, 600, alto táctil ≥ 44px) |
| `.num` | Números: Chakra Petch 500, `tabular-nums` |

### Accesibilidad del vidrio

- `@media (prefers-reduced-transparency: reduce)` y `@supports not (backdrop-filter: …)`: el vidrio pasa a
  sólido `#F4F7FB` con borde `#D5DEE8`, sin blur.
- Nada de texto directamente sobre el fondo con manchas salvo títulos de página (`--ink-strong`).

---

## 4. Fondo y texturas

Va una sola vez en el Shell (`vuelo/Backdrop.jsx`), fijo detrás de todo (`position: fixed`, `z-index: 0`,
`pointer-events: none`, `aria-hidden`). Capas, de abajo hacia arriba:

1. Base: `linear-gradient(160deg, #D9E4EF 0%, #E6EDF4 50%, #D3E0EB 100%)` + un brillo blanco central.
2. Manchas pastel con `filter: blur(70px)`, opacidad .6–.75: azul `#9EBCE6` (izquierda), aqua `#A4D6D2`,
   lila `#C3B8EC` (arriba derecha), durazno `#F4CDB4` (derecha, .6), azul lavanda `#B7C6EE` (abajo).
   Son lo que el vidrio refracta; no oscurecerlas (el contraste del punto 2.1 se calculó con estas).
3. Campo de puntos: `radial-gradient(rgba(40,64,104,.2) 1px, transparent 1.5px)` cada 26px, enmascarado a una
   elipse central (se desvanece hacia los bordes).
4. Órbitas: 2–3 elipses blancas de 1px rotadas −14°, opacidad .45–.7, `blur(.6px)`.
5. Grano: `feTurbulence` (fractalNoise .85) en gris, opacidad .07, `mix-blend-mode: multiply`.

Todo sutil: si una textura se nota antes que los datos, está de más.

---

## 5. Tipografía

- **Chakra Petch** (OFL, autoalojada en `fonts/`, pesos 400/500/600/700) para todo: texto y números.
  Reemplaza a Chivo + Barlow Semi Condensed. Bitcount queda solo donde ya estaba en el simulador del reloj.
- Escala:

| Rol | Tamaño / peso |
|---|---|
| Título de página (h1) | 30px / 600 (26px en mobile) |
| Título de card (h2) | 15–17px / 600 |
| Eyebrow ("MISSION STATUS") | 11px / 600, mayúsculas, `letter-spacing: .12em`, `--muted` |
| Texto | 13–14px / 400, `line-height` 1.45 |
| Caption | 11–12px, `--muted`. **Mínimo 11px** |
| Número grande (KPI) | 42px / 500 desktop, 30–34px mobile, `line-height: 1` |
| Número de lista | 17–20px / 500 |

---

## 6. Componentes

- **Card de indicador** (Aerobic, Strength): ícono en cuadradito de 28px (radio 8) con un tinte suave del
  tema del dato, título 13px/600, flecha ↗ a la derecha, número grande + unidad, sparkline de 100×40 a la
  derecha, chip de estado + texto de comparación abajo. Toda la card es el link.
- **Lista de grupos musculares**: filas de 44px mínimo: nombre (13/600) + nivel (11, `--muted`), barra de 8px
  sobre `rgba(255,255,255,.5)`, valor a la derecha (17px `.num`). Hover `rgba(255,255,255,.32)`.
- **Mapa del cuerpo**: va **sin card**, directo sobre el fondo, con un halo blanco radial detrás. Título,
  controles segmentados, leyenda y callouts son `.glass-sm`. El callout seleccionado lleva `outline: 2px solid
  var(--link)`. Las líneas de los callouts usan `--muted`.
- **Mission status**: eyebrow + chip de estado, una frase de 20px/600, y la caja de alerta (`--warn-wash`) con
  ícono, título, texto y acciones (`.btn-primary` + `.btn-link`).
- **Wearable · today**: número grande + chip, gráfico de FC del día sobre `rgba(255,255,255,.4)` con bandas de
  sueño (lila 14%) y ejercicio (verde 18%), y una grilla 2×2 de lecturas (`dt` 11px `--muted`, `dd` 20px `.num`).
- **Mission schedule**: timeline de 7 días (columna "TODAY" tintada `rgba(255,255,255,.32)`), chip de tipo de
  78px, barras con los colores de 2.4 y radio `--r-sm`.
- **Gráficos (recharts)**: línea principal `--link` 2–2.5px; fuerza `#B24A18`; relleno de área 14%; grilla
  `--line-soft`; ticks 11–13px `--muted`; tooltip = `.glass-sm`.

---

## 7. Layout

- Contenedor `max-width: 1440px`, padding horizontal 40px (16px en mobile), gaps de 16px entre cards y 24px
  entre columnas.
- **Overview desktop**: grilla `300px | 1fr | 348px`. Izquierda: Aerobic, Strength, Muscle groups. Centro: el
  cuerpo. Derecha: Mission status, Wearable. Abajo a todo el ancho: Mission schedule.
- ≤1180px: el cuerpo y la columna derecha arriba, las tres cards de la izquierda en fila abajo.
- ≤760px: una columna en este orden: status, cuerpo, indicadores, músculos, wearable, schedule. Las pestañas
  muestran solo íconos o pasan a grilla; el timeline scrollea dentro de su card.
- Objetivos táctiles ≥ 44px (pestañas 38px dentro de una cápsula de 46px).

---

## 8. Checklist antes de dar una vista por terminada

- [ ] Ninguna card con color sólido ni con un color propio: todas `.glass`.
- [ ] Radios: 12 cards, 8 piezas chicas, pill en pestañas/chips.
- [ ] Ningún hex suelto que no salga de estas tablas; los estados usan `.chip` / tokens.
- [ ] Texto ≥ 11px y nunca más claro que `--muted`.
- [ ] Chakra Petch en todo; números con `.num`.
- [ ] Funciona a 1440, 1180, 760 y 390px de ancho, sin scroll horizontal.
- [ ] Con `prefers-reduced-transparency` se ve sólido y legible.
- [ ] Focus visible (`outline: 3px solid var(--link)`), botones reales, nada clickeable en un `div`.

---

## 9. Logo

La marca es la variante **B3 · Superficie de gravedad** con corazón, que eligió el equipo en el canvas de
diseño (página "Logo · GraviTal"). La línea gruesa es el cuerpo, que se hunde en un pozo de gravedad; el
corazón queda en el fondo, y las líneas finas de abajo son la superficie del espacio-tiempo deformada.

| Dónde | Archivo | Colores |
|---|---|---|
| Header (dashboard, simulador de alertas) | `Brand()` / `BrandMark()` en `vuelo/Icons.jsx` | `--brand-ink` (= `--ink-strong`), `--brand-heart` (= `--accent`), `--brand-field` `#9AA8E0` |
| Favicon de todas las páginas | `public/favicon.svg` | Tile `#0E1630`; línea `#EEF2FF`, corazón `#8C9EFF`, líneas finas blancas al 40 % |

- La marca va siempre con sus tres piezas; no se recolorea con los tonos de estado.
- En el header se usa a 36px junto a "GraviTal" en Chakra Petch 700. Por debajo de 24px las líneas finas
  casi no se ven: para tamaños chicos se usa el favicon (sobre tile oscuro, líneas finas más gruesas).
- No usar elementos del logo de la NASA (esfera, órbita roja, "worm") junto a la marca.
- El logo se hizo con asistencia de IA (Claude): declararlo en el campo de uso de IA de la entrega.
