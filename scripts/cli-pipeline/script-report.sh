#!/bin/bash

# Script Report Generator
# Recursively finds all shell scripts (.sh) in the project and creates a markdown report

echo "Generating shell script report..."

# Define important locations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$REPO_ROOT/docs"
REPORT_FILE="$REPORT_DIR/script-report.md"

# Ensure docs directory exists
mkdir -p "$REPORT_DIR"

# Initialize counters as global variables
TOTAL_SCRIPTS=0
EXECUTABLE_SCRIPTS=0
NON_EXECUTABLE_SCRIPTS=0
ROOT_SCRIPTS=0

# Create report header
cat > "$REPORT_FILE" << EOL
# Shell Script Report

Generated: $(date)

## Overview

This report shows all shell script files (.sh) found in the repository, organized hierarchically by directory.
It includes information about each script's executable status, size, and last modification date.

**Note**: The following directories and patterns are excluded from this report:
- _archive/ or archive/ directories (archived code)
- scripts-*/ directories (backup scripts)
- file_types/ directory (file type examples) 
- backups/ or .backups/ directories
- Standard exclusions: node_modules/, .git/, dist/, build/, coverage/

EOL

# Create temporary files for storing script paths
ALL_SCRIPTS_TMP=$(mktemp)
ROOT_SCRIPTS_TMP=$(mktemp)
SCRIPTS_TMP=$(mktemp)
APPS_TMP=$(mktemp)
PACKAGES_TMP=$(mktemp)
OTHER_TMP=$(mktemp)

