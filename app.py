import ctypes
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import uuid
import webbrowser

from flask import Flask, jsonify, render_template, request

def _resource_dir():
    """Where Flask reads templates/static from (read-only when frozen)."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def _data_dir():
    """Where downloads + config live (read-write, persistent next to the exe)."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return os.path.dirname(os.path.abspath(__file__))


RESOURCE_DIR = _resource_dir()
DATA_DIR = _data_dir()
APP_DIR = DATA_DIR  # back-compat alias for any external references
DOWNLOADS_DIR = os.path.join(DATA_DIR, "downloads")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")


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
    cfg = load_user_config()
    saved = (cfg.get("out_dir") or "").strip()
    if saved:
        path = os.path.normpath(os.path.expanduser(saved))
        # Self-heal: rewrite config.json if the on-disk value had mixed/forward slashes.
        if path != saved:
            cfg["out_dir"] = path
            save_user_config(cfg)
        try:
            os.makedirs(path, exist_ok=True)
            return path
        except OSError:
            pass
    env = os.environ.get("TAPEDECK_OUT_DIR")
    if env:
        return os.path.normpath(os.path.expanduser(env))
    return os.path.normpath(os.path.expanduser("~/Music/yt"))


DEFAULT_TEMPLATE = "{title}"


def initial_filename_template():
    return (load_user_config().get("filename_template") or "").strip() or DEFAULT_TEMPLATE


class JobCancelled(Exception):
    pass


# Friendly translations for common yt-dlp / network errors. First regex match wins;
# fallback is the raw first line, trimmed.
_ERROR_PATTERNS = [
    (re.compile(r"video unavailable", re.I),
     "Video unavailable — it may be private, deleted, or region-locked."),
    (re.compile(r"sign in to confirm your age", re.I),
     "Age-restricted video. Sign-in required."),
    (re.compile(r"private video", re.I), "Private video."),
    (re.compile(r"members[- ]only", re.I), "Members-only content."),
    (re.compile(r"HTTP Error 429|too many requests", re.I),
     "YouTube rate-limited the request. Wait a moment and retry."),
    (re.compile(r"HTTP Error 403|access denied", re.I),
     "Access forbidden by the host."),
    (re.compile(r"HTTP Error 404|not found", re.I), "URL not found."),
    (re.compile(r"unable to download webpage|name or service not known|getaddrinfo failed",
                re.I),
     "Network error — can't reach the host."),
    (re.compile(r"unsupported url", re.I),
     "Unsupported URL — yt-dlp doesn't recognize this site."),
    (re.compile(r"is not a valid url|not a valid url", re.I),
     "That doesn't look like a valid URL."),
    (re.compile(r"ffmpeg", re.I),
     "FFmpeg error during conversion. Make sure FFmpeg is installed."),
]


def friendlyize_error(exc) -> str:
    msg = str(exc).strip()
    if not msg:
        return "Unknown error."
    for pat, friendly in _ERROR_PATTERNS:
        if pat.search(msg):
            return friendly
    first = msg.splitlines()[0]
    # yt-dlp prefixes errors with "ERROR: " — strip that for a cleaner display.
    first = re.sub(r"^(ERROR|WARNING):\s*", "", first, flags=re.I)
    return first[:220]


OUT_DIR = initial_out_dir()
FILENAME_TEMPLATE = initial_filename_template()
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

app = Flask(
    __name__,
    template_folder=os.path.join(RESOURCE_DIR, "templates"),
    static_folder=os.path.join(RESOURCE_DIR, "static"),
)

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
    p_norm = os.path.normpath(p)
    home_norm = os.path.normpath(os.path.expanduser("~"))
    if p_norm.lower().startswith(home_norm.lower()):
        return "~" + p_norm[len(home_norm):]
    return p_norm


_TOKEN_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def render_filename(template: str, info: dict) -> str:
    """Substitute {token} placeholders with sanitized info values.

    Unknown tokens stay as literals so typos are visible in the filename
    rather than silently dropped. Falls back to the title (or 'audio') if
    the rendered string is empty after substitution and trimming.
    """
    def repl(m):
        val = info.get(m.group(1))
        return safe_name(str(val)) if val is not None else m.group(0)

    rendered = _TOKEN_RE.sub(repl, template or DEFAULT_TEMPLATE)
    rendered = re.sub(r"\s+", " ", rendered).strip()
    if not rendered:
        rendered = safe_name(info.get("title") or "audio")
    return rendered[:160]


