#!/bin/bash

# Script to examine markdown files and their associated prompts and relationships

GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}=== Running Markdown Examiner ===${NC}\n"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MONO_ROOT="$(cd "$APP_DIR/.." && pwd)"
CLI_DIR="${MONO_ROOT}/packages/cli"  # Updated to use packages/cli directory
TARGET_FILE="$(pwd)/docs/markdown-report.md"

# Make sure we have the file to examine
if [ ! -f "$TARGET_FILE" ]; then
  echo -e "${BOLD}Error: Target file not found: ${TARGET_FILE}${NC}"
  exit 1
fi

# Check if the CLI is built
if [ -f "${CLI_DIR}/dist/index.js" ]; then
  echo "Using the TypeScript CLI to examine markdown"
  node "${CLI_DIR}/dist/index.js" examine "${TARGET_FILE}" --verbose
else
  echo "Error: CLI not built yet. Please run 'npm run cli:build' first."
  exit 1
fi

echo -e "\n${BOLD}${GREEN}=== Markdown Examination Complete ===${NC}"