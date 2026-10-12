#!/bin/bash
# Double-click to start the Hindivine WhatsApp lead agent on a Mac.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org, then double-click this file again."
  open https://nodejs.org
  read -r -p "Press Enter to close."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing for the first time, please wait..."
  npm install --omit=dev || { read -r -p "Install failed. Press Enter to close."; exit 1; }
fi
OPEN_BROWSER=1 node src/server.js
read -r -p "The agent stopped. Press Enter to close."
