#!/bin/bash

# Script to run the actual workflow with real credentials

GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}=== Running Markdown Workflow ===${NC}\n"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MONO_ROOT="$(cd "$APP_DIR/.." && pwd)"
CLI_DIR="${MONO_ROOT}/packages/cli"  # Updated to use packages/cli directory
TARGET_FILE="$(pwd)/docs/markdown-report.md"

# Use a default file if the target doesn't exist
if [ ! -f "$TARGET_FILE" ]; then
  echo "Note: Target file not found at ${TARGET_FILE}"
  echo "Using README.md as a fallback example..."
  TARGET_FILE="$(pwd)/README.md"
fi

# Get the real env file path
# First try the current directory
ENV_FILE="$(pwd)/.env.development"

# Then try app-specific location (for monorepo)
if [ ! -f "$ENV_FILE" ]; then
  # Check if we're in the apps/dhg-improve-experts directory
  if [[ "$(pwd)" == *"/apps/dhg-improve-experts" ]]; then
    ENV_FILE="$(pwd)/.env.development"
  # Check if we're in the repo root
  elif [ -d "$(pwd)/apps/dhg-improve-experts" ]; then
    ENV_FILE="$(pwd)/apps/dhg-improve-experts/.env.development"
  # Otherwise use the full path
  else
    ENV_FILE="/Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts/.env.development"
  fi
fi

# Check if the env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: Environment file not found at: $ENV_FILE"
  exit 1
fi

# Find project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ../.. && pwd)"
echo "Project root: ${PROJECT_ROOT}"

# Make sure development-process-specification.md is available (symlink if needed)
if [ ! -d "${PROJECT_ROOT}/prompts" ]; then
  echo "Creating prompts directory in project root..."
  mkdir -p "${PROJECT_ROOT}/prompts"
fi

if [ -f "${PROJECT_ROOT}/development-process-specification.md" ] && [ ! -f "${PROJECT_ROOT}/prompts/development-process-specification.md" ]; then
  echo "Symlinking development-process-specification.md to prompts directory..."
  ln -sf "${PROJECT_ROOT}/development-process-specification.md" "${PROJECT_ROOT}/prompts/development-process-specification.md"
fi

# Check if the CLI is built
if [ -f "${CLI_DIR}/dist/index.js" ]; then
  echo "Running workflow with real credentials..."
  echo "Using environment file: $ENV_FILE"
  
  # Explicitly pass env vars instead of relying on dotenv
  export VITE_SUPABASE_URL=$(grep VITE_SUPABASE_URL "$ENV_FILE" | cut -d '=' -f2)
  export VITE_SUPABASE_SERVICE_ROLE_KEY=$(grep VITE_SUPABASE_SERVICE_ROLE_KEY "$ENV_FILE" | cut -d '=' -f2)
  export VITE_SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY "$ENV_FILE" | cut -d '=' -f2)
  export VITE_ANTHROPIC_API_KEY=$(grep VITE_ANTHROPIC_API_KEY "$ENV_FILE" | cut -d '=' -f2)
  
  # Set working directory to project root to help with file path resolution
  cd "${PROJECT_ROOT}"
  
  # Check if --execute flag was passed
  if [ "$1" == "--execute" ]; then
    echo "Will execute the Claude API call"
    node "${CLI_DIR}/dist/index.js" workflow "${TARGET_FILE}" --verbose --execute
  else
    node "${CLI_DIR}/dist/index.js" workflow "${TARGET_FILE}" --verbose
  fi
else
  echo "Error: CLI not built yet. Please run 'npm run cli:build' first."
  exit 1
fi

echo -e "\n${BOLD}${GREEN}=== Workflow Complete ===${NC}"