#!/bin/bash

# Enhanced markdown file report with hierarchical presentation
# Shows root files and prompt files separately

echo "Generating markdown files report..."

# Define important locations
REPO_ROOT="$(pwd)"
REPORT_FILE="$REPO_ROOT/docs/markdown-report.md"

# Ensure docs directory exists
mkdir -p "$REPO_ROOT/docs"

# Initialize counters
total_files=0
readme_files=0
docs_files=0
other_files=0
prompt_files=0
root_files=0

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

# Process the docs directory
echo "Processing docs directory..."
docs_hierarchy=()
docs_md_count=0

process_directory() {
  local dir="$1"
  local prefix="$2"
  local files=()
  local directories=()
  
  # Get all files and directories
  while read -r item; do
    if [ -f "$item" ] && [[ "$item" == *.md ]]; then
      files+=("$item")
    elif [ -d "$item" ] && [[ "$item" != *"node_modules"* ]] && [[ "$item" != *".git"* ]]; then
      directories+=("$item")
    fi
  done < <(find "$dir" -mindepth 1 -maxdepth 1 2>/dev/null | sort)
  
  # Process files at this level
  for file in "${files[@]}"; do
    filename=$(basename "$file")
    
    # Check if this is a prompt file
    if [[ "$dir" == *"/prompts"* || "$filename" == *"prompt"* ]]; then
      # Don't add to hierarchy, will process separately
      ((prompt_files++))
    else
      # Add to hierarchy
      rel_path=${file#"$REPO_ROOT/"}
      last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
      size=$(stat -f "%z" "$file" 2>/dev/null)
      
      docs_hierarchy+=("$prefix- 📄 [$filename](/$rel_path) - $last_mod ($size bytes)")
      ((docs_md_count++))
      ((total_files++))
      
      # Count file type
      if [[ "$filename" == "README.md" || "$filename" == README-* ]]; then
        ((readme_files++))
      elif [[ "$dir" == *"/docs/"* ]]; then
        ((docs_files++))
      else
        ((other_files++))
      fi
    fi
  done
  
  # Process subdirectories
  for subdir in "${directories[@]}"; do
    dirname=$(basename "$subdir")
    
    # Skip node_modules, .git, etc.
    if [[ "$dirname" == "node_modules" || "$dirname" == ".git" || "$dirname" == "dist" || "$dirname" == "build" ]]; then
      continue
    fi
    
    # Skip prompts directory (we'll handle it separately)
    if [[ "$dirname" == "prompts" ]]; then
      continue
    fi
    
    # Add directory to hierarchy
    docs_hierarchy+=("$prefix- 📁 **$dirname/**")
    
    # Process this subdirectory
    process_directory "$subdir" "$prefix  "
  done
}

# Process each main section
process_directory "$REPO_ROOT/docs" ""

# Find all prompt files
echo "Finding prompt files..."
prompt_md_files=()

while read -r file; do
  if [[ "$file" != *"/node_modules/"* && 
        "$file" != *"/.git/"* && 
        "$file" != *"/dist/"* && 
        "$file" != *"/build/"* ]]; then
    prompt_md_files+=("$file")
  fi
done < <(find "$REPO_ROOT" -path "*/prompts/*.md" -type f 2>/dev/null | sort)

# Process apps directory to find all markdown files
echo "Processing apps directory..."
apps_hierarchy=()
apps_md_count=0

# Process apps directory
if [ -d "$REPO_ROOT/apps" ]; then
  process_directory "$REPO_ROOT/apps" ""
fi

# Process packages directory
echo "Processing packages directory..."
packages_hierarchy=()
packages_md_count=0

if [ -d "$REPO_ROOT/packages" ]; then
  process_directory "$REPO_ROOT/packages" ""
fi

# Write summary to report
cat >> "$REPORT_FILE" << EOL
## Summary

- **Total markdown files:** $total_files
- **README files:** $readme_files
- **Files in docs folders:** $docs_files
- **Files in other locations:** $other_files
- **Prompt files:** $prompt_files
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

# Add prompt files
cat >> "$REPORT_FILE" << EOL

## Prompt Files

| File Path | Last Modified | Size (bytes) |
|-----------|---------------|--------------|
EOL

for file in "${prompt_md_files[@]}"; do
  rel_path=${file#"$REPO_ROOT/"}
  last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
  size=$(stat -f "%z" "$file" 2>/dev/null)
  
  echo "| $rel_path | $last_mod | $size |" >> "$REPORT_FILE"
done

# Print completion message
echo "Report generated at: $REPORT_FILE"
echo "Summary:"
echo "- Total markdown files: $total_files"
echo "- README files: $readme_files"
echo "- Files in docs folders: $docs_files"
echo "- Files in other locations: $other_files"
echo "- Prompt files: $prompt_files"
echo "- Root-level files: $root_files"