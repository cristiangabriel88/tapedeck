#!/usr/bin/env bash
# macOS launcher — double-click in Finder (after a one-time `chmod +x run.command`).
# Mirrors run.bat: checks deps, installs Python packages, opens the browser, runs the server.

set -e
cd "$(dirname "$0")"

echo
echo " YouTube -> MP3  Converter"
echo " ============================"
echo

# --- Python ---
echo " Checking Python..."
if ! command -v python3 >/dev/null 2>&1; then
    echo " [ERROR] python3 not found."
    echo "         Install Python 3.8+ with:  brew install python"
    echo "         (or download from https://python.org)"
    echo
    read -n 1 -s -r -p " Press any key to close..."
    exit 1
fi
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' 2>/dev/null; then
    echo " [ERROR] Python 3.8+ required. Found: $(python3 --version 2>&1)"
    echo
    read -n 1 -s -r -p " Press any key to close..."
    exit 1
fi
echo " [OK] $(python3 --version 2>&1)"

# --- FFmpeg ---
if ! command -v ffmpeg >/dev/null 2>&1; then
    echo " [ERROR] ffmpeg not found."
    echo "         Install with:  brew install ffmpeg"
    echo
    read -n 1 -s -r -p " Press any key to close..."
    exit 1
fi
echo " [OK] ffmpeg found"

# --- Dependencies ---
# --user dodges PEP 668 ("externally-managed-environment") that Homebrew's Python enforces.
echo " Installing dependencies..."
if ! python3 -m pip install --quiet --upgrade --disable-pip-version-check --user flask yt-dlp waitress 2>/dev/null; then
    echo " [ERROR] pip install failed."
    echo "         Try a virtualenv:"
    echo "           python3 -m venv .venv && source .venv/bin/activate"
    echo "           pip install flask yt-dlp waitress && python app.py"
    echo
    read -n 1 -s -r -p " Press any key to close..."
    exit 1
fi
echo " [OK] Dependencies ready"

# --- Node.js (optional, improves yt-dlp YouTube support) ---
if command -v node >/dev/null 2>&1; then
    echo " [OK] Node.js found"
else
    echo " [!] Node.js not found  (install from https://nodejs.org for best YouTube support)"
fi

echo
echo " Starting at http://127.0.0.1:5050"
echo " Press Ctrl+C to stop."
echo

(sleep 2 && open "http://127.0.0.1:5050") &

python3 app.py

echo
echo " Server stopped."
read -n 1 -s -r -p " Press any key to close..."
