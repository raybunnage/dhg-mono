#!/bin/bash

# This script classifies an untyped script by using the prompt-lookup approach
# It combines the best parts of prompt-lookup.sh and analyze-script.ts
# Usage: classify-script-with-prompt.sh [script_count]
# Example: classify-script-with-prompt.sh 5 - This will classify 5 untyped scripts

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Ensure we're in the repo root directory
cd "$REPO_ROOT"

# Get the script count from command line arguments
SCRIPT_COUNT="${1:-1}" # Default to 1 if not provided

# Validate that the count is a positive integer
if ! [[ "$SCRIPT_COUNT" =~ ^[0-9]+$ ]] || [ "$SCRIPT_COUNT" -lt 1 ]; then
    echo "Error: Script count must be a positive integer"
    echo "Usage: classify-script-with-prompt.sh [script_count]"
    echo "Example: classify-script-with-prompt.sh 5"
    exit 1
fi

echo "Will process $SCRIPT_COUNT script(s)"

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

if [ -n "$CLAUDE_API_KEY" ]; then
    echo "- CLAUDE_API_KEY: ${CLAUDE_API_KEY:0:5}..."
else
    echo "- CLAUDE_API_KEY: not set"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "- ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:5}..."
else
    echo "- ANTHROPIC_API_KEY: not set"
fi

# Execute the TypeScript file with ts-node and pass the script count
echo "Starting script classification for $SCRIPT_COUNT script(s)..."
ts-node "$SCRIPT_DIR/classify-script-with-prompt.ts" "$SCRIPT_COUNT"

# Check the exit code
if [ $? -eq 0 ]; then
    echo "✅ Script classification process completed successfully"
else
    echo "❌ Script classification process failed"
    exit 1
fi