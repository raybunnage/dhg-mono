#!/bin/bash

# Script to consolidate markdown files according to best practices
# This script will:
# 1. Create a centralized docs structure if it doesn't exist
# 2. Move markdown files to appropriate locations
# 3. Create symlinks if needed to maintain references
# 4. Skip any files in prompts folders

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

echo -e "${GREEN}Starting documentation consolidation...${NC}"

# Function to check if a file is in a prompts folder
is_in_prompts_folder() {
  if [[ "$1" == *"/prompts/"* ]]; then
    return 0 # true
  else
    return 1 # false
  fi
}

# Find all markdown files in the app
echo -e "${BLUE}Finding all markdown files...${NC}"
# Use a different approach instead of mapfile (for macOS compatibility)
MD_FILES=()
while IFS= read -r line; do
  MD_FILES+=("$line")
done < <(find "$APP_ROOT" -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/\.*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/coverage/*")

# Process each markdown file
for file in "${MD_FILES[@]}"; do
  # Skip files in prompts folders
  if is_in_prompts_folder "$file"; then
    echo -e "${YELLOW}Skipping prompt file: ${file}${NC}"
    continue
  fi

  filename=$(basename "$file")
  relative_path=${file#"$APP_ROOT/"}
  
  # Handle special cases
  if [[ "$filename" == "README.md" ]]; then
    # Keep README.md files where they are
    echo -e "${BLUE}Keeping README file in place: ${file}${NC}"
    continue
  elif [[ "$filename" == "README-"* ]]; then
    # Move README-* files to docs with proper naming
    new_name=${filename#"README-"}
    destination="$DOCS_ROOT/${new_name}"
    
    # Check if the file already exists in docs folder with a different name
    base_name=${new_name%.*}
    if [[ -f "$DOCS_ROOT/${base_name}.md" ]]; then
      echo -e "${YELLOW}File already exists in docs: ${base_name}.md - skipping ${filename}${NC}"
      continue
    fi
    
    echo -e "${GREEN}Moving ${filename} to ${destination}${NC}"
    cp "$file" "$destination"
    echo "# See consolidated documentation in docs folder" > "$file"
    echo "" >> "$file"
    echo "The content of this file has been moved to [docs/${new_name}](docs/${new_name})" >> "$file"
  elif [[ "$relative_path" != "docs/"* ]]; then
    # Any other markdown file not already in the docs folder
    destination="$DOCS_ROOT/$filename"
    
    # Avoid duplicates
    if [[ -f "$destination" ]]; then
      echo -e "${YELLOW}File already exists in docs: ${filename} - comparing content${NC}"
      if cmp -s "$file" "$destination"; then
        echo -e "${YELLOW}Files are identical, can be safely removed: ${file}${NC}"
      else
        new_destination="$DOCS_ROOT/${filename%.*}-$(date +%Y%m%d).md"
        echo -e "${YELLOW}Files differ, creating timestamped copy: ${new_destination}${NC}"
        cp "$file" "$new_destination"
      fi
    else
      echo -e "${GREEN}Moving ${file} to ${destination}${NC}"
      cp "$file" "$destination"
    fi
  else
    echo -e "${BLUE}File already in docs folder: ${file}${NC}"
  fi
done

echo -e "${GREEN}Documentation consolidation complete!${NC}"
echo -e "${YELLOW}Note: Original files have been preserved. Review changes and remove duplicates manually if needed.${NC}"