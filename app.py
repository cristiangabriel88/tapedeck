import ctypes
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import uuid

from flask import Flask, jsonify, render_template, request

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(APP_DIR, "downloads")
CONFIG_FILE = os.path.join(APP_DIR, "config.json")


def load_user_config():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def save_user_config(cfg):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except OSError:
        pass


def initial_out_dir():
    saved = (load_user_config().get("out_dir") or "").strip()
    if saved:
        path = os.path.expanduser(saved)
        try:
            os.makedirs(path, exist_ok=True)
            return path
        except OSError:
            pass
    env = os.environ.get("TAPEDECK_OUT_DIR")
    if env:
        return os.path.expanduser(env)
    return os.path.expanduser("~/Music/yt")


OUT_DIR = initial_out_dir()
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

app = Flask(__name__)

JOBS = {}
JOBS_LOCK = threading.Lock()
JOB_TTL_SECONDS = 120


def update_job(job_id, **changes):
    with JOBS_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(changes)


def schedule_job_cleanup(job_id):
    def drop():
        with JOBS_LOCK:
            JOBS.pop(job_id, None)
    threading.Timer(JOB_TTL_SECONDS, drop).start()


def sweep_staging():
    for name in os.listdir(DOWNLOADS_DIR):
        path = os.path.join(DOWNLOADS_DIR, name)
        try:
            if os.path.isfile(path):
                os.unlink(path)
        except OSError:
            pass


def find_js_runtime():
    for runtime, exe in [("nodejs", "node"), ("deno", "deno")]:
        if shutil.which(exe):
            return runtime
    return None


def find_ffmpeg_dir():
    if shutil.which("ffmpeg"):
        return None
    candidates = [
        os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Links"),
        r"C:\ffmpeg\bin",
        r"C:\Program Files\ffmpeg\bin",
        r"C:\Program Files (x86)\ffmpeg\bin",
    ]
    for path in candidates:
        if os.path.isfile(os.path.join(path, "ffmpeg.exe")):
            return path
    raise RuntimeError(
        "FFmpeg not found. Install it and add to PATH.\n"
        "  Windows:  winget install ffmpeg\n"
        "  Mac/Linux: brew install ffmpeg  or  apt install ffmpeg"
    )


def safe_name(s: str) -> str:
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:120] if s else "audio"


def short_path(p: str) -> str:
    home = os.path.expanduser("~")
    norm = p.replace("\\", "/")
    home_norm = home.replace("\\", "/")
    if norm.lower().startswith(home_norm.lower()):
        return "~" + norm[len(home_norm):]
    return norm


def move_to_output(staged_path: str, title: str, fmt: str) -> str:
    base = safe_name(title)
    candidate = os.path.join(OUT_DIR, f"{base}.{fmt}")
    n = 1
    while os.path.exists(candidate):
        candidate = os.path.join(OUT_DIR, f"{base} ({n}).{fmt}")
        n += 1
    shutil.move(staged_path, candidate)
    return candidate


def reveal(path: str, select: bool = False):
    if not os.path.exists(path):
        return False
    plat = sys.platform
    if plat == "win32":
        # Allow the spawned Explorer (or an existing instance being re-activated)
        # to take foreground — without this, Windows' focus-stealing protection
        # leaves it blinking in the taskbar because the caller (Python, invoked
        # by a browser fetch) isn't the foreground app.
        try:
            ctypes.windll.user32.AllowSetForegroundWindow(-1)  # ASFW_ANY
        except Exception:
            pass
        arg = f"/select,{path}" if select else path
        subprocess.Popen(["explorer", arg])
    elif plat == "darwin":
        if select:
            subprocess.Popen(["open", "-R", path])
        else:
            subprocess.Popen(["open", path])
    else:
        target = os.path.dirname(path) if select else path
        subprocess.Popen(["xdg-open", target])
    return True


ALLOWED_FORMATS = {"mp3", "m4a", "opus", "wav", "flac"}
ALLOWED_QUALITIES = {"0", "128", "192", "256", "320"}


