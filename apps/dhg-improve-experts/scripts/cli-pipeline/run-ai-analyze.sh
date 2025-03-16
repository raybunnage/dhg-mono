#!/bin/bash

# Enhanced AI Script Analysis
# This script runs script analysis while avoiding environment variable loading issues

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPS_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
MONO_ROOT="$(dirname "$APPS_DIR")"
CLI_DIR="$MONO_ROOT/packages/cli"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo "Running AI Script Analysis Pipeline"
echo "===================================="
echo "Working directories:"
echo "Script Dir: $SCRIPT_DIR"
echo "Apps Dir: $APPS_DIR"
echo "Mono Root: $MONO_ROOT"
echo "CLI Dir: $CLI_DIR"

# Create a temporary env file that will be safe to source
TMP_ENV_FILE="$(mktemp)"
echo "Creating safe environment in $TMP_ENV_FILE"

# Extract environment variables manually from common locations
extract_env_vars() {
  ENV_FILE="$1"
  
  if [ ! -f "$ENV_FILE" ]; then
    return
  fi
  
  echo "# Extracted from $ENV_FILE" >> "$TMP_ENV_FILE"
  
  # Process only specific variables we care about that don't have URLs
  grep -E "^(SUPABASE_URL|SUPABASE_KEY|SUPABASE_ANON_KEY|VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY|VITE_ANTHROPIC_API_KEY|ANTHROPIC_API_KEY|NODE_ENV)=" "$ENV_FILE" >> "$TMP_ENV_FILE"  
}

# Extract from each environment file
echo "Extracting environment variables from:"
for ENV_FILE in "$MONO_ROOT/.env" "$MONO_ROOT/.env.development" "$MONO_ROOT/.env.local" \
                "$APPS_DIR/dhg-improve-experts/.env" "$APPS_DIR/dhg-improve-experts/.env.development" \
                "$APPS_DIR/dhg-improve-experts/.env.local"; do
  if [ -f "$ENV_FILE" ]; then
    echo "- $ENV_FILE"
    extract_env_vars "$ENV_FILE"
  fi
done

# Source the temporary environment file
echo "Activating environment variables"
source "$TMP_ENV_FILE"
rm "$TMP_ENV_FILE"

# Print the environment variables we extracted (without values)
echo "Environment variables set:"
grep -v "^#" "$TMP_ENV_FILE" | cut -d= -f1 | while read var; do
  if [ -n "$var" ]; then
    echo "- $var: ✅"
  fi
done

echo -e "${GREEN}✅ Environment configuration complete${NC}"

# Check if CLI dist directory exists
if [ ! -d "$CLI_DIR/dist" ]; then
  echo -e "${YELLOW}CLI dist directory doesn't exist at $CLI_DIR/dist${NC}"
  
  # Check if the CLI directory exists  
  if [ ! -d "$CLI_DIR" ]; then
    echo -e "${RED}Error: CLI directory not found at $CLI_DIR${NC}"
    echo "Please check that your project structure is correct"
    exit 1
  fi
  
  echo "Checking for build scripts in $CLI_DIR"
  # Check if package.json exists
  if [ ! -f "$CLI_DIR/package.json" ]; then
    echo -e "${RED}Error: package.json not found in CLI directory${NC}"
    echo "Please check that your CLI setup is correct"
    exit 1
  fi
  
  # Build manually instead of trying to run the fix scripts
  echo -e "${YELLOW}Attempting to build CLI package...${NC}"
  
  # Try npm install first
  echo "Running npm install in CLI directory..."
  (cd "$CLI_DIR" && npm install)
  
  # Then try to build
  echo "Running npm build in CLI directory..."
  (cd "$CLI_DIR" && npm run build)
  
  # Check if build was successful
  if [ ! -d "$CLI_DIR/dist" ]; then
    echo -e "${RED}Error: Failed to build CLI package.${NC}"
    echo "Please manually build the CLI package with:"
    echo "  cd $CLI_DIR && npm install && npm run build"
    exit 1
  else
    echo -e "${GREEN}Successfully built CLI package.${NC}"
  fi
fi

# Run the script analysis with our current environment
echo -e "${BOLD}${GREEN}Running Script Analysis...${NC}"
"$SCRIPT_DIR/analyze-scripts.sh"

# Return the exit code from the analyze-scripts.sh script
exit $?