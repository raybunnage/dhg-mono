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
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
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
  echo "    list-views           List database views grouped by prefix (0 uses)"
  echo "    table-structure      Get detailed information about a table structure (3 uses)"
  echo "    find-tables          Search for specific tables in the database"
  echo "    update-table-definitions  Update sys_table_definitions with missing tables"
  echo "    update-table-purposes     Update table/view purposes with common use cases"
  echo "    update-view-definitions   Update sys_table_definitions with database views"
  echo "    analyze-views        Analyze all views registered in sys_table_definitions"
  echo ""
  echo "SYSTEM HEALTH:"
  echo "  * connection-test      Test connection to Supabase database (4 uses)"
  echo "  * db-health-check      Simple database health check (quick connection test) (4 uses)"
  echo "  * schema-health        Analyze database schema health and identify issues (2 uses)"
  echo "    check-auth-objects   Check if auth migration objects already exist"
  echo "    verify-user-roles    Verify user roles removal migration was successful"
  echo "    test-light-auth-audit Test light auth audit logging functionality"
  echo ""
  echo "RLS POLICIES:"
  echo "    check-rls-policies   Check and create permissive RLS policies for tables"
  echo ""
  echo "BACKUP MANAGEMENT:"
  echo "    create-backup        Create backups of configured tables with today's date"
  echo "    add-backup-table     Add a table to the backup configuration"
  echo "    list-backup-config   Show the current backup configuration"
  echo "    list-backup-tables   List all backup tables in the backup schema"
  echo ""
  echo "MIGRATION MANAGEMENT:"
  echo "    migration validate   Validate SQL migration file without executing"
  echo "    migration dry-run    Show what would be executed without running"
  echo "    migration test       Test migration sections against database"
  echo "    migration run-staged Execute migration with confirmation between sections"
  echo ""
  echo "TABLE RENAMING:"
  echo "    rename-table         Rename a table with optional compatibility view"
  echo "    rollback-rename      Rollback a table rename operation"
  echo "    list-migrations      List all table migration history"
  echo ""
  echo "CLI REGISTRY:"
  echo "    scan-cli-pipelines   Scan and import all CLI pipelines into command registry"
  echo ""
  echo "OPTIONS:"
  echo "  --debug                Run commands directly without tracking"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "DATABASE INFORMATION:"
  echo "  # List all tables with record counts"
  echo "  ./database-cli.sh table-records"
  echo ""
  echo "  # List only non-empty tables"
  echo "  ./database-cli.sh table-records --non-empty"
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
  echo ""
  echo "BACKUP MANAGEMENT:"
  echo "  # Create backups of all configured tables"
  echo "  ./database-cli.sh create-backup"
  echo ""
  echo "  # Create backup with dry run"
  echo "  ./database-cli.sh create-backup --dry-run"
  echo ""
  echo "  # Add a new table to backup configuration"
  echo "  ./database-cli.sh add-backup-table script_analysis_results"
  echo ""
  echo "  # List current backup configuration"
  echo "  ./database-cli.sh list-backup-config"
  echo ""
  echo "  # List backup config with validation"
  echo "  ./database-cli.sh list-backup-config --validate --show-backups"
  echo ""
  echo "MIGRATION MANAGEMENT:"
  echo "  # Validate migration file"
  echo "  ./database-cli.sh migration validate migration.sql"
  echo ""
  echo "  # Dry run migration"
  echo "  ./database-cli.sh migration dry-run --show-sql migration.sql"
  echo ""
  echo "  # Test migration sections"
  echo "  ./database-cli.sh migration test --section tables migration.sql"
  echo ""
  echo "  # Execute migration with confirmations"
  echo "  ./database-cli.sh migration run-staged migration.sql"
}

# Command handlers
table_records() {
  track_command "table-records" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/table-records.ts $@"
}

empty_tables() {
  track_command "empty-tables" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/empty-tables.ts $@"
}

database_functions() {
  track_command "database-functions" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/database-functions.ts $@"
}

list_views() {
  echo "🔍 Listing database views..."
  track_command "list-views" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/list-views.ts $@"
}

# Helper function was moved up earlier in the file

table_structure() {
  track_command "table-structure" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/table-structure.ts $@"
}

schema_health() {
  track_command "schema-health" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/schema-health.ts $@"
}

connection_test() {
  track_command "connection-test" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/connection-test.ts $@"
}

db_health_check() {
  track_command "db-health-check" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/db-health-check.ts $@"
}

check_auth_objects() {
  echo "🔍 Checking for existing auth migration objects..."
  track_command "check-auth-objects" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/check-auth-migration-objects.ts $@"
}

