#!/bin/bash

# Modified version of start-md-server.sh that just checks paths
# and doesn't try to start the server

# Get script directory (in viewers folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="${SCRIPT_DIR}/simple-md-server.js"

echo "Script directory: ${SCRIPT_DIR}"
echo "Server script path: ${SERVER_SCRIPT}"

# Check if the server script exists
if [ -f "${SERVER_SCRIPT}" ]; then
  echo "✅ simple-md-server.js exists at the correct path"
else
  echo "❌ simple-md-server.js not found at ${SERVER_SCRIPT}"
  exit 1
fi

echo "✅ All path checks passed!"