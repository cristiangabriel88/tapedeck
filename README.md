# tapedeck.local

A local web app that pulls audio from YouTube (and most yt-dlp sites) as MP3, M4A, Opus, WAV, or FLAC. Runs entirely on your machine — nothing leaves your computer.

## Requirements

- **Python 3.8+** — [python.org](https://python.org)
- **FFmpeg** — must be available on your system
  - Windows: `winget install ffmpeg`
  - Mac: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`

## Quick Start (Windows)

Double-click **`run.bat`**. It installs Python dependencies, starts the server, and opens the app at `http://127.0.0.1:5050`.

## Manual Start

```bash
pip install flask yt-dlp waitress
python app.py
# then open http://127.0.0.1:5050
```

## Usage

1. **Add a link** — paste a YouTube URL into the input field and press **Enter** (or click **add**). You can also drag a browser tab onto the page, or accept the small "Clipboard" pill that appears when the app detects a YouTube URL on your clipboard.
2. **Multi-link adds** — paste several URLs separated by spaces, commas, or newlines, then submit once; each becomes its own row.
3. **Format & bitrate** — pick them from the two dropdowns next to the URL field. Choices persist across reloads (stored in `localStorage`).
4. **Watch progress** — each row shows phase-aware status: `resolving… → queued → downloading 47% → converting… → ✓ saved`.
5. **Find your file** — files save directly to `~/Music/yt` (or your configured folder). Click the folder pill in the top-right to open it, or use the row's reveal-in-folder arrow to jump to a specific file.
6. **Bulk actions** — the strip above the queue shows `retry failed`, `clear ✓`, and `clear all` when applicable.

### Settings (in-app)

Click the **gear icon** in the top-right to open settings:

- **Output folder** — where files are saved. Created if it doesn't exist.
- **Filename template** — a drag-and-drop pill builder. Drag token pills (`title`, `channel`, `uploader`, `id`) and separator pills (`–`, `·`, `_`, space) into the box to compose names like `Queen Official - Bohemian Rhapsody`. Drop pills anywhere in the box to append after the last one, drag pills in the box to reorder, click `×` on a pill to remove it. A live preview shows the rendered filename using sample metadata.
- **Parallel downloads** — 1–4 simultaneous jobs (default **3**).
- **Expand playlists** — when on, pasting a playlist URL queues every video.

Settings persist in `config.json` (output folder + template) and `localStorage` (parallelism + playlist toggle).

You can still pre-seed the output folder via environment variable:

```bash
# Windows (PowerShell)
$env:TAPEDECK_OUT_DIR = "D:\Audio\yt"; python app.py
# Mac/Linux
TAPEDECK_OUT_DIR=~/Downloads/yt python app.py
```

The folder is created on startup if it doesn't exist. The in-app setting takes precedence once changed.

### Keyboard shortcuts

- **Ctrl/Cmd+K** or **/** — focus the URL input
- **Enter** — add (when input is focused)
- **Esc** — clear input, or dismiss the clipboard hint, or close the settings modal

### Build a single-exe (advanced)

For non-Python users, package the app as a single executable. **FFmpeg stays external** — the build does not bundle it.

```bash
# Windows
build.bat

# Mac/Linux
./build.sh
```

Output: `dist/tapedeck.exe` (Windows) or `dist/tapedeck` (Unix). Double-click to run.

## Features

- **Disk-save, not browser-save.** Files land directly in your configured output folder. No browser save dialog, no `~/Downloads` detour.
- **Reveal in OS file manager.** Reveal-in-folder uses `explorer /select,…` on Windows, `open -R` on macOS, and `xdg-open` on Linux — with a foreground-focus fix on Windows so the window pops to the front instead of blinking in the taskbar.
- **Collision-safe filenames.** Duplicates get a numeric suffix: `Title.mp3`, `Title (1).mp3`, `Title (2).mp3`.
- **Drag-and-drop, clipboard detect, multi-paste.** Multiple ways to enqueue URLs without typing.
- **Duplicate-paste feedback.** Press Enter on a URL that's already in the queue and the existing row shakes briefly so you know it didn't quietly drop your input — retriggers on every press.
- **Persisted preferences.** Format and bitrate stick across sessions.
- **Job-based progress.** The server runs yt-dlp in a background thread with a `progress_hook` that streams percentage to the client via a small polling loop, so the bar reflects real work (download + conversion phases), not just the trivial localhost transfer.

## How It Works

| Layer | Tool |
|---|---|
| Web server | [Flask](https://flask.palletsprojects.com/) (localhost only) + [Waitress](https://docs.pylonsproject.org/projects/waitress/) |
| Audio download | [yt-dlp](https://github.com/yt-dlp/yt-dlp) |
| Audio conversion | [FFmpeg](https://ffmpeg.org/) |
| Frontend | React 18 (UMD) + Babel-standalone — no build step |

### File flow

1. `POST /download` spawns a background thread and returns a `job_id`.
2. yt-dlp writes the raw download into `./downloads/<job_id>.<ext>` (a staging area).
3. FFmpeg post-processes into `./downloads/<job_id>.<fmt>`.
4. The worker moves the finished file into your output folder (with collision-safe naming).
5. `GET /progress/<job_id>` reports `{ status, phase, progress, final_name }`.
6. The job's record self-expires from memory ~120 s after it terminates.
7. The staging area is swept at startup so partial files from a crashed run don't pile up.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Render the SPA |
| GET | `/config` | Return `{ out_dir, out_dir_abs, filename_template }` |
| POST | `/config` | Update `out_dir` and/or `filename_template`; persists to `config.json` |
| POST | `/info` | yt-dlp metadata lookup. Returns single-video info or `{ type: "playlist", entries: [...] }` when `expand_playlist` is true |
| POST | `/download` | Start a job; returns `{ job_id, out_dir }` |
| GET | `/progress/<job_id>` | Poll job status + progress |
| POST | `/cancel/<job_id>` | Stop the worker for a running job |
| POST | `/reveal/<job_id>` | Open OS file manager focused on the saved file |
| POST | `/reveal-folder` | Open the output folder in the OS file manager |

## Notes

- For personal use only. Only download content you have the right to download.
- FFmpeg is auto-detected from PATH or common install locations on Windows.
- The `downloads/` staging folder and `__pycache__/` are git-ignored.

## Author

Made by [cristiangabriel.dev](https://cristiangabriel.dev) — [me@cristiangabriel.dev](mailto:me@cristiangabriel.dev).
