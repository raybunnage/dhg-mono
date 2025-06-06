#!/bin/bash
# Simplified Document Pipeline CLI
# Core document management without complex AI features

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_FILE="${SCRIPT_DIR}/simplified-cli.ts"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Command tracking function
track_command() {
  local pipeline_name="document_pipeline"
  local command_name="$1"
  shift
  local full_command="$@"
  
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Display help information
show_help() {
  echo "Simplified Document Pipeline CLI"
  echo "================================"
  echo "Core document management commands"
  echo ""
  echo "Usage: $0 COMMAND [OPTIONS]"
  echo ""
  echo "Commands:"
  echo "  sync-docs [--full]         Sync filesystem with doc_files table"
  echo "  find-new [--dir <dir>]     Find and add new markdown files"
  echo "  classify-doc <path>        Classify a single document"
  echo "  tag-doc <path> <tags...>   Add tags to a document"
  echo "  mark-important <path> <1-5> Set importance score"
  echo "  enable-auto-update <path> <source> <frequency>"
  echo "                             Enable auto-updates for a document"
  echo "    --disable                Disable auto-updates"
  echo ""
  echo "Examples:"
  echo "  $0 sync-docs --full"
  echo "  $0 find-new --dir docs"
  echo "  $0 classify-doc docs/README.md"
  echo "  $0 tag-doc docs/README.md architecture important"
  echo "  $0 mark-important docs/CLAUDE.md 5"
  echo "  $0 enable-auto-update docs/CLI_OVERVIEW.md cli_pipelines '1 day'"
}

# Load environment variables
load_env() {
  if [ -f "${ROOT_DIR}/.env.development" ]; then
    source "${ROOT_DIR}/.env.development"
  fi
  
  if [ -f "${ROOT_DIR}/.env.local" ]; then
    source "${ROOT_DIR}/.env.local"
  fi
  
  # Ensure Claude API key is set
  if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
    export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
  fi
}

# Load environment
load_env

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Missing Supabase credentials."
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Process command
COMMAND=${1:-"help"}

if [ "$COMMAND" == "help" ] || [ "$COMMAND" == "--help" ] || [ "$COMMAND" == "-h" ]; then
  show_help
  exit 0
fi

# Process commands
case "$COMMAND" in
  "sync-docs")
    track_command "sync-docs" "npx ts-node --transpile-only ${CLI_FILE} sync-docs ${@:2}"
    ;;
  "find-new")
    track_command "find-new" "npx ts-node --transpile-only ${CLI_FILE} find-new ${@:2}"
    ;;
  "classify-doc")
    track_command "classify-doc" "npx ts-node --transpile-only ${CLI_FILE} classify-doc ${@:2}"
    ;;
  "tag-doc")
    track_command "tag-doc" "npx ts-node --transpile-only ${CLI_FILE} tag-doc ${@:2}"
    ;;
  "mark-important")
    track_command "mark-important" "npx ts-node --transpile-only ${CLI_FILE} mark-important ${@:2}"
    ;;
  "enable-auto-update")
    track_command "enable-auto-update" "npx ts-node --transpile-only ${CLI_FILE} enable-auto-update ${@:2}"
    ;;
  *)
    echo "❌ Unknown command: $COMMAND"
    echo "Run '$0 help' for usage information"
    exit 1
    ;;
esac