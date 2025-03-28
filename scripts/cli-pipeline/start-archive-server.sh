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

# Run the server
echo "Starting docs-archive-server on port 3003..."
node ./docs-archive-server.js

# This will keep running until terminated by the user