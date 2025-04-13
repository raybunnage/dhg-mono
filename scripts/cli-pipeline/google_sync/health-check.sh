#!/bin/bash
# Google Drive CLI Pipeline Health Check
# This script verifies that all required commands are defined in index.ts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INDEX_TS="$SCRIPT_DIR/index.ts"
LOG_DIR="$SCRIPT_DIR/../../../logs"
LOG_FILE="$LOG_DIR/google-sync-health-check.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
VERBOSE=false

# Parse command line options
for arg in "$@"; do
  case $arg in
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      # Unknown option
      ;;
  esac
done

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Initialize the log file
echo "=== Google Drive CLI Pipeline Health Check - $TIMESTAMP ===" > "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Commands that should be available
COMMANDS=(
  "sync-and-update-metadata"
  "check-document-types"
  "check-duplicates"
  "update-file-signatures"
  "classify-missing-docs"
  "report-main-video-ids"
  "update-main-video-ids"
  "browser-recursive-search"
  "update-sources-from-json"
  "insert-missing-sources"
  "update-schema-from-json"
  "count-mp4"
  "add-root-service"
)

# Special case for count-mp4 which is directly implemented in google-sync-cli.sh
COUNT_MP4_COMMAND=$(grep -c "count-mp4" "$SCRIPT_DIR/google-sync-cli.sh")

# Main testing function
main() {
  if [ "$VERBOSE" = true ]; then
    echo "Running Google Drive CLI Pipeline health check (verbose mode)..."
  else
    echo "Running Google Drive CLI Pipeline health check..."
  fi
  echo "Results will be logged to $LOG_FILE"
  
  # Check if index.ts exists
  if [ ! -f "$INDEX_TS" ]; then
    echo "❌ FAILED: index.ts not found at $INDEX_TS" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  if [ "$VERBOSE" = true ]; then
    echo "Checking for commands in index.ts..." | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
  else
    echo "Checking for commands in index.ts..." >> "$LOG_FILE"
  fi
  
  # Variables to track results
  local passed=0
  local failed=0
  
  # Check each command
  for cmd in "${COMMANDS[@]}"; do
    # Special case for count-mp4
    if [ "$cmd" = "count-mp4" ] && [ "$COUNT_MP4_COMMAND" -gt 0 ]; then
      if [ "$VERBOSE" = true ]; then
        echo "✅ PASSED: Command $cmd is defined in google-sync-cli.sh" | tee -a "$LOG_FILE"
      else
        echo "✅ PASSED: Command $cmd is defined in google-sync-cli.sh" >> "$LOG_FILE"
      fi
      ((passed++))
      continue
    fi
    
    # Check if command is defined in index.ts
    local found=$(grep -c ".command('$cmd')" "$INDEX_TS")
    
    if [ "$found" -gt 0 ]; then
      if [ "$VERBOSE" = true ]; then
        echo "✅ PASSED: Command $cmd is defined in index.ts" | tee -a "$LOG_FILE"
      else
        echo "✅ PASSED: Command $cmd is defined in index.ts" >> "$LOG_FILE" 
      fi
      ((passed++))
    else
      if [ "$VERBOSE" = true ]; then
        echo "❌ FAILED: Command $cmd not found in index.ts" | tee -a "$LOG_FILE"
      else
        echo "❌ FAILED: Command $cmd not found in index.ts" >> "$LOG_FILE"
      fi
      ((failed++))
    fi
  done
  
  # Report results
  local total=$((passed + failed))
  
  echo "" >> "$LOG_FILE"
  echo "=== Test Results Summary ===" | tee -a "$LOG_FILE"
  echo "Total commands checked: $total" | tee -a "$LOG_FILE"
  echo "Commands found: $passed" | tee -a "$LOG_FILE"
  echo "Commands missing: $failed" | tee -a "$LOG_FILE"
  
  if [ $failed -eq 0 ]; then
    echo "✅ All commands are properly defined!" | tee -a "$LOG_FILE"
    return 0
  else
    echo "❌ $failed command(s) are missing. Full details in $LOG_FILE" | tee -a "$LOG_FILE"
    return 1
  fi
}

# Run the main function
main