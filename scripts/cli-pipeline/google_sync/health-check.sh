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

# Initialize special command count variables
COUNT_MP4_COMMAND=0

# Commands that should be available
COMMANDS=(
  "sync-and-update-metadata"
  "check-document-types"
  "check-duplicates"
  "update-file-signatures"
  "update-media-document-types"
  "classify-docs-with-service"
  "classify-pdfs-with-service"
  "reclassify-docs-with-service"
  "report-main-video-ids"
  "update-main-video-ids"
  "browser-recursive-search"
  "update-sources-from-json"
  "insert-missing-sources"
  "update-schema-from-json"
  "count-mp4"
  "add-root-service"
  "show-expert-documents"
  "list-unclassified-files"
  "check-expert-doc"
  "fix-orphaned-docx"
  "remove-expert-docs-pdf-records"
  "test-prompt-service"
  "validate-pdf-classification"
  "check-recent-updates"
)

# Check for commands in google-sync-cli.sh that are directly implemented
CLI_SH="$SCRIPT_DIR/google-sync-cli.sh"

# Use standard arrays since associative arrays might not be supported in all environments
declare -a CMD_LIST=()
declare -a STATUS_LIST=()

for cmd in "${COMMANDS[@]}"; do
  # Find command implementations in google-sync-cli.sh - directly check tracking  
  CMD_LIST+=("$cmd")
  
  # Special case for classify-pdfs-with-service since it uses a variable for the command name
  if [ "$cmd" = "classify-pdfs-with-service" ] && grep -q 'CMD_NAME="classify-pdfs-with-service"' "$CLI_SH"; then
    STATUS_LIST+=("tracked")
  # Check if track_command exists for this command with proper quoting
  elif grep -q "track_command \"$cmd\"" "$CLI_SH"; then
    STATUS_LIST+=("tracked")
  else
    STATUS_LIST+=("untracked")
  fi
done

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
    if [ "$cmd" = "count-mp4" ] && [ -n "$COUNT_MP4_COMMAND" ] && [ "$COUNT_MP4_COMMAND" -gt 0 ]; then
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
  
  # Now check command tracking in google-sync-cli.sh
  if [ "$VERBOSE" = true ]; then
    echo "" | tee -a "$LOG_FILE"
    echo "Checking for command tracking in google-sync-cli.sh..." | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
  else
    echo "" >> "$LOG_FILE"
    echo "Checking for command tracking in google-sync-cli.sh..." >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
  fi
  
  local tracked=0
  local untracked=0
  local missing_in_cli=0  # Unused now that we simplified the approach
  
  # Check each command's tracking status
  for i in "${!CMD_LIST[@]}"; do
    local cmd="${CMD_LIST[$i]}"
    local status="${STATUS_LIST[$i]}"
    
    if [ "$status" = "tracked" ]; then
      if [ "$VERBOSE" = true ]; then
        echo "✅ PASSED: Command $cmd is tracked in google-sync-cli.sh" | tee -a "$LOG_FILE"
      else
        echo "✅ PASSED: Command $cmd is tracked in google-sync-cli.sh" >> "$LOG_FILE"
      fi
      ((tracked++))
    else
      if [ "$VERBOSE" = true ]; then
        echo "❌ FAILED: Command $cmd is NOT tracked in google-sync-cli.sh" | tee -a "$LOG_FILE"
      else
        echo "❌ FAILED: Command $cmd is NOT tracked in google-sync-cli.sh" >> "$LOG_FILE"
      fi
      ((untracked++))
    fi
  done
  
  # Report results
  local total_index=$((passed + failed))
  local total_cli=$((tracked + untracked))
  
  # Ensure all variables have valid integer values
  passed=${passed:-0}
  failed=${failed:-0}
  tracked=${tracked:-0}
  untracked=${untracked:-0}
  
  echo "" >> "$LOG_FILE"
  echo "=== Test Results Summary ===" | tee -a "$LOG_FILE"
  echo "Index.ts Commands:" | tee -a "$LOG_FILE"
  echo "  Total commands checked: $total_index" | tee -a "$LOG_FILE"
  echo "  Commands found: $passed" | tee -a "$LOG_FILE"
  echo "  Commands missing: $failed" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  echo "Command Tracking:" | tee -a "$LOG_FILE"
  echo "  Total commands checked: $total_cli" | tee -a "$LOG_FILE"
  echo "  Commands with tracking: $tracked" | tee -a "$LOG_FILE"
  echo "  Commands not tracked: $untracked" | tee -a "$LOG_FILE"
  
  if [ "${failed:-0}" -eq 0 ] && [ "${untracked:-0}" -eq 0 ]; then
    echo "✅ All commands are properly defined and tracked!" | tee -a "$LOG_FILE"
    return 0
  else
    echo "" | tee -a "$LOG_FILE"
    if [ "${failed:-0}" -gt 0 ]; then
      echo "❌ $failed command(s) are missing from index.ts." | tee -a "$LOG_FILE"
    fi
    if [ "${untracked:-0}" -gt 0 ]; then
      echo "❌ $untracked command(s) are not properly tracked in the CLI shell script." | tee -a "$LOG_FILE"
    fi
    echo "Full details in $LOG_FILE" | tee -a "$LOG_FILE"
    return 1
  fi
}

# Run the main function
main