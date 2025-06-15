#!/usr/bin/env bash

# Document Pipeline Service CLI - Refactored with simplified base pattern
# Manages document pipelines and document types

# Script setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_FILE="$SCRIPT_DIR/cli.ts"

# Pipeline metadata
PIPELINE_NAME="document_pipeline"
PIPELINE_DESCRIPTION="Document pipeline and document type management"
PIPELINE_VERSION="1.0.0"

# Log directory setup
LOG_DIR="$PROJECT_ROOT/document-analysis-results"
mkdir -p "$LOG_DIR"

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

# Load environment variables
load_env() {
    local env_loaded=false
    
    if [[ -f "$PROJECT_ROOT/.env.development" ]]; then
        log_info "Loading environment variables from .env.development..."
        set -a
        source "$PROJECT_ROOT/.env.development"
        set +a
        env_loaded=true
    fi
    
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        log_info "Loading environment variables from .env.local..."
        set -a
        source "$PROJECT_ROOT/.env.local"
        set +a
        env_loaded=true
    fi
    
    # Handle Claude API key variants
    if [[ -z "$CLAUDE_API_KEY" && -n "$ANTHROPIC_API_KEY" ]]; then
        log_info "Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY"
        export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
    fi
    
    if [[ "$env_loaded" == "false" ]]; then
        log_warn "No environment files found"
    fi
}

# Command tracking function
track_command() {
    local command_name="$1"
    shift
    local full_command="$@"
    
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

# Execute command with logging
execute_with_logging() {
    local command_name="$1"
    shift
    local full_command="$@"
    
    local log_file="$LOG_DIR/document-pipeline-$(date +%Y-%m-%d_%H-%M-%S).log"
    
    track_command "$command_name" "$full_command"
    
    # Execute and capture both stdout and stderr
    if eval "$full_command" 2>&1 | tee -a "$log_file"; then
        log_success "Command completed successfully. Log: $log_file"
        return 0
    else
        log_error "Command failed. Check log: $log_file"
        return 1
    fi
}

# Show help
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

Usage: $(basename "$0") COMMAND [OPTIONS]

Commands:
  test-connection      Test connection to Supabase
  sync                 Synchronize database with files on disk
  find-new             Find and insert new files on disk into the database
  show-untyped         Show all documentation files without a document type
    --limit N          Limit number of results (default: all)
  show-recent          Show the most recent files based on update date
    --limit N          Limit number of results (default: 10)
  classify-recent      Classify the most recent files
    --count N          Number of files to classify (default: 5)
  classify-untyped     Classify untyped files
    --count N          Number of files to classify (default: 5)
  all                  Run the complete pipeline (sync, find-new, classify-recent)
  test-classify-document-types   Test document classification with Claude
  test-google-doc-classification Test classifying Google Drive files with Claude
  health-check         Check the health of the document pipeline service
    --skip-database    Skip database connection check
    --skip-files       Skip file system check
    --skip-claude      Skip Claude service check
    --verbose, -v      Show verbose output
  help                 Show this help information

Examples:
  $(basename "$0") all                        # Run the complete document pipeline
  $(basename "$0") health-check               # Check the health of all components
  $(basename "$0") classify-recent --count 5  # Classify the 5 most recent files
  $(basename "$0") show-untyped --limit 20    # Show 20 untyped documents

Logs are saved to: $LOG_DIR

EOF
}

# Command handlers
cmd_test_connection() {
    log_info "Testing Supabase connection..."
    execute_with_logging "test-connection" "npx ts-node --transpile-only '$CLI_FILE' test-connection $*"
}

cmd_sync() {
    log_info "Synchronizing database with files on disk..."
    execute_with_logging "sync" "npx ts-node --transpile-only '$CLI_FILE' sync $*"
}

cmd_find_new() {
    log_info "Finding new files on disk..."
    execute_with_logging "find-new" "npx ts-node --transpile-only '$CLI_FILE' find-new $*"
}

cmd_show_untyped() {
    log_info "Showing untyped documentation files..."
    execute_with_logging "show-untyped" "npx ts-node --transpile-only '$CLI_FILE' show-untyped $*"
}

cmd_show_recent() {
    log_info "Showing recent files..."
    execute_with_logging "show-recent" "npx ts-node --transpile-only '$CLI_FILE' show-recent $*"
}

cmd_classify_recent() {
    log_info "Classifying recent files..."
    execute_with_logging "classify-recent" "npx ts-node --transpile-only '$CLI_FILE' classify-recent $*"
}

cmd_classify_untyped() {
    log_info "Classifying untyped files..."
    execute_with_logging "classify-untyped" "npx ts-node --transpile-only '$CLI_FILE' classify-untyped $*"
}

cmd_all() {
    log_info "Running complete document pipeline..."
    execute_with_logging "all" "npx ts-node --transpile-only '$CLI_FILE' all $*"
}

cmd_test_classify_document_types() {
    log_info "Testing document classification with Claude..."
    execute_with_logging "test-classify-document-types" "npx ts-node --transpile-only '$CLI_FILE' test-classify-document-types $*"
}

cmd_test_google_doc_classification() {
    log_info "Testing Google Drive file classification..."
    execute_with_logging "test-google-doc-classification" "npx ts-node --transpile-only '$CLI_FILE' test-google-doc-classification $*"
}

cmd_health_check() {
    log_info "Running health check for document pipeline service..."
    
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Parse options
    local skip_database=false
    local skip_files=false
    local skip_claude=false
    local verbose=false
    
    for arg in "$@"; do
        case "$arg" in
            --skip-database) skip_database=true ;;
            --skip-files) skip_files=true ;;
            --skip-claude) skip_claude=true ;;
            --verbose|-v) verbose=true ;;
        esac
    done
    
    # Check TypeScript CLI file
    if [[ -f "$CLI_FILE" ]]; then
        log_success "CLI TypeScript file found"
    else
        log_error "CLI TypeScript file not found: $CLI_FILE"
        return 1
    fi
    
    # Check log directory
    if [[ -w "$LOG_DIR" ]]; then
        log_success "Log directory is writable: $LOG_DIR"
    else
        log_warn "Log directory not writable: $LOG_DIR"
    fi
    
    # Run full health check via TypeScript
    execute_with_logging "health-check" "npx ts-node --transpile-only '$CLI_FILE' health-check $*"
}

# Main handler
main() {
    # Load environment first
    load_env
    
    # Check for required environment variables
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        log_error "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
        exit 1
    fi
    
    cd "$PROJECT_ROOT" || exit 1
    
    local command="${1:-help}"
    shift
    
    case "$command" in
        test-connection)
            cmd_test_connection "$@"
            ;;
        sync)
            cmd_sync "$@"
            ;;
        find-new)
            cmd_find_new "$@"
            ;;
        show-untyped)
            cmd_show_untyped "$@"
            ;;
        show-recent)
            cmd_show_recent "$@"
            ;;
        classify-recent)
            cmd_classify_recent "$@"
            ;;
        classify-untyped)
            cmd_classify_untyped "$@"
            ;;
        all)
            cmd_all "$@"
            ;;
        test-classify-document-types)
            cmd_test_classify_document_types "$@"
            ;;
        test-google-doc-classification)
            cmd_test_google_doc_classification "$@"
            ;;
        health-check)
            cmd_health_check "$@"
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