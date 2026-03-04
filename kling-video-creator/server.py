#!/usr/bin/env python3
"""
Kling Video Creator — Flask + FAL.ai Kling V3 Pro
Image-to-video generation via the FAL.ai API.
"""

import os
import json
import uuid
import requests
from datetime import datetime
from pathlib import Path

from flask import (
    Flask, render_template, request, jsonify,
    send_from_directory, session, redirect,
)
from dotenv import load_dotenv

load_dotenv()

# ── FAL_KEY must be in environment before importing fal_client ──────────────
os.environ.setdefault("FAL_KEY", os.getenv("FAL_KEY", ""))

import fal_client  # noqa: E402 — imported after env is set

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY") or os.urandom(24).hex()

# ── Auth ────────────────────────────────────────────────────────────────────
ACCESS_PIN       = os.getenv("ACCESS_PIN", "").strip()
EXEMPT_ENDPOINTS = {"login", "logout", "static"}


@app.before_request
def check_auth():
    if not ACCESS_PIN:
        return
    if request.endpoint in EXEMPT_ENDPOINTS:
        return
    if not session.get("authenticated"):
        return redirect("/login")


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        pin = request.form.get("pin", "").strip()
        if pin == ACCESS_PIN:
            session["authenticated"] = True
            return redirect("/")
        error = "Incorrect PIN — try again."
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.pop("authenticated", None)
    return redirect("/login")


# ── Storage ─────────────────────────────────────────────────────────────────
OUTPUTS_DIR  = Path(__file__).parent / "outputs"
UPLOADS_DIR  = Path(__file__).parent / "uploads"
GALLERY_JSON = OUTPUTS_DIR / "gallery.json"


def ensure_dirs():
    OUTPUTS_DIR.mkdir(exist_ok=True)
    UPLOADS_DIR.mkdir(exist_ok=True)
    if not GALLERY_JSON.exists():
        GALLERY_JSON.write_text("[]")


def load_gallery():
    try:
        return json.loads(GALLERY_JSON.read_text())
    except Exception:
        return []


def save_gallery(entries):
    GALLERY_JSON.write_text(json.dumps(entries, indent=2))


def fal_key():
    return os.getenv("FAL_KEY", "").strip()


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/status")
def status():
    key = fal_key()
    return jsonify({
        "api_key_set": bool(key),
        "model":       "Kling V3 Pro",
        "endpoint":    "fal-ai/kling-video/v3/pro/image-to-video",
    })


@app.route("/gallery")
def gallery_index():
    ensure_dirs()
    return jsonify(load_gallery())


@app.route("/outputs/<path:filename>")
def serve_output(filename):
    return send_from_directory(OUTPUTS_DIR, filename)


@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOADS_DIR, filename)


# ── Upload image → FAL CDN ───────────────────────────────────────────────────

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif", "avif"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[-1].lower() in ALLOWED_EXTENSIONS


@app.route("/upload", methods=["POST"])
def upload_image():
    if not fal_key():
        return jsonify({"error": "FAL_KEY not set — add it to your .env file."}), 500

    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "No file provided"}), 400
    if not allowed_file(f.filename):
        return jsonify({"error": "Unsupported file type"}), 400

    ensure_dirs()
    ext      = f.filename.rsplit(".", 1)[-1].lower()
    fname    = f"{uuid.uuid4().hex}.{ext}"
    local    = UPLOADS_DIR / fname
    f.save(str(local))

    try:
        fal_url = fal_client.upload_file(str(local))
    except Exception as e:
        return jsonify({"error": f"FAL upload failed: {e}"}), 500

    return jsonify({"url": fal_url, "local": f"/uploads/{fname}"})


# ── Generate video ───────────────────────────────────────────────────────────

@app.route("/generate", methods=["POST"])
def generate():
    key = fal_key()
    if not key:
        return jsonify({"error": "FAL_KEY not found. Add it to your .env file."}), 500

    # Propagate key to environment for fal_client
    os.environ["FAL_KEY"] = key

    data             = request.get_json(force=True)
    start_image_url  = (data.get("start_image_url") or "").strip()
    end_image_url    = (data.get("end_image_url")   or "").strip() or None
    prompt           = (data.get("prompt")          or "").strip()
    # Duration is a string enum for Kling V3: "5", "10", or "15"
    duration         = str(data.get("duration", "5"))
    if duration not in ("5", "10", "15"):
        duration = "5"
    aspect_ratio     = data.get("aspect_ratio", "16:9")
    negative_prompt  = data.get("negative_prompt", "blur, distort, and low quality")
    cfg_scale        = float(data.get("cfg_scale", 0.5))
    generate_audio   = bool(data.get("generate_audio", True))
    elements         = data.get("elements") or []   # list of {image_url: ...}

    if not start_image_url:
        return jsonify({"error": "start_image_url is required"}), 400

    arguments = {
        "start_image_url":  start_image_url,
        "prompt":           prompt,
        "duration":         duration,
        "aspect_ratio":     aspect_ratio,
        "negative_prompt":  negative_prompt,
        "cfg_scale":        cfg_scale,
        "generate_audio":   generate_audio,
    }
    if end_image_url:
        arguments["end_image_url"] = end_image_url
    if elements:
        arguments["elements"] = elements

    try:
        result = fal_client.subscribe(
            "fal-ai/kling-video/v3/pro/image-to-video",
            arguments=arguments,
        )
    except Exception as e:
        return jsonify({"error": f"FAL generation failed: {e}"}), 500

    video_url = None
    try:
        video_url = result["video"]["url"]
    except (KeyError, TypeError):
        pass

    if not video_url:
        return jsonify({"error": "No video URL in FAL response"}), 500

    # ── Download and persist ─────────────────────────────────────────────────
    try:
        ensure_dirs()
        ts_str   = datetime.now().strftime("%Y%m%d_%H%M%S")
        entry_id = uuid.uuid4().hex[:8]
        filename = f"kling_{ts_str}_{entry_id}.mp4"

        dl = requests.get(video_url, timeout=120)
        dl.raise_for_status()
        (OUTPUTS_DIR / filename).write_bytes(dl.content)

        gallery = load_gallery()
        gallery.insert(0, {
            "id":             entry_id,
            "timestamp":      datetime.now().isoformat(),
            "filename":       filename,
            "prompt":         prompt,
            "duration":       duration,
            "aspect_ratio":   aspect_ratio,
            "negative_prompt": negative_prompt,
            "cfg_scale":      cfg_scale,
            "generate_audio": generate_audio,
        })
        save_gallery(gallery)
    except Exception as e:
        print(f"[warn] Could not save video: {e}")
        # Still return success — video is in FAL CDN
        filename = None

    print(f"  ◈  [KLING V3] {aspect_ratio} · {duration}s · audio={generate_audio} · elements={len(elements)}")

    return jsonify({
        "video_url":  f"/outputs/{filename}" if filename else video_url,
        "filename":   filename,
        "fal_url":    video_url,
        "duration":   duration,
        "aspect_ratio": aspect_ratio,
    })


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5151))
    ensure_dirs()
    print(f"\n  ◈  Kling Video Creator")
    print(f"     http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
