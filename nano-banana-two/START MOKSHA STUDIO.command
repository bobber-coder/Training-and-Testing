#!/bin/bash
# MOKSHA AI — Nano Banana 2 Studio launcher

cd "$(dirname "$0")"

# ── Set to true to expose a public team URL via ngrok ──────
USE_NGROK=true
# ──────────────────────────────────────────────────────────

# Get port from .env or default
PORT=$(grep -m1 "^PORT=" .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
PORT=${PORT:-5150}

# Check .env exists
if [ ! -f .env ]; then
  echo ""
  echo "  ⚠  .env file not found."
  echo "     Copy .env.example to .env and add your GEMINI_API_KEY."
  echo ""
  read -n 1 -s -r -p "  Press any key to exit..."
  exit 1
fi

# Install deps if needed
pip3 install -q -r requirements.txt 2>/dev/null

echo ""
echo "  ◈  MOKSHA AI · Nano Banana 2 Studio"
echo "     http://localhost:${PORT}"

# ── ngrok team sharing ─────────────────────────────────────
if [ "$USE_NGROK" = true ]; then
  if ! command -v ngrok &>/dev/null; then
    echo ""
    echo "  ⚠  ngrok not found. Install it from https://ngrok.com/download"
    echo "     or: brew install ngrok"
  else
    echo ""
    echo "  ◈  Starting ngrok tunnel for team access…"
    # Kill any existing ngrok
    pkill -f "ngrok http" 2>/dev/null
    sleep 0.5
    ngrok http "$PORT" --log=stdout > /tmp/moksha_ngrok.log 2>&1 &
    NGROK_PID=$!
    sleep 2.5
    # Extract public URL from ngrok API
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null)
    if [ -n "$NGROK_URL" ]; then
      echo "  ◈  Team URL: $NGROK_URL"
      PIN=$(grep -m1 "^ACCESS_PIN=" .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
      if [ -n "$PIN" ]; then
        echo "  ◈  PIN protection: ON (set in .env → ACCESS_PIN)"
      else
        echo "  ⚠  No PIN set — anyone with the link can generate images."
        echo "     Add ACCESS_PIN=yourpin to .env to protect it."
      fi
    else
      echo "  ⚠  Could not get ngrok URL — check /tmp/moksha_ngrok.log"
    fi
  fi
fi
# ──────────────────────────────────────────────────────────

echo ""

# Open local browser after short delay
sleep 1.5 && open http://localhost:${PORT} &

python3 server.py
