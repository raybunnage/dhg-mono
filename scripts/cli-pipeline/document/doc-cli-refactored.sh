#!/usr/bin/env bash

# Document Pipeline CLI - Refactored with simplified base pattern
# Core document management without complex AI features

# Script setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_FILE="$SCRIPT_DIR/simplified-cli.ts"

# Pipeline metadata
PIPELINE_NAME="document_pipeline"
PIPELINE_DESCRIPTION="Core document management commands"
PIPELINE_VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
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
        export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY|ANTHROPIC_API_KEY" "$PROJECT_ROOT/.env.development" | xargs)
        env_loaded=true
    fi
    
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY|ANTHROPIC_API_KEY" "$PROJECT_ROOT/.env.local" | xargs)
        env_loaded=true
    fi
    
    # Handle Claude API key variants
    if [[ -z "$CLAUDE_API_KEY" && -n "$ANTHROPIC_API_KEY" ]]; then
        export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
    fi
    
    if [[ "$env_loaded" == "true" ]]; then
        log_info "Environment variables loaded"
    else
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
    
    # Execute the command
    eval "$full_command"
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

# Show help
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

Usage: $(basename "$0") COMMAND [OPTIONS]

Commands:
  sync-docs [--full]         Sync filesystem with doc_files table
  find-new [--dir <dir>]     Find and add new markdown files
  classify-doc <path>        Classify a single document
  tag-doc <path> <tags...>   Add tags to a document
  mark-important <path> <1-5> Set importance score (1-5)
  enable-auto-update <path> <source> <frequency>
                             Enable auto-updates for a document
    --disable                Disable auto-updates
  help                       Show this help message

Examples:
  $(basename "$0") sync-docs --full
  $(basename "$0") find-new --dir docs
  $(basename "$0") classify-doc docs/README.md
  $(basename "$0") tag-doc docs/README.md architecture important
  $(basename "$0") mark-important docs/CLAUDE.md 5
  $(basename "$0") enable-auto-update docs/CLI_OVERVIEW.md cli_pipelines '1 day'

EOF
}

# Command: sync-docs
cmd_sync_docs() {
    log_info "Syncing documents with database..."
    
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        return 1
    fi
    
    track_command "sync-docs" "npx ts-node --transpile-only '$CLI_FILE' sync-docs $*"
    local result=$?
    
    if [[ $result -eq 0 ]]; then
        log_success "Document sync completed"
    else
        log_error "Document sync failed"
    fi
    return $result
}

# Command: find-new
cmd_find_new() {
    log_info "Finding new markdown files..."
    
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        return 1
    fi
    
    track_command "find-new" "npx ts-node --transpile-only '$CLI_FILE' find-new $*"
    local result=$?
    
    if [[ $result -eq 0 ]]; then
        log_success "New file search completed"
    else
        log_error "New file search failed"
    fi
    return $result
}

# Command: classify-doc
cmd_classify_doc() {
    if [[ $# -lt 1 ]]; then
        log_error "Missing required argument: <path>"
        echo "Usage: $(basename "$0") classify-doc <path>"
        return 1
    fi
    
    local doc_path="$1"
    log_info "Classifying document: $doc_path"
    
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        return 1
    fi
    
    track_command "classify-doc" "npx ts-node --transpile-only '$CLI_FILE' classify-doc '$doc_path'"
    local result=$?
    
    if [[ $result -eq 0 ]]; then
        log_success "Document classified successfully"
    else
        log_error "Document classification failed"
    fi
    return $result
}

# Command: tag-doc
cmd_tag_doc() {
    if [[ $# -lt 2 ]]; then
        log_error "Missing required arguments"
        echo "Usage: $(basename "$0") tag-doc <path> <tags...>"
        return 1
    fi
    
    local doc_path="$1"
    shift
    local tags="$*"
    
    log_info "Tagging document: $doc_path with tags: $tags"
    
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        return 1
    fi
    
    track_command "tag-doc" "npx ts-node --transpile-only '$CLI_FILE' tag-doc '$doc_path' $tags"
    local result=$?
    
    if [[ $result -eq 0 ]]; then
        log_success "Document tagged successfully"
    else
        log_error "Document tagging failed"
    fi
    return $result
}

# Command: mark-important
cmd_mark_important() {
    if [[ $# -lt 2 ]]; then
        log_error "Missing required arguments"
        echo "Usage: $(basename "$0") mark-important <path> <1-5>"
        return 1
    fi
    
    local doc_path="$1"
    local importance="$2"
    
    # Validate importance score
    if ! [[ "$importance" =~ ^[1-5]$ ]]; then
        log_error "Importance score must be between 1 and 5"
        return 1
    fi
    
    log_info "Setting importance score for $doc_path to $importance"
    
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        return 1
    fi
    
    track_command "mark-important" "npx ts-node --transpile-only '$CLI_FILE' mark-important '$doc_path' '$importance'"
    local result=$?
    
    if [[ $result -eq 0 ]]; then
        log_success "Importance score set successfully"
    else
        log_error "Failed to set importance score"
    fi
    return $result
}

# Command: enable-auto-update
cmd_enable_auto_update() {
    if [[ $# -lt 3 ]]; then
        log_error "Missing required arguments"
        echo "Usage: $(basename "$0") enable-auto-update <path> <source> <frequency>"
        echo "   or: $(basename "$0") enable-auto-update <path> --disable"
        return 1
    fi
    
    local doc_path="$1"
    shift
    
    log_info "Configuring auto-update for $doc_path"
    
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        return 1
    fi
    
    track_command "enable-auto-update" "npx ts-node --transpile-only '$CLI_FILE' enable-auto-update '$doc_path' $*"
    local result=$?
    
    if [[ $result -eq 0 ]]; then
        log_success "Auto-update configuration completed"
    else
        log_error "Auto-update configuration failed"
    fi
    return $result
}

# Main handler
main() {
    # Load environment first
    load_env
    
    # Check for required environment variables
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        log_error "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        exit 1
    fi
    
    local command="${1:-help}"
    shift
    
    case "$command" in
        sync-docs)
            cmd_sync_docs "$@"
            ;;
        find-new)
            cmd_find_new "$@"
            ;;
        classify-doc)
            cmd_classify_doc "$@"
            ;;
        tag-doc)
            cmd_tag_doc "$@"
            ;;
        mark-important)
            cmd_mark_important "$@"
            ;;
        enable-auto-update)
            cmd_enable_auto_update "$@"
            ;;
        help|--help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Execute main
main "$@"