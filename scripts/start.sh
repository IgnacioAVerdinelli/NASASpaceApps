#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -x health/.venv/bin/python ]; then
  python3 -m venv health/.venv
fi
if ! health/.venv/bin/python -c 'import gravsim, healthservice, planner, fastapi, uvicorn, numpy' 2>/dev/null; then
  health/.venv/bin/pip install -e ./sim -e ./health -e ./planner
fi
[ -d node_modules ] || npm install
[ -d src/front/sketch/node_modules ] || npm install --prefix src/front/sketch

pids=()
cleanup() {
  trap - EXIT INT TERM
  kill "${pids[@]}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

health/.venv/bin/python -m gravsim.serve --day 95 --speed 20 --db /tmp/nasa-data.sqlite --queue /tmp/nasa-queue.sqlite & pids+=("$!")
health/.venv/bin/python - <<'PY'
import time
from urllib.request import urlopen

for _ in range(60):
    try:
        with urlopen('http://localhost:8000/api/v1/mission', timeout=1):
            break
    except OSError:
        time.sleep(0.5)
else:
    raise SystemExit('El simulador no respondió en 30 segundos.')
PY
health/.venv/bin/python -m healthservice --queue /tmp/nasa-queue.sqlite & pids+=("$!")
health/.venv/bin/python -m healthservice.demo --queue /tmp/nasa-queue.sqlite & pids+=("$!")
health/.venv/bin/python -m planner --queue /tmp/nasa-queue.sqlite --simulate-crew & pids+=("$!")
npm run dev --prefix src/front/sketch & pids+=("$!")

echo 'Servicios iniciándose. Abrí la dirección que indique Vite. Para detenerlos: Ctrl+C.'
wait -n "${pids[@]}" || true
echo 'Un servicio se detuvo; cerrando los demás.' >&2
exit 1
