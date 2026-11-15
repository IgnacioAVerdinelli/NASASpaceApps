# Traspasos de "Mediciones en vuelo"

Notas para los agentes y personas responsables de cada parte del sistema. Salen del diseño de las vistas de análisis en vuelo (rama `Feat/muscle-strength-view` de Tomás; se mergeó a `main` y se revirtió). La integración con el HealthService está en la rama `feat/flight-measurements`, sobre ese commit. Cada nota dice **qué** cambiar, **por qué** y **cómo** proponemos hacerlo; la implementación queda a criterio de quien es dueño de esa parte.

| Documento | Para | Estado |
|---|---|---|
| [dataservice.md](dataservice.md) | DataService y generador (`sim/`, en `main` desde el PR #7) | Pendientes: datos de validez del test en bicicleta, `method`, referencia por endpoint, calendario |
| [frontend.md](frontend.md) | Frontend (`src/front/`) y HealthService, que arma el JSON | Pedido al HealthService resuelto (`GET /api/v1/analyses`); quedan detalles del front |

## Análisis cubiertos hasta ahora

| Pestaña | Métrica | Referencia | Prototipo |
|---|---|---|---|
| Muscle strength | Torque máximo (N·m) y % de cambio, 5 grupos (la flexión de tronco queda afuera, como en el dashboard) | NLSP MR079G, CFT70 | `src/front/sketch/fuerza/` |
| Aerobic capacity | VO₂pico (ml/kg/min) y % de cambio, mínimo NASA 32,9 | NLSP MR080G, CFT70 | `src/front/sketch/aerobica/` |

Para verlo: levantar DataService, HealthService y Vite como dice el [README](../../README.md) y abrir `/vuelo.html?crew=CM-1` (`#fuerza` o `#aerobica`), o el link "Flight measurements" de la página principal. Sin backend: `VITE_DASHBOARD_MODE=example npm run dev`. La página está en inglés, como Trama.

Se actualiza a medida que se suman análisis (próximos de la lista "a bordo": masa corporal, examen ocular, ecografía venosa, sangre y orina, sueño).
