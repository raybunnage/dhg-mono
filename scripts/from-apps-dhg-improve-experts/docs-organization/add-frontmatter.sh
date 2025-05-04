#!/bin/bash

# Script to add YAML frontmatter to markdown files
# This helps organize documentation by adding metadata

# Set up colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Root directory of the monorepo
MONO_ROOT="/Users/raybunnage/Documents/github/dhg-mono"
APP_ROOT="$MONO_ROOT/apps/dhg-improve-experts"
DOCS_ROOT="$APP_ROOT/docs"

# Make sure docs directory exists
mkdir -p "$DOCS_ROOT"

echo -e "${GREEN}Starting frontmatter addition to documentation...${NC}"

# Function to check if a file already has frontmatter
has_frontmatter() {
  if grep -q "^---" "$1" && grep -q "^---$" "$1"; then
    return 0 # true
  else
    return 1 # false
  fi
}

# Find all markdown files in the docs folder
echo -e "${BLUE}Finding all markdown files in docs folder...${NC}"
# Use a different approach instead of mapfile (for macOS compatibility)
DOC_FILES=()
while IFS= read -r line; do
  DOC_FILES+=("$line")
done < <(find "$DOCS_ROOT" -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/\.*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/coverage/*")

# Current date in YYYY-MM-DD format
CURRENT_DATE=$(date +"%Y-%m-%d")

# Process each markdown file
for file in "${DOC_FILES[@]}"; do
  filename=$(basename "$file")
  title=${filename%.*}
  
  # Skip if file already has frontmatter
  if has_frontmatter "$file"; then
    echo -e "${YELLOW}File already has frontmatter: ${file}${NC}"
    continue
  fi
  
  echo -e "${GREEN}Adding frontmatter to: ${file}${NC}"
  
  # Create temporary file
  temp_file=$(mktemp)
  
  # Write frontmatter
  cat > "$temp_file" << EOL
---
title: "${title}"
date: ${CURRENT_DATE}
description: ""
app: "dhg-improve-experts"
category: "documentation"
status: "active"
---

EOL

  # Append original content
  cat "$file" >> "$temp_file"
  
  # Replace original file
  mv "$temp_file" "$file"
  
  echo -e "${BLUE}Added frontmatter to: ${file}${NC}"
done

echo -e "${GREEN}Frontmatter addition complete!${NC}"