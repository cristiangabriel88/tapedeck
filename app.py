from flask import Flask, request, send_file, render_template_string
import os
import re
import shutil
import subprocess
import uuid

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(APP_DIR, "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

HTML = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Local YouTube → MP3</title>
  <style>
    body{font-family:system-ui,Segoe UI,Arial;margin:0;background:#0b1020;color:#fff}
    .wrap{max-width:720px;margin:40px auto;padding:24px}
    .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:18px}
    input{width:100%;padding:14px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:#fff}
    button{margin-top:12px;width:100%;padding:14px 12px;border-radius:12px;border:0;background:#7c5cff;color:#fff;font-weight:700;cursor:pointer}
    button:active{transform:scale(.99)}
    .muted{color:rgba(255,255,255,.65);font-size:14px;margin-top:10px}
    .err{color:#ff7b7b;margin-top:12px;white-space:pre-wrap}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h2 style="margin:0 0 12px 0;">Local YouTube → MP3</h2>
      <form method="post" action="/download">
        <input name="url" placeholder="Paste YouTube URL..." required />
        <button type="submit">Download MP3</button>
      </form>
      <div class="muted">Runs locally. Saves MP3 via yt-dlp + FFmpeg.</div>
      {% if error %}<div class="err">{{ error }}</div>{% endif %}
    </div>
  </div>
</body>
</html>
"""

app = Flask(__name__)

def ensure_ffmpeg():
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg not found. Install FFmpeg and ensure it's in PATH.")

def safe_name(s: str) -> str:
    s = re.sub(r"[^\w\-\.\(\)\[\]\s]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:120] if s else "audio"

def run_yt_dlp(url: str, out_dir: str):
    from yt_dlp import YoutubeDL

    ffmpeg_dir = r"C:\Users\crist\AppData\Local\Microsoft\WinGet\Links"


    job_id = uuid.uuid4().hex
    outtmpl = os.path.join(out_dir, f"{job_id}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "ffmpeg_location": ffmpeg_dir,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "0",
            }
        ],
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title", "audio")

    mp3_path = os.path.join(out_dir, f"{job_id}.mp3")

    if not os.path.exists(mp3_path):
        raise RuntimeError("MP3 output not found even after FFmpeg conversion.")

    return mp3_path, safe_name(title)

@app.get("/")
def index():
    return render_template_string(HTML, error=None)

@app.post("/download")
def download():
    url = (request.form.get("url") or "").strip()
    if not url:
        return render_template_string(HTML, error="Missing URL.")

    try:
        mp3_path, title = run_yt_dlp(url, DOWNLOADS_DIR)
        final_name = f"{title}.mp3"
        return send_file(mp3_path, as_attachment=True, download_name=final_name, mimetype="audio/mpeg")
    except Exception as e:
        return render_template_string(HTML, error=str(e))

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)
