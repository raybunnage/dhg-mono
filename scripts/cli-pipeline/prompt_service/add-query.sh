#!/bin/bash

# Add Database Query to Prompt
# Adds or updates a database query for a prompt's metadata

# Get directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load environment variables
if [ -f "$ROOT_DIR/.env.development" ]; then
  source "$ROOT_DIR/.env.development"
  export SUPABASE_URL
  export SUPABASE_SERVICE_ROLE_KEY
  export SUPABASE_ANON_KEY
  # Export other necessary environment variables
fi

# Check for required arguments or help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ "$#" -lt 2 ]; then
  echo "Add Database Query to Prompt"
  echo ""
  echo "Adds or updates a database query in a prompt's metadata."
  echo "The query is used by the prompt when fetching data from the database."
  echo ""
  echo "Usage:"
  echo "  $(basename "$0") <prompt-name> <database-query> [--query2] [--dry-run]"
  echo ""
  echo "Arguments:"
  echo "  prompt-name       Name of the prompt to update"
  echo "  database-query    SQL query to add to the prompt metadata"
  echo ""
  echo "Options:"
  echo "  --query2          Use databaseQuery2 field instead of databaseQuery"
  echo "  --dry-run         Show what would be updated without making changes"
  echo "  -h, --help        Show this help message"
  echo ""
  echo "Examples:"
  echo "  $(basename "$0") document-classification-prompt \"SELECT * FROM document_types\""
  echo "  $(basename "$0") markdown-extraction-prompt \"SELECT * FROM experts\" --query2"
  
  # Exit with error code if no arguments were provided
  if [ "$#" -lt 2 ] && [ "$1" != "-h" ] && [ "$1" != "--help" ]; then
    exit 1
  else
    exit 0
  fi
fi

# Make script executable
chmod +x "$SCRIPT_DIR/add-query.sh"

# Change to the root directory
cd "$ROOT_DIR"

# Run the command directly with the standalone script
# This avoids the commander.js version issues with the CLI
npx ts-node -P "$ROOT_DIR/tsconfig.json" "$SCRIPT_DIR/add-query-command.ts" "$@"