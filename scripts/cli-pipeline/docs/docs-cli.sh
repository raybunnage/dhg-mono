#!/bin/bash

# Documentation Management CLI
# Manages continuously updated documentation with monitoring and review cycles

set -e

# Find script directory and project root
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Setup environment
cd "$PROJECT_ROOT" || exit 1
source "$PROJECT_ROOT/.env.development" 2>/dev/null || true

# Function to track commands
track_command() {
  local pipeline_name="docs"
  local command_name="$1"
  shift
  local full_command="$@"
  
  echo "🔍 Tracking command: $command_name"
}

show_help() {
    echo "Documentation Management CLI"
    echo ""
    echo "USAGE:"
    echo "  ./docs-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  register         Register a new living document for monitoring"
    echo "  list            List all monitored documents"
    echo "  check-reviews   Show documents needing review"
    echo "  daily-check     Run daily review check (for automation)"
    echo "  update          Update document and reset review timer"
    echo "  archive         Archive old documentation with relationships"
    echo "  search          Search archived documents"
    echo "  format          Update document format to standard template"
    echo "  bulk-format     Format all continuously-updated docs"
    echo "  sync-db         Sync continuously-updated files to database"
    echo "  report          Generate documentation health report"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  ./docs-cli.sh register --path docs/continuously-updated/cli-pipelines.md --area cli-pipeline --frequency 14"
    echo "  ./docs-cli.sh check-reviews"
    echo "  ./docs-cli.sh format --path docs/continuously-updated/apps-documentation.md"
    echo "  ./docs-cli.sh bulk-format"
    echo ""
}

case "${1:-}" in
    register)
        track_command "docs" "register" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/register-document.ts" "$@"
        ;;
    list)
        track_command "docs" "list" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/list-documents.ts" "$@"
        ;;
    check-reviews)
        track_command "docs" "check-reviews" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/check-reviews.ts" "$@"
        ;;
    daily-check)
        track_command "docs" "daily-check" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/daily-review-check.ts" "$@"
        ;;
    update)
        track_command "docs" "update" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/update-document.ts" "$@"
        ;;
    archive)
        track_command "docs" "archive" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/archive-documents.ts" "$@"
        ;;
    search)
        track_command "docs" "search" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/search-archives.ts" "$@"
        ;;
    format)
        track_command "docs" "format" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/format-document.ts" "$@"
        ;;
    bulk-format)
        track_command "docs" "bulk-format" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/bulk-format-documents.ts" "$@"
        ;;
    sync-db)
        track_command "docs" "sync-db" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/sync-to-database.ts" "$@"
        ;;
    report)
        track_command "docs" "report" "$@"
        shift
        exec ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$SCRIPT_DIR/commands/generate-report.ts" "$@"
        ;;
    health-check)
        track_command "docs" "health-check" "$@"
        echo "✅ Documentation CLI pipeline is healthy"
        echo "Available commands: register, list, check-reviews, update, archive, search, format, bulk-format, sync-db, report"
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac