#!/bin/bash
# Google Drive CLI Pipeline Health Check
# This script tests the health of key commands in the Google Drive CLI pipeline

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/google-sync-cli.sh"
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

# macOS-compatible timeout function (since timeout command isn't available by default)
timeout_command() {
  local timeout=$1
  shift
  
  # Start the command in background
  "$@" > /tmp/cmd_output 2>&1 &
  local cmd_pid=$!
  
  # Monitor the process for the specified timeout
  local count=0
  while [ $count -lt $timeout ] && kill -0 $cmd_pid 2>/dev/null; do
    sleep 1
    ((count++))
  done
  
  # If process is still running after timeout, kill it
  if kill -0 $cmd_pid 2>/dev/null; then
    kill $cmd_pid 2>/dev/null
    wait $cmd_pid 2>/dev/null
    return 124  # Standard timeout exit code
  fi
  
  # Wait for the process to finish and get its exit code
  wait $cmd_pid
  return $?
}

# Function to run a command with timeout and log the result
run_command_test() {
  local command="$1"
  local args="$2"
  local description="$3"
  local timeout_seconds="${4:-30}"  # Default timeout of 30 seconds

  if [ "$VERBOSE" = true ]; then
    echo "Testing: $command $args - $description" | tee -a "$LOG_FILE"
  else
    echo "Testing: $command $args - $description" >> "$LOG_FILE"
  fi
  
  # Run the command with a timeout
  timeout_command $timeout_seconds $CLI_PATH $command $args --dry-run
  local exit_code=$?
  
  # Check if command timed out
  if [ $exit_code -eq 124 ]; then
    echo "❌ FAILED (TIMEOUT): Command took too long to execute (> $timeout_seconds seconds)" >> "$LOG_FILE"
    echo "Command: $CLI_PATH $command $args --dry-run" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    return 1
  fi
  
  # Check if command returned success
  if [ $exit_code -eq 0 ]; then
    echo "✅ PASSED: Command executed successfully" | tee -a "$LOG_FILE"
    # Log a snippet of the output (first 5 lines)
    echo "Output snippet:" >> "$LOG_FILE"
    head -n 5 /tmp/cmd_output >> "$LOG_FILE"
    if [ $(wc -l < /tmp/cmd_output) -gt 5 ]; then
      echo "... (output truncated)" >> "$LOG_FILE"
    fi
    
    # Display output snippet if verbose mode is enabled
    if [ "$VERBOSE" = true ]; then
      echo "Output snippet:"
      head -n 5 /tmp/cmd_output
      if [ $(wc -l < /tmp/cmd_output) -gt 5 ]; then
        echo "... (output truncated)"
      fi
    fi
  else
    echo "❌ FAILED: Command returned exit code $exit_code" | tee -a "$LOG_FILE"
    echo "Command: $CLI_PATH $command $args --dry-run" | tee -a "$LOG_FILE"
    echo "Error output:" | tee -a "$LOG_FILE"
    cat /tmp/cmd_output | tee -a "$LOG_FILE"
  fi
  
  echo "" >> "$LOG_FILE"
  if [ "$VERBOSE" = true ]; then
    echo ""
  fi
  
  return $exit_code
}

# Function to check if a command exists in the CLI script
command_exists() {
  grep -q "^[[:space:]]*$1)[[:space:]]*$" "$CLI_PATH"
  return $?
}

# Function to count passed and failed tests
count_results() {
  local passed=$(grep -c "✅ PASSED" "$LOG_FILE")
  local failed=$(grep -c "❌ FAILED" "$LOG_FILE")
  local total=$((passed + failed))
  
  if [ "$VERBOSE" = true ]; then
    echo "=== Test Results Summary ===" | tee -a "$LOG_FILE"
    echo "Total tests: $total" | tee -a "$LOG_FILE"
    echo "Passed: $passed" | tee -a "$LOG_FILE"
    echo "Failed: $failed" | tee -a "$LOG_FILE"
    
    if [ $failed -eq 0 ]; then
      echo "✅ All tests passed!" | tee -a "$LOG_FILE"
      return 0
    else
      echo "❌ $failed test(s) failed. Full details in $LOG_FILE" | tee -a "$LOG_FILE"
      return 1
    fi
  else
    echo "=== Test Results Summary ===" >> "$LOG_FILE"
    echo "Total tests: $total" >> "$LOG_FILE"
    echo "Passed: $passed" >> "$LOG_FILE"
    echo "Failed: $failed" >> "$LOG_FILE"
    
    if [ $failed -eq 0 ]; then
      echo "✅ All tests passed!" >> "$LOG_FILE"
      echo "All tests passed!" 
      return 0
    else
      echo "❌ $failed test(s) failed. Check $LOG_FILE for details." >> "$LOG_FILE"
      echo "$failed test(s) failed. Check $LOG_FILE for details."
      return 1
    fi
  fi
}

# Main testing function
main() {
  if [ "$VERBOSE" = true ]; then
    echo "Running Google Drive CLI Pipeline health check (verbose mode)..."
  else
    echo "Running Google Drive CLI Pipeline health check..."
  fi
  echo "Results will be logged to $LOG_FILE"
  
  if [ "$VERBOSE" = true ]; then
    echo "Starting tests..." | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
  else
    echo "Starting tests..." | tee -a "$LOG_FILE"
  fi
  
  # 1. Test sync-and-update-metadata - check help text only to avoid actual Drive API calls
  run_command_test "sync-and-update-metadata" "--help" "Checks if sync and metadata update command exists" 10
  
  # 2. Test check-document-types - with --help to avoid actual database queries
  run_command_test "check-document-types" "--help" "Checks if document type verification command exists" 10
  
  # 3. Test check-duplicates
  run_command_test "check-duplicates" "--help" "Checks if duplicate detection command exists" 10
  
  # 4. Test update-file-signatures
  run_command_test "update-file-signatures" "--help" "Checks if file signature updating command exists" 10
  
  # 5. Test classify-missing-docs
  run_command_test "classify-missing-docs" "--help" "Checks if document classification command exists" 10
  
  # 6. Test report-main-video-ids
  run_command_test "report-main-video-ids" "--help" "Checks if video ID reporting command exists" 10
  
  # 7. Test count-mp4
  run_command_test "count-mp4" "--help" "Checks if MP4 counting command exists" 10
  
  # 8. Test add-root-service - with --help to avoid actual Drive API calls
  run_command_test "add-root-service" "--help" "Checks if root folder adding command exists" 10
  
  # 9-10. Additional tests could be added here if needed
  
  # Count and display results
  count_results
}

# Run the main function
main