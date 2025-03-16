#!/bin/bash

# Enhanced wrapper script that uses the new TypeScript CLI

GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}=== Running Markdown Classifier ===${NC}\n"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MONO_ROOT="$(cd "$APP_DIR/.." && pwd)"
CLI_DIR="${MONO_ROOT}/packages/cli"  # Updated to use packages/cli directory
TARGET_FILE="$(pwd)/docs/markdown-report.md"

# Check if the new CLI is built
if [ -f "${CLI_DIR}/dist/index.js" ]; then
  echo "Using the new TypeScript CLI"
  node "${CLI_DIR}/dist/index.js" classify "${TARGET_FILE}" --verbose
else
  echo "New CLI not built yet, using legacy Node.js script"
  node "${SCRIPT_DIR}/classify-markdowns.js"
fi

echo -e "\n${BOLD}${GREEN}=== Markdown Classification Complete ===${NC}"