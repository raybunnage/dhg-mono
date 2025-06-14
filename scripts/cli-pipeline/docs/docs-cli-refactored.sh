#!/usr/bin/env bash

# Documentation Management CLI - Refactored with simplified base pattern
# Manages continuously updated documentation with monitoring and review cycles

# Script setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="docs"
PIPELINE_DESCRIPTION="Documentation management with monitoring and review cycles"
PIPELINE_VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  INFO${NC} [$PIPELINE_NAME] $*"
}

log_error() {
    echo -e "${RED}❌ ERROR${NC} [$PIPELINE_NAME] $*" >&2
}

log_success() {
    echo -e "${GREEN}✅ SUCCESS${NC} [$PIPELINE_NAME] $*"
}

log_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC} [$PIPELINE_NAME] $*"
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${PURPLE}🔍 DEBUG${NC} [$PIPELINE_NAME] $*"
    fi
}

# Load environment variables
load_env() {
    local env_loaded=false
    
    if [[ -f "$PROJECT_ROOT/.env.development" ]]; then
        export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$PROJECT_ROOT/.env.development" | xargs)
        env_loaded=true
    fi
    
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$PROJECT_ROOT/.env.local" | xargs)
        env_loaded=true
    fi
    
    if [[ "$env_loaded" == "true" ]]; then
        log_debug "Environment variables loaded"
    else
        log_warn "No environment files found"
    fi
}

# Command tracking function
track_command() {
    local command_name="$1"
    shift
    local full_command="$@"
    
    log_debug "Tracking command: $command_name"
    
    local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    if [[ -f "$TRACKER_TS" ]]; then
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$PIPELINE_NAME" "$command_name" "$full_command" 2>/dev/null || true
    fi
}

# Validate required parameters
validate_params() {
    local missing=()
    for param in "$@"; do
        if [[ -z "${!param}" ]]; then
            missing+=("$param")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required parameters: ${missing[*]}"
        return 1
    fi
    return 0
}

# Execute TypeScript command
execute_ts_command() {
    local command_name="$1"
    local ts_file="$2"
    shift 2
    
    if [[ ! -f "$ts_file" ]]; then
        log_error "Command implementation not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "true"  # Track before execution
    
    cd "$PROJECT_ROOT" || return 1
    exec npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$ts_file" "$@"
}

# Show help
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

USAGE:
  $(basename "$0") <command> [options]

COMMANDS:
  register         Register a new living document for monitoring
  list            List all monitored documents
  check-reviews   Show documents needing review
  daily-check     Run daily review check (for automation)
  update          Update document and reset review timer
  archive         Archive old documentation with relationships
  search          Search archived documents
  format          Update document format to standard template
  bulk-format     Format all continuously-updated docs
  sync-db         Sync continuously-updated files to database
  report          Generate documentation health report
  health-check    Check pipeline health status
  help            Show this help message

OPTIONS:
  -h, --help      Show this help message
  --debug         Enable debug output

EXAMPLES:
  $(basename "$0") register --path docs/continuously-updated/cli-pipelines.md --area cli-pipeline --frequency 14
  $(basename "$0") check-reviews
  $(basename "$0") format --path docs/continuously-updated/apps-documentation.md
  $(basename "$0") bulk-format
  $(basename "$0") report

EOF
}

# Command: register
cmd_register() {
    log_info "Registering new document for monitoring..."
    execute_ts_command "register" "$SCRIPT_DIR/commands/register-document.ts" "$@"
}

# Command: list
cmd_list() {
    log_info "Listing monitored documents..."
    execute_ts_command "list" "$SCRIPT_DIR/commands/list-documents.ts" "$@"
}

# Command: check-reviews
cmd_check_reviews() {
    log_info "Checking for documents needing review..."
    execute_ts_command "check-reviews" "$SCRIPT_DIR/commands/check-reviews.ts" "$@"
}

