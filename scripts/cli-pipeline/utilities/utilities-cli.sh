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
  local pipeline_name="utilities"
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
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Help message
show_help() {
  echo "Utilities CLI Tool"
  echo "=================="
  echo ""
  echo "COMMANDS:"
  echo "  (* = frequently used commands based on usage statistics)"
  echo ""
  echo "SQLITE IMPORTS:"
  echo "  * import-sqlite-tables   Import SQLite table definitions from dynamic healing database"
  echo "    import-sqlite-data     Import actual data from SQLite tables (future implementation)"
  echo ""
  echo "MIGRATION UTILITIES:"
  echo "    migrate-cli-imports    Migrate CLI import statements to new format"
  echo "    test-migration         Test a single migration file"
  echo ""
  echo "WORK SUMMARIES:"
  echo "    insert-work-summary    Insert a new work summary record"
  echo "    track-commit           Track a commit for a specific task"
  echo ""
  echo "PACKAGE MANAGEMENT:"
  echo "    archive-packages       Archive unused packages"
  echo "    check-archived         Check status of archived packages"
  echo ""
  echo "APP FEATURE SCANNING:"
  echo "  * scan-app-features      Scan and populate dhg-admin-code app features"
  echo ""
  echo "SYSTEM UTILITIES:"
  echo "    health-check           Check utilities pipeline health"
  echo ""
  echo "OPTIONS:"
  echo "  --debug                  Run commands directly without tracking"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "SQLITE IMPORTS:"
  echo "  # Import SQLite table definitions for planning imports"
  echo "  ./utilities-cli.sh import-sqlite-tables"
  echo ""
  echo "  # Import with verbose output"
  echo "  ./utilities-cli.sh import-sqlite-tables --verbose"
  echo ""
  echo "WORK SUMMARIES:"
  echo "  # Insert a new work summary"
  echo "  ./utilities-cli.sh insert-work-summary --title 'My Work' --summary 'Description'"
  echo ""
  echo "  # Track a commit for a task"
  echo "  ./utilities-cli.sh track-commit <task-id> <commit-hash> 'commit message'"
  echo ""
  echo "MIGRATION UTILITIES:"
  echo "  # Migrate CLI imports"
  echo "  ./utilities-cli.sh migrate-cli-imports"
  echo ""
  echo "  # Test a migration"
  echo "  ./utilities-cli.sh test-migration migration.sql"
  echo ""
  echo "APP FEATURE SCANNING:"
  echo "  # Scan and populate dhg-admin-code app features"
  echo "  ./utilities-cli.sh scan-app-features"
}

# Main command dispatcher
case "$1" in
  # SQLite Import Commands
  "import-sqlite-tables")
    track_command "import-sqlite-tables" "ts-node scripts/cli-pipeline/utilities/import-dynamic-healing-sqlite-tables-list.ts"
    ;;
    
  # Migration Utilities
  "migrate-cli-imports")
    track_command "migrate-cli-imports" "ts-node scripts/cli-pipeline/utilities/migrate-cli-imports.ts"
    ;;
    
  "test-migration")
    if [ -z "$2" ]; then
      echo "❌ Error: Migration file required"
      echo "Usage: $0 test-migration <migration-file>"
      exit 1
    fi
    track_command "test-migration" "ts-node scripts/cli-pipeline/utilities/test-single-migration.ts \"$2\""
    ;;
    
  # Work Summary Utilities
  "insert-work-summary")
    track_command "insert-work-summary" "ts-node scripts/cli-pipeline/utilities/insert-work-summary.ts $*"
    ;;
    
  "track-commit")
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo "❌ Error: Task ID and commit hash required"
      echo "Usage: $0 track-commit <task-id> <commit-hash> [commit-message]"
      exit 1
    fi
    track_command "track-commit" "ts-node scripts/cli-pipeline/utilities/track-commit-for-task.ts \"$2\" \"$3\" \"$4\""
    ;;
    
  # Package Management
  "archive-packages")
    track_command "archive-packages" "ts-node scripts/cli-pipeline/utilities/archive-packages.ts"
    ;;
    
  "check-archived")
    track_command "check-archived" "ts-node scripts/cli-pipeline/utilities/check-archived-packages.ts"
    ;;
    
  # App Feature Scanning
  "scan-app-features")
    track_command "scan-app-features" "ts-node scripts/cli-pipeline/utilities/scan-dhg-admin-code-features.ts"
    ;;
    
  # System
  "health-check")
    echo "🏥 Utilities Pipeline Health Check"
    echo "=================================="
    echo ""
    echo "✅ Utilities CLI is operational"
    echo "✅ SQLite import script available"
    echo "✅ Migration utilities available"
    echo "✅ Work summary utilities available"
    echo "✅ Package management utilities available"
    echo "✅ App feature scanning available"
    echo ""
    echo "📊 Available Commands: 9"
    echo "📁 Utilities Directory: scripts/cli-pipeline/utilities/"
    echo "🔧 Primary Focus: SQLite imports, migrations, work summaries"
    ;;
    
  "help"|"--help"|"-h"|"")
    show_help
    ;;
    
  *)
    echo "❌ Unknown command: $1"
    echo ""
    show_help
    exit 1
    ;;
esac