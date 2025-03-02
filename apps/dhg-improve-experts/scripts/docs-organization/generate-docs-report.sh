#!/bin/bash

# Script to generate a report of all markdown files in the repository
# Excluding files in prompts folders and tool-related files

# Set up colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Root directory of the monorepo
MONO_ROOT="/Users/raybunnage/Documents/github/dhg-mono"
APP_ROOT="$MONO_ROOT/apps/dhg-improve-experts"
REPORT_FILE="$APP_ROOT/docs/documentation-report.md"
TEMP_TREE_FILE="/tmp/doc_tree.txt"

# Make sure docs directory exists
mkdir -p "$APP_ROOT/docs"

echo -e "${GREEN}Generating documentation report...${NC}"

# Function to check if a file is in a prompts folder
is_in_prompts_folder() {
  if [[ "$1" == *"/prompts/"* ]]; then
    return 0 # true
  else
    return 1 # false
  fi
}

# Function to check if a file is in an excluded path
is_excluded_path() {
  # Additional paths to exclude (customize as needed)
  if [[ "$1" == *"/node_modules/"* || 
        "$1" == *"/.git/"* || 
        "$1" == *"/dist/"* || 
        "$1" == *"/build/"* || 
        "$1" == *"/coverage/"* ||
        "$1" == *"/.next/"* ||
        "$1" == *"/.docusaurus/"* ||
        "$1" == *"/.turbo/"* ||
        "$1" == *"/LICENSE"* ||
        "$1" == *"/CHANGELOG"* ||
        "$1" == *"/.github/"* ||
        "$1" == *"/package-lock.json"* ]]; then
    return 0 # true - should be excluded
  else
    return 1 # false - should not be excluded
  fi
}

# Create a filtered list of project directories and important doc directories
PROJECT_DIRS=()
echo -e "${BLUE}Finding project directories and doc folders...${NC}"

# Add root docs folder
if [[ -d "$MONO_ROOT/docs" ]]; then
  PROJECT_DIRS+=("$MONO_ROOT/docs")
  echo -e "  Found docs folder: ${YELLOW}root/docs${NC}"
fi

# Add root level of monorepo (for README, etc.)
PROJECT_DIRS+=("$MONO_ROOT")
echo -e "  Added monorepo root: ${YELLOW}root${NC}"

# Add apps directories
for dir in $(find "$MONO_ROOT/apps" -type d -maxdepth 1 2>/dev/null | sort); do
  # Skip non-directories and excluded paths
  if [[ -d "$dir" ]] && ! is_excluded_path "$dir"; then
    PROJECT_DIRS+=("$dir")
    echo -e "  Found project: ${YELLOW}apps/$(basename "$dir")${NC}"
  fi
done

# Add packages directories
for dir in $(find "$MONO_ROOT/packages" -type d -maxdepth 1 2>/dev/null | sort); do
  # Skip non-directories and excluded paths
  if [[ -d "$dir" ]] && ! is_excluded_path "$dir"; then
    PROJECT_DIRS+=("$dir")
    echo -e "  Found project: ${YELLOW}packages/$(basename "$dir")${NC}"
  fi
done

# Start writing the report
cat > "$REPORT_FILE" << EOL
# Documentation Report

Generated on $(date)

## Executive Summary

- **Projects scanned:** 0
- **Total markdown files:** 0
- **Total README files:** 0
- **Total docs files:** 0
- **Total other files:** 0
- **Prompt files (excluded):** 0

*Note: This summary will be updated at the end of the report generation*

## Project Documentation Summary

EOL

# Total counters across all projects
total_project_count=0
total_markdown_count=0
total_readme_count=0
total_docs_count=0
total_other_count=0
total_prompt_count=0

