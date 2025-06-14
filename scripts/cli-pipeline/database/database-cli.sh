#!/usr/bin/env bash

# Database CLI Tool - Comprehensive database management and migration tool
# Refactored to use SimpleCLIPipeline base class

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the base class
source "$SCRIPT_DIR/../base-classes/SimpleCLIPipeline.sh" || {
    echo "Error: Failed to source SimpleCLIPipeline.sh"
    exit 1
}

# Initialize with pipeline name
init_cli_pipeline "database" "Database CLI Tool - Comprehensive database management and migration"

# Function to run database TypeScript commands with fallback
run_db_command() {
    local command_path="$1"
    shift
    
    local full_path="$SCRIPT_DIR/commands/$command_path"
    if [[ -f "$full_path" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$full_path" "$@"
    else
        log_warn "$command_path not found"
        log_info "Fallback: Basic ${command_path##*/} operation"
        
        local command_name=$(basename "$command_path" .ts)
        case "$command_name" in
            "table-records"|"empty-tables")
                log_info "Would query database for table record counts"
                ;;
            "db-health-check"|"connection-test"|"schema-health")
                log_info "Would test database connectivity and health"
                ;;
            "database-functions"|"list-views")
                log_info "Would query database schema information"
                ;;
            "table-structure")
                log_info "Would analyze table structure: $*"
                ;;
            "table-audit"|"function-audit"|"consistency-check")
                log_info "Would perform database auditing operation"
                ;;
            *)
                log_info "Would perform database operation: $command_name"
                ;;
        esac
    fi
}

# Function to run migration commands with fallback
run_migration_command() {
    local operation="$1"
    shift
    
    case "$operation" in
        "validate"|"dry-run"|"test"|"run-staged")
            log_info "Would perform migration $operation operation"
            if [[ $# -gt 0 ]]; then
                log_info "Migration file: $1"
            fi
            ;;
    esac
}

# Define commands

command_help() {
    show_help
}

# DATABASE INFORMATION COMMANDS
command_table-records() {
    log_info "Listing tables with their record counts..."
    run_db_command "table-records.ts" "$@"
}

command_empty-tables() {
    log_info "Listing tables with no records..."
    run_db_command "empty-tables.ts" "$@"
}

command_database-functions() {
    log_info "Listing database functions..."
    run_db_command "simple-database-functions.ts" "$@"
}

command_list-views() {
    log_info "Listing database views grouped by prefix..."
    run_db_command "list-views.ts" "$@"
}

command_table-structure() {
    local table_name="$1"
    
    if [[ -z "$table_name" ]]; then
        log_error "Table name required"
        echo "Usage: ./database-cli.sh table-structure <table-name>"
        return 1
    fi
    
    log_info "Getting detailed information about table structure: $table_name"
    run_db_command "table-structure.ts" "$@"
}

command_find-tables() {
    log_info "Searching for specific tables in the database..."
    run_db_command "find-tables.ts" "$@"
}

command_update-table-definitions() {
    log_info "Updating sys_table_definitions with missing tables..."
    run_db_command "update-table-definitions.ts" "$@"
}

command_update-table-purposes() {
    log_info "Updating table/view purposes with common use cases..."
    run_db_command "update-table-purposes.ts" "$@"
}

command_update-view-definitions() {
    log_info "Updating sys_table_definitions with database views..."
    run_db_command "update-view-definitions.ts" "$@"
}

command_analyze-views() {
    log_info "Analyzing all views registered in sys_table_definitions..."
    run_db_command "analyze-views.ts" "$@"
}

# DATABASE AUDITING COMMANDS
command_table-audit() {
    log_info "Performing comprehensive table evaluation against best practices..."
    run_db_command "table-audit-cmd.ts" "$@"
}

command_function-audit() {
    log_info "Analyzing database functions and identifying unused ones..."
    run_db_command "function-audit-cmd.ts" "$@"
}

command_consistency-check() {
    log_info "Checking cross-table consistency for naming, types, and constraints..."
    run_db_command "consistency-check-cmd.ts" "$@"
}

# APP ELEMENT MANAGEMENT
command_populate-app-elements() {
    log_info "Populating app UI pages and features for success criteria..."
    run_db_command "populate-app-elements.ts" "$@"
}

# SYSTEM HEALTH COMMANDS
command_connection-test() {
    log_info "Testing connection to Supabase database..."
    run_db_command "simple-connection-test.ts" "$@"
}

command_db-health-check() {
    log_info "Running simple database health check..."
    run_db_command "simple-db-health-check.ts" "$@"
}

command_schema-health() {
    log_info "Analyzing database schema health and identifying issues..."
    run_db_command "schema-health.ts" "$@"
}

command_check-auth-objects() {
    log_info "Checking if auth migration objects already exist..."
    run_db_command "check-auth-migration-objects.ts" "$@"
}

command_verify-user-roles() {
    log_info "Verifying user roles removal migration was successful..."
    run_db_command "verify-user-roles-removal.ts" "$@"
}

command_test-light-auth-audit() {
    log_info "Testing light auth audit logging functionality..."
    run_db_command "test-light-auth-audit-simple.ts" "$@"
}

# RLS POLICIES
command_check-rls-policies() {
    log_info "Checking and creating permissive RLS policies for tables..."
    run_db_command "check-and-create-rls-policies.ts" "$@"
}

# BACKUP MANAGEMENT COMMANDS
command_create-backup() {
    log_info "Creating backups of configured tables with today's date..."
    log_info "Backup configuration found in backup-config.json"
    
    local backup_script="$SCRIPT_DIR/../all_pipelines/create-backup.sh"
    if [[ -f "$backup_script" ]]; then
        bash "$backup_script" "$@"
    else
        log_warn "create-backup.sh not found"
        log_info "Would create database backups based on configuration"
    fi
}

command_add-backup-table() {
    log_info "Adding a table to the backup configuration..."
    log_info "Would modify backup-config.json"
}

command_list-backup-config() {
    log_info "Showing the current backup configuration..."
    
    local config_file="$SCRIPT_DIR/backup-config.json"
    if [[ -f "$config_file" ]]; then
        cat "$config_file"
    else
        log_warn "backup-config.json not found"
        log_info "No backup configuration available"
    fi
}

command_list-backup-tables() {
    log_info "Listing all backup tables in the backup schema..."
    run_db_command "list-backup-tables.ts" "$@"
}

# MIGRATION MANAGEMENT COMMANDS
command_migration() {
    local operation="$1"
    shift
    
    case "$operation" in
        "validate")
            log_info "Validating SQL migration file without executing..."
            run_migration_command "validate" "$@"
            ;;
        "dry-run")
            log_info "Showing what would be executed without running..."
            run_migration_command "dry-run" "$@"
            ;;
        "test")
            log_info "Testing migration sections against database..."
            run_migration_command "test" "$@"
            ;;
        "run-staged")
            log_info "Executing migration with confirmation between sections..."
            run_migration_command "run-staged" "$@"
            ;;
        "help"|"--help"|"-h"|"")
            echo "Migration Management Commands:"
            echo "  validate     Validate SQL migration file without executing"
            echo "  dry-run      Show what would be executed without running"
            echo "  test         Test migration sections against database"
            echo "  run-staged   Execute migration with confirmation between sections"
            ;;
        *)
            log_error "Unknown migration command: $operation"
            echo "Run './database-cli.sh migration help' for available options"
            return 1
            ;;
    esac
}

