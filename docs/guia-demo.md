# Guía: levantar y mostrar la demo

Cómo correr el sistema completo y qué recorrer en la página. Para saber qué hace cada parte y por qué, ver [handoff/planner-y-reloj.md](handoff/planner-y-reloj.md) y [architecture.md](architecture.md).

## 1. Instalar (una vez)

Hace falta Python 3.10 o más y Node.js 20.19+ o 22.12+. Desde la raíz del repo:

```bash
python -m venv .venv
# Linux / macOS:
.venv/bin/pip install -e ./sim -e './health[dev]' -e './planner[dev]'
# Windows (Git Bash):
.venv/Scripts/pip install -e ./sim -e './health[dev]' -e './planner[dev]'

npm install
cd src/front/sketch && npm install && cd ../../..
```

## 2. Levantar

Todo en una terminal:

```bash
bash scripts/demo.sh
```

Arranca, en este orden:

| Servicio | Puerto | Qué hace |
|---|---|---|
| DataService (`gravsim.serve`) | 8000 | Genera la misión simulada y guarda lecturas, contexto y resultados |
| HealthService | 3000 | Interpreta los datos: niveles, alertas, signos del reloj |
| Worker (`healthservice.demo`) | — | Procesa eventos, publica hallazgos y avisos, simula las entregas |
| Planner | 3001 | Arma el plan de cada tripulante desde la norma de la NASA |
| Página (Vite) | 5190 | `http://127.0.0.1:5190/vuelo.html?crew=CM-3#summary` |
| Selección de tripulante | 5190 | `http://127.0.0.1:5190/crew.html` ([detalle](crew-select.md)) |

El arranque genera el historial de cinco personas y espera a que salud y planificación procesen los eventos antes de anunciar que está listo. Puede tardar más de un minuto. Las bases, los logs y los temporales van a `.demo/` (está en `.gitignore`). `Ctrl+C` detiene todo. Cada arranque reemplaza las bases `data.sqlite` y `queue.sqlite` de la demo y empieza una misión nueva.

Opciones, todas por variables de entorno:

| Variable | Por defecto | Para qué |
|---|---|---|
| `DAY` | 130 | Día de misión al arrancar (0 = lanzamiento, 180 = aterrizaje) |
| `SPEED` | 0 | Días de misión por minuto real; 0 deja los cinco casos en el momento preparado |
| `SANS`, `THROMBUS` | vacías | Estudios por imagen, apagados para no cambiar los cinco casos. `SANS=CM-4:1.8:R` da SANS clase B en el ojo derecho; `THROMBUS=CM-5:45`, un coágulo en la yugular izquierda desde el día 45 |
| `DEMO_DIR` | `.demo/` | Dónde guardar bases, logs y temporales |
| `PORT` | 5190 | Puerto de la página |
| `DATA_PORT`, `HEALTH_PORT`, `PLANNER_PORT` | 8000, 3000, 3001 | Puertos de los servicios; cambiarlos si ya están ocupados |

Los casos están preparados para `DAY=130` y `SPEED=0`; con otros valores pueden cambiar o dejar de verse. Para levantar cada servicio por separado, ver el [README](../README.md).

## 3. Qué mostrar

Se puede empezar por `/crew.html`: la tripulación en un carrusel 3D con los nombres de ejemplo de la ISS Expedición 75 y una card con el estado de cada persona; clic en la persona de adelante (o en "Open health overview") abre su overview. Los datos de salud siguen siendo sintéticos. Con los cinco casos de la demo, CM-4 aparece con el nombre de Jessica Watkins y cuerpo masculino; ver [crew-select.md](crew-select.md#pendiente-para-integrar).

La página es `/vuelo.html`. El selector de tripulante está arriba; "← All crew" vuelve a la selección.

En Surface, las regiones con mediciones usan sus resultados; las demás muestran colores ilustrativos distintos para cada tripulante. Esos colores no son lecturas, no generan alertas y no representan un diagnóstico. El mapa interno y las tablas conservan las mediciones disponibles.

1. **CM-1: referencia estable.** Recorrer los signos vitales y las mediciones para comparar con los demás casos.
2. **CM-2: fatiga reciente.** En Vital signs se observa un cambio reciente en la calidad del sueño; es una señal simulada, no un diagnóstico.
3. **Health summary, CM-3: fatiga persistente.**
   - La banda amarilla dice "Check needed": la FC en reposo está alta hace 3 días.
   - El panel "Now · from your watch" tiene una tarjeta por signo vital, con la banda personal sombreada.
   - Más abajo, la frecuencia cardíaca de hoy contra ayer, hace una semana o antes del vuelo, con el sueño y el ejercicio sombreados.
   - En "To do", el Planner ya agendó "Review by the flight surgeon: resting heart rate".
   - En Vital signs se muestran los últimos 30 días, la banda personal y el promedio semanal de toda la misión.
4. **CM-4: pérdida de fuerza.** En Muscle strength y el cuerpo 3D se ven las mediciones de piernas y las alertas correspondientes.
5. **CM-5: capacidad aeróbica.**
   - Alarma roja de capacidad aeróbica: el VO2pico está por debajo del mínimo de la NASA (32,9 ml/kg/min).
   - El Planner incluye una revisión de la capacidad aeróbica.
6. **Mission plan.**
   - "Open now" y "Coming up this week", con lenguaje simple.
   - Al abrir una tarea: pasos, qué hacer si algo sale anormal y la cita de la norma con su página.
   - "Mark as done" pide confirmación y lo guarda en el Planner.
7. **Muscle strength y Aerobic capacity:** el detalle de cada prueba frente a los estudios de reposo en cama de la NASA.
8. **Eyes y Neck veins: los estudios por imagen.** Con `SANS=CM-4:1.8:R THROMBUS=CM-5:45 bash scripts/demo.sh`:
   - **Eyes, CM-4:** clase B en el ojo derecho (la retina alrededor del disco óptico subió más de 55 µm); el ojo cortado al medio cambia con cada examen ("▶ Play the mission").
   - **Neck veins, CM-5:** alarma, la vena izquierda no colapsa al apretarla (un posible coágulo, como el que se encontró sin síntomas en la ISS); "Compress the vein" lo muestra y el Planner agenda la revisión del mismo día.
   - Sin esas variables, las dos pestañas muestran lo que el simulador genera para cada tripulante.

**Mensaje para cerrar:** el reloj mira todos los días cómo estás comparado con vos mismo; las pruebas periódicas miran si perdés más rápido de lo esperado; y el Planner convierte las dos cosas en tareas concretas, siguiendo la norma médica de la NASA (OCHMO-STD-100.1A).

## 4. Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| La página tarda segundos en cada actualización | Algún servicio usa `localhost`: en Windows prueba IPv6 primero y pierde unos 2 s por consulta. Usar `http://127.0.0.1:8000`; ya es el valor por defecto. |
| "Unable to reach the Planner (port 3001)" | El Planner no arrancó o se cayó. Ver `.demo/planner.log`. |
| `database or disk is full` | Disco lleno. Mover `DEMO_DIR` a otro disco. |
| Un puerto está ocupado | Cambiar la variable correspondiente; por ejemplo, `PORT=5191 bash scripts/demo.sh`. |
| CM-3 ya no muestra el desvío | El reloj de la misión avanzó y el episodio terminó. Reiniciar o usar `SPEED=0`. |
| En "Missed" nunca hay nada | Es esperado: `--simulate-crew` marca como hechas las tareas de la tripulación a mitad de su ventana. |

Todos los datos son **sintéticos**. Salen de los estudios de reposo en cama de la NASA y de supuestos documentados. Nada de esto es una evaluación médica.
