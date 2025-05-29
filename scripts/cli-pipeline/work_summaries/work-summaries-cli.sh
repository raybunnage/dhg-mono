#!/bin/bash

# Work Summaries CLI - Track AI assistant work
#
# Commands:
#   add          Add a new work summary (manual)
#   auto         Auto-generate a work summary (AI-friendly)
#   import       Import summaries from claude_code_prompts.txt
#   help         Show this help message

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Show help if no arguments
if [ $# -eq 0 ] || [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Work Summaries CLI - Track AI assistant work"
  echo ""
  echo "Usage: ./work-summaries-cli.sh <command> [options]"
  echo ""
  echo "Commands:"
  echo "  add          Add a new work summary (manual)"
  echo "  auto         Auto-generate a work summary (AI-friendly)"
  echo "  import       Import summaries from claude_code_prompts.txt"
  echo ""
  echo "Examples:"
  echo "  ./work-summaries-cli.sh add --title \"Fixed bug\" --content \"Description\" --commands \"cmd1,cmd2\""
  echo "  ./work-summaries-cli.sh auto \"Fixed bug\" \"Description of the fix\""
  echo "  ./work-summaries-cli.sh import"
  exit 0
fi

# Route commands
case "$1" in
  "add")
    shift
    ts-node "$SCRIPT_DIR/add-summary.ts" "$@"
    ;;
    
  "auto")
    shift
    ts-node "$SCRIPT_DIR/auto-summary.ts" "$@"
    ;;
    
  "import")
    shift
    ts-node "$SCRIPT_DIR/import-from-prompts.ts" "$@"
    ;;
    
  *)
    echo "Unknown command: $1"
    echo "Run './work-summaries-cli.sh help' for usage"
    exit 1
    ;;
esac