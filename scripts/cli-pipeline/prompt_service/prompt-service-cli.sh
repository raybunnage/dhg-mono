#!/bin/bash

# Prompt Service CLI
# Manages prompt content across the application

# Get directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="prompt_service"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Check if we have a TS tracking wrapper
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    # Fallback to direct execution without tracking
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Load environment variables
if [ -f "$ROOT_DIR/.env.development" ]; then
  source "$ROOT_DIR/.env.development"
  export SUPABASE_URL
  export SUPABASE_SERVICE_ROLE_KEY
  export SUPABASE_ANON_KEY
  # Export other necessary environment variables
fi

# Make script executable
chmod +x "$SCRIPT_DIR/prompt-service-cli.sh"

# Change to the root directory
cd "$ROOT_DIR"

# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"
CMD="NODE_PATH=\"$SCRIPT_DIR/node_modules:$ROOT_DIR/node_modules\" npx ts-node -P \"$ROOT_DIR/tsconfig.json\" \"$SCRIPT_DIR/prompt-service-cli.ts\" $*"
track_command "$COMMAND" "$CMD"