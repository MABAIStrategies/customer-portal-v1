#!/bin/bash
# ============================================================
#  Apex Abstracts — one-click launcher (Linux)
#  Run this file to start the Title Search app.
#  It starts the local server and opens your browser.
# ============================================================

# Move to the folder this script lives in (the repo root).
cd "$(dirname "$0")" || exit 1

URL="http://localhost:8787"

echo ""
echo "  +------------------------------------------+"
echo "  |   APEX ABSTRACTS - Title Search          |"
echo "  +------------------------------------------+"
echo ""

# 1. Make sure Node.js is installed.
if ! command -v node >/dev/null 2>&1; then
  echo "  !  Node.js is not installed."
  echo ""
  echo "  Apex needs Node.js (version 18 or newer) to run."
  echo "  Install it with your package manager, e.g.:"
  echo "      sudo apt install nodejs        (Debian/Ubuntu)"
  echo "  or download the LTS version from:  https://nodejs.org"
  echo "  Then run this launcher again."
  echo ""
  read -n 1 -s -r -p "  Press any key to close..."
  exit 1
fi

echo "  OK Node.js found ($(node --version))"
echo "  >  Starting the Apex app..."
echo "  >  Your browser will open to: $URL"
echo ""
echo "  Keep this window OPEN while you use Apex."
echo "  Close it (or press Ctrl+C) when you're done."
echo ""

# 2. Open the browser shortly after the server boots.
#    Try the common Linux openers; ignore if none exist.
(
  sleep 2
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
  elif command -v gio >/dev/null 2>&1; then gio open "$URL"
  elif command -v sensible-browser >/dev/null 2>&1; then sensible-browser "$URL"
  fi
) >/dev/null 2>&1 &

# 3. Start the backend (this keeps the window running).
node backend/server.mjs
