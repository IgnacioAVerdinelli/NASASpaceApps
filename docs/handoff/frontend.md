# Traspaso para el frontend y el HealthService

Para:
- el dueño del **frontend** (`src/front/`);
- el dueño del **HealthService** (`health/`), que arma el JSON que consume el frontend.

Desde: diseño de las pestañas "Mediciones en vuelo". Actualizado: 2026-11-14.

**Estado (14/11/2026, rama `feat/flight-measurements`):** la página ya no usa datos fijos. Lee `GET /api/v1/analyses` del HealthService con el mismo esquema de sondeo, validación y avisos que GraviTal, y elige tripulante igual. El pedido del punto 2 está resuelto con un contrato propio, documentado en [frontend-backend.md](../frontend-backend.md#mediciones-en-vuelo-get-apiv1analyses). Del punto 3 quedan el 5 y parte del 6.

**Estilo visual (15/11/2026, rama `codex/rediseno-dashboard`):** todo el front sigue el [design system "Frosted glass"](../design-system.md): tokens, vidrio, fondo, tipografía (Chakra Petch) y layout del Overview. Antes de tocar estilos, leerlo.

Lo que sigue explica qué se agregó, qué faltaba para integrarlo al sistema real, por qué y cómo se resolvió.

## 1. Qué hay en la página (rama `Feat/muscle-strength-view`, integrada en `feat/flight-measurements`)

| Archivo | Qué es |
|---|---|
| `src/front/sketch/vuelo.html`, `vuelo/Shell.jsx`, `vuelo/style.css` | Página "Mediciones en vuelo": header compacto y fijo con datos de la misión, más una barra de pestañas accesible (flechas, Home y End). La pestaña activa va en la URL (`#fuerza`, `#aerobica`). Las pestañas inactivas quedan montadas y ocultas, así que no se recarga el modelo 3D y se conserva el estado. |
| `src/front/sketch/fuerza/` | Pestaña de fuerza: mapa 3D por grupo muscular, escala de cuatro niveles, línea de tiempo con las próximas pruebas, detalle con la banda de ruido y referencia CFT70. `fuerza.html` se eliminó; la pestaña se abre desde `/#fuerza` o `vuelo.html#fuerza`. |
| `src/front/sketch/aerobica/` | Pestaña de capacidad aeróbica: VO₂pico, órganos en 3D, trayectoria con la banda de ruido, la línea de −20 % y el mínimo NASA, alerta, referencia CFT70 y validez de la prueba ("Not recorded" hasta que el DataService guarde esos datos). |
| `src/front/sketch/data/analyses.js`, `analyses.example.json` | Carga y valida `GET /api/v1/analyses`; el ejemplo es CM-1 de la demo en el día 170. |
| `src/front/sketch/data/cft70-reference.json`, `cft70-aerobic-reference.json` | Referencias de CFT70, generadas por `scripts/build-cft70-*.py`. |

### Cambios en el visor del equipo (`src/front/body-3d/`), todos opcionales y retrocompatibles

| Prop o cambio | Qué hace | Por qué |
|---|---|---|
| `colorScale(score) → THREE.Color` | Reemplaza la paleta de intensidad | Fuerza usa una escala ordinal de verde a rojo por nivel, no 0–100 |
| `indicatorText(key, value) → {name, value}` | Texto de las etiquetas 3D | Mostrar el nombre del grupo y el % real, no el score |
| `layer="organs"` + `structureColors {clave: color}` | Piel translúcida, con los órganos, vasos y músculos pedidos adentro (claves del modelo: `heart`, `lung_l`, `aorta`, `arteries_leg_l`, `quadriceps_l`…). Clic y zoom funcionan igual que en las otras capas | La capacidad aeróbica no es de una región: depende del corazón, la sangre, los músculos y los pulmones |
| `indicators.js` mide las etiquetas con el `font-size` real | Las etiquetas pueden agrandarse por CSS sin cortarse | Pedido de letras más grandes |
| `anatomy.js → visibleSystems('organs')` | Nueva capa | Ídem |

Las animaciones de cámara e indicadores son las de `main` sin cambios. Para que se vean suaves hay que llamar a `explorationRequest` con la clave exacta tocada, y no hacer renders pesados en el mismo cuadro: en el prototipo los gráficos se actualizan 550 ms después de elegir un grupo.

## 2. Pedido al HealthService: un JSON por análisis (resuelto)

**Resuelto** con `GET /api/v1/analyses` ([contrato](../frontend-backend.md#mediciones-en-vuelo-get-apiv1analyses)). Diferencias con la propuesta de abajo:

- Es un endpoint aparte, versión 1, en vez de un contrato v2 del dashboard: el dashboard de GraviTal no cambia.
- Nivel 4 también cuando VO₂pico está debajo del mínimo de NASA (32,9). Los cortes son sobre "% peor", así que valen para medidas que bajan o suben.
- Cada prueba trae `withinNoise`: si su cambio cabe en el ruido de un solo test. Con 8–12 % de ruido por test del dinamómetro, una prueba sola puede caer en nivel 3 o 4 por ruido; la página lo aclara ("within test noise") y dibuja la banda real de cada medida en vez de un ±5 % fijo.
- Cada análisis trae su `alert` (la misma que va a la cola). VO₂pico tiene una regla nueva, crítica: el estándar de NASA (promedio de las dos últimas pruebas 20 % abajo o debajo de 32,9).
- `upcoming` sale de los estudios que agenda el planificador de la demo, con `reason` `routine` o `retest`.
- `test` (FC, RER, Borg, motivo de corte, `method`) va siempre `null` hasta que el DataService lo guarde ([dataservice.md](dataservice.md), pedidos 1 y 2).
- Fuerza tiene 5 grupos: la flexión de tronco queda afuera, como en el dashboard, porque sus datos de reposo en cama van al revés.

La propuesta original, como referencia:

**Qué:** el contrato v1 (`docs/frontend-backend.md`) solo describe el mapa muscular (`body`, `summary`, `charts`). Las pestañas necesitan, por cada análisis, las evaluaciones con sus valores, el nivel y la referencia.

**Por qué:**
- Hoy esos datos están fijos en `fuerza/data.js` y `aerobica/data.js`.
- El **nivel** (sin cambio, leve, moderado, supera −20 %) es una clasificación con consecuencias clínicas: debería calcularla el HealthService, para que la vista y las alertas usen exactamente el mismo criterio. El frontend solo traduce nivel → color.

**Cómo (propuesta para un contrato v2; los nombres son orientativos):**

```json
{
  "version": 2,
  "crew": { "id": "CM-2", "missionDays": 180, "today": 112, "simulated": true },
  "analyses": {
    "strength": {
      "evaluations": [{ "id": "fd105", "day": 105, "label": "FD 105" }],
      "upcoming": [{ "day": 135, "label": "FD 135" }],
      "groups": [{
        "key": "quadriceps", "name": "Cuádriceps", "muscleKeys": ["quadriceps_l", "quadriceps_r"],
        "test": "KES60", "unit": "N·m", "baseline": 212,
        "points": [{ "evaluation": "fd105", "value": 194, "changePct": -8.4, "level": 2 }]
      }],
      "referenceId": "cft70-strength"
    },
    "aerobic": {
      "unit": "ml/kg/min", "baseline": 41.5, "nasaFloor": 32.9,
      "evaluations": [{
        "id": "fd75", "day": 75, "label": "FD 75", "value": 38.1, "changePct": -8.2, "level": 2,
        "test": { "hrPeak": 183, "rerPeak": 1.16, "workloadW": 225, "rpePeak": 18, "termination": "Fatiga general", "method": "measured", "maximal": true }
      }],
      "upcoming": [{ "day": 165, "label": "FD 165" }, { "day": 166, "label": "R−14" }],
      "referenceId": "cft70-aerobic"
    }
  }
}
```

- `level`: 1 = cambio > −5 %; 2 = entre −5 y −10 %; 3 = entre −10 y −20 %; 4 = −20 % o más (umbral de Scott y col. 2023, NASA). Igual para fuerza y VO₂pico.
- `test.maximal`: RER ≥ 1,1 y Borg ≥ 17. Si es `false`, la vista debería avisar que el VO₂pico puede estar subestimado.
- `test.method`: `measured` (gases) o `estimated` (FC). El DataService todavía no lo produce: ver [dataservice.md](dataservice.md), pedidos 1 y 2.
- Referencias: mientras el DataService no las exponga, el frontend sigue usando los JSON estáticos.

## 3. Pendientes del frontend (a criterio del dueño)

1. ~~**Integrar al dashboard real.**~~ Hecho: `vuelo/Shell.jsx` usa `useDashboard`, `VITE_DASHBOARD_MODE` y `VITE_DASHBOARD_URL` como `src.jsx`, con selector de tripulante.
2. ~~**Build.**~~ Hecho: `vite.config.js` compila `vuelo.html`; `fuerza.html` se borró.
3. ~~**Idioma.**~~ Inglés, como GraviTal.
4. ~~**Pestañas y página principal.**~~ Página aparte, con links en los dos sentidos que conservan el tripulante (`?crew=`).
5. **Etiquetas 3D al volver a una pestaña:** al mostrar un visor que estaba oculto, una etiqueta puede deslizarse desde la esquina durante menos de un segundo. Propuesta: limpiar `display` en `indicators.js` cuando el contenedor vuelve a tener tamaño, para que la primera posición no se anime.
6. **Tests:** `tests/analyses.test.mjs` cubre el validador y la carga de `analyses`. Siguen sin casos `colorScale`, `indicatorText`, `structureColors` y la capa `organs`.
7. **Escalas de color:**
   - Estado (fuerza y VO₂pico): `#8fcca5`, `#d7a12a`, `#d1602b`, `#a4242f`. Luminosidad decreciente, siempre con etiqueta de texto y un ícono en el nivel 4.
   - Identidad de los órganos: `#c2417a` corazón, `#7a5cc4` sangre y vasos, `#0f8a6f` músculo, `#4a90d9` pulmones.
   - Ambas paletas pasaron el validador de daltonismo de la skill dataviz. No reutilizar los colores de estado como colores de serie.

## 4. Decisiones de diseño tomadas con el usuario

- Tono de análisis serio "de NASA", sin títulos de marketing.
- Fuerza: método en vuelo propuesto = dinamómetro tipo MARES (hoy NASA no mide fuerza en vuelo de forma rutinaria). Cinco grupos (la flexión de tronco queda afuera); ambos lados con el mismo valor.
- VO₂pico: cifra principal en ml/kg/min con el % de cambio al lado; trayectoria como protagonista; órganos en 3D dentro del cuerpo.
- Referencia de ambos análisis: CFT70 (mismo estudio, mismos tres grupos).