check_rls_policies() {
  echo "🔒 Checking and creating RLS policies..."
  track_command "check-rls-policies" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/check-and-create-rls-policies.ts $@"
}

list_backup_tables() {
  echo "📋 Listing backup tables..."
  track_command "list-backup-tables" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/backup/list-backup-tables-simple.ts $@"
}

verify_user_roles() {
  echo "🔍 Verifying user roles removal migration..."
  track_command "verify-user-roles" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/verify-user-roles-removal.ts $@"
}

find_tables() {
  echo "🔍 Searching for tables in the database..."
  track_command "find-tables" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/find-missing-tables.ts $@"
}

test_light_auth_audit() {
  echo "🧪 Testing light auth audit logging..."
  track_command "test-light-auth-audit" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/test-light-auth-audit-logging.ts $@"
}

test_auth_audit_simple() {
  echo "🧪 Testing auth audit log functionality..."
  track_command "test-auth-audit-simple" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/test-light-auth-audit-simple.ts $@"
}

# Backup command handlers
create_backup() {
  echo "🔄 Creating database backups..."
  track_command "create-backup" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/backup/create-backup.ts $@"
}

add_backup_table() {
  echo "📝 Adding table to backup configuration..."
  track_command "add-backup-table" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/backup/add-backup-table.ts $@"
}

list_backup_config() {
  echo "📋 Listing backup configuration..."
  track_command "list-backup-config" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/backup/list-backup-config.ts $@"
}

# Migration command handlers
migration_validate() {
  echo "🔍 Validating migration file..."
  track_command "migration-validate" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/migration/validate.ts $@"
}

migration_dry_run() {
  echo "🏃‍♂️ Performing migration dry run..."
  track_command "migration-dry-run" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/migration/dry-run.ts $@"
}

migration_test() {
  echo "🧪 Testing migration sections..."
  track_command "migration-test" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/migration/test-sections.ts $@"
}

migration_run_staged() {
  echo "🚀 Running staged migration..."
  track_command "migration-run-staged" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/commands/migration/run-staged.ts $@"
}

migration_help() {
  echo "Migration Management Commands"
  echo "============================"
  echo ""
  echo "COMMANDS:"
  echo "  validate     Validate SQL migration file without executing"
  echo "  dry-run      Show what would be executed without running"
  echo "  test         Test migration sections against database"
  echo "  run-staged   Execute migration with confirmation between sections"
  echo ""
  echo "EXAMPLES:"
  echo ""
  echo "VALIDATION:"
  echo "  # Validate migration file"
  echo "  ./database-cli.sh migration validate migration.sql"
  echo ""
  echo "  # Validate with warnings"
  echo "  ./database-cli.sh migration validate --warnings migration.sql"
  echo ""
  echo "  # Validate specific section type"
  echo "  ./database-cli.sh migration validate --section tables migration.sql"
  echo ""
  echo "DRY RUN:"
  echo "  # Show execution plan"
  echo "  ./database-cli.sh migration dry-run migration.sql"
  echo ""
  echo "  # Show with SQL code"
  echo "  ./database-cli.sh migration dry-run --show-sql migration.sql"
  echo ""
  echo "  # Export to JSON"
  echo "  ./database-cli.sh migration dry-run --output plan.json migration.sql"
  echo ""
  echo "TESTING:"
  echo "  # Test all sections"
  echo "  ./database-cli.sh migration test migration.sql"
  echo ""
  echo "  # Test only tables"
  echo "  ./database-cli.sh migration test --section tables migration.sql"
  echo ""
  echo "  # Dry run test"
  echo "  ./database-cli.sh migration test --dry-run migration.sql"
  echo ""
  echo "EXECUTION:"
  echo "  # Interactive staged execution"
  echo "  ./database-cli.sh migration run-staged migration.sql"
  echo ""
  echo "  # Auto-confirm all sections"
  echo "  ./database-cli.sh migration run-staged --auto-confirm migration.sql"
  echo ""
  echo "  # Continue on errors with logging"
  echo "  ./database-cli.sh migration run-staged --continue-on-error --log migration.log migration.sql"
  echo ""
  echo "TABLE RENAMING:"
  echo "  # Rename a table with compatibility view"
  echo "  ./database-cli.sh rename-table old_table_name new_table_name"
  echo ""
  echo "  # Rename without creating a compatibility view"
  echo "  ./database-cli.sh rename-table old_table_name new_table_name --no-view"
  echo ""
  echo "  # Dry run to see what would happen"
  echo "  ./database-cli.sh rename-table old_table_name new_table_name --dry-run"
  echo ""
  echo "  # List all table migrations"
  echo "  ./database-cli.sh list-migrations"
  echo ""
  echo "  # Rollback a table rename"
  echo "  ./database-cli.sh rollback-rename new_table_name"
  echo ""
  echo "  # Force rollback without confirmation"
  echo "  ./database-cli.sh rollback-rename new_table_name --force"
  echo ""
  echo "SECTION TYPES:"
  echo "  extensions, tables, indexes, functions, triggers, rls, grants, views, custom"
  echo ""
  echo "MIGRATION FILE FORMAT:"
  echo "  Migration files should use section-based structure:"
  echo ""
  echo "  -- MIGRATION: migration_name"
  echo "  -- VERSION: 20250522000000"
  echo "  -- DESCRIPTION: Description of changes"
  echo ""
  echo "  -- SECTION: extensions"
  echo "  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
  echo ""
  echo "  -- SECTION: tables"
  echo "  CREATE TABLE IF NOT EXISTS ..."
  echo ""
  echo "  See existing migration files for examples."
}

