#!/bin/bash
# Analysis CLI Pipeline Health Check
# This script verifies that the analysis pipeline is properly configured

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../../../logs"
LOG_FILE="$LOG_DIR/analysis-health-check.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Initialize the log file
echo "=== Analysis CLI Pipeline Health Check - $TIMESTAMP ===" > "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Main testing function
main() {
  echo "Running Analysis CLI Pipeline health check..."
  echo "Results will be logged to $LOG_FILE"
  
  # Check if pipeline directory exists
  if [ ! -d "$SCRIPT_DIR" ]; then
    echo "❌ FAILED: Pipeline directory not found at $SCRIPT_DIR" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  echo "✅ Pipeline directory exists" | tee -a "$LOG_FILE"
  
  # Check if CLI script exists
  if [ -f "$SCRIPT_DIR/analysis-cli.sh" ]; then
    echo "✅ CLI script found: analysis-cli.sh" | tee -a "$LOG_FILE"
  else
    echo "❌ FAILED: CLI script analysis-cli.sh not found" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  # Check for important scripts
  SCRIPTS=(
    "analyze-scripts.sh"
    "classify-script-with-prompt.sh"
    "import-script-analysis.sh"
  )
  
  echo "" | tee -a "$LOG_FILE"
  echo "Checking for analysis scripts..." | tee -a "$LOG_FILE"
  
  for script in "${SCRIPTS[@]}"; do
    if [ -f "$SCRIPT_DIR/$script" ]; then
      echo "✅ Script found: $script" | tee -a "$LOG_FILE"
    else
      echo "⚠️  WARNING: Script not found: $script" | tee -a "$LOG_FILE"
    fi
  done
  
  echo "" | tee -a "$LOG_FILE"
  echo "✅ Analysis CLI Pipeline health check completed successfully!" | tee -a "$LOG_FILE"
  return 0
}

# Run the main function
main