# Find all shell scripts in the repository and save to temporary file
echo "Finding all shell scripts..."
find "$REPO_ROOT" -name "*.sh" -type f \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/coverage/*" \
  -not -path "*/_archive/*" \
  -not -path "*/archive/*" \
  -not -path "*/scripts-*/*" \
  -not -path "*/file_types/*" \
  -not -path "*/backups/*" \
  -not -path "*/.backups/*" \
  -not -path "*/._archive/*" > "$ALL_SCRIPTS_TMP"

# Count total scripts
TOTAL_SCRIPTS=$(wc -l < "$ALL_SCRIPTS_TMP")
echo "Found $TOTAL_SCRIPTS shell scripts"

# Find root level scripts
echo "Finding scripts in repo root..."
find "$REPO_ROOT" -maxdepth 1 -name "*.sh" -type f \
  -not -path "*/_archive/*" \
  -not -path "*/archive/*" \
  -not -path "*/scripts-*" \
  -not -path "*/file_types/*" \
  -not -path "*/backups/*" \
  -not -path "*/.backups/*" \
  -not -path "*/._archive/*" > "$ROOT_SCRIPTS_TMP"
ROOT_SCRIPTS=$(wc -l < "$ROOT_SCRIPTS_TMP")

# Count executable and non-executable scripts
while read -r file; do
  if [[ -x "$file" ]]; then
    echo "$file" >> /tmp/executable_scripts.tmp
  else
    echo "$file" >> /tmp/non_executable_scripts.tmp
  fi
done < "$ALL_SCRIPTS_TMP"

if [[ -f /tmp/executable_scripts.tmp ]]; then
  EXECUTABLE_SCRIPTS=$(wc -l < /tmp/executable_scripts.tmp)
  rm /tmp/executable_scripts.tmp
fi

if [[ -f /tmp/non_executable_scripts.tmp ]]; then
  NON_EXECUTABLE_SCRIPTS=$(wc -l < /tmp/non_executable_scripts.tmp)
  rm /tmp/non_executable_scripts.tmp
fi

# Process a directory and write directly to the report file
# Returns 0 if scripts were found, 1 otherwise
process_directory() {
  local dir="$1"
  local prefix="$2"
  local section_file="$3"
  local scripts_found_file="$4"
  
  # Create a temporary file for this directory's scripts
  local DIR_SCRIPTS_TMP=$(mktemp)
  
  # Find all shell scripts in this directory (not recursive)
  find "$dir" -maxdepth 1 -name "*.sh" -type f 2>/dev/null | sort > "$DIR_SCRIPTS_TMP"
  
  # Check if any scripts were found in this directory
  local script_count=$(wc -l < "$DIR_SCRIPTS_TMP")
  
  # If scripts were found in this directory, add them to the report
  if [[ $script_count -gt 0 ]]; then
    # Add directory header
    dirname=$(basename "$dir")
    echo "$prefix- 📁 **$dirname/**" >> "$section_file"
    
    # Process each script file
    while read -r file; do
      filename=$(basename "$file")
      rel_path=${file#"$REPO_ROOT/"}
      
      # Get file stats - handle both macOS and Linux
      if [[ "$OSTYPE" == "darwin"* ]]; then
        last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
        size=$(stat -f "%z" "$file" 2>/dev/null)
      else
        last_mod=$(stat -c "%y" "$file" | cut -d. -f1 2>/dev/null)
        size=$(stat -c "%s" "$file" 2>/dev/null)
      fi
      
      # Check if script is executable
      if [[ -x "$file" ]]; then
        executable_status="✅ Executable"
      else
        executable_status="❌ Not executable"
      fi
      
      # Get first line to check for shebang
      shebang=$(head -n 1 "$file" | grep -E '^#!' || echo "No shebang")
      
      # Write directly to the section file
      echo "$prefix  - 📜 [$filename](/$rel_path) - $executable_status - $last_mod ($size bytes)" >> "$section_file"
      echo "$prefix    - Shebang: \`$shebang\`" >> "$section_file"
      
      # Add chmod command to make executable
      if [[ ! -x "$file" ]]; then
        echo "$prefix    - To make executable: \`chmod +x $rel_path\`" >> "$section_file"
      fi
    done < "$DIR_SCRIPTS_TMP"
    
    # Mark that scripts were found
    echo "1" > "$scripts_found_file"
  fi
  
  # Clean up temporary file
  rm -f "$DIR_SCRIPTS_TMP"
  
  # Create a temporary file for subdirectories with scripts
  local SUBDIRS_WITH_SCRIPTS=$(mktemp)
  
  # Find all subdirectories (not recursive)
  local subdirs_tmp=$(mktemp)
  find "$dir" -maxdepth 1 -type d 2>/dev/null | sort > "$subdirs_tmp"
  
  # Process each subdirectory
  local any_subdir_has_scripts=0
  while read -r subdir; do
    # Skip the current directory and excluded directories
    if [[ "$subdir" == "$dir" || 
          "$subdir" == *"/node_modules"* || 
          "$subdir" == *"/.git"* || 
          "$subdir" == *"/dist"* || 
          "$subdir" == *"/build"* || 
          "$subdir" == *"/coverage"* ||
          "$subdir" == *"/_archive"* ||
          "$subdir" == *"/archive"* ||
          "$subdir" == *"/scripts-"* ||
          "$subdir" == *"/file_types"* ||
          "$subdir" == *"/backups"* ||
          "$subdir" == *"/.backups"* ||
          "$subdir" == *"/._archive"* ]]; then
      continue
    fi
    
    # Create a temporary file for this subdirectory
    local SUBDIR_TMP=$(mktemp)
    local SUBDIR_HAS_SCRIPTS=$(mktemp)
    echo "0" > "$SUBDIR_HAS_SCRIPTS"
    
    # Process this subdirectory recursively
    process_directory "$subdir" "$prefix  " "$SUBDIR_TMP" "$SUBDIR_HAS_SCRIPTS"
    
    # Check if scripts were found in the subdirectory
    if [[ $(cat "$SUBDIR_HAS_SCRIPTS") -eq 1 ]]; then
      # If this is the first subdirectory with scripts and no scripts were found in this directory,
      # add the directory header
      if [[ $any_subdir_has_scripts -eq 0 && $script_count -eq 0 ]]; then
        dirname=$(basename "$dir")
        echo "$prefix- 📁 **$dirname/**" >> "$section_file"
        any_subdir_has_scripts=1
      fi
      
      # Add subdirectory content to the section file
      cat "$SUBDIR_TMP" >> "$section_file"
      
      # Mark that scripts were found
      echo "1" > "$scripts_found_file"
    fi
    
    # Clean up temporary files
    rm -f "$SUBDIR_TMP" "$SUBDIR_HAS_SCRIPTS"
  done < "$subdirs_tmp"
  
  # Clean up temporary files
  rm -f "$subdirs_tmp" "$SUBDIRS_WITH_SCRIPTS"
  
  # Return success if scripts were found
  if [[ $(cat "$scripts_found_file") -eq 1 ]]; then
    return 0
  else
    return 1
  fi
}

# Process the scripts directory
echo "Processing scripts directory..."
SCRIPTS_FOUND_TMP=$(mktemp)
echo "0" > "$SCRIPTS_FOUND_TMP"
if [ -d "$REPO_ROOT/scripts" ]; then
  if process_directory "$REPO_ROOT/scripts" "" "$SCRIPTS_TMP" "$SCRIPTS_FOUND_TMP"; then
    SCRIPTS_FOUND=1
  else
    SCRIPTS_FOUND=0
  fi
fi

# Process apps directory
echo "Processing apps directory..."
APPS_FOUND_TMP=$(mktemp)
echo "0" > "$APPS_FOUND_TMP"
if [ -d "$REPO_ROOT/apps" ]; then
  if process_directory "$REPO_ROOT/apps" "" "$APPS_TMP" "$APPS_FOUND_TMP"; then
    APPS_FOUND=1
  else
    APPS_FOUND=0
  fi
fi

# Process packages directory
echo "Processing packages directory..."
PACKAGES_FOUND_TMP=$(mktemp)
echo "0" > "$PACKAGES_FOUND_TMP"
if [ -d "$REPO_ROOT/packages" ]; then
  if process_directory "$REPO_ROOT/packages" "" "$PACKAGES_TMP" "$PACKAGES_FOUND_TMP"; then
    PACKAGES_FOUND=1
  else
    PACKAGES_FOUND=0
  fi
fi

# Process other directories
echo "Processing other directories..."
OTHER_FOUND=0
for dir in "$REPO_ROOT"/*; do
  if [ -d "$dir" ] && 
     [[ "$dir" != *"/scripts"* ]] && 
     [[ "$dir" != *"/apps"* ]] && 
     [[ "$dir" != *"/packages"* ]] && 
     [[ "$dir" != *"/node_modules"* ]] && 
     [[ "$dir" != *"/.git"* ]] && 
     [[ "$dir" != *"/dist"* ]] && 
     [[ "$dir" != *"/build"* ]] && 
     [[ "$dir" != *"/coverage"* ]] &&
     [[ "$dir" != *"/_archive"* ]] &&
     [[ "$dir" != *"/archive"* ]] &&
     [[ "$dir" != *"/scripts-"* ]] &&
     [[ "$dir" != *"/file_types"* ]] &&
     [[ "$dir" != *"/backups"* ]] &&
     [[ "$dir" != *"/.backups"* ]] &&
     [[ "$dir" != *"/._archive"* ]]; then
    
    # Create a temporary file for this directory
    DIR_TMP=$(mktemp)
    DIR_FOUND_TMP=$(mktemp)
    echo "0" > "$DIR_FOUND_TMP"
    
    # Process this directory
    if process_directory "$dir" "" "$DIR_TMP" "$DIR_FOUND_TMP"; then
      # If scripts were found, add the content to the OTHER_TMP file
      cat "$DIR_TMP" >> "$OTHER_TMP"
      OTHER_FOUND=1
    fi
    
    # Clean up temporary files
    rm -f "$DIR_TMP" "$DIR_FOUND_TMP"
  fi
done

# Write summary to report
cat >> "$REPORT_FILE" << EOL
## Summary

- **Total shell scripts:** $TOTAL_SCRIPTS
- **Executable scripts:** $EXECUTABLE_SCRIPTS
- **Non-executable scripts:** $NON_EXECUTABLE_SCRIPTS
- **Root-level scripts:** $ROOT_SCRIPTS

## Make All Scripts Executable

To make all shell scripts in the repository executable, run:

\`\`\`bash
find . -name "*.sh" -type f -exec chmod +x {} \;
\`\`\`
EOL

# Add root files to report if any were found
if [ -f "$ROOT_SCRIPTS_TMP" ] && [ -s "$ROOT_SCRIPTS_TMP" ]; then
  cat >> "$REPORT_FILE" << EOL

## Root-Level Scripts

| Script | Executable | Last Modified | Size (bytes) |
|--------|------------|---------------|--------------|
EOL

  while read -r file; do
    filename=$(basename "$file")
    rel_path=${file#"$REPO_ROOT/"}
    
    # Get file stats - handle both macOS and Linux
    if [[ "$OSTYPE" == "darwin"* ]]; then
      last_mod=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
      size=$(stat -f "%z" "$file" 2>/dev/null)
    else
      last_mod=$(stat -c "%y" "$file" | cut -d. -f1 2>/dev/null)
      size=$(stat -c "%s" "$file" 2>/dev/null)
    fi
    
    if [[ -x "$file" ]]; then
      executable="Yes"
    else
      executable="No"
    fi
    
    echo "| $filename | $executable | $last_mod | $size |" >> "$REPORT_FILE"
  done < "$ROOT_SCRIPTS_TMP"
fi

# Add scripts hierarchy if scripts were found
if [[ -n "$SCRIPTS_FOUND" && "$SCRIPTS_FOUND" -eq 1 && -s "$SCRIPTS_TMP" ]]; then
  cat >> "$REPORT_FILE" << EOL

## Scripts Directory (Hierarchical View)

EOL
  cat "$SCRIPTS_TMP" >> "$REPORT_FILE"
fi

# Add apps hierarchy if scripts were found
if [[ -n "$APPS_FOUND" && "$APPS_FOUND" -eq 1 && -s "$APPS_TMP" ]]; then
  cat >> "$REPORT_FILE" << EOL

## Apps Directory (Hierarchical View)

EOL
  cat "$APPS_TMP" >> "$REPORT_FILE"
fi

# Add packages hierarchy if scripts were found
if [[ -n "$PACKAGES_FOUND" && "$PACKAGES_FOUND" -eq 1 && -s "$PACKAGES_TMP" ]]; then
  cat >> "$REPORT_FILE" << EOL

## Packages Directory (Hierarchical View)

EOL
  cat "$PACKAGES_TMP" >> "$REPORT_FILE"
fi

# Add other directories hierarchy if scripts were found
if [[ -n "$OTHER_FOUND" && "$OTHER_FOUND" -eq 1 && -s "$OTHER_TMP" ]]; then
  cat >> "$REPORT_FILE" << EOL

## Other Directories (Hierarchical View)

EOL
  cat "$OTHER_TMP" >> "$REPORT_FILE"
fi

# Clean up temporary files
rm -f "$ALL_SCRIPTS_TMP" "$ROOT_SCRIPTS_TMP" "$SCRIPTS_TMP" "$APPS_TMP" "$PACKAGES_TMP" "$OTHER_TMP"
rm -f "$SCRIPTS_FOUND_TMP" "$APPS_FOUND_TMP" "$PACKAGES_FOUND_TMP"

# Print completion message
echo "Report generated at: $REPORT_FILE"
echo "Summary:"
echo "- Total shell scripts: $TOTAL_SCRIPTS"
echo "- Executable scripts: $EXECUTABLE_SCRIPTS"
echo "- Non-executable scripts: $NON_EXECUTABLE_SCRIPTS"
echo "- Root-level scripts: $ROOT_SCRIPTS"
echo ""
echo "To make this script executable, run:"
echo "chmod +x scripts/script-report.sh" 