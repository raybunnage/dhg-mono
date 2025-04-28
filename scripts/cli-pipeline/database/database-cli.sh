#!/usr/bin/env bash

# Find script directory
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Setup environment
cd "$PROJECT_ROOT" || exit 1
source "$PROJECT_ROOT/.env.development" 2>/dev/null || true

# Parse debug flag from command line arguments
DEBUG_MODE=false
for arg in "$@"; do
  if [ "$arg" = "--debug" ]; then
    DEBUG_MODE=true
    break
  fi
done

# Function to track commands
track_command() {
  local pipeline_name="database"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Filter out the --debug flag from the command arguments
  full_command=$(echo "$full_command" | sed 's/--debug//g')
  
  # Run directly if debug mode is enabled
  if [ "$DEBUG_MODE" = true ]; then
    echo "🐛 DEBUG MODE: Running command directly without tracking"
    echo "📋 Executing: $full_command"
    eval "$full_command"
    return
  fi
  
  local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
  if [ -f "$TRACKER_TS" ]; then
    echo "🔍 Tracking command: $command_name"
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
  echo "  connection-test   - Test connection to Supabase database and network connectivity"
  echo "  db-health-check   - Simple database health check (quick connection test)"
  echo ""
  echo "Options:"
  echo "  --debug           - Run commands directly without tracking (bypasses tracker for troubleshooting)"
  echo "  --direct-run      - Run with delayed process exit (ensures output is flushed - for table-records only)"
  echo ""
  echo "Use './database-cli.sh <command> --help' for more information about a command"
}

# Command handlers
table_records() {
  # Check for special direct run option
  for arg in "$@"; do
    if [ "$arg" = "--direct-run" ]; then
      echo "🐛 DIRECT RUN MODE: Executing table-records with process exit delay"
      # Run with manual command and forced output using printf
      cd "$PROJECT_ROOT" && ts-node -e "
        console.log('🔍 Loading table-records program...');
        
        // Intercept console.log to force output
        const originalConsoleLog = console.log;
        console.log = function(...args) {
          // Force immediate output with process.stdout.write
          process.stdout.write('[INTERCEPTED LOG]: ' + args.join(' ') + '\\n');
          // Still call original for good measure 
          originalConsoleLog.apply(console, args);
        };
        
        const program = require('$SCRIPT_DIR/commands/table-records').default;
        console.log('🔍 Parsing arguments...');
        try {
          program.parse(['node', 'script', ...process.argv.slice(1).filter(arg => arg !== '--direct-run')]);
          console.log('🔍 Command executed, waiting for output to flush...');
        } catch (error) {
          process.stdout.write('ERROR EXECUTING COMMAND: ' + error + '\\n');
        }
        
        // Add delay before exiting to ensure output is flushed
        setTimeout(() => {
          process.stdout.write('🔍 Exit timeout reached, terminating process\\n');
          process.exit(0)
        }, 2000);
      " -- "$@"
      return
    fi
  done
  
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

connection_test() {
  track_command "connection-test" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/connection-test.ts $@"
}

db_health_check() {
  track_command "db-health-check" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/db-health-check.ts $@"
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
  "connection-test")
    connection_test "${@:2}"
    ;;
  "db-health-check")
    db_health_check "${@:2}"
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