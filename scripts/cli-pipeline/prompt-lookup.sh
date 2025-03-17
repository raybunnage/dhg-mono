#!/bin/bash

# This script executes the prompt-lookup.ts file with ts-node
# Usage: ./prompt-lookup.sh [prompt-name]

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Ensure we're in the repo root directory
cd "$REPO_ROOT"

# Check if ts-node is installed
if ! command -v ts-node &> /dev/null; then
    echo "Error: ts-node is not installed. Please install it with 'npm install -g ts-node typescript'."
    exit 1
fi

# Default prompt name is "script-analysis-prompt" if not provided
PROMPT_NAME=${1:-"script-analysis-prompt"}

# Execute the TypeScript file with ts-node
echo "Looking up prompt: $PROMPT_NAME"
ts-node "$SCRIPT_DIR/prompt-lookup.ts" "$PROMPT_NAME"