def move_to_output(staged_path: str, info: dict, fmt: str, template: str = None) -> str:
    base = render_filename(template or FILENAME_TEMPLATE, info)
    candidate = os.path.join(OUT_DIR, f"{base}.{fmt}")
    n = 1
    while os.path.exists(candidate):
        candidate = os.path.join(OUT_DIR, f"{base} ({n}).{fmt}")
        n += 1
    shutil.move(staged_path, candidate)
    return candidate


def cleanup_staging_for_job(job_id: str):
    """Remove every file in the staging dir whose name starts with the job_id —
    handles `.webm`, `.m4a`, `.mp3`, `.jpg` thumbnails, partials, etc."""
    prefix = job_id + "."
    try:
        for name in os.listdir(DOWNLOADS_DIR):
            if name.startswith(prefix):
                try:
                    os.unlink(os.path.join(DOWNLOADS_DIR, name))
                except OSError:
                    pass
    except OSError:
        pass


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
        norm = os.path.normpath(path)
        if select:
            # Explorer's /select arg parser expects `/select,"<path>"` — quotes
            # around the path only. subprocess.list2cmdline would instead wrap
            # the whole `/select,<path>` token in quotes when the path contains
            # spaces, which Explorer mis-parses and silently opens Documents
            # instead. Build the command line manually so the quoting is right.
            subprocess.Popen(f'explorer /select,"{norm}"')
        else:
            subprocess.Popen(["explorer", norm])
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


def _cancel_event_for(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        return job.get("cancel_event") if job else None


# Formats whose container supports embedded cover art via FFmpeg.
# wav has no standard cover-art slot, so EmbedThumbnail is skipped there.
_THUMBNAIL_FORMATS = {"mp3", "m4a", "opus", "flac"}


def run_yt_dlp(job_id: str, url: str, quality: str = "320", fmt: str = "mp3"):
    from yt_dlp import YoutubeDL

    quality = quality if quality in ALLOWED_QUALITIES else "320"
    fmt     = fmt     if fmt     in ALLOWED_FORMATS   else "mp3"

    ffmpeg_dir = find_ffmpeg_dir()
    outtmpl = os.path.join(DOWNLOADS_DIR, f"{job_id}.%(ext)s")
    cancel_event = _cancel_event_for(job_id)

    def progress_hook(d):
        if cancel_event and cancel_event.is_set():
            raise JobCancelled()
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            pct = (done / total * 95) if total else 0
            update_job(job_id, phase="downloading", progress=pct)
        elif status == "finished":
            update_job(job_id, phase="converting", progress=96)

    postprocessors = [{
        "key": "FFmpegExtractAudio",
        "preferredcodec": fmt,
        "preferredquality": quality,
    }, {
        # Writes title/artist/album/etc. into the container's metadata block.
        "key": "FFmpegMetadata",
        "add_metadata": True,
    }]
    if fmt in _THUMBNAIL_FORMATS:
        # EmbedThumbnail must come after the audio extraction; yt-dlp orders
        # postprocessors in the list order we provide.
        postprocessors.append({"key": "EmbedThumbnail", "already_have_thumbnail": False})

    opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "writethumbnail": fmt in _THUMBNAIL_FORMATS,
        "progress_hooks": [progress_hook],
        "postprocessors": postprocessors,
    }
    if ffmpeg_dir:
        opts["ffmpeg_location"] = ffmpeg_dir
    js_runtime = find_js_runtime()
    if js_runtime:
        opts["js_runtimes"] = {js_runtime: {}}

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)

    staged_path = os.path.join(DOWNLOADS_DIR, f"{job_id}.{fmt}")
    if not os.path.exists(staged_path):
        raise RuntimeError(f"{fmt.upper()} output not found after FFmpeg conversion.")

    return staged_path, info, fmt


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/config")
def config():
    return jsonify(
        out_dir=short_path(OUT_DIR),
        out_dir_abs=OUT_DIR,
        filename_template=FILENAME_TEMPLATE,
    )


