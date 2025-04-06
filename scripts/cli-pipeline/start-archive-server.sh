#!/bin/bash

# Run the docs-archive-server.js standalone server
# This script provides a convenient way to start the server

# Determine the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the script directory
cd "$SCRIPT_DIR"

# Make sure the docs-archive-server.js file exists
if [ ! -f "./docs-archive-server.js" ]; then
  echo "Error: docs-archive-server.js not found in $SCRIPT_DIR"
  exit 1
fi

# Check if port 3003 is already in use
if lsof -Pi :3003 -sTCP:LISTEN -t >/dev/null ; then
  echo "Warning: Port 3003 is already in use."
  echo "Another instance may be running or use a different port."
  echo "Kill the existing process with: kill $(lsof -Pi :3003 -sTCP:LISTEN -t)"
  exit 1
fi

# Run the server
echo "Starting docs-archive-server on port 3003..."
node --experimental-modules ./docs-archive-server.js

# This will keep running until terminated by the user