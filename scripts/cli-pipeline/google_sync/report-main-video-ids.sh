#!/bin/bash
# Script to directly run the report-main-video-ids.ts script
# Usage: ./report-main-video-ids.sh [options]

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the TypeScript file with ts-node
ts-node "$SCRIPT_DIR/report-main-video-ids.ts" "$@"