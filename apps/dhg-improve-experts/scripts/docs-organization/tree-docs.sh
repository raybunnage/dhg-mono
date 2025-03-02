#!/bin/bash

# Script to generate a tree structure of documentation files for the specified app
# Usage: ./tree-docs.sh [app-name]

# Set up colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Root directory of the monorepo
MONO_ROOT="/Users/raybunnage/Documents/github/dhg-mono"

# Get app name from command line or use default
APP_NAME="${1:-dhg-improve-experts}"
APP_ROOT="$MONO_ROOT/apps/$APP_NAME"

# Check if app exists
if [ ! -d "$APP_ROOT" ]; then
  echo -e "${RED}Error: App '$APP_NAME' not found at $APP_ROOT${NC}"
  echo -e "${YELLOW}Available apps:${NC}"
  ls -1 "$MONO_ROOT/apps"
  exit 1
fi

echo -e "${GREEN}Generating documentation tree for app: $APP_NAME${NC}"

# Function to check if a file is in a prompts folder
is_in_prompts_folder() {
  if [[ "$1" == *"/prompts/"* ]]; then
    return 0 # true
  else
    return 1 # false
  fi
}

# Generate a tree of all markdown files
echo -e "${BLUE}Markdown files (excluding prompts):${NC}"
echo

echo "$APP_NAME/"
find "$APP_ROOT" -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/\.*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/coverage/*" | sort | while read -r file; do
  # Skip files in prompts folders
  if is_in_prompts_folder "$file"; then
    continue
  fi
  
  # Get relative path
  relative_path=${file#"$APP_ROOT/"}
  
  # Calculate depth for indentation
  depth=$(echo "$relative_path" | tr -cd '/' | wc -c)
  indentation=$(printf '%*s' $((depth*2)) '')
  
  # Print the file with appropriate indentation
  filename=$(basename "$file")
  if [ "$depth" -eq 0 ]; then
    echo "├── $filename"
  else
    dir_part=$(dirname "$relative_path")
    echo "$indentation├── $filename"
  fi
done

echo
echo -e "${BLUE}Prompt files (for reference only):${NC}"
echo

echo "$APP_NAME/"
find "$APP_ROOT" -path "*prompts*" -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/\.*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/coverage/*" | sort | while read -r file; do
  # Get relative path
  relative_path=${file#"$APP_ROOT/"}
  
  # Calculate depth for indentation
  depth=$(echo "$relative_path" | tr -cd '/' | wc -c)
  indentation=$(printf '%*s' $((depth*2)) '')
  
  # Print the file with appropriate indentation
  filename=$(basename "$file")
  if [ "$depth" -eq 0 ]; then
    echo "├── $filename"
  else
    dir_part=$(dirname "$relative_path")
    echo "$indentation├── $filename"
  fi
done

echo
echo -e "${GREEN}Documentation tree generation complete!${NC}"