@app.post("/config")
def update_config():
    global OUT_DIR, FILENAME_TEMPLATE
    body = request.get_json(silent=True) or {}
    cfg = load_user_config()
    changed = False

    if "out_dir" in body:
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
        cfg["out_dir"] = expanded
        changed = True

    if "filename_template" in body:
        tpl = (body.get("filename_template") or "").strip() or DEFAULT_TEMPLATE
        # Sanity: template must contain at least one substitutable token, otherwise
        # every download collides into the same name + (n) suffix forever.
        if not _TOKEN_RE.search(tpl):
            return jsonify(error="Template must contain at least one {token}."), 400
        FILENAME_TEMPLATE = tpl
        cfg["filename_template"] = tpl
        changed = True

    if changed:
        save_user_config(cfg)

    return jsonify(
        out_dir=short_path(OUT_DIR),
        out_dir_abs=OUT_DIR,
        filename_template=FILENAME_TEMPLATE,
    )


def _entry_summary(d: dict) -> dict:
    return dict(
        url=d.get("webpage_url") or d.get("url") or "",
        title=d.get("title") or "audio",
        channel=d.get("uploader") or d.get("channel") or "",
        duration=fmt_duration(d.get("duration")),
        thumbnail=d.get("thumbnail") or "",
    )


@app.post("/info")
def info():
    from yt_dlp import YoutubeDL

    body = request.get_json(silent=True) or {}
    url = (body.get("url") or "").strip()
    expand = bool(body.get("expand_playlist"))
    if not url:
        return jsonify(error="Missing URL."), 400

    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": not expand,
        "extract_flat": "in_playlist" if expand else False,
    }
    js_runtime = find_js_runtime()
    if js_runtime:
        opts["js_runtimes"] = {js_runtime: {}}

    try:
        with YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
    except Exception as e:
        return jsonify(error=friendlyize_error(e)), 500

    if expand and data.get("_type") == "playlist":
        entries = [_entry_summary(e) for e in (data.get("entries") or []) if e]
        return jsonify(
            type="playlist",
            title=data.get("title") or "playlist",
            count=len(entries),
            entries=entries,
        )
    return jsonify(_entry_summary(data))


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
            "cancel_event": threading.Event(),
        }

    def worker():
        ev = _cancel_event_for(job_id)
        cancelled = False
        try:
            staged_path, info, final_fmt = run_yt_dlp(job_id, url, quality, fmt)
            final_path = move_to_output(staged_path, info, final_fmt)
            update_job(
                job_id,
                status="done",
                phase="done",
                progress=100,
                final_path=final_path,
                final_name=os.path.basename(final_path),
            )
        except JobCancelled:
            cancelled = True
        except Exception as e:
            # yt-dlp wraps hook exceptions in DownloadError, so a clean cancel may
            # arrive here disguised. Trust the event over the exception type.
            if ev and ev.is_set():
                cancelled = True
            else:
                update_job(job_id, status="error", phase="error",
                           error=friendlyize_error(e))
        finally:
            if cancelled:
                update_job(job_id, status="cancelled", phase="cancelled", error=None)
                cleanup_staging_for_job(job_id)
            schedule_job_cleanup(job_id)

    threading.Thread(target=worker, daemon=True).start()
    return jsonify(job_id=job_id, out_dir=short_path(OUT_DIR))


@app.post("/cancel/<job_id>")
def cancel_job(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify(error="Unknown job."), 404
        ev = job.get("cancel_event")
    if ev:
        ev.set()
    return ("", 204)


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


HOST = "127.0.0.1"
PORT = 5050
URL = f"http://{HOST}:{PORT}"


def _instance_already_running():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.25)
        try:
            s.connect((HOST, PORT))
            return True
        except OSError:
            return False


def _open_browser_when_ready():
    deadline = threading.Event()
    for _ in range(40):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.1)
            try:
                s.connect((HOST, PORT))
                webbrowser.open(URL)
                return
            except OSError:
                deadline.wait(0.1)


if __name__ == "__main__":
    if _instance_already_running():
        webbrowser.open(URL)
        sys.exit(0)
    sweep_staging()
    threading.Thread(target=_open_browser_when_ready, daemon=True).start()
    try:
        from waitress import serve
        print(f" * Saving audio to {OUT_DIR}")
        print(f" * Running on {URL} (Press CTRL+C to quit)")
        serve(app, host=HOST, port=PORT, threads=4)
    except ImportError:
        app.run(host=HOST, port=PORT, debug=False)
