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

Tarda unos 40 segundos: genera la misión entera, con unas 100 lecturas del reloj por día y tripulante. Las bases, los logs y los temporales van a `.demo/` (está en `.gitignore`). `Ctrl+C` detiene todo. Cada arranque empieza una misión nueva.

Opciones, todas por variables de entorno:

| Variable | Por defecto | Para qué |
|---|---|---|
| `DAY` | 130 | Día de misión al arrancar (0 = lanzamiento, 180 = aterrizaje) |
| `SPEED` | 0.5 | Días de misión por minuto real; 0 deja el reloj quieto |
| `FATIGUE` | `CM-3:126:7` | Episodio de fatiga que solo ve el reloj: tripulante, día de inicio y duración en días |
| `SANS` | `CM-1:1.8:R` | SANS para el examen ocular: tripulante, susceptibilidad en desvíos estándar y el ojo que lo lleva (R o L) |
| `THROMBUS` | `CM-2:45` | Trombo en la yugular izquierda: tripulante y día de vuelo en que se forma (`:R` para la derecha) |
| `DEMO_DIR` | `.demo/` | Dónde guardar bases, logs y temporales |
| `PORT` | 5190 | Puerto de la página |

Para levantar cada servicio por separado, ver el [README](../README.md).

## 3. Qué mostrar (unos 3 minutos)

La página es `/vuelo.html`. El selector de tripulante está arriba.

1. **Overview, CM-3: el reloj como primera línea.**
   - La banda amarilla dice "Check needed": la FC en reposo está alta hace 3 días.
   - El panel "Now · from your watch" tiene una tarjeta por signo vital, con la banda personal sombreada.
   - Más abajo, la frecuencia cardíaca de hoy contra ayer, hace una semana o antes del vuelo, con el sueño y el ejercicio sombreados.
   - En "To do", el Planner ya agendó "Review by the flight surgeon: resting heart rate".
2. **Wearable, CM-3.**
   - Cada signo a 30 días: la banda personal sombreada y los días fuera de rango en naranja.
   - El promedio semanal de toda la misión.
   - El texto explica por qué un cambio de 3 días agenda una revisión.
3. **Overview, CM-2: las pruebas periódicas como segunda línea.**
   - Alarma roja de capacidad aeróbica: el VO2pico está por debajo del mínimo de la NASA (32,9 ml/kg/min).
   - El cuerpo 3D colorea cada grupo muscular según cuánta fuerza perdió.
4. **Mission plan.**
   - "Open now" y "Coming up this week", con lenguaje simple.
   - Al abrir una tarea: pasos, qué hacer si algo sale anormal y la cita de la norma con su página.
   - "Mark as done" pide confirmación y lo guarda en el Planner.
5. **Muscles y Aerobic:** el detalle de cada prueba frente a los estudios de reposo en cama de la NASA.
6. **Eyes (Eye exam), CM-1: la ecografía y el OCT del ojo (SANS).**
   - Clase B en el ojo derecho: la retina alrededor del disco óptico subió más de 55 µm desde antes del vuelo.
   - El ojo cortado al medio cambia con cada examen ("▶ Play the mission"); el cuerpo 3D colorea cada ojo por su clase.
7. **Neck veins (Neck vein ultrasound), CM-2: la ecografía de las yugulares.**
   - Alarma roja: la vena izquierda no colapsa al apretarla, un posible coágulo (el primero se encontró así, sin síntomas, en la ISS).
   - En la vena en 3D la sangre fluye, se detiene o vuelve según el grado; "Press the probe" muestra que la vena sana se aplasta y la del coágulo no.
   - En "To do", el Planner agendó la revisión del médico de vuelo para el mismo día.

**Mensaje para cerrar:** el reloj mira todos los días cómo estás comparado con vos mismo; las pruebas periódicas miran si perdés más rápido de lo esperado; y el Planner convierte las dos cosas en tareas concretas, siguiendo la norma médica de la NASA (OCHMO-STD-100.1A).

## 4. Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| La página tarda segundos en cada actualización | Algún servicio usa `localhost`: en Windows prueba IPv6 primero y pierde unos 2 s por consulta. Usar `http://127.0.0.1:8000`; ya es el valor por defecto. |
| "Unable to reach the Planner (port 3001)" | El Planner no arrancó o se cayó. Ver `.demo/planner.log`. |
| `database or disk is full` | Disco lleno. Mover `DEMO_DIR` a otro disco. |
| `Port 5190 is in use` | Otro Vite está corriendo. Usar `PORT=5191 bash scripts/demo.sh`. |
| CM-3 ya no muestra el desvío | El reloj de la misión avanzó y el episodio terminó. Reiniciar o usar `SPEED=0`. |
| En "Missed" nunca hay nada | Es esperado: `--simulate-crew` marca como hechas las tareas de la tripulación a mitad de su ventana. |

Todos los datos son **sintéticos**. Salen de los estudios de reposo en cama de la NASA y de supuestos documentados. Nada de esto es una evaluación médica.
