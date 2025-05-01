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

# Display help function
display_help() {
  echo "Prompt Service CLI - Manage prompts across the application"
  echo ""
  echo "USAGE:"
  echo "  ./prompt-service-cli.sh <command> [options]"
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands based on usage statistics)"
  echo ""
  echo "PROMPT MANAGEMENT:"
  echo "    load <file-path>           Load a prompt file into the database"
  echo "  * update <name> <file-path>  Update an existing prompt in the database (16 uses)"
  echo "    view <prompt-number>       View the content of a prompt"
  echo "  * view-metadata <number>     View metadata of a prompt (9 uses)"
  echo ""
  echo "DATABASE OPERATIONS:"
  echo "  * add-query <name> <query>   Add or update a database query for a prompt (14 uses)"
  echo "    clean-metadata             Clean metadata by removing specified fields"
  echo ""
  echo "REPORTING & UTILITIES:"
  echo "  * summarize-metadata         Summarize metadata fields across all prompt records (9 uses)"
  echo "    verify-claude-temperature  Verify that Claude service is using temperature=0"
  echo "    list                       List all prompts in the database"
  echo ""
  echo "SYSTEM:"
  echo "  * health-check               Check the health of the prompt service (59 uses)"
  echo "    fix-database-queries       Fix database queries for document classification prompts"
  echo "    help                       Show this help message"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "PROMPT MANAGEMENT:"
  echo "  # Load a prompt file into the database"
  echo "  ./prompt-service-cli.sh load ./prompts/document-classification-prompt.md"
  echo ""
  echo "  # Update an existing prompt"
  echo "  ./prompt-service-cli.sh update document-classification-prompt ./prompts/document-classification-prompt-updated.md"
  echo ""
  echo "  # View prompt metadata"
  echo "  ./prompt-service-cli.sh view-metadata 1"
  echo ""
  echo "DATABASE OPERATIONS:"
  echo "  # Add a database query to a prompt"
  echo "  ./prompt-service-cli.sh add-query \"document-classification-prompt\" \"select * from document_types\""
  echo ""
  echo "SYSTEM:"
  echo "  # Check the health of the prompt service"
  echo "  ./prompt-service-cli.sh health-check"
}

# Check for help command
if [ "$COMMAND" = "help" ] || [ "$COMMAND" = "--help" ] || [ "$COMMAND" = "-h" ]; then
  display_help
  exit 0
# Check for special commands
elif [ "$COMMAND" = "fix-database-queries" ]; then
  fix_database_queries
else
  # Default to running the normal CLI
  CMD="NODE_PATH=\"$SCRIPT_DIR/node_modules:$ROOT_DIR/node_modules\" npx ts-node -P \"$ROOT_DIR/tsconfig.json\" \"$SCRIPT_DIR/prompt-service-cli.ts\" $*"
  track_command "$COMMAND" "$CMD"
fi