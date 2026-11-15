# Contexto: Planner, vistas de la tripulación y reloj

Qué se construyó entre el 14 y el 15/11/2026, por qué, dónde está y qué queda pendiente. Sirve para retomar el trabajo, persona o agente. Para correrlo: [guia-demo.md](../guia-demo.md).

## 1. Resumen

| Parte | Qué es | Diseño y contrato | Código |
|---|---|---|---|
| **Planner** | Arma el plan de cada tripulante con la norma médica de la NASA: estudios de rutina, retests y revisiones | [planner.md](../planner.md) | `planner/` (puerto 3001) |
| **Mission plan** | Pestaña del plan: qué hacer ahora, guía paso a paso, marcar como hecho | [planner.md](../planner.md), §5 y §7 | `src/front/sketch/plan/` |
| **Health summary** | Tablero general: estado y alarmas, cuerpo 3D, indicadores clave, tareas | [frontend-backend.md](../frontend-backend.md) | `src/front/sketch/summary/` |
| **Reloj (capa 1)** | Signos diarios y FC cada 15 min, comparados con las dos últimas semanas de la persona | [wearable.md](../wearable.md) | `sim/` (instrumento `Watch`), `health/healthservice/vitals.py`, `src/front/sketch/vitals/` |

Todo está en `main`. Las ramas, todas mergeadas: `feat/planner` (PR #17), `feat/plan-view`, `feat/wearable-data`, `feat/vitals-analysis`, `feat/vitals-planner` y `feat/vitals-view`.

## 2. La norma: qué podemos decir y qué no

- **La base es OCHMO-STD-100.1A Rev. A (09/09/2024)**, la norma médica vigente de la NASA. No existe una Rev. B. Su Sección 6 (Tabla 8) es el calendario de controles de una misión.
- **Su origen:** según sus autores (Coffey y col., OCHMO, 2025), la Rev. A *"added Mission Medical Evaluations (MED B) at an Agency level"*. O sea, es la versión de la NASA del documento internacional de la ISS (SSP 50667 MED Vol. B), que no es público.
- **Los calendarios son ejemplos:** la norma dice *"for example only"* y los basa en misiones de 180 días en la ISS. Para otra misión se adaptan.
- **Cómo decirlo en el pitch:** "seguimos la norma médica de misión de la NASA, con su calendario de ejemplo para la ISS". No decir "es el protocolo exacto de la ISS".
- **Para Marte,** la propia NASA dice que los criterios actuales vienen de la órbita baja y habrá que revisarlos. Es un buen argumento para nuestra propuesta.

## 3. Cómo funciona

```
gravsim (DataService) ──lecturas──▶ HealthService ──hallazgos──▶ Planner ──plan──▶ página
       ▲                               │  capa 2: pruebas (fuerza, VO2, hueso)       │
       │                               │  capa 1: reloj (signos diarios, FC 15 min)  │
       └─── retests que agenda el Planner (--run-booked) ◀──────────────────────────┘
```

- **Capa 2, las pruebas periódicas:** el HealthService compara cada prueba con la referencia previa al vuelo y con los estudios de reposo en cama (`alerts.py`, `findings.py`, de Valen). Un hallazgo sospechado hace que el Planner agende un retest; uno confirmado, una revisión.
- **Capa 1, el reloj:** `vitals.py` compara cada signo diario con la banda personal de la persona: mediana ± 2 desvíos robustos de los 14 días anteriores a los últimos 3. Un desvío es el promedio de los últimos 3 días fuera de 2,5 desvíos de un promedio de 3 días, con los 3 días del lado malo. Genera un hallazgo con `source: watch` y el Planner agenda una revisión del médico de vuelo.
- **El Planner** lee 21 rutinas transcritas de la Tabla 8. Un test verifica cada cita contra el texto del PDF en su página (`docs/references/*.txt`). Cada rutina se cierra:
  - sola, cuando llegan las lecturas de su instrumento (dinamómetro, DXA, cicloergómetro, traje, reloj para el registro de sueño);
  - o a mano, por la tripulación (`POST /api/v1/plan/{id}/status`).

## 4. Endpoints nuevos

| Servicio | Endpoint | Qué devuelve |
|---|---|---|
| Planner | `GET /api/v1/plan?crew=` | El plan completo (unas 330 tareas en una misión de 180 días) |
| Planner | `GET /api/v1/plan/today?crew=` | Lo abierto y lo de los próximos 7 días |
| Planner | `POST /api/v1/plan/{id}/status?crew=` | Marcar como `done`, `missed` o `cancelled` |
| Planner | `GET /api/v1/routines`, `/routines/{id}` | El catálogo de la norma, con pasos y guías |
| HealthService | `GET /api/v1/vitals?crew=&day=` | Signos del reloj, bandas, estados, patrones y curvas del día |
| DataService | `GET /api/v1/readings?start=` | Nuevo filtro `start`, para no traer toda la misión del reloj |

Mensajes en la cola: `health.finding` (ahora con `source: watch` para el reloj), y `plan.reminder` y `plan.missed` en el canal `notifications`.

## 5. Decisiones y supuestos (nuestros, no de la NASA)

| Tema | Decisión | Por qué |
|---|---|---|
| Ventanas del Planner | ±3 días alrededor de cada fecha de la norma | La norma da fechas, no ventanas |
| Retest | En los 7 días siguientes, sin caminata espacial ese día | Igual que en la arquitectura |
| Bucle de retests | Si el hallazgo sigue tras un retest de los últimos 14 días, va a revisión | Antes, con `--run-booked`, cada retest volvía a disparar otro |
| Banda del reloj | Mediana y MAD en vez de media y desvío | Con la media, un episodio largo ensanchaba su propia referencia y se escondía |
| Desvío del reloj | Promedio de 3 días, no 3 días sueltos | El reloj tiene un ruido diario de ±6 %; día a día no se detecta un +12 % |
| SpO2 | Bajo 92 %: aviso inmediato | Piso habitual en adultos; no es un límite de la NASA |
| Sueño en vuelo | 6,09 h por noche | Barger y col. 2014, *Lancet Neurology*, 85 astronautas |
| Episodio de fatiga (demo) | FC en reposo +12 %, HRV −30 %, 1,6 h menos de sueño | Supuesto, para que la demo tenga un caso |

## 6. Cambios en código de otros (para revisar)

| Dueño | Archivo | Cambio |
|---|---|---|
| Juan (DataService) | `sim/gravsim/store.py`, `dataservice.py` | Filtran por medida en SQL y en memoria: el reloj multiplica por 13 las lecturas |
| Juan | `sim/gravsim/serve.py` | `--fatigue`, el filtro `start` y `run_booked_studies`, que lee el plan |
| Valen (HealthService) | `sources.py`, `__main__.py`, `demo.py`, `notices.py` | URL por defecto `127.0.0.1`. El worker ya no recalcula fuerza con cada lectura del reloj y publica los hallazgos del reloj |
| Enzo (frontend) | `vuelo/Shell.jsx`, `vite.config.js` | Pestañas "Health summary", "Vital signs" y "Mission plan", y proxy al Planner. La vista anterior de recomendaciones (`recommendations.js`) ya no se usa en la página |

## 7. Pendientes y preguntas abiertas

- **Nacho:** tipo de notificación para `plan.reminder` y `plan.missed` en el Notification Center.
- **Equipo, días:** una sola convención. Hoy el día de misión empieza en 0 en el lanzamiento y FD empieza en 1; el frontend convierte todo a FD.
- **Equipo, colores:** "Large loss" usa el mismo rojo que la alarma crítica. ¿Pasamos los niveles de pérdida a otra paleta para que el rojo signifique solo "alarma"?
- **HealthService:** enviar un nivel para la densidad ósea. El frontend no lo calcula, por la regla de que no hace cálculos clínicos.
- **Planner:** las sesiones de ejercicio después de un hallazgo confirmado (§9 de planner.md) necesitan una señal de adherencia al ejercicio.
- **Otras misiones:** perfiles `artemis_30` y `mars` del catálogo. Hoy solo existe `iss_180`.
- **Checklist de pasos:** las tildes no se guardan; haría falta un campo en el Planner.
- **Rendimiento:** generar el reloj suma unos 40 s al arranque y lleva la suite del HealthService a unos 4 minutos.

## 8. Tests

| Suite | Cómo correrla | Cantidad |
|---|---|---|
| Simulador | `cd sim && python -m pytest -q` (más `-m slow` para las de estrés) | 124 + 84 |
| HealthService | `cd health && python -m pytest -q` | 78 |
| Planner | `cd planner && python -m pytest -q` | 45 |
| Frontend | `node --test tests/*.test.mjs` | 54 |
