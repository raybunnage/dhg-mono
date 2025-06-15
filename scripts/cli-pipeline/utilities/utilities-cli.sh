#!/usr/bin/env bash

# Utilities CLI Pipeline - Refactored Version
# Various utility commands for the monorepo using SimpleCLIPipeline base class

# Source base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BASE_CLASSES_DIR="$PROJECT_ROOT/scripts/cli-pipeline/base-classes"

# Source the base class
if [[ -f "$BASE_CLASSES_DIR/SimpleCLIPipeline.sh" ]]; then
    source "$BASE_CLASSES_DIR/SimpleCLIPipeline.sh"
else
    echo "Error: Cannot find SimpleCLIPipeline.sh at $BASE_CLASSES_DIR"
    exit 1
fi

# Pipeline configuration
PIPELINE_NAME="utilities"
PIPELINE_DESCRIPTION="Various utility commands for the monorepo"
PIPELINE_VERSION="2.0.0"

# Initialize the pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Command implementations

# SQLite Import Commands
command_import-sqlite-tables() {
    log_info "Importing SQLite table definitions from dynamic healing database"
    
    track_and_execute "import-sqlite-tables" "Import SQLite table definitions" \
        ts-node "$SCRIPT_DIR/import-dynamic-healing-sqlite-tables-list.ts" "$@"
}

command_import-sqlite-data() {
    log_warn "Import SQLite data functionality not yet implemented"
    log_info "This will import actual data from SQLite tables in the future"
    return 1
}

# Migration Utilities
command_migrate-cli-imports() {
    log_info "Migrating CLI import statements to new format"
    
    track_and_execute "migrate-cli-imports" "Migrate CLI imports to new format" \
        ts-node "$SCRIPT_DIR/migrate-cli-imports.ts"
}

command_test-migration() {
    local migration_file="${1:-}"
    
    if [[ -z "$migration_file" ]]; then
        log_error "Migration file required"
        log_info "Usage: $SCRIPT_NAME test-migration <migration-file>"
        return 1
    fi
    
    log_info "Testing migration: $migration_file"
    
    track_and_execute "test-migration" "Test single migration file" \
        ts-node "$SCRIPT_DIR/test-single-migration.ts" "$migration_file"
}

# Work Summary Utilities
command_insert-work-summary() {
    log_info "Inserting new work summary record"
    
    # Pass all arguments to the TypeScript command
    track_and_execute "insert-work-summary" "Insert work summary record" \
        ts-node "$SCRIPT_DIR/insert-work-summary.ts" "$@"
}

command_track-commit() {
    local task_id="${1:-}"
    local commit_hash="${2:-}"
    local commit_msg="${3:-}"
    
    if [[ -z "$task_id" ]] || [[ -z "$commit_hash" ]]; then
        log_error "Task ID and commit hash required"
        log_info "Usage: $SCRIPT_NAME track-commit <task-id> <commit-hash> [commit-message]"
        return 1
    fi
    
    log_info "Tracking commit $commit_hash for task $task_id"
    
    track_and_execute "track-commit" "Track commit for task" \
        ts-node "$SCRIPT_DIR/track-commit-for-task.ts" "$task_id" "$commit_hash" "$commit_msg"
}

command_standardize-categories() {
    log_info "Standardizing work summary categories"
    
    track_and_execute "standardize-categories" "Clean up duplicate work summary categories" \
        ts-node "$SCRIPT_DIR/standardize-work-summary-categories.ts"
}

# Package Management
command_archive-packages() {
    log_info "Archiving unused packages"
    
    track_and_execute "archive-packages" "Archive unused packages" \
        ts-node "$SCRIPT_DIR/archive-packages.ts"
}

command_check-archived() {
    log_info "Checking status of archived packages"
    
    track_and_execute "check-archived" "Check archived packages status" \
        ts-node "$SCRIPT_DIR/check-archived-packages.ts"
}

# App Feature Scanning
command_scan-app-features() {
    log_info "Scanning and populating dhg-admin-code app features"
    
    track_and_execute "scan-app-features" "Scan dhg-admin-code features" \
        ts-node "$SCRIPT_DIR/scan-dhg-admin-code-features.ts"
}

# Port Registry (new command found in directory)
command_check-ports() {
    log_info "Checking port registry configuration"
    
    if [[ -f "$SCRIPT_DIR/port-registry.ts" ]]; then
        track_and_execute "check-ports" "Check port registry" \
            ts-node "$SCRIPT_DIR/port-registry.ts"
    else
        log_warn "Port registry script not found"
        return 1
    fi
}

# Vite Environment Utilities (new commands)
command_fix-vite-env() {
    local app_name="${1:-}"
    
    if [[ -z "$app_name" ]]; then
        log_error "App name required"
        log_info "Usage: $SCRIPT_NAME fix-vite-env <app-name> [--nuclear]"
        return 1
    fi
    
    log_info "Fixing Vite environment for $app_name"
    
    track_and_execute "fix-vite-env" "Fix Vite environment issues" \
        ts-node "$SCRIPT_DIR/fix-vite-env.ts" "$@"
}

