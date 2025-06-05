#!/bin/bash

# Open the worktree switcher in the default browser
# This script can be bound to a global hotkey for quick access

PORT=${WORKTREE_SWITCHER_PORT:-3010}
URL="http://localhost:$PORT"

# Check if the server is running
if ! curl -s "$URL" > /dev/null 2>&1; then
  echo "❌ Worktree switcher server is not running!"
  echo "Start it with: pnpm servers"
  exit 1
fi

# Open in default browser
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  open "$URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Linux
  xdg-open "$URL"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  # Windows
  start "$URL"
else
  echo "Unsupported OS: $OSTYPE"
  echo "Please open $URL in your browser"
fi