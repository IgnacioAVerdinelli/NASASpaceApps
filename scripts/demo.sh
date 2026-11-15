#!/usr/bin/env bash
# Levanta la demo completa en una sola terminal: DataService (8000), HealthService (3000), worker de eventos,
# Planner (3001) y la página (Vite, 5190). Guía: docs/guia-demo.md.
#
#   bash scripts/demo.sh                      # misión ISS de 180 días, día 130, CM-3 con un episodio de fatiga
#   DAY=95 SPEED=2 bash scripts/demo.sh       # otro día de arranque y otra velocidad (días de misión por minuto)
#   DEMO_DIR=D:/demo bash scripts/demo.sh     # dónde van bases, logs y temporales (por defecto .demo/ en el repo)
#
# Ctrl+C detiene todo. Cada arranque empieza una misión nueva (borra las bases anteriores de DEMO_DIR).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="${DEMO_DIR:-$ROOT/.demo}"
DAY="${DAY:-130}"
SPEED="${SPEED:-0.5}"
FATIGUE="${FATIGUE:-CM-3:126:7}"
SANS="${SANS:-CM-1:1.8:R}"       # SANS for the eye exam, mostly in CM-1's right eye (docs/investigacion-ojos.md)
THROMBUS="${THROMBUS:-CM-2:45}" # a left jugular clot for CM-2 (docs/investigacion-yugular.md)
PORT="${PORT:-5190}"

# El entorno de Python: .venv en la raíz (o health/.venv, como dice el README); bin/ en Linux y macOS, Scripts/ en Windows.
for v in "$ROOT/.venv" "$ROOT/health/.venv"; do
  for b in bin/python Scripts/python.exe; do [ -x "$v/$b" ] && PY="$v/$b" && break 2; done
done
[ -n "${PY:-}" ] || { echo "No encuentro el entorno de Python. Ver docs/guia-demo.md, paso 1."; exit 1; }
[ -d "$ROOT/src/front/sketch/node_modules" ] || { echo "Falta 'npm install' en la raíz y en src/front/sketch. Ver docs/guia-demo.md."; exit 1; }

mkdir -p "$DEMO_DIR/tmp"
export TMP="$DEMO_DIR/tmp" TEMP="$DEMO_DIR/tmp" TMPDIR="$DEMO_DIR/tmp" SQLITE_TMPDIR="$DEMO_DIR/tmp"
rm -f "$DEMO_DIR"/*.sqlite* "$DEMO_DIR"/*.log
DATA=http://127.0.0.1:8000        # 127.0.0.1 y no localhost: en Windows localhost prueba IPv6 primero (2 s por consulta)
Q="$DEMO_DIR/queue.sqlite"

trap 'echo; echo "Deteniendo..."; kill 0' INT TERM EXIT
cd "$DEMO_DIR"
"$PY" -m gravsim.serve --day "$DAY" --speed "$SPEED" --fatigue "$FATIGUE" --sans "$SANS" --thrombus "$THROMBUS" --db "$DEMO_DIR/data.sqlite" --queue "$Q" --run-booked > data.log 2>&1 &
echo "Generando la misión (unos 40 s)..."
until curl -s -m 2 "$DATA/api/v1/mission" > /dev/null; do sleep 1; done
"$PY" -m healthservice --data-url "$DATA" --queue "$Q" > health.log 2>&1 &
"$PY" -m healthservice.demo --data-url "$DATA" --queue "$Q" > demo.log 2>&1 &
"$PY" -m planner --data-url "$DATA" --queue "$Q" --simulate-crew > planner.log 2>&1 &
(cd "$ROOT/src/front/sketch" && npx vite --host 127.0.0.1 --port "$PORT" --strictPort > "$DEMO_DIR/vite.log" 2>&1) &
until curl -s -m 5 -o /dev/null "http://127.0.0.1:$PORT/api/v1/health"; do sleep 1; done
echo
echo "Listo: http://127.0.0.1:$PORT/vuelo.html?crew=CM-3#summary"
echo "Logs en $DEMO_DIR (data, health, demo, planner, vite). Ctrl+C para detener."
wait
