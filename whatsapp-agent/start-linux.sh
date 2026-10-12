#!/bin/sh
# Start the Hindivine WhatsApp lead agent on Linux.
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "Install Node.js 18+ from https://nodejs.org first."; exit 1; }
[ -d node_modules ] || npm install --omit=dev || exit 1
OPEN_BROWSER=1 exec node src/server.js