# Process each project directory
for project_dir in "${PROJECT_DIRS[@]}"; do
  # Get a human-readable project name
  if [[ "$project_dir" == "$MONO_ROOT" ]]; then
    project_name="Monorepo Root"
    display_name="Monorepo Root"
  elif [[ "$project_dir" == "$MONO_ROOT/docs" ]]; then
    project_name="docs"
    display_name="Root Docs Folder"
  else
    project_name=$(basename "$project_dir")
    # Get the parent directory name (apps or packages)
    parent_dir=$(basename "$(dirname "$project_dir")")
    display_name="$parent_dir/$project_name"
  fi
  
  echo -e "${GREEN}Scanning: ${display_name}${NC}"
  
  # Find markdown files in this project (using process substitution and arrays to avoid command line length limits)
  project_md_files=()
  
  # Different handling for root directory to avoid searching everything
  if [[ "$project_dir" == "$MONO_ROOT" ]]; then
    # For root, only search files directly in the root (not recursively)
    while read -r line; do
      if ! is_excluded_path "$line"; then
        project_md_files+=("$line")
      fi
    done < <(find "$project_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort -u)
  else
    # For other directories, search recursively
    while read -r line; do
      if ! is_excluded_path "$line"; then
        project_md_files+=("$line")
      fi
    done < <(find "$project_dir" -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/\.*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/coverage/*" 2>/dev/null | grep -v "node_modules" | sort -u)
  fi
  
  # Initialize counters for this project
  project_total=0
  project_readme=0
  project_docs=0
  project_other=0
  project_prompts=0
  
  # Process each markdown file for counting
  for file in "${project_md_files[@]}"; do
    # Skip files in prompts folders
    if is_in_prompts_folder "$file"; then
      ((project_prompts++))
      continue
    fi

    # Get relative path within project
    relative_path=${file#"$project_dir/"}
    
    # Determine file type
    if [[ "$relative_path" == "README.md" ]]; then
      ((project_readme++))
    elif [[ "$relative_path" == "README-"* ]]; then
      ((project_readme++))
    elif [[ "$relative_path" == "docs/"* ]]; then
      ((project_docs++))
    else
      ((project_other++))
    fi
    
    ((project_total++))
  done
  
  # Add to global counters - but skip if no files found
  if [[ $project_total -gt 0 ]]; then
    ((total_project_count++))
    ((total_markdown_count+=project_total))
    ((total_readme_count+=project_readme))
    ((total_docs_count+=project_docs))
    ((total_other_count+=project_other))
    ((total_prompt_count+=project_prompts))
  fi
  
  # Only add project to report if it has files
  if [[ $project_total -gt 0 ]]; then
    echo "### $display_name" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "- **Total markdown files:** $project_total" >> "$REPORT_FILE"
    echo "- **README files:** $project_readme" >> "$REPORT_FILE"
    echo "- **Files in docs folder:** $project_docs" >> "$REPORT_FILE"
    echo "- **Files in other locations:** $project_other" >> "$REPORT_FILE"
    echo "- **Prompt files (excluded from count):** $project_prompts" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
  fi
  
  # Only add detailed file list if there are files to report
  if [[ $project_total -gt 0 ]]; then
    echo "#### File Structure" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "```" >> "$REPORT_FILE"
    
    # Generate tree structure
    > "$TEMP_TREE_FILE"
    
    if [[ "$project_dir" == "$MONO_ROOT" ]]; then
      # For root directory, just list files at root level
      echo "$display_name/" >> "$TEMP_TREE_FILE"
      
      for file in "${project_md_files[@]}"; do
        if ! is_in_prompts_folder "$file"; then
          filename=$(basename "$file")
          echo "├── $filename" >> "$TEMP_TREE_FILE"
        fi
      done
    else
      # For other directories, build a proper tree
      
      # First, extract all directories from file paths
      declare -a all_dirs
      
      # Root of the tree
      echo "$display_name/" >> "$TEMP_TREE_FILE"
      
      # First handle root-level files
      for file in "${project_md_files[@]}"; do
        if ! is_in_prompts_folder "$file"; then
          relative_path=${file#"$project_dir/"}
          
          # If this is a file directly in the project root
          if [[ "$relative_path" != *"/"* ]]; then
            echo "├── $relative_path" >> "$TEMP_TREE_FILE"
          else
            # Add the directory path to our list
            dir=$(dirname "$relative_path")
            all_dirs+=("$dir")
          fi
        fi
      done
      
      # Get unique directories and sort them
      IFS=$'\n' sorted_dirs=($(printf "%s\n" "${all_dirs[@]}" | sort -u))
      unset IFS
      
      # Build a map of directory depths
      declare -A dir_depths
      
      # Add all directories to the tree first
      for dir in "${sorted_dirs[@]}"; do
        # Count slashes to determine depth
        depth=$(echo "$dir" | tr -cd '/' | wc -l)
        dir_depths["$dir"]=$depth
        
        # Get parent directory
        parent=$(dirname "$dir")
        
        # Skip if we're at root level
        if [[ "$parent" == "." ]]; then
          # Root-level directory
          echo "├── $dir/" >> "$TEMP_TREE_FILE"
        fi
      done
      
      # Add nested directories
      for dir in "${sorted_dirs[@]}"; do
        # Skip root-level directories (already added)
        parent=$(dirname "$dir")
        if [[ "$parent" == "." ]]; then
          continue
        fi
        
        depth=${dir_depths["$dir"]}
        indent=$(printf '  %.0s' $(seq 1 "$depth"))
        basename=$(basename "$dir")
        
        # Only add if parent is in our list (avoid duplicates)
        if [[ -n "${dir_depths[$parent]}" ]]; then
          echo "$indent├── $basename/" >> "$TEMP_TREE_FILE"
        fi
      done
      
      # Now add all files under their directories
      for file in "${project_md_files[@]}"; do
        if ! is_in_prompts_folder "$file"; then
          relative_path=${file#"$project_dir/"}
          
          # Skip files at root level (already processed)
          if [[ "$relative_path" == *"/"* ]]; then
            dir=$(dirname "$relative_path")
            filename=$(basename "$file")
            depth=${dir_depths["$dir"]}
            
            if [[ -z "$depth" ]]; then
              depth=1
            fi
            
            indent=$(printf '  %.0s' $(seq 1 "$((depth+1))"))
            echo "$indent├── $filename" >> "$TEMP_TREE_FILE"
          fi
        fi
      done
    fi
    
    # Add the tree to the report
    cat "$TEMP_TREE_FILE" >> "$REPORT_FILE"
    
    echo "```" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Now add the detailed table
    echo "#### File Details (Sorted by Last Modified)" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "| File Location | Type | Last Modified | Size (bytes) |" >> "$REPORT_FILE"
    echo "|---------------|------|---------------|--------------|" >> "$REPORT_FILE"
    
    # Create a temporary array to hold file details with timestamps for sorting
    declare -a file_details
    
    # Process each markdown file for details
    for file in "${project_md_files[@]}"; do
      # Skip files in prompts folders
      if is_in_prompts_folder "$file"; then
        continue
      fi

      # Get file info
      relative_path=${file#"$project_dir/"}
      last_modified_display=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null)
      last_modified_sort=$(stat -f "%m" "$file" 2>/dev/null) # Unix timestamp for sorting
      size=$(stat -f "%z" "$file" 2>/dev/null)
      
      # Determine file type
      if [[ "$relative_path" == "README.md" ]]; then
        type="Main README"
      elif [[ "$relative_path" == "README-"* ]]; then
        type="Feature README"
      elif [[ "$relative_path" == "docs/"* ]]; then
        type="Documentation"
      else
        type="Other"
      fi
      
      # Store in array with timestamp prefix for sorting
      file_details+=("$last_modified_sort|$relative_path|$type|$last_modified_display|$size")
    done
    
    # Sort the array by timestamp in descending order
    IFS=$'\n' sorted=($(sort -r -t '|' -k1 <<<"${file_details[*]}"))
    unset IFS
    
    # Add sorted details to report
    for detail in "${sorted[@]}"; do
      # Remove the timestamp prefix used for sorting
      formatted_detail=${detail#*|}
      # Replace pipe characters with table column separators
      formatted_detail=${formatted_detail//|/ | }
      echo "| $formatted_detail |" >> "$REPORT_FILE"
    done
    
    echo "" >> "$REPORT_FILE"
  fi
done

# Add overall summary section
cat >> "$REPORT_FILE" << EOL
## Overall Summary

- **Total projects scanned:** $total_project_count
- **Total markdown files:** $total_markdown_count
- **Total README files:** $total_readme_count
- **Total files in docs folders:** $total_docs_count
- **Total files in other locations:** $total_other_count
- **Total prompt files (excluded from counts):** $total_prompt_count

## Documentation Recommendations

Based on monorepo best practices:

1. **Keep shared documentation centralized** in the root /docs folder
2. **Maintain a simple README.md** in each project with basics and links to detailed docs
3. **Avoid duplication** by cross-referencing instead of copying content
4. **Use frontmatter** in markdown files to indicate which projects they apply to

## Next Steps

1. Run the consolidation script to organize documentation according to these principles
   \`pnpm docs:consolidate\`

2. Add frontmatter to documentation files
   \`pnpm docs:frontmatter\`

3. Generate a documentation index
   \`pnpm docs:organize\`
EOL

# Update the executive summary at the top of the file with the actual numbers
temp_file=$(mktemp)
sed -e "s/Projects scanned:.*/Projects scanned: $total_project_count/" \
    -e "s/Total markdown files:.*/Total markdown files: $total_markdown_count/" \
    -e "s/Total README files:.*/Total README files: $total_readme_count/" \
    -e "s/Total docs files:.*/Total docs files: $total_docs_count/" \
    -e "s/Total other files:.*/Total other files: $total_other_count/" \
    -e "s/Prompt files (excluded):.*/Prompt files (excluded): $total_prompt_count/" \
    -e "/\*Note: This summary will be updated/d" \
    "$REPORT_FILE" > "$temp_file"
mv "$temp_file" "$REPORT_FILE"

echo -e "${GREEN}Documentation report generated at ${REPORT_FILE}${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "${YELLOW}Projects scanned:${NC} $total_project_count"
echo -e "${YELLOW}Total markdown files:${NC} $total_markdown_count"
echo -e "${YELLOW}Total README files:${NC} $total_readme_count"
echo -e "${YELLOW}Total docs files:${NC} $total_docs_count"
echo -e "${YELLOW}Total other files:${NC} $total_other_count"
echo -e "${YELLOW}Prompt files (excluded):${NC} $total_prompt_count"

# Clean up
rm -f "$TEMP_TREE_FILE"