#!/bin/bash

# Media Analytics CLI - Analyze media tracking data

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/media-analytics-cli.ts"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to track command usage
track_command() {
    local command="$1"
    shift
    local args="$*"
    
    # Track the command in database
    ts-node "$SCRIPT_DIR/../../../scripts/cli-pipeline/all_pipelines/commands/track-command.ts" \
        --pipeline "media_analytics" \
        --command "$command" \
        --args "$args" \
        2>/dev/null || true
}

# Check if ts-node is available
if ! command -v ts-node &> /dev/null; then
    echo -e "${RED}Error: ts-node is not installed. Please run: pnpm install -g ts-node${NC}"
    exit 1
fi

# Show help if no arguments
if [ $# -eq 0 ]; then
    echo -e "${YELLOW}Media Analytics CLI${NC}"
    echo ""
    ts-node "$CLI_SCRIPT" --help
    exit 0
fi

# Extract command for tracking
COMMAND="$1"

# Track the command
track_command "$COMMAND" "${@:2}"

# Execute the CLI command
echo -e "${GREEN}Executing command: $COMMAND${NC}"
ts-node "$CLI_SCRIPT" "$@"