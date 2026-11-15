# Traspasos de "Mediciones en vuelo"

Notas para los agentes y personas responsables de cada parte del sistema. Salen del diseño de las vistas de análisis en vuelo (rama `Feat/muscle-strength-view` de Tomás; se mergeó a `main` y se revirtió). La integración con el HealthService está en la rama `feat/flight-measurements`, sobre ese commit. Cada nota dice **qué** cambiar, **por qué** y **cómo** proponemos hacerlo; la implementación queda a criterio de quien es dueño de esa parte.

| Documento | Para | Estado |
|---|---|---|
| [planner-y-reloj.md](planner-y-reloj.md) | Todo el equipo: contexto del Planner, las pestañas Health summary, Mission plan y Vital signs, y el reloj | Hecho y en `main` (15/11); pendientes en su §7 |
| [dataservice.md](dataservice.md) | DataService y generador (`sim/`, en `main` desde el PR #7) | Pendientes: datos de validez del test en bicicleta, `method`, referencia por endpoint, calendario |
| [frontend.md](frontend.md) | Frontend (`src/front/`) y HealthService, que arma el JSON | Pedido al HealthService resuelto (`GET /api/v1/analyses`); quedan detalles del front |

## Análisis cubiertos hasta ahora

| Pestaña | Métrica | Referencia | Prototipo |
|---|---|---|---|
| Muscle strength | Torque máximo (N·m) y % de cambio, 5 grupos (la flexión de tronco queda afuera, como en el dashboard) | NLSP MR079G, CFT70 | `src/front/sketch/fuerza/` |
| Aerobic capacity | VO₂pico (ml/kg/min) y % de cambio, mínimo NASA 32,9 | NLSP MR080G, CFT70 | `src/front/sketch/aerobica/` |
| Vital signs | Signos del reloj (FC en reposo, presión, SpO₂, HRV, sueño) contra las dos últimas semanas de la persona | Banda personal; sueño en vuelo de Barger 2014 | `src/front/sketch/vitals/` |
| Mission plan | Plan de controles de OCHMO-STD-100.1A (Tabla 8) | La norma, con cada cita verificada contra el PDF | `src/front/sketch/plan/` |

Para verlo: `bash scripts/demo.sh` ([guía](../guia-demo.md)), o levantar cada servicio como dice el [README](../../README.md) y abrir `/vuelo.html?crew=CM-1` (`#fuerza` o `#aerobica`), o el link "Flight measurements" de la página principal. Sin backend: `VITE_DASHBOARD_MODE=example npm run dev`. La página está en inglés, como GraviTal.

Se actualiza a medida que se suman análisis (próximos de la lista "a bordo": masa corporal, examen ocular, ecografía venosa, sangre y orina, sueño).