# Command: daily-check
cmd_daily_check() {
    log_info "Running daily review check..."
    execute_ts_command "daily-check" "$SCRIPT_DIR/commands/daily-review-check.ts" "$@"
}

# Command: update
cmd_update() {
    log_info "Updating document..."
    execute_ts_command "update" "$SCRIPT_DIR/commands/update-document.ts" "$@"
}

# Command: archive
cmd_archive() {
    log_info "Archiving documentation..."
    execute_ts_command "archive" "$SCRIPT_DIR/commands/archive-documents.ts" "$@"
}

# Command: search
cmd_search() {
    log_info "Searching archived documents..."
    execute_ts_command "search" "$SCRIPT_DIR/commands/search-archives.ts" "$@"
}

# Command: format
cmd_format() {
    log_info "Formatting document to standard template..."
    execute_ts_command "format" "$SCRIPT_DIR/commands/format-document.ts" "$@"
}

# Command: bulk-format
cmd_bulk_format() {
    log_info "Bulk formatting continuously-updated documents..."
    execute_ts_command "bulk-format" "$SCRIPT_DIR/commands/bulk-format-documents.ts" "$@"
}

# Command: sync-db
cmd_sync_db() {
    log_info "Syncing documents to database..."
    execute_ts_command "sync-db" "$SCRIPT_DIR/commands/sync-to-database.ts" "$@"
}

# Command: report
cmd_report() {
    log_info "Generating documentation health report..."
    execute_ts_command "report" "$SCRIPT_DIR/commands/generate-report.ts" "$@"
}

# Command: health-check
cmd_health_check() {
    log_info "Running health check for documentation pipeline..."
    
    # Check environment
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Check command files
    local commands=(
        "register-document.ts"
        "list-documents.ts"
        "check-reviews.ts"
        "daily-review-check.ts"
        "update-document.ts"
        "archive-documents.ts"
        "search-archives.ts"
        "format-document.ts"
        "bulk-format-documents.ts"
        "sync-to-database.ts"
        "generate-report.ts"
    )
    
    local missing_commands=0
    for cmd in "${commands[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/commands/$cmd" ]]; then
            log_warn "Missing command file: $cmd"
            ((missing_commands++))
        fi
    done
    
    if [[ $missing_commands -eq 0 ]]; then
        log_success "All command files present"
    else
        log_warn "$missing_commands command files missing"
    fi
    
    log_success "Documentation CLI pipeline is healthy"
    log_info "Available commands: register, list, check-reviews, update, archive, search, format, bulk-format, sync-db, report"
    
    track_command "health-check" "true"
    return 0
}

# Main handler
main() {
    # Check for debug flag
    for arg in "$@"; do
        if [[ "$arg" == "--debug" ]]; then
            export DEBUG=true
            break
        fi
    done
    
    # Load environment
    load_env
    
    # Get command
    local command="${1:-help}"
    shift
    
    # Remove debug flag from args if present
    local args=()
    for arg in "$@"; do
        if [[ "$arg" != "--debug" ]]; then
            args+=("$arg")
        fi
    done
    
    # Route to command handler
    case "$command" in
        register)
            cmd_register "${args[@]}"
            ;;
        list)
            cmd_list "${args[@]}"
            ;;
        check-reviews)
            cmd_check_reviews "${args[@]}"
            ;;
        daily-check)
            cmd_daily_check "${args[@]}"
            ;;
        update)
            cmd_update "${args[@]}"
            ;;
        archive)
            cmd_archive "${args[@]}"
            ;;
        search)
            cmd_search "${args[@]}"
            ;;
        format)
            cmd_format "${args[@]}"
            ;;
        bulk-format)
            cmd_bulk_format "${args[@]}"
            ;;
        sync-db)
            cmd_sync_db "${args[@]}"
            ;;
        report)
            cmd_report "${args[@]}"
            ;;
        health-check)
            cmd_health_check "${args[@]}"
            ;;
        help|--help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Execute main
main "$@"