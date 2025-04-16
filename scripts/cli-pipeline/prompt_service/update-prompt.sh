#!/bin/bash

# Update Prompt from File
# Updates a prompt in the database from a file

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
  echo "Update Prompt from File"
  echo ""
  echo "Updates a prompt in the database from a file."
  echo "The file content will replace the existing prompt content."
  echo ""
  echo "Usage:"
  echo "  $(basename "$0") <prompt-name> <file-path> [--dry-run]"
  echo ""
  echo "Arguments:"
  echo "  prompt-name       Name of the prompt to update"
  echo "  file-path         Path to the updated prompt file"
  echo ""
  echo "Options:"
  echo "  --dry-run         Show what would be updated without making changes"
  echo "  -h, --help        Show this help message"
  echo ""
  echo "Examples:"
  echo "  $(basename "$0") document-classification-prompt /path/to/updated-prompt.md"
  echo "  $(basename "$0") document-classification-prompt ./prompts/document-classification-prompt-v2.md --dry-run"
  
  # Exit with error code if no arguments were provided
  if [ "$#" -lt 2 ] && [ "$1" != "-h" ] && [ "$1" != "--help" ]; then
    exit 1
  else
    exit 0
  fi
fi

# Make script executable
chmod +x "$SCRIPT_DIR/update-prompt.sh"

# Change to the root directory
cd "$ROOT_DIR"

# Run the command through the CLI
"$SCRIPT_DIR/prompt-service-cli.sh" update "$@"