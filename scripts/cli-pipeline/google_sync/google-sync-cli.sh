#!/bin/bash
# Script to run the Google Sync CLI
# Usage: ./google-sync-cli.sh <command> [options]

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Handle specific commands that might need special treatment
if [ "$1" = "count-mp4" ]; then
  shift
  ts-node "$SCRIPT_DIR/count-mp4-files.ts" "$@"
  exit $?
fi

# Run the TypeScript file with ts-node
ts-node "$SCRIPT_DIR/index.ts" "$@"