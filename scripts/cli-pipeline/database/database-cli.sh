#!/usr/bin/env bash

# Find script directory
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Setup environment
cd "$PROJECT_ROOT" || exit 1
source "$PROJECT_ROOT/.env.development" 2>/dev/null || true

# Function to track commands
track_command() {
  local pipeline_name="database"
  local command_name="$1"
  shift
  local full_command="$@"
  
  local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Help message
show_help() {
  echo "Database CLI Tool"
  echo "=================="
  echo "Commands:"
  echo "  table-records     - List tables with their record counts"
  echo "  empty-tables      - List tables with no records"
  echo "  database-functions - List database functions"
  echo "  table-structure   - Get detailed information about a table structure"
  echo "  schema-health     - Analyze database schema health and identify issues"
  echo ""
  echo "Use './database-cli.sh <command> --help' for more information about a command"
}

# Command handlers
table_records() {
  track_command "table-records" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/table-records.ts $@"
}

empty_tables() {
  track_command "empty-tables" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/empty-tables.ts $@"
}

database_functions() {
  track_command "database-functions" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/database-functions.ts $@"
}

table_structure() {
  track_command "table-structure" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/table-structure.ts $@"
}

schema_health() {
  track_command "schema-health" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/schema-health.ts $@"
}

# Main command processor
case "$1" in
  "table-records")
    table_records "${@:2}"
    ;;
  "empty-tables")
    empty_tables "${@:2}"
    ;;
  "database-functions")
    database_functions "${@:2}"
    ;;
  "table-structure")
    table_structure "${@:2}"
    ;;
  "schema-health")
    schema_health "${@:2}"
    ;;
  "help"|"--help"|"-h")
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    echo ""
    show_help
    exit 1
    ;;
esac