def fmt_duration(seconds: int) -> str:
    seconds = int(seconds or 0)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def run_yt_dlp(job_id: str, url: str, quality: str = "320", fmt: str = "mp3"):
    from yt_dlp import YoutubeDL

    quality = quality if quality in ALLOWED_QUALITIES else "320"
    fmt     = fmt     if fmt     in ALLOWED_FORMATS   else "mp3"

    ffmpeg_dir = find_ffmpeg_dir()
    outtmpl = os.path.join(DOWNLOADS_DIR, f"{job_id}.%(ext)s")

    def progress_hook(d):
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            pct = (done / total * 95) if total else 0
            update_job(job_id, phase="downloading", progress=pct)
        elif status == "finished":
            update_job(job_id, phase="converting", progress=96)

    opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [progress_hook],
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": fmt,
            "preferredquality": quality,
        }],
    }
    if ffmpeg_dir:
        opts["ffmpeg_location"] = ffmpeg_dir
    js_runtime = find_js_runtime()
    if js_runtime:
        opts["js_runtimes"] = {js_runtime: {}}

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title", "audio")

    staged_path = os.path.join(DOWNLOADS_DIR, f"{job_id}.{fmt}")
    if not os.path.exists(staged_path):
        raise RuntimeError(f"{fmt.upper()} output not found after FFmpeg conversion.")

    return staged_path, title, fmt


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/config")
def config():
    return jsonify(out_dir=short_path(OUT_DIR), out_dir_abs=OUT_DIR)


@app.post("/config")
def update_config():
    global OUT_DIR
    body = request.get_json(silent=True) or {}
    new_dir = (body.get("out_dir") or "").strip()
    if not new_dir:
        return jsonify(error="Missing path."), 400
    expanded = os.path.abspath(os.path.expanduser(new_dir))
    try:
        os.makedirs(expanded, exist_ok=True)
    except OSError as e:
        return jsonify(error=f"Could not create folder: {e}"), 400
    if not os.path.isdir(expanded):
        return jsonify(error="Not a folder."), 400
    if not os.access(expanded, os.W_OK):
        return jsonify(error="Folder is not writable."), 400
    OUT_DIR = expanded
    cfg = load_user_config()
    cfg["out_dir"] = expanded
    save_user_config(cfg)
    return jsonify(out_dir=short_path(OUT_DIR), out_dir_abs=OUT_DIR)


@app.post("/info")
def info():
    from yt_dlp import YoutubeDL

    body = request.get_json(silent=True) or {}
    url = (body.get("url") or "").strip()
    if not url:
        return jsonify(error="Missing URL."), 400

    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }
    js_runtime = find_js_runtime()
    if js_runtime:
        opts["js_runtimes"] = {js_runtime: {}}

    try:
        with YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
        return jsonify(
            title=data.get("title") or "audio",
            channel=data.get("uploader") or data.get("channel") or "",
            duration=fmt_duration(data.get("duration")),
        )
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.post("/download")
def download():
    body = request.get_json(silent=True) or {}
    url     = (body.get("url")     or request.form.get("url")     or "").strip()
    quality = (body.get("quality") or request.form.get("quality") or "320").strip()
    fmt     = (body.get("format")  or request.form.get("format")  or "mp3").strip()
    if not url:
        return jsonify(error="Missing URL."), 400

    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {
            "status": "working",
            "phase": "starting",
            "progress": 0,
            "final_path": None,
            "final_name": None,
            "error": None,
        }

    def worker():
        try:
            staged_path, title, final_fmt = run_yt_dlp(job_id, url, quality, fmt)
            final_path = move_to_output(staged_path, title, final_fmt)
            update_job(
                job_id,
                status="done",
                phase="done",
                progress=100,
                final_path=final_path,
                final_name=os.path.basename(final_path),
            )
        except Exception as e:
            update_job(job_id, status="error", phase="error", error=str(e))
        finally:
            schedule_job_cleanup(job_id)

    threading.Thread(target=worker, daemon=True).start()
    return jsonify(job_id=job_id, out_dir=short_path(OUT_DIR))


@app.get("/progress/<job_id>")
def progress(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify(error="Unknown job."), 404
        return jsonify(
            status=job["status"],
            phase=job["phase"],
            progress=job["progress"],
            error=job.get("error"),
            final_name=job.get("final_name"),
        )


@app.post("/reveal/<job_id>")
def reveal_job(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        final_path = job.get("final_path") if job else None
    if not final_path:
        return jsonify(error="No file for job."), 404
    if not reveal(final_path, select=True):
        return jsonify(error="File no longer exists."), 404
    return ("", 204)


@app.post("/reveal-folder")
def reveal_folder():
    if not reveal(OUT_DIR, select=False):
        return jsonify(error="Output folder missing."), 404
    return ("", 204)


if __name__ == "__main__":
    sweep_staging()
    try:
        from waitress import serve
        print(f" * Saving audio to {OUT_DIR}")
        print(" * Running on http://127.0.0.1:5050 (Press CTRL+C to quit)")
        serve(app, host="127.0.0.1", port=5050, threads=4)
    except ImportError:
        app.run(host="127.0.0.1", port=5050, debug=False)
