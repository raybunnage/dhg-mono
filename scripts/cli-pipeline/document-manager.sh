#!/bin/bash

# Script to run the document-type-manager.ts with proper environment variables

# Prevent execution of the script arguments
set -f

# Change to the project root directory
cd "$(dirname "$0")/../.." || exit 1

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  set -a
  source .env
  set +a
else
  echo "Error: .env file not found."
  exit 1
fi

# Set Claude API key from ANTHROPIC_API_KEY if not set
if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
  export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
  echo "Using ANTHROPIC_API_KEY for Claude API calls."
fi

# Print environment variable status
echo "SUPABASE_URL: $SUPABASE_URL"
echo "ANTHROPIC_API_KEY length: ${#ANTHROPIC_API_KEY}"

# Define a function for running the TypeScript script with the right environment
run_ts_script() {
  # Run the TypeScript file with explicit environment variables
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  CLAUDE_API_KEY="$ANTHROPIC_API_KEY" \
  npx ts-node ./scripts/cli-pipeline/document-type-manager.ts "$@"
}

# Process commands
case "$1" in
  "classify")
    # Set default document path and prompt name
    DEFAULT_DOC_PATH="docs/technical-specs/document-classification-prompt.md"
    DEFAULT_PROMPT="markdown-document-classification-prompt"
    
    # Parse arguments
    if [ -z "$2" ]; then
      # No file path provided, use default
      FILE_PATH="$DEFAULT_DOC_PATH"
      PROMPT_NAME="$DEFAULT_PROMPT"
      echo "No file path provided, using default: $FILE_PATH"
    else
      # Use provided file path
      FILE_PATH="$2"
      PROMPT_NAME="${3:-$DEFAULT_PROMPT}"
      
      # Verify file exists
      if [ ! -f "$FILE_PATH" ]; then
        echo "Warning: File not found: $FILE_PATH"
        echo "Using default file instead: $DEFAULT_DOC_PATH"
        FILE_PATH="$DEFAULT_DOC_PATH"
      fi
    fi
    
    echo "Classifying document: $FILE_PATH"
    echo "Using prompt: $PROMPT_NAME"
    
    # Run the classification command
    run_ts_script classify "$FILE_PATH" "$PROMPT_NAME"
    ;;
    
  "list-types")
    run_ts_script list-types
    ;;
    
  "list-files")
    run_ts_script list-files
    ;;
    
  "update-status")
    run_ts_script update-status
    ;;
    
  "lookup-prompt")
    PROMPT_NAME="${2:-markdown-document-classification-prompt}"
    echo "Looking up prompt: $PROMPT_NAME"
    run_ts_script lookup-prompt "$PROMPT_NAME"
    ;;
    
  *)
    # Show usage if no command or unknown command
    run_ts_script
    ;;
esac