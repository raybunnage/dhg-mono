#!/bin/bash

# Enhanced markdown file report with hierarchical presentation
# Shows all markdown files in their natural hierarchy

echo "Generating markdown files report..."

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
REPORT_FILE="$REPO_ROOT/docs/markdown-report.md"

# Ensure docs directory exists
mkdir -p "$REPO_ROOT/docs"

# Initialize counters
total_files=0
readme_files=0
docs_files=0
other_files=0
root_files=0
prompts_files=0

# Create report header
cat > "$REPORT_FILE" << EOL
# Markdown Files Report

Generated: $(date)

## Overview

This report shows all markdown files found in the repository, organized hierarchically by directory.

EOL

# Find markdown files in the repo root
echo "Finding files in repo root..."
root_md_files=()

while read -r file; do
  filename=$(basename "$file")
  root_md_files+=("$file")
  ((root_files++))
  ((total_files++))
  
  # Count by type
  if [[ "$filename" == "README.md" || "$filename" == README-* ]]; then
    ((readme_files++))
  else
    ((other_files++))
  fi
done < <(find "$REPO_ROOT" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)

# Define function to process directories recursively
process_directory() {
  local dir="$1"
  local prefix="$2"
  local target_array="$3"
  local files=()
  local directories=()
  
  # Get all files and directories
  while read -r item; do
    if [ -f "$item" ] && [[ "$item" == *.md ]]; then
      files+=("$item")
    elif [ -d "$item" ] && [[ "$item" != *"node_modules"* ]] && 
         [[ "$item" != *".git"* ]] && [[ "$item" != *"dist"* ]] && 
         [[ "$item" != *"build"* ]] && [[ "$item" != *"coverage"* ]]; then
      directories+=("$item")
    fi
  done < <(find "$dir" -mindepth 1 -maxdepth 1 2>/dev/null | sort)
  
  # Process files at this level
  for file in "${files[@]}"; do
    filename=$(basename "$file")
    rel_path=${file#"$REPO_ROOT/"}
    last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
    size=$(stat -f "%z" "$file" 2>/dev/null)
    
    # Add file to hierarchy
    eval "$target_array+=(\"$prefix- 📄 [$filename](/$rel_path) - $last_mod ($size bytes)\")"
    
    # Count file type
    if [[ "$filename" == "README.md" || "$filename" == README-* ]]; then
      ((readme_files++))
    elif [[ "$dir" == *"/docs/"* ]]; then
      ((docs_files++))
    elif [[ "$dir" == *"/prompts/"* ]]; then
      ((prompts_files++))
    else
      ((other_files++))
    fi
    
    ((total_files++))
  done
  
  # Process subdirectories
  for subdir in "${directories[@]}"; do
    dirname=$(basename "$subdir")
    
    # Add directory to hierarchy
    eval "$target_array+=(\"$prefix- 📁 **$dirname/**\")"
    
    # Process this subdirectory recursively
    process_directory "$subdir" "$prefix  " "$target_array"
  done
}

# Process the docs directory
echo "Processing docs directory..."
docs_hierarchy=()
process_directory "$REPO_ROOT/docs" "" "docs_hierarchy"

# Process the prompts directory (if it exists)
if [ -d "$REPO_ROOT/prompts" ]; then
  echo "Processing prompts directory..."
  prompts_hierarchy=()
  process_directory "$REPO_ROOT/prompts" "" "prompts_hierarchy"
fi

# Process apps directory
echo "Processing apps directory..."
apps_hierarchy=()
process_directory "$REPO_ROOT/apps" "" "apps_hierarchy"

# Process packages directory
echo "Processing packages directory..."
packages_hierarchy=()
process_directory "$REPO_ROOT/packages" "" "packages_hierarchy"

# Write summary to report
cat >> "$REPORT_FILE" << EOL
## Summary

- **Total markdown files:** $total_files
- **README files:** $readme_files
- **Files in docs folders:** $docs_files
- **Files in prompts folder:** $prompts_files
- **Files in other locations:** $other_files
- **Root-level files:** $root_files

## Root-Level Files

| File | Last Modified | Size (bytes) |
|------|---------------|--------------|
EOL

# Add root files to report
for file in "${root_md_files[@]}"; do
  filename=$(basename "$file")
  last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
  size=$(stat -f "%z" "$file" 2>/dev/null)
  
  echo "| $filename | $last_mod | $size |" >> "$REPORT_FILE"
done

# Add docs hierarchy
cat >> "$REPORT_FILE" << EOL

## Docs Directory (Hierarchical View)

EOL

for line in "${docs_hierarchy[@]}"; do
  echo "$line" >> "$REPORT_FILE"
done

# Add prompts hierarchy (if it exists)
if [ -d "$REPO_ROOT/prompts" ]; then
  cat >> "$REPORT_FILE" << EOL

## Prompts Directory (Hierarchical View)

EOL

  for line in "${prompts_hierarchy[@]}"; do
    echo "$line" >> "$REPORT_FILE"
  done
fi

# Add apps hierarchy
cat >> "$REPORT_FILE" << EOL

## Apps Directory (Hierarchical View)

EOL

for line in "${apps_hierarchy[@]}"; do
  echo "$line" >> "$REPORT_FILE"
done

# Add packages hierarchy
cat >> "$REPORT_FILE" << EOL

## Packages Directory (Hierarchical View)

EOL

for line in "${packages_hierarchy[@]}"; do
  echo "$line" >> "$REPORT_FILE"
done

# Print completion message
echo "Report generated at: $REPORT_FILE"
echo "Summary:"
echo "- Total markdown files: $total_files"
echo "- README files: $readme_files"
echo "- Files in docs folders: $docs_files"
echo "- Files in prompts folder: $prompts_files"
echo "- Files in other locations: $other_files"
echo "- Root-level files: $root_files"