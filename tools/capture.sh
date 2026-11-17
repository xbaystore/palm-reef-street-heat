#!/usr/bin/env bash
# Capture the four Palm Reef screenshots: serve game/ on :8902, shoot each
# ?shot= scene with the headless Chromium shell, convert PNG to JPEG q88.
#   bash tools/capture.sh   (from the repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SHELL_BIN="/home/hatch/.cache/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-linux64/chrome-headless-shell"
if [ ! -x "$SHELL_BIN" ]; then
  SHELL_BIN="/home/hatch/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome"
fi

mkdir -p screenshots

node serve.ts --port 8902 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

# Wait for the server to answer.
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://localhost:8902/index.html" 2>/dev/null; then break; fi
  sleep 0.5
done

capture() {
  local name="$1" query="$2" out="$3"
  local tmp="/tmp/palm-reef-$name.png"
  "$SHELL_BIN" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=1280,720 --virtual-time-budget=15000 \
    --screenshot="$tmp" "http://localhost:8902/${query}"
  python3 -c "from PIL import Image; Image.open('$tmp').convert('RGB').save('$out', quality=88)"
  local size
  size=$(stat -c%s "$out")
  echo "$out: ${size} bytes"
  if [ "$size" -gt 262144 ]; then
    echo "ERROR: $out is over the 256 KiB cap" >&2
    exit 1
  fi
}

capture chase "?shot=chase&seed=7" "screenshots/1-cover.jpg"
capture onfoot "?shot=onfoot&seed=3" "screenshots/2-onfoot.jpg"
capture drive "?shot=drive&seed=5" "screenshots/3-drive.jpg"
capture mission "?shot=mission&seed=9" "screenshots/4-mission.jpg"

kill $SERVER_PID 2>/dev/null || true
trap - EXIT
echo "all four screenshots captured."
