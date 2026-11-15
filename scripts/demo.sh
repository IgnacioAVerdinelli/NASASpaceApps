#!/usr/bin/env bash
# Levanta la demo completa en una sola terminal: DataService (8000), HealthService (3000), worker de eventos,
# Planner (3001) y la página (Vite, 5190). Guía: docs/guia-demo.md.
#
#   bash scripts/demo.sh                      # cinco casos preparados, misión detenida en el día 130
#   DAY=95 SPEED=2 bash scripts/demo.sh       # otro día de arranque y otra velocidad (días de misión por minuto)
#   DEMO_DIR=D:/demo bash scripts/demo.sh     # dónde van bases, logs y temporales (por defecto .demo/ en el repo)
#
# Ctrl+C detiene todo. Cada arranque empieza una misión nueva (borra las bases anteriores de DEMO_DIR).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_DIR="${DEMO_DIR:-$ROOT/.demo}"
DAY="${DAY:-130}"
SPEED="${SPEED:-0}"
PORT="${PORT:-5190}"
DATA_PORT="${DATA_PORT:-8000}"
HEALTH_PORT="${HEALTH_PORT:-3000}"
PLANNER_PORT="${PLANNER_PORT:-3001}"

# El entorno de Python: .venv en la raíz (o health/.venv, como dice el README); bin/ en Linux y macOS, Scripts/ en Windows.
for v in "$ROOT/.venv" "$ROOT/health/.venv"; do
  for b in bin/python Scripts/python.exe; do [ -x "$v/$b" ] && PY="$v/$b" && break 2; done
done
[ -n "${PY:-}" ] || { echo "No encuentro el entorno de Python. Ver docs/guia-demo.md, paso 1."; exit 1; }
[ -d "$ROOT/src/front/sketch/node_modules" ] || { echo "Falta 'npm install' en la raíz y en src/front/sketch. Ver docs/guia-demo.md."; exit 1; }

"$PY" - "$DATA_PORT" "$HEALTH_PORT" "$PLANNER_PORT" "$PORT" <<'PY'
import socket, sys
sockets = []
try:
    if len(set(sys.argv[1:])) != len(sys.argv[1:]):
        sys.exit("Los servicios necesitan puertos diferentes")
    for port in map(int, sys.argv[1:]):
        s = socket.socket()
        sockets.append(s)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(('127.0.0.1', port))
except (OSError, ValueError) as exc:
    sys.exit(f"No se puede usar el puerto {port}: {exc}")
finally:
    for s in sockets:
        s.close()
PY

mkdir -p "$DEMO_DIR/tmp"
export TMP="$DEMO_DIR/tmp" TEMP="$DEMO_DIR/tmp" TMPDIR="$DEMO_DIR/tmp" SQLITE_TMPDIR="$DEMO_DIR/tmp"
rm -f "$DEMO_DIR"/data.sqlite{,-wal,-shm} "$DEMO_DIR"/queue.sqlite{,-wal,-shm}
DATA="http://127.0.0.1:$DATA_PORT" # 127.0.0.1 evita la demora IPv6 de localhost en Windows
Q="$DEMO_DIR/queue.sqlite"

cleanup() {
  trap - INT TERM EXIT
  echo; echo "Deteniendo..."
  for pid in $(jobs -pr); do kill "$pid" 2>/dev/null || true; done
}
trap cleanup INT TERM EXIT
cd "$DEMO_DIR"
"$PY" -m gravsim.serve --demo-cases --day "$DAY" --speed "$SPEED" --port "$DATA_PORT" --db "$DEMO_DIR/data.sqlite" --queue "$Q" --run-booked > data.log 2>&1 &
DATA_PID=$!
echo "Generando la misión (unos 40 s)..."
for ((i=0; i<180; i++)); do
  curl -fsS -m 2 "$DATA/api/v1/mission" > /dev/null 2>&1 && break
  kill -0 "$DATA_PID" 2>/dev/null || { echo "DataService se detuvo; revisar $DEMO_DIR/data.log"; exit 1; }
  sleep 1
done
curl -fsS -m 2 "$DATA/api/v1/mission" > /dev/null || { echo "DataService no respondió; revisar $DEMO_DIR/data.log"; exit 1; }
"$PY" -m healthservice --data-url "$DATA" --queue "$Q" --port "$HEALTH_PORT" > health.log 2>&1 &
"$PY" -m healthservice.demo --data-url "$DATA" --queue "$Q" > demo.log 2>&1 &
"$PY" -m planner --data-url "$DATA" --queue "$Q" --port "$PLANNER_PORT" --simulate-crew > planner.log 2>&1 &
(cd "$ROOT/src/front/sketch" && export DEMO_HEALTH_PORT="$HEALTH_PORT" DEMO_PLANNER_PORT="$PLANNER_PORT" && exec ./node_modules/.bin/vite --host 127.0.0.1 --port "$PORT" --strictPort > "$DEMO_DIR/vite.log" 2>&1) &
echo "Procesando los casos y preparando los planes..."
"$PY" "$ROOT/scripts/demo_ready.py" "$Q" "$PORT" "$PLANNER_PORT" || { echo "La demo no quedó lista; revisar los logs en $DEMO_DIR"; exit 1; }
echo
echo "Listo: http://127.0.0.1:$PORT/vuelo.html?crew=CM-3#summary"
echo "Logs en $DEMO_DIR (data, health, demo, planner, vite). Ctrl+C para detener."
wait
