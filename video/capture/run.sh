#!/usr/bin/env bash
# Capture every screen from a clean start: fresh database, seeded, signed in.
# Needs Postgres on 127.0.0.1:55432 and the frontend dev server on :5173
# (cd frontend && VITE_API_BASE=/api npx vite --port 5173).
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=${LOG:-/var/tmp/urs-video-backend.log}

pgrep -f "^python3 capture/backend.py" | xargs -r kill
sleep 1
psql -h 127.0.0.1 -p 55432 -U urs -d postgres -q \
  -c "DROP DATABASE IF EXISTS ursdb_video" -c "CREATE DATABASE ursdb_video"
python3 capture/backend.py > "$LOG" 2>&1 &
until curl -sf http://127.0.0.1:5000/api/health > /dev/null; do sleep 1; done

(cd capture && python3 seed.py > /dev/null && python3 sessions.py)
node capture/capture.mjs

# WebP keeps the repository small; Chromium renders it the same.
python3 - <<'PY'
from pathlib import Path
from PIL import Image
for png in Path("public/screens").glob("*.png"):
    Image.open(png).convert("RGB").save(png.with_suffix(".webp"), quality=90, method=6)
    png.unlink()
PY
cp ../frontend/public/icon-192.png public/app-icon.png
