#!/bin/bash
# Command History Tracker Wrapper
#
# This script provides a simple wrapper around the command-history-tracker.ts script
# to make it easier to track command history.
#
# Usage:
#   ./track.sh [category] [command]
#
# Example:
#   ./track.sh git "git push origin main"
#   ./track.sh pnpm "pnpm install marked"
#
# You can also create aliases in your .bashrc or .zshrc file:
#   alias tgit='~/path/to/track.sh git'
#   alias tpnpm='~/path/to/track.sh pnpm'
#
# Then use them like:
#   tgit "git push origin main"
#   tpnpm "pnpm install marked"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Check if ts-node is installed
if ! command -v ts-node &> /dev/null; then
    echo "Error: ts-node is not installed. Please install it with 'npm install -g ts-node'"
    exit 1
fi

# Check if the required arguments are provided
if [ $# -lt 2 ]; then
    echo "Usage: $0 [category] [command]"
    echo "Valid categories: git, pnpm, build, deploy, database, system, other"
    exit 1
fi

CATEGORY="$1"
COMMAND="${@:2}"

# Execute the command tracker from the correct location
ts-node "$PROJECT_ROOT/scripts/cli-pipeline/command-history-tracker.ts" "$CATEGORY" "$COMMAND" 