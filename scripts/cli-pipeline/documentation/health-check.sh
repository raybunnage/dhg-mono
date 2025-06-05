#!/bin/bash
# Documentation CLI Pipeline Health Check
# This script verifies that the documentation pipeline is properly configured

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../../../logs"
LOG_FILE="$LOG_DIR/documentation-health-check.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Initialize the log file
echo "=== Documentation CLI Pipeline Health Check - $TIMESTAMP ===" > "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Main testing function
main() {
  echo "Running Documentation CLI Pipeline health check..."
  echo "Results will be logged to $LOG_FILE"
  
  # Check if pipeline directory exists
  if [ ! -d "$SCRIPT_DIR" ]; then
    echo "❌ FAILED: Pipeline directory not found at $SCRIPT_DIR" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  echo "✅ Pipeline directory exists" | tee -a "$LOG_FILE"
  
  # Check if CLI script exists
  if [ -f "$SCRIPT_DIR/documentation-cli.sh" ]; then
    echo "✅ CLI script found: documentation-cli.sh" | tee -a "$LOG_FILE"
  else
    echo "❌ FAILED: CLI script documentation-cli.sh not found" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  # Check if package.json exists and dependencies are installed
  if [ -f "$SCRIPT_DIR/package.json" ]; then
    echo "✅ package.json found" | tee -a "$LOG_FILE"
    
    # Check if node_modules exists
    if [ -d "$SCRIPT_DIR/node_modules" ]; then
      echo "✅ Dependencies appear to be installed" | tee -a "$LOG_FILE"
    else
      echo "⚠️  WARNING: node_modules not found - run 'npm install' in $SCRIPT_DIR" | tee -a "$LOG_FILE"
    fi
  fi
  
  # Check for TypeScript files
  TS_FILES=$(find "$SCRIPT_DIR" -name "*.ts" -type f | wc -l)
  if [ "$TS_FILES" -gt 0 ]; then
    echo "✅ Found $TS_FILES TypeScript files" | tee -a "$LOG_FILE"
  else
    echo "⚠️  WARNING: No TypeScript files found" | tee -a "$LOG_FILE"
  fi
  
  echo "" | tee -a "$LOG_FILE"
  echo "✅ Documentation CLI Pipeline health check completed successfully!" | tee -a "$LOG_FILE"
  return 0
}

# Run the main function
main