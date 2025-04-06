#!/bin/bash

# Script to directly check the path resolution of the start script

# Run this from the viewers directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "Path resolved to: $SCRIPT_DIR"

# Check if server scripts exist
if [ -f "$SCRIPT_DIR/simple-md-server.js" ]; then
  echo "✅ simple-md-server.js exists in current directory"
else
  echo "❌ simple-md-server.js not found in current directory"
fi

if [ -f "$SCRIPT_DIR/simple-script-server.js" ]; then
  echo "✅ simple-script-server.js exists in current directory"
else
  echo "❌ simple-script-server.js not found in current directory"
fi

if [ -f "$SCRIPT_DIR/docs-archive-server.js" ]; then
  echo "✅ docs-archive-server.js exists in current directory"
else
  echo "❌ docs-archive-server.js not found in current directory"
fi