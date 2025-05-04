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
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands based on usage statistics)"
  echo ""
  echo "DATABASE INFORMATION:"
  echo "  * table-records        List tables with their record counts (13 uses)"
  echo "  * empty-tables         List tables with no records (5 uses)"
  echo "    database-functions   List database functions (3 uses)"
  echo "    table-structure      Get detailed information about a table structure (3 uses)"
  echo ""
  echo "SYSTEM HEALTH:"
  echo "  * connection-test      Test connection to Supabase database (4 uses)"
  echo "  * db-health-check      Simple database health check (quick connection test) (4 uses)"
  echo "  * schema-health        Analyze database schema health and identify issues (2 uses)"
  echo ""
  echo "OPTIONS:"
  echo "  --debug                Run commands directly without tracking"
  echo "  --simple               Run simplified version with direct output"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "DATABASE INFORMATION:"
  echo "  # List all tables with record counts"
  echo "  ./database-cli.sh table-records"
  echo ""
  echo "  # List empty tables"
  echo "  ./database-cli.sh empty-tables"
  echo ""
  echo "  # Show functions in the database"
  echo "  ./database-cli.sh database-functions"
  echo ""
  echo "SYSTEM HEALTH:"
  echo "  # Test database connection"
  echo "  ./database-cli.sh connection-test"
  echo ""
  echo "  # Run a quick health check"
  echo "  ./database-cli.sh db-health-check"
}

# Command handlers
# Helper function to check for simple flag
run_simple_if_needed() {
  local command_name=$1
  local simple_script=$2
  shift 2  # Remove first two parameters
  
  for arg in "$@"; do
    if [ "$arg" = "--simple" ]; then
      echo "🔍 Running simplified $command_name command..."
      cd "$PROJECT_ROOT" && ts-node "$SCRIPT_DIR/commands/$simple_script"
      return 0  # Success, command executed
    fi
  done
  
  return 1  # Flag not found, continue with normal execution
}

table_records() {
  # First try running simplified version
  if run_simple_if_needed "table-records" "simple-table-records.ts" "$@"; then
    return
  fi

  # Check for --exec flag to bypass tracker completely 
  for arg in "$@"; do
    if [ "$arg" = "--exec" ]; then
      echo "🔄 Executing table-records command directly using execSync..."
      # Run directly
      cd "$PROJECT_ROOT" && node -e "
        const { execSync } = require('child_process');
        try {
          // Filter out the --exec flag from the args
          const args = process.argv.slice(1).filter(arg => arg !== '--exec').join(' ');
          const command = 'ts-node $SCRIPT_DIR/commands/table-records.ts ' + args;
          
          console.log('Executing: ' + command);
          // Use execSync to run synchronously with all output directly to parent process
          const output = execSync(command, { 
            encoding: 'utf8',
            stdio: 'inherit'
          });
        } catch (error) {
          console.error('Error executing command:', error.message);
          process.exit(1);
        }
      " -- "$@"
      return
    fi
  done
  
  # Normal case using command tracker
  track_command "table-records" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/table-records.ts $@"
}

empty_tables() {
  if run_simple_if_needed "empty-tables" "simple-empty-tables.ts" "$@"; then
    return
  fi
  
  # Normal case using command tracker
  track_command "empty-tables" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/empty-tables.ts $@"
}

database_functions() {
  if run_simple_if_needed "database-functions" "simple-database-functions.ts" "$@"; then
    return
  fi
  
  # Normal case using command tracker
  track_command "database-functions" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/database-functions.ts $@"
}

# Helper function was moved up earlier in the file

table_structure() {
  if run_simple_if_needed "table-structure" "simple-table-structure.ts" "$@"; then
    return
  fi
  
  track_command "table-structure" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/table-structure.ts $@"
}

schema_health() {
  if run_simple_if_needed "schema-health" "simple-schema-health.ts" "$@"; then
    return
  fi
  
  track_command "schema-health" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/schema-health.ts $@"
}

connection_test() {
  if run_simple_if_needed "connection-test" "simple-connection-test.ts" "$@"; then
    return
  fi
  
  track_command "connection-test" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/connection-test.ts $@"
}

db_health_check() {
  if run_simple_if_needed "db-health-check" "simple-db-health-check.ts" "$@"; then
    return
  fi
  
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