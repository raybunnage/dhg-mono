#!/bin/bash

# Test script to identify issues with command tracking

# Get the project root
PROJECT_ROOT="/Users/raybunnage/Documents/github/dhg-mono"
cd "$PROJECT_ROOT" || exit 1

# Load environment
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ -f "$ENV_DEV_FILE" ]; then
  echo "Loading environment variables from $ENV_DEV_FILE"
  export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_DEV_FILE" | xargs)
fi

# Function to track commands - similar to database-cli.sh
track_command() {
  local pipeline_name="test_pipeline"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Path to the tracking wrapper
  local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
  
  echo "TEST: About to run command with tracking"
  echo "Command: $full_command"
  
  if [ -f "$TRACKER_TS" ]; then
    echo "🔍 Using tracking wrapper"
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
  
  echo "TEST: Command execution completed"
}

# Get the directory of this script
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")

# Test 1: Direct execution
echo "==== TEST 1: Direct Execution ===="
ts-node "$SCRIPT_DIR/test-table-simple.ts"
echo "==== END TEST 1 ===="

echo ""
echo "==== TEST 2: Execution Through Tracking Wrapper ===="
track_command "test-command" "ts-node $SCRIPT_DIR/test-table-simple.ts"
echo "==== END TEST 2 ===="