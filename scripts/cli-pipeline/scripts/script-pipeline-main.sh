#!/bin/bash
# script-pipeline-main.sh - Shell wrapper for the TypeScript CLI implementation
# This script executes the TypeScript version of the script pipeline CLI
# It provides a backwards-compatible interface while using the new service-based approach

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TS_SCRIPT="${SCRIPT_DIR}/script-pipeline-main.ts"

# Load environment variables from .env files
for ENV_FILE in "${ROOT_DIR}/.env" "${ROOT_DIR}/.env.development" "${ROOT_DIR}/.env.local"; do
  if [ -f "${ENV_FILE}" ]; then
    echo "Loading environment variables from ${ENV_FILE}..."
    set -a
    source "${ENV_FILE}"
    set +a
  fi
done

# Ensure we have a valid CLAUDE_API_KEY (copy from ANTHROPIC_API_KEY if needed)
if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY"
  export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
fi

# Check for TS_NODE and install if needed
if ! command -v ts-node &> /dev/null; then
  echo "ts-node not found, installing with npm..."
  npm install -g ts-node typescript
fi

# Check for typescript and install if needed
if ! command -v tsc &> /dev/null; then
  echo "TypeScript not found, installing with npm..."
  npm install -g typescript
fi

# Verify TypeScript script exists
if [ ! -f "${TS_SCRIPT}" ]; then
  echo "Error: Cannot find script-pipeline-main.ts at ${TS_SCRIPT}"
  exit 1
fi

# Display a separator for better readability
echo "===================================================================="
echo "                  Script Pipeline (Service-Based)"
echo "===================================================================="

# Pass all arguments to the TypeScript script
ts-node "${TS_SCRIPT}" "$@"
exit $?