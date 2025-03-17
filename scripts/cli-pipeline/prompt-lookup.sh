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

# Load environment variables from .env file
if [ -f .env ]; then
    echo "Loading environment from .env file..."
    set -a
    source .env
    set +a
fi

# Also try .env.local which might contain secret keys
if [ -f .env.local ]; then
    echo "Loading environment from .env.local file..."
    set -a
    source .env.local
    set +a
fi

# Default prompt name is "script-analysis-prompt" if not provided
PROMPT_NAME=${1:-"script-analysis-prompt"}

# Print the environment variables for debugging (with censored values)
echo "Environment configuration:"
if [ -n "$SUPABASE_URL" ]; then
    echo "- SUPABASE_URL: ${SUPABASE_URL:0:12}..."
else
    echo "- SUPABASE_URL: not set"
fi

if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "- SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:5}..."
else
    echo "- SUPABASE_SERVICE_ROLE_KEY: not set"
fi

# Execute the TypeScript file with ts-node
echo "Looking up prompt: $PROMPT_NAME"
ts-node "$SCRIPT_DIR/prompt-lookup.ts" "$PROMPT_NAME"