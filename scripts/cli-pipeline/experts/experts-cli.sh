#!/bin/bash
# Experts CLI Pipeline
# Shell script wrapper for the Experts CLI utilities

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLI_DIR="$SCRIPT_DIR"

# Change to the project root directory (important for relative paths)
cd "$SCRIPT_DIR/../../.." || { echo "Error: Could not change to project root directory"; exit 1; }

# Execute the TypeScript CLI with Node.js
exec ts-node "$CLI_DIR/experts-cli.ts" "$@"