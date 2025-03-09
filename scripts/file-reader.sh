#!/bin/bash

# file-reader.sh - A script to read local files and generate a report
# Usage: ./scripts/file-reader.sh <filepath>

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Define report file location
REPORT_DIR="./docs"
REPORT_FILE="$REPORT_DIR/file-reader-report.md"

# Ensure report directory exists
mkdir -p "$REPORT_DIR"

# Function to log messages with timestamps
log() {
  local level=$1
  local message=$2
  local color=$NC
  
  case $level in
    "INFO") color=$BLUE ;;
    "SUCCESS") color=$GREEN ;;
    "WARNING") color=$YELLOW ;;
    "ERROR") color=$RED ;;
  esac
  
  echo -e "${color}[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message${NC}"
}

# Function to validate file path
validate_file() {
  local filepath=$1
  
  # Check if file path is provided
  if [ -z "$filepath" ]; then
    log "ERROR" "No file path provided. Usage: ./scripts/file-reader.sh <filepath>"
    return 1
  fi
  
  # Check if file exists
  if [ ! -f "$filepath" ]; then
    log "ERROR" "File does not exist: $filepath"
    return 1
  fi
  
  # Check if file is readable
  if [ ! -r "$filepath" ]; then
    log "ERROR" "File is not readable: $filepath"
    return 1
  fi
  
  return 0
}

# Function to get file metadata
get_file_metadata() {
  local filepath=$1
  local size=$(wc -c < "$filepath")
  local lines=$(wc -l < "$filepath")
  local modified=$(date -r "$filepath" "+%Y-%m-%d %H:%M:%S")
  local filetype=$(file -b "$filepath")
  local extension="${filepath##*.}"
  
  echo "Size: $size bytes"
  echo "Lines: $lines"
  echo "Last Modified: $modified"
  echo "File Type: $filetype"
  echo "Extension: $extension"
}

# Function to generate report
generate_report() {
  local filepath=$1
  local status=$2
  local metadata=$3
  local content=$4
  local error_message=$5
  
  # Create report header
  cat > "$REPORT_FILE" << EOF
# File Reader Report

Generated: $(date '+%Y-%m-%d %H:%M:%S')

## File Information

- **Path:** \`$filepath\`
- **Status:** ${status}

## File Metadata

\`\`\`
$metadata
\`\`\`

EOF

  # Add content or error message to report
  if [ "$status" = "✅ Success" ]; then
    # Determine if we should use code block formatting based on file extension
    local ext="${filepath##*.}"
    local code_block=""
    
    case $ext in
      md|markdown) code_block="markdown" ;;
      js|jsx|ts|tsx) code_block="javascript" ;;
      py) code_block="python" ;;
      sh) code_block="bash" ;;
      sql) code_block="sql" ;;
      json) code_block="json" ;;
      html) code_block="html" ;;
      css) code_block="css" ;;
      *) code_block="" ;;
    esac
    
    cat >> "$REPORT_FILE" << EOF
## File Content

\`\`\`${code_block}
$content
\`\`\`

## Summary

The file was successfully read and its contents are displayed above.
EOF
  else
    cat >> "$REPORT_FILE" << EOF
## Error

\`\`\`
$error_message
\`\`\`

## Summary

Failed to read the file. Please check the error message above.
EOF
  fi
  
  log "INFO" "Report generated at $REPORT_FILE"
}

# Main execution
main() {
  local filepath=$1
  
  log "INFO" "Starting file reader for: $filepath"
  
  # Validate file
  if ! validate_file "$filepath"; then
    local error_message="File validation failed for: $filepath"
    generate_report "$filepath" "❌ Failed" "N/A" "" "$error_message"
    log "ERROR" "$error_message"
    exit 1
  fi
  
  # Get file metadata
  log "INFO" "Getting metadata for: $filepath"
  local metadata=$(get_file_metadata "$filepath")
  
  # Read file content
  log "INFO" "Reading file content"
  local content=$(cat "$filepath")
  
  if [ $? -ne 0 ]; then
    local error_message="Failed to read file content: $filepath"
    generate_report "$filepath" "❌ Failed" "$metadata" "" "$error_message"
    log "ERROR" "$error_message"
    exit 1
  fi
  
  # Generate success report
  generate_report "$filepath" "✅ Success" "$metadata" "$content" ""
  
  log "SUCCESS" "File read successfully: $filepath"
  
  # Output the content to stdout (can be captured by other scripts/programs)
  echo "$content"
}

# Execute main function with the provided filepath
main "$1" 