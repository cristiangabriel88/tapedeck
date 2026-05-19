#!/usr/bin/env bash
# Build a single-exe (Mac/Linux). Output: dist/tapedeck
# FFmpeg stays external — install via `brew install ffmpeg` or `apt install ffmpeg`.

set -euo pipefail

if ! command -v pyinstaller >/dev/null 2>&1; then
  echo "Installing build deps..."
  pip install -r requirements-build.txt
fi
pip install flask yt-dlp waitress

pyinstaller --onefile --noconsole --name tapedeck \
  --icon tapedeck.icns \
  --add-data "static:static" \
  --add-data "templates:templates" \
  --collect-all yt_dlp \
  --hidden-import waitress \
  app.py

echo
echo "Built dist/tapedeck"