# Check if no arguments provided
if [ $# -eq 0 ] || [ -z "$1" ]; then
  show_help
  exit 0
fi

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
  "list-views")
    list_views "${@:2}"
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
  "check-auth-objects")
    check_auth_objects "${@:2}"
    ;;
  "check-rls-policies")
    check_rls_policies "${@:2}"
    ;;
  "verify-user-roles")
    verify_user_roles "${@:2}"
    ;;
  "list-backup-tables")
    list_backup_tables "${@:2}"
    ;;
  "find-tables")
    find_tables "${@:2}"
    ;;
  "test-light-auth-audit")
    test_light_auth_audit "${@:2}"
    ;;
  "test-auth-audit-simple")
    test_auth_audit_simple "${@:2}"
    ;;
  "create-backup")
    create_backup "${@:2}"
    ;;
  "add-backup-table")
    add_backup_table "${@:2}"
    ;;
  "list-backup-config")
    list_backup_config "${@:2}"
    ;;
  "migration")
    case "$2" in
      "validate")
        migration_validate "${@:3}"
        ;;
      "dry-run")
        migration_dry_run "${@:3}"
        ;;
      "test")
        migration_test "${@:3}"
        ;;
      "run-staged")
        migration_run_staged "${@:3}"
        ;;
      "help"|"--help"|"-h"|"")
        migration_help
        ;;
      *)
        echo "Unknown migration command: $2"
        echo ""
        migration_help
        exit 1
        ;;
    esac
    ;;
  "rename-table")
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo "Error: Missing required arguments"
      echo "Usage: $0 rename-table <old-name> <new-name> [options]"
      echo "Options:"
      echo "  --no-view     Skip creating compatibility view"
      echo "  --dry-run     Show what would be done without making changes"
      echo "  --notes=TEXT  Add notes to migration record"
      exit 1
    fi
    echo "🔄 Renaming table..."
    track_command "rename-table" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/rename-table.ts ${@:2}"
    ;;
  "rollback-rename")
    if [ -z "$2" ]; then
      echo "Error: Missing required argument"
      echo "Usage: $0 rollback-rename <table-name> [options]"
      echo "Options:"
      echo "  --id=ID       Rollback specific migration by ID"
      echo "  --force       Skip confirmation prompt"
      echo "  --dry-run     Show what would be done without making changes"
      exit 1
    fi
    echo "🔄 Rolling back table rename..."
    track_command "rollback-rename" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/rollback-table-rename.ts ${@:2}"
    ;;
  "list-migrations")
    echo "📋 Listing table migration history..."
    track_command "list-migrations" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/rollback-table-rename.ts list ${@:2}"
    ;;
  "scan-cli-pipelines")
    echo "🔍 Scanning CLI pipelines for command registry..."
    track_command "scan-cli-pipelines" "cd $PROJECT_ROOT && ts-node --project "$PROJECT_ROOT/tsconfig.node.json" $SCRIPT_DIR/scan-cli-pipelines.ts ${@:2}"
    ;;
  "update-table-definitions")
    echo "🔄 Updating sys_table_definitions..."
    track_command "update-table-definitions" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/update-table-definitions.ts ${@:2}"
    ;;
  "update-table-purposes")
    echo "📝 Updating table and view purposes with common use cases..."
    track_command "update-table-purposes" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/update-table-purposes.ts ${@:2}"
    ;;
  "update-view-definitions")
    echo "🔄 Updating view definitions in sys_table_definitions..."
    track_command "update-view-definitions" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/update-view-definitions.ts ${@:2}"
    ;;
  "analyze-views")
    echo "📊 Analyzing views in sys_table_definitions..."
    track_command "analyze-views" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/update-view-definitions.ts analyze ${@:2}"
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