#!/bin/bash

# A simple script to generate a report of markdown files - should work without any errors

# Root directory of the monorepo
MONO_ROOT="/Users/raybunnage/Documents/github/dhg-mono"
APP_ROOT="$MONO_ROOT/apps/dhg-improve-experts"
REPORT_FILE="$APP_ROOT/docs/documentation-report.md"

# Make sure docs directory exists
mkdir -p "$APP_ROOT/docs"

echo "Generating documentation report..."

# Total counters
total_files=0
readme_files=0
docs_files=0
other_files=0
prompt_files=0
scanned_dirs=0

# Find markdown files in the docs folder
echo "Searching in: Root Docs Folder"
doc_files=()
while read -r file; do
  if [[ ! "$file" == *"/node_modules/"* && 
         ! "$file" == *"/.git/"* && 
         ! "$file" == *"/dist/"* && 
         ! "$file" == *"/build/"* ]]; then
    doc_files+=("$file")
    
    # Count file types
    if [[ "$file" == *"/prompts/"* ]]; then
      ((prompt_files++))
    elif [[ "$file" == *"/README.md" || "$file" == *"/README-"* ]]; then
      ((readme_files++))
      ((total_files++))
    elif [[ "$file" == *"/docs/"* ]]; then
      ((docs_files++))
      ((total_files++))
    else
      ((other_files++))
      ((total_files++))
    fi
  fi
done < <(find "$MONO_ROOT/docs" -name "*.md" -type f 2>/dev/null | sort -u)

# Check if we found files
if [[ ${#doc_files[@]} -gt 0 ]]; then
  ((scanned_dirs++))
fi

# Find markdown files in the root
echo "Searching in: Monorepo Root"
root_files=()
while read -r file; do
  if [[ ! "$file" == *"/node_modules/"* && 
         ! "$file" == *"/.git/"* && 
         ! "$file" == *"/dist/"* && 
         ! "$file" == *"/build/"* ]]; then
    root_files+=("$file")
    
    # Count file types
    if [[ "$file" == *"/prompts/"* ]]; then
      ((prompt_files++))
    elif [[ "$file" == *"/README.md" || "$file" == *"/README-"* ]]; then
      ((readme_files++))
      ((total_files++))
    elif [[ "$file" == *"/docs/"* ]]; then
      ((docs_files++))
      ((total_files++))
    else
      ((other_files++))
      ((total_files++))
    fi
  fi
done < <(find "$MONO_ROOT" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort -u)

# Check if we found files
if [[ ${#root_files[@]} -gt 0 ]]; then
  ((scanned_dirs++))
fi

# Find markdown files in dhg-improve-experts
echo "Searching in: dhg-improve-experts"
app_files=()
while read -r file; do
  if [[ ! "$file" == *"/node_modules/"* && 
         ! "$file" == *"/.git/"* && 
         ! "$file" == *"/dist/"* && 
         ! "$file" == *"/build/"* ]]; then
    app_files+=("$file")
    
    # Count file types
    if [[ "$file" == *"/prompts/"* ]]; then
      ((prompt_files++))
    elif [[ "$file" == *"/README.md" || "$file" == *"/README-"* ]]; then
      ((readme_files++))
      ((total_files++))
    elif [[ "$file" == *"/docs/"* ]]; then
      ((docs_files++))
      ((total_files++))
    else
      ((other_files++))
      ((total_files++))
    fi
  fi
done < <(find "$APP_ROOT" -name "*.md" -type f -not -path "*/node_modules/*" 2>/dev/null | sort -u)

# Check if we found files
if [[ ${#app_files[@]} -gt 0 ]]; then
  ((scanned_dirs++))
fi

# Write the report file
cat > "$REPORT_FILE" << EOL
# Documentation Report

Generated on $(date)

## Summary

- **Projects scanned:** $scanned_dirs
- **Total markdown files:** $total_files
- **README files:** $readme_files
- **Files in docs folder:** $docs_files
- **Files in other locations:** $other_files
- **Prompt files (excluded):** $prompt_files

## Contents

This report lists all markdown files found in:
- The root /docs folder
- The root directory
- The dhg-improve-experts app

## Root Docs Folder Files

EOL

# Add root docs files to the report
if [[ ${#doc_files[@]} -gt 0 ]]; then
  echo "| File Path | Last Modified |" >> "$REPORT_FILE"
  echo "|-----------|---------------|" >> "$REPORT_FILE"
  
  for file in "${doc_files[@]}"; do
    if [[ ! "$file" == *"/prompts/"* ]]; then
      rel_path=${file#"$MONO_ROOT/docs/"}
      last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
      echo "| $rel_path | $last_mod |" >> "$REPORT_FILE"
    fi
  done
  
  echo "" >> "$REPORT_FILE"
fi

# Add root files to the report
echo "## Root Directory Files" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [[ ${#root_files[@]} -gt 0 ]]; then
  echo "| File Path | Last Modified |" >> "$REPORT_FILE"
  echo "|-----------|---------------|" >> "$REPORT_FILE"
  
  for file in "${root_files[@]}"; do
    if [[ ! "$file" == *"/prompts/"* ]]; then
      rel_path=${file#"$MONO_ROOT/"}
      last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
      echo "| $rel_path | $last_mod |" >> "$REPORT_FILE"
    fi
  done
  
  echo "" >> "$REPORT_FILE"
fi

# Add app files to the report
echo "## App Files - dhg-improve-experts" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

if [[ ${#app_files[@]} -gt 0 ]]; then
  echo "| File Path | Last Modified |" >> "$REPORT_FILE"
  echo "|-----------|---------------|" >> "$REPORT_FILE"
  
  for file in "${app_files[@]}"; do
    if [[ ! "$file" == *"/prompts/"* ]]; then
      rel_path=${file#"$APP_ROOT/"}
      last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
      echo "| $rel_path | $last_mod |" >> "$REPORT_FILE"
    fi
  done
  
  echo "" >> "$REPORT_FILE"
fi

echo "Documentation report generated at: $REPORT_FILE"
echo "Summary:"
echo "Projects scanned: $scanned_dirs"
echo "Total markdown files: $total_files"
echo "README files: $readme_files"
echo "Files in docs folder: $docs_files"
echo "Files in other locations: $other_files"
echo "Prompt files (excluded): $prompt_files"