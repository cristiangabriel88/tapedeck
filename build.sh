#!/usr/bin/env bash
# Build a single-exe (Mac/Linux). Output: dist/tapedeck
# FFmpeg stays external - install via `brew install ffmpeg` or `apt install ffmpeg`.

set -euo pipefail

# Pick a Python interpreter (python3 on macOS/most Linux, fallback to python).
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python 3 not found. Install it from https://python.org or 'brew install python'." >&2
  exit 1
fi

echo "Using $($PY --version)"

# Use 'python -m pip' so we never depend on a bare 'pip' being on PATH (common on macOS).
"$PY" -m pip install -r requirements-build.txt
"$PY" -m pip install flask yt-dlp waitress

"$PY" -m PyInstaller --onefile --noconsole --name tapedeck \
  --icon tapedeck.icns \
  --add-data "static:static" \
  --add-data "templates:templates" \
  --collect-all yt_dlp \
  --hidden-import waitress \
  app.py

echo
echo "Built dist/tapedeck.app (or dist/tapedeck on Linux)"
