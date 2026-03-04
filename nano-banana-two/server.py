#!/usr/bin/env python3
"""
MOKSHA AI — Nano Banana 2 Image Studio
Direct Google Gemini 3.1 Flash Image API integration.
No intermediaries. No markup.
"""

import os
import json
import uuid
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
import requests
from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY") or os.urandom(24).hex()

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

# Available models — update IDs here if Google renames them
MODELS = {
    "nb2": {
        "id":   os.getenv("GEMINI_MODEL",     "gemini-3.1-flash-image-preview"),
        "name": "Nano Banana 2",
    },
    "pro": {
        "id":   os.getenv("GEMINI_PRO_MODEL", "nano-banana-pro-preview"),
        "name": "Nano Banana Pro",
    },
}

# Optional PIN gate — set ACCESS_PIN in .env to require a password
ACCESS_PIN = os.getenv("ACCESS_PIN", "").strip()

EXEMPT_ENDPOINTS = {"login", "logout", "static"}

@app.before_request
def check_auth():
    if not ACCESS_PIN:
        return  # No PIN set → open access (local use)
    if request.endpoint in EXEMPT_ENDPOINTS:
        return  # Always allow login page + static assets
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

# ─── Library / storage ─────────────────────────────────────────────────────────

OUTPUTS_DIR  = Path(__file__).parent / "outputs"
GALLERY_JSON = OUTPUTS_DIR / "gallery.json"

def ensure_outputs():
    OUTPUTS_DIR.mkdir(exist_ok=True)
    if not GALLERY_JSON.exists():
        GALLERY_JSON.write_text("[]")

def load_gallery():
    try:
        return json.loads(GALLERY_JSON.read_text())
    except Exception:
        return []

def save_gallery(entries):
    GALLERY_JSON.write_text(json.dumps(entries, indent=2))


def api_key():
    return os.getenv("GEMINI_API_KEY", "")


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/status")
def status():
    key = api_key()
    info = {"api_key_set": bool(key), "model": MODELS["nb2"]["id"]}
    if key:
        try:
            r = requests.get(
                f"{GEMINI_BASE}/models?key={key}&pageSize=1", timeout=5
            )
            info["api_reachable"] = r.status_code == 200
        except Exception:
            info["api_reachable"] = False
    return jsonify(info)


@app.route("/models")
def list_models():
    """Return available Gemini models so the user can verify the model ID."""
    key = api_key()
    if not key:
        return jsonify({"error": "No API key set"}), 500
    try:
        r = requests.get(
            f"{GEMINI_BASE}/models?key={key}&pageSize=100", timeout=10
        )
        if r.status_code != 200:
            return jsonify({"error": r.json().get("error", {}).get("message", "Failed")}), r.status_code
        models = r.json().get("models", [])
        generate_models = [
            m for m in models
            if "generateContent" in m.get("supportedGenerationMethods", [])
        ]
        return jsonify({"models": generate_models})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/gallery")
def gallery_index():
    ensure_outputs()
    return jsonify(load_gallery())


@app.route("/outputs/<path:filename>")
def serve_output(filename):
    return send_from_directory(OUTPUTS_DIR, filename)


