#!/usr/bin/env bash

# MIME Types CLI - Simplified refactored version
# Uses minimal base class pattern for better compatibility

# Script setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="mime_types"
PIPELINE_DESCRIPTION="MIME type synchronization and management"
PIPELINE_VERSION="1.0.0"

# Load environment variables
ENV_FILE="$PROJECT_ROOT/.env.development"
if [[ -f "$ENV_FILE" ]]; then
    export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY" "$ENV_FILE" | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
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

# Command tracking function (simplified)
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

Usage: $(basename "$0") <command> [options]

Commands:
  sync                  Synchronize the mime_types table with MIME types from sources_google
  health-check          Run health check for MIME types pipeline
  help                  Show this help message

Options for sync:
  --dry-run             Show what would be done without making changes
  -v, --verbose         Show detailed information about each MIME type

Examples:
  $(basename "$0") sync                  # Synchronize the mime_types table
  $(basename "$0") sync --dry-run        # Show what would be synchronized
  $(basename "$0") sync -v               # Synchronize with verbose output

EOF
}

# Sync command
cmd_sync() {
    log_info "Starting MIME types synchronization..."
    
    # Validate environment
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        return 1
    fi
    
    # Build sync command
    local sync_args=""
    for arg in "$@"; do
        case "$arg" in
            --dry-run|--verbose|-v)
                sync_args="$sync_args $arg"
                ;;
            *)
                log_error "Unknown option: $arg"
                show_help
                return 1
                ;;
        esac
    done
    
    # Execute sync
    track_command "sync" "cd '$PROJECT_ROOT' && npx ts-node '$SCRIPT_DIR/cli.ts' sync $sync_args"
    
    if [[ $? -eq 0 ]]; then
        log_success "MIME types synchronization completed"
    else
        log_error "MIME types synchronization failed"
        return 1
    fi
}

# Health check command  
cmd_health_check() {
    log_info "Running health check for MIME types pipeline..."
    
    # Check environment
    if ! validate_params "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY"; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Check TypeScript file
    if [[ ! -f "$SCRIPT_DIR/cli.ts" ]]; then
        log_error "CLI TypeScript file not found"
        return 1
    fi
    
    # Check if we have a health check script
    if [[ -f "$SCRIPT_DIR/health-check.sh" ]]; then
        track_command "health-check" "$SCRIPT_DIR/health-check.sh"
    else
        log_success "MIME types pipeline is healthy"
        log_info "Environment variables: OK"
        log_info "TypeScript files: OK"
    fi
}

# Main handler
main() {
    local command="$1"
    shift
    
    case "$command" in
        sync)
            cmd_sync "$@"
            ;;
        health-check)
            cmd_health_check "$@"
            ;;
        help|--help|-h|"")
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