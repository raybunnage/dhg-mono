#!/bin/bash

# Script to start the local markdown server for development
# This allows direct file reading from disk
# No external dependencies required!

# Get script directory (in viewers folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="${SCRIPT_DIR}/simple-md-server.js"

# Check if the server script exists
if [ ! -f "${SERVER_SCRIPT}" ]; then
  echo "Error: Cannot find simple-md-server.js at ${SERVER_SCRIPT}"
  exit 1
fi

# Check if port 3001 is already in use
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
  echo "Warning: Port 3001 is already in use."
  echo "Another instance may be running or use a different port."
  echo "Kill the existing process with: kill $(lsof -Pi :3001 -sTCP:LISTEN -t)"
  exit 1
fi

# Start the simple server
echo "Starting simple markdown file server on port 3001..."
echo "NOTE: Ignore any localhost connection errors in the browser console."
echo "Those are related to Vite HMR, not the markdown server."

# Run with Node.js properly identifying it as an ES module
node --experimental-modules "${SERVER_SCRIPT}"

# If the server fails to start, show an error message
if [ $? -ne 0 ]; then
  echo "Error starting markdown server"
  echo "Try running 'node ${SERVER_SCRIPT}' directly to see the error"
  exit 1
fi