@app.route("/generate", methods=["POST"])
def generate():
    key = api_key()
    if not key:
        return jsonify({"error": "GEMINI_API_KEY not found. Add it to your .env file."}), 500

    data          = request.get_json(force=True)
    model_key     = data.get("model", "nb2")
    model_info    = MODELS.get(model_key, MODELS["nb2"])
    model_id      = model_info["id"]
    prompt        = (data.get("prompt") or "").strip()
    aspect_ratio  = data.get("aspectRatio", "auto")
    resolution    = data.get("resolution", "1K")
    num_images    = min(max(int(data.get("numImages", 1)), 1), 8)
    seed          = data.get("seed")
    output_format = data.get("outputFormat", "png")
    use_search    = bool(data.get("useWebSearch", False))
    # Support multiple reference images: [{data, mimeType}, ...]
    ref_images    = data.get("referenceImages", [])
    # Also accept legacy single-image keys for backwards compat
    if not ref_images and data.get("referenceImage"):
        ref_images = [{"data": data["referenceImage"], "mimeType": data.get("referenceMimeType", "image/jpeg")}]

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # Map UI values to exact API parameter values
    # imageSize: API requires "512px", "1K", "2K", "4K" (uppercase K)
    res_map = {"0.5K": "512px", "1K": "1K", "2K": "2K", "4K": "4K"}
    image_size = res_map.get(resolution, "1K")

    # aspectRatio: API accepts "1:1","16:9","9:16","4:3","3:4","2:3","3:2",
    #              "4:5","5:4","21:9","1:4","4:1","1:8","8:1"
    # "auto" = omit the parameter, let the model decide
    api_aspect = None if aspect_ratio == "auto" else aspect_ratio

    full_prompt = prompt

    # Safety — always maximally permissive
    safety_settings = [
        {"category": c, "threshold": "BLOCK_NONE"}
        for c in [
            "HARM_CATEGORY_HARASSMENT",
            "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "HARM_CATEGORY_DANGEROUS_CONTENT",
        ]
    ]

    fal_key_val = os.getenv("FAL_API_KEY", "").strip()
    # FAL wraps the same Gemini model and correctly delivers 2K/4K output.
    # Google's direct REST API has a confirmed bug silently ignoring imageConfig.
    # Use FAL when: key is set + NB2 model + no reference images (FAL t2i doesn't support refs).
    use_fal = bool(fal_key_val) and model_key == "nb2" and not ref_images

    all_images = []
    errors     = []

    if use_fal:
        # ── FAL path — true resolution support ─────────────────────────────────
        fal_url   = "https://fal.run/fal-ai/nano-banana-2"
        remaining = num_images
        while remaining > 0:
            batch   = min(remaining, 4)   # FAL supports up to 4 per request
            payload = {
                "prompt":            full_prompt,
                "num_images":        batch,
                "aspect_ratio":      api_aspect or "auto",
                "output_format":     output_format,
                "safety_tolerance":  "4",
                "resolution":        resolution,   # "0.5K" | "1K" | "2K" | "4K"
                "enable_web_search": use_search,
                "limit_generations": False,
            }
            if seed is not None:
                try:
                    payload["seed"] = int(seed)
                except (ValueError, TypeError):
                    pass
            try:
                resp = requests.post(
                    fal_url,
                    json=payload,
                    headers={"Authorization": f"Key {fal_key_val}", "Content-Type": "application/json"},
                    timeout=180,
                )
                if resp.status_code != 200:
                    err_data = resp.json() if resp.content else {}
                    errors.append(err_data.get("detail", f"FAL error {resp.status_code}"))
                else:
                    for img_info in resp.json().get("images", []):
                        url  = img_info.get("url", "")
                        mime = img_info.get("content_type", "image/png")
                        if url.startswith("data:"):
                            b64 = url.split(",", 1)[1]
                        else:
                            # Download from FAL CDN
                            dl  = requests.get(url, timeout=60)
                            b64 = base64.b64encode(dl.content).decode()
                        all_images.append({"data": b64, "mimeType": mime})
            except requests.Timeout:
                errors.append("FAL request timed out — try again.")
            except Exception as e:
                errors.append(str(e))
            remaining -= batch

    else:
        # ── Google path — used for: Pro model, reference-image generations ─────
        api_url = f"{GEMINI_BASE}/models/{model_id}:generateContent?key={key}"

        def fetch_one(i):
            parts = []
            for ref in ref_images:
                parts.append({"inlineData": {"mimeType": ref.get("mimeType", "image/jpeg"), "data": ref["data"]}})
            parts.append({"text": full_prompt})

            image_config = {"imageSize": image_size}
            if api_aspect:
                image_config["aspectRatio"] = api_aspect

            cfg = {
                "responseModalities": ["TEXT", "IMAGE"],   # TEXT required for imageConfig to be respected
                "temperature": 1.0,
                "candidateCount": 1,
                "imageConfig": image_config,
            }
            if seed is not None:
                try:
                    cfg["seed"] = int(seed) + i
                except (ValueError, TypeError):
                    pass

            payload = {
                "contents":         [{"parts": parts}],
                "generationConfig": cfg,
                "safetySettings":   safety_settings,
            }
            if use_search:
                payload["tools"] = [{"googleSearch": {}}]

            try:
                resp = requests.post(api_url, json=payload, timeout=120)
                if resp.status_code != 200:
                    body = resp.json() if resp.content else {}
                    msg  = body.get("error", {}).get("message", f"HTTP {resp.status_code}")
                    return [], f"Image {i+1}: {msg}"
                imgs = []
                for candidate in resp.json().get("candidates", []):
                    for part in candidate.get("content", {}).get("parts", []):
                        if "inlineData" in part:
                            imgs.append({
                                "data":     part["inlineData"]["data"],
                                "mimeType": part["inlineData"].get("mimeType", "image/png"),
                            })
                return imgs, None
            except requests.Timeout:
                return [], f"Image {i+1}: Request timed out — try again."
            except Exception as e:
                return [], f"Image {i+1}: {str(e)}"

        with ThreadPoolExecutor(max_workers=num_images) as executor:
            for imgs, err in executor.map(fetch_one, range(num_images)):
                all_images.extend(imgs)
                if err:
                    errors.append(err)

    if not all_images and errors:
        return jsonify({"error": errors[0]}), 500

    # ── Persist to disk ────────────────────────────────────────────────────────
    try:
        ensure_outputs()
        gallery_entries = load_gallery()
        batch_ts = datetime.now().isoformat()
        for img in all_images:
            ext       = img["mimeType"].split("/")[-1] or "png"
            ts_str    = datetime.now().strftime("%Y%m%d_%H%M%S")
            entry_id  = uuid.uuid4().hex[:8]
            filename  = f"moksha_{ts_str}_{entry_id}.{ext}"
            img_bytes = base64.b64decode(img["data"])
            (OUTPUTS_DIR / filename).write_bytes(img_bytes)
            gallery_entries.insert(0, {
                "id":          entry_id,
                "timestamp":   batch_ts,
                "filename":    filename,
                "mimeType":    img["mimeType"],
                "prompt":      prompt,
                "promptUsed":  full_prompt,
                "model":       model_id,
                "modelName":   model_info["name"],
                "aspectRatio": aspect_ratio,
                "resolution":  resolution,
                "outputFormat": output_format,
                "seed":        seed,
            })
        save_gallery(gallery_entries)
    except Exception as e:
        print(f"[warn] Could not save images to disk: {e}")

    backend = "fal" if use_fal else "google"
    print(f"  ◈  [{backend.upper()}] {len(all_images)} image(s) · {resolution} · {aspect_ratio}")

    return jsonify({
        "images":      all_images,
        "model":       model_id,
        "model_name":  model_info["name"],
        "prompt_used": full_prompt,
        "errors":      errors,
        "backend":     backend,
    })


# ─── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5150))
    print(f"\n  ◈  MOKSHA AI · Nano Banana 2 Studio")
    print(f"     http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
