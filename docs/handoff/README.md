# Traspasos de "Mediciones en vuelo"

Notas para los agentes y personas responsables de cada parte del sistema. Salen del diseño de las vistas de análisis en vuelo (rama `Feat/muscle-strength-view`, mergeada a `main`). Cada nota dice **qué** cambiar, **por qué** y **cómo** proponemos hacerlo; la implementación queda a criterio de quien es dueño de esa parte.

| Documento | Para | Estado |
|---|---|---|
| [dataservice.md](dataservice.md) | DataService y generador (`sim/`, en `main` desde el PR #7) | Pendiente de revisión por el dueño |
| [frontend.md](frontend.md) | Frontend (`src/front/`) y HealthService (PR #8), que arma el JSON del dashboard | Pendiente de revisión por los dueños |

## Análisis cubiertos hasta ahora

| Pestaña | Métrica | Referencia | Prototipo |
|---|---|---|---|
| Fuerza muscular | Torque máximo (N·m) y % de cambio, 6 grupos | NLSP MR079G, CFT70 | `src/front/sketch/fuerza/` |
| Capacidad aeróbica | VO₂pico (ml/kg/min) y % de cambio | NLSP MR080G, CFT70 | `src/front/sketch/aerobica/` |

Para verlo: `cd src/front/sketch && npx vite` y abrir `/vuelo.html` (`#fuerza` o `#aerobica`).

Se actualiza a medida que se suman análisis (próximos de la lista "a bordo": masa corporal, examen ocular, ecografía venosa, sangre y orina, sueño).