command_diagnose-vite-env() {
    log_info "Diagnosing Vite environment issues"
    
    track_and_execute "diagnose-vite-env" "Diagnose Vite environment" \
        ts-node "$SCRIPT_DIR/diagnose-vite-env.ts" "$@"
}

# Worktree Management
command_sync-worktrees() {
    log_info "Syncing all worktrees with integration/bug-fixes-tweaks"
    log_info "This will update improve-cli-pipelines, improve-google, and improve-suite"
    
    track_and_execute "sync-worktrees" "Sync all worktrees with integration branch" \
        "$SCRIPT_DIR/sync-all-worktrees.sh"
}

# System Health Check
command_health-check() {
    log_info "Running utilities pipeline health check"
    
    # Run base health check
    health_check || return 1
    
    # Additional utilities-specific checks
    local health_status="healthy"
    local issues=()
    local available_commands=0
    local missing_scripts=()
    
    # Check for key utility scripts
    local key_scripts=(
        "import-dynamic-healing-sqlite-tables-list.ts"
        "migrate-cli-imports.ts"
        "insert-work-summary.ts"
        "track-commit-for-task.ts"
        "archive-packages.ts"
        "scan-dhg-admin-code-features.ts"
    )
    
    for script in "${key_scripts[@]}"; do
        if [[ -f "$SCRIPT_DIR/$script" ]]; then
            ((available_commands++))
        else
            missing_scripts+=("$script")
        fi
    done
    
    if [[ ${#missing_scripts[@]} -gt 0 ]]; then
        health_status="degraded"
        issues+=("Missing scripts: ${missing_scripts[*]}")
    fi
    
    # Check for service availability
    if ! check_service_available "FileSystemService"; then
        health_status="degraded"
        issues+=("FileSystemService not available")
    fi
    
    if ! check_service_available "UtilityService"; then
        health_status="degraded"
        issues+=("UtilityService not available")
    fi
    
    log_info "Utilities Pipeline Health Check"
    log_info "=============================="
    echo ""
    echo "Status: $health_status"
    echo "Available Commands: $available_commands"
    echo "Pipeline Directory: $SCRIPT_DIR"
    echo "Primary Focus: SQLite imports, migrations, work summaries"
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        log_warn "Issues found:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
    else
        log_success "All utilities operational"
    fi
}

# Override the base show_help to add utilities-specific information
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

USAGE:
  $SCRIPT_NAME <command> [options]

COMMANDS:
  (* = frequently used commands based on usage statistics)

SQLITE IMPORTS:
  * import-sqlite-tables        Import SQLite table definitions from dynamic healing database
    import-sqlite-data          Import actual data from SQLite tables (future implementation)

MIGRATION UTILITIES:
    migrate-cli-imports         Migrate CLI import statements to new format
    test-migration <file>       Test a single migration file

WORK SUMMARIES:
    insert-work-summary         Insert a new work summary record
    track-commit                Track a commit for a specific task
    standardize-categories      Clean up duplicate work summary categories

PACKAGE MANAGEMENT:
    archive-packages            Archive unused packages
    check-archived              Check status of archived packages

APP FEATURES:
  * scan-app-features           Scan and populate dhg-admin-code app features

VITE UTILITIES:
    fix-vite-env <app>          Fix Vite environment issues for an app
    diagnose-vite-env           Diagnose Vite environment configuration

WORKTREE MANAGEMENT:
  * sync-worktrees              Sync all worktrees with latest integration/bug-fixes-tweaks

SYSTEM:
    check-ports                 Check port registry configuration
    health-check                Check utilities pipeline health
    help                        Show this help message

OPTIONS:
  --debug                       Enable debug output
  --verbose                     Enable verbose output

EXAMPLES:
  # Import SQLite table definitions
  $SCRIPT_NAME import-sqlite-tables
  
  # Insert a new work summary
  $SCRIPT_NAME insert-work-summary --title 'My Work' --summary 'Description'
  
  # Track a commit for a task
  $SCRIPT_NAME track-commit <task-id> <commit-hash> 'commit message'
  
  # Fix Vite environment for an app
  $SCRIPT_NAME fix-vite-env dhg-audio --nuclear
  
  # Scan app features
  $SCRIPT_NAME scan-app-features
  
  # Sync all worktrees with integration branch
  $SCRIPT_NAME sync-worktrees

DEBUG MODE:
  DEBUG=1 $SCRIPT_NAME <command>  # Enable debug output

EOF
}

# Main command routing
case "$1" in
    "")
        log_error "No command specified"
        show_help
        exit 1
        ;;
    "help"|"--help"|"-h")
        show_help
        exit 0
        ;;
    *)
        route_command "$@"
        ;;
esac