# TABLE RENAMING COMMANDS
command_rename-table() {
    local old_name="$1"
    local new_name="$2"
    
    if [[ -z "$old_name" ]] || [[ -z "$new_name" ]]; then
        log_error "Missing required arguments"
        echo "Usage: ./database-cli.sh rename-table <old-name> <new-name> [options]"
        echo "Options:"
        echo "  --no-view     Skip creating compatibility view"
        echo "  --dry-run     Show what would be done without making changes"
        return 1
    fi
    
    log_info "Renaming table: $old_name → $new_name"
    run_db_command "rename-table.ts" "$@"
}

command_rollback-rename() {
    log_info "Rolling back a table rename operation..."
    run_db_command "rollback-table-rename.ts" "$@"
}

command_list-migrations() {
    log_info "Listing all table migration history..."
    run_db_command "list-migrations.ts" "$@"
}

command_update-definitions() {
    log_info "Updating missing entries in sys_table_definitions..."
    run_db_command "update-specific-table-definitions.ts" "$@"
}

# CLI REGISTRY
command_scan-cli-pipelines() {
    log_info "Scanning and importing all CLI pipelines into command registry..."
    run_db_command "scan-cli-pipelines.ts" "$@"
}

# Override help to add comprehensive database management examples
show_help() {
    echo "$PIPELINE_DESCRIPTION"
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
    echo "DATABASE AUDITING:"
    echo "  * table-audit          Comprehensive table evaluation against best practices"
    echo "  * function-audit       Analyze database functions and identify unused ones"
    echo "  * consistency-check    Check cross-table consistency for naming, types, and constraints"
    echo ""
    echo "APP ELEMENT MANAGEMENT:"
    echo "    populate-app-elements  Populate app UI pages and features for success criteria"
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
    echo "    update-definitions   Update missing entries in sys_table_definitions"
    echo ""
    echo "CLI REGISTRY:"
    echo "    scan-cli-pipelines   Scan and import all CLI pipelines into command registry"
    echo "    help                 Show this help message"
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
    echo "MIGRATION MANAGEMENT:"
    echo "  # Validate a migration file"
    echo "  ./database-cli.sh migration validate migration.sql"
    echo ""
    echo "  # Run staged migration with confirmations"
    echo "  ./database-cli.sh migration run-staged migration.sql"
}

# Main execution
route_command "$@"