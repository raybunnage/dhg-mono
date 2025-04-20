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
if [ -f "$ROOT_DIR/.env" ]; then
  echo "Loading environment variables from $ROOT_DIR/.env"
  source "$ROOT_DIR/.env"
fi

if [ -f "$ROOT_DIR/.env.local" ]; then
  echo "Loading environment variables from $ROOT_DIR/.env.local"
  source "$ROOT_DIR/.env.local" 
fi

if [ -f "$ROOT_DIR/.env.development" ]; then
  echo "Loading environment variables from $ROOT_DIR/.env.development"
  source "$ROOT_DIR/.env.development"
  echo "Loaded Supabase credentials successfully from $ROOT_DIR/.env.development"
  export SUPABASE_URL
  export SUPABASE_SERVICE_ROLE_KEY
  export SUPABASE_ANON_KEY
  # Export other necessary environment variables
fi

# Fix database queries function
fix_database_queries() {
  # Execute the commands directly with proper quoting
  echo "Updating document-classification-prompt-new..."
  track_command "add-query" "NODE_PATH=\"$SCRIPT_DIR/node_modules:$ROOT_DIR/node_modules\" npx ts-node -P \"$ROOT_DIR/tsconfig.json\" \"$SCRIPT_DIR/prompt-service-cli.ts\" add-query \"document-classification-prompt-new\" \"select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'docx';\""
  
  echo "Updating scientific-document-analysis-prompt..."
  track_command "add-query" "NODE_PATH=\"$SCRIPT_DIR/node_modules:$ROOT_DIR/node_modules\" npx ts-node -P \"$ROOT_DIR/tsconfig.json\" \"$SCRIPT_DIR/prompt-service-cli.ts\" add-query \"scientific-document-analysis-prompt\" \"select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'pdf';\""
  
  echo "Updating scientific-powerpoint..."
  track_command "add-query" "NODE_PATH=\"$SCRIPT_DIR/node_modules:$ROOT_DIR/node_modules\" npx ts-node -P \"$ROOT_DIR/tsconfig.json\" \"$SCRIPT_DIR/prompt-service-cli.ts\" add-query \"scientific-powerpoint\" \"select id, category, document_type, description, mime_type, file_extension from document_types where classifier = 'powerpoint';\""
  
  echo "Database queries fixed successfully."
}

# Make script executable
chmod +x "$SCRIPT_DIR/prompt-service-cli.sh"

# Change to the root directory
cd "$ROOT_DIR"

# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"

# Check for special commands
if [ "$COMMAND" = "fix-database-queries" ]; then
  fix_database_queries
else
  # Default to running the normal CLI
  CMD="NODE_PATH=\"$SCRIPT_DIR/node_modules:$ROOT_DIR/node_modules\" npx ts-node -P \"$ROOT_DIR/tsconfig.json\" \"$SCRIPT_DIR/prompt-service-cli.ts\" $*"
  track_command "$COMMAND" "$CMD"
fi