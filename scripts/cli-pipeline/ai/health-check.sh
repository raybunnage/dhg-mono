#!/bin/bash
# AI CLI Pipeline Health Check
# This script verifies that the AI pipeline is properly configured

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../../../logs"
LOG_FILE="$LOG_DIR/ai-health-check.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Initialize the log file
echo "=== AI CLI Pipeline Health Check - $TIMESTAMP ===" > "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Main testing function
main() {
  echo "Running AI CLI Pipeline health check..."
  echo "Results will be logged to $LOG_FILE"
  
  # Check if pipeline directory exists
  if [ ! -d "$SCRIPT_DIR" ]; then
    echo "❌ FAILED: Pipeline directory not found at $SCRIPT_DIR" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  echo "✅ Pipeline directory exists" | tee -a "$LOG_FILE"
  
  # Check if CLI script exists
  if [ -f "$SCRIPT_DIR/ai-cli.sh" ]; then
    echo "✅ CLI script found: ai-cli.sh" | tee -a "$LOG_FILE"
  else
    echo "❌ FAILED: CLI script ai-cli.sh not found" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  # Check for important scripts
  SCRIPTS=(
    "check-claude-api-key.sh"
    "prompt-lookup.sh"
    "run-ai-analyze.sh"
    "validate-ai-assets.sh"
  )
  
  echo "" | tee -a "$LOG_FILE"
  echo "Checking for AI scripts..." | tee -a "$LOG_FILE"
  
  for script in "${SCRIPTS[@]}"; do
    if [ -f "$SCRIPT_DIR/$script" ]; then
      echo "✅ Script found: $script" | tee -a "$LOG_FILE"
    else
      echo "⚠️  WARNING: Script not found: $script" | tee -a "$LOG_FILE"
    fi
  done
  
  # Check for TypeScript files
  TS_FILES=$(find "$SCRIPT_DIR" -name "*.ts" -type f | wc -l)
  if [ "$TS_FILES" -gt 0 ]; then
    echo "✅ Found $TS_FILES TypeScript files" | tee -a "$LOG_FILE"
  else
    echo "⚠️  WARNING: No TypeScript files found" | tee -a "$LOG_FILE"
  fi
  
  # Check Claude API key configuration
  echo "" | tee -a "$LOG_FILE"
  echo "Checking Claude API configuration..." | tee -a "$LOG_FILE"
  
  # Source environment variables
  ENV_FILE="$SCRIPT_DIR/../../../.env.development"
  if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
    if [ -n "$CLAUDE_API_KEY" ]; then
      echo "✅ Claude API key found" | tee -a "$LOG_FILE"
    else
      echo "⚠️  WARNING: CLAUDE_API_KEY not found in .env.development" | tee -a "$LOG_FILE"
    fi
  else
    echo "❌ FAILED: .env.development file not found" | tee -a "$LOG_FILE"
    exit 1
  fi
  
  echo "" | tee -a "$LOG_FILE"
  echo "✅ AI CLI Pipeline health check completed successfully!" | tee -a "$LOG_FILE"
  return 0
}

# Run the main function
main