#!/usr/bin/env bash

# CLIPipelineBase.sh - Foundation class for all CLI pipelines
# This provides the core functionality that every CLI pipeline needs:
# - Environment setup and path resolution
# - Command tracking with fallback
# - Consistent help system
# - Debug mode support
# - Error handling framework
# - Logging utilities
# - Performance timing

# Version and metadata
CLI_BASE_VERSION="1.0.0"
CLI_BASE_AUTHOR="DHG CLI Pipeline Framework"

# Color definitions for consistent output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Global variables (will be set by init_cli_pipeline)
PIPELINE_NAME=""
PIPELINE_DESCRIPTION=""
PIPELINE_VERSION="1.0.0"
SCRIPT_DIR=""
PROJECT_ROOT=""
DEBUG_MODE=false
VERBOSE_MODE=false
ENABLE_TRACKING=true
ENABLE_ERROR_REPORTING=true

# Performance tracking
COMMAND_START_TIME=""
TOTAL_COMMANDS=0
FAILED_COMMANDS=0

# Initialize CLI pipeline with base functionality
init_cli_pipeline() {
    local pipeline_name="$1"
    local pipeline_description="$2"
    shift 2
    
    # Set pipeline metadata
    PIPELINE_NAME="$pipeline_name"
    PIPELINE_DESCRIPTION="$pipeline_description"
    
    # Resolve paths
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
    
    # Parse global flags
    parse_global_flags "$@"
    
    # Setup environment
    setup_environment
    
    # Initialize tracking
    init_command_tracking
    
    log_debug "Initialized $PIPELINE_NAME pipeline"
    log_debug "Script dir: $SCRIPT_DIR"
    log_debug "Project root: $PROJECT_ROOT"
}

# Parse global flags that all pipelines support
parse_global_flags() {
    for arg in "$@"; do
        case "$arg" in
            --debug)
                DEBUG_MODE=true
                ;;
            --verbose)
                VERBOSE_MODE=true
                ;;
            --no-tracking)
                ENABLE_TRACKING=false
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
        esac
    done
}

# Setup environment (load .env files, set paths)
setup_environment() {
    # Change to project root
    cd "$PROJECT_ROOT" || {
        log_error "Failed to change to project root: $PROJECT_ROOT"
        exit 1
    }
    
    # Load environment variables
    local env_file="$PROJECT_ROOT/.env.development"
    if [[ -f "$env_file" ]]; then
        log_debug "Loading environment from $env_file"
        set -a  # Automatically export variables
        source "$env_file" 2>/dev/null || true
        set +a
    else
        log_warn "Environment file not found: $env_file"
    fi
}

# Initialize command tracking system
init_command_tracking() {
    if [[ "$ENABLE_TRACKING" != "true" ]]; then
        log_debug "Command tracking disabled"
        return 0
    fi
    
    # Check for tracking service
    local tracker_ts="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    local tracker_js="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.js"
    
    if [[ -f "$tracker_ts" ]]; then
        log_debug "Found TypeScript command tracker"
        COMMAND_TRACKER="$tracker_ts"
    elif [[ -f "$tracker_js" ]]; then
        log_debug "Found JavaScript command tracker"
        COMMAND_TRACKER="$tracker_js"
    else
        log_warn "No command tracker found - tracking will be logged only"
        ENABLE_TRACKING=false
    fi
}

# Logging functions with consistent format
log_info() {
    echo -e "${BLUE}ℹ️  INFO${NC} [$PIPELINE_NAME] $*"
}

log_success() {
    echo -e "${GREEN}✅ SUCCESS${NC} [$PIPELINE_NAME] $*"
}

log_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC} [$PIPELINE_NAME] $*"
}

log_error() {
    echo -e "${RED}❌ ERROR${NC} [$PIPELINE_NAME] $*" >&2
}

log_debug() {
    if [[ "$DEBUG_MODE" == "true" || "$VERBOSE_MODE" == "true" ]]; then
        echo -e "${PURPLE}🐛 DEBUG${NC} [$PIPELINE_NAME] $*" >&2
    fi
}

log_timing() {
    if [[ "$VERBOSE_MODE" == "true" ]]; then
        echo -e "${CYAN}⏱️  TIMING${NC} [$PIPELINE_NAME] $*"
    fi
}

# Track and execute a command with full monitoring
track_and_execute() {
    local command_name="$1"
    local description="$2"
    shift 2
    
    COMMAND_START_TIME=$(date +%s.%N)
    ((TOTAL_COMMANDS++))
    
    log_info "Executing: $command_name"
    log_debug "Description: $description"
    log_debug "Command: $*"
    
    # Execute based on mode
    local exit_code=0
    if [[ "$DEBUG_MODE" == "true" ]]; then
        log_debug "Debug mode: executing directly without tracking"
        "$@"
        exit_code=$?
    else
        execute_with_tracking "$command_name" "$description" "$@"
        exit_code=$?
    fi
    
    # Calculate timing
    local end_time=$(date +%s.%N)
    local duration
    duration=$(echo "$end_time - $COMMAND_START_TIME" | bc 2>/dev/null || echo "unknown")
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "Command '$command_name' completed in ${duration}s"
    else
        log_error "Command '$command_name' failed with exit code $exit_code after ${duration}s"
        ((FAILED_COMMANDS++))
    fi
    
    return $exit_code
}

# Execute command with tracking service
execute_with_tracking() {
    local command_name="$1"
    local description="$2"
    shift 2
    
    if [[ "$ENABLE_TRACKING" == "true" && -n "$COMMAND_TRACKER" ]]; then
        log_debug "Tracking command via service"
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" \
            "$COMMAND_TRACKER" "$PIPELINE_NAME" "$command_name" "$*"
    else
        log_debug "Executing without tracking service"
        "$@"
    fi
}

# Error handling framework
handle_error() {
    local error_code="${1:-1}"
    local error_message="${2:-Unknown error}"
    local context="${3:-No context}"
    
    log_error "Error in $PIPELINE_NAME: $error_message"
    log_error "Context: $context"
    log_error "Error code: $error_code"
    
    if [[ "$ENABLE_ERROR_REPORTING" == "true" ]]; then
        report_error_to_system "$error_code" "$error_message" "$context"
    fi
    
    # Show summary if we've run multiple commands
    if [[ $TOTAL_COMMANDS -gt 0 ]]; then
        show_execution_summary
    fi
    
    exit "$error_code"
}

# Report error to system (can be overridden by specialized classes)
report_error_to_system() {
    local error_code="$1"
    local error_message="$2"
    local context="$3"
    
    log_debug "Error reporting not implemented for base class"
    # Specialized classes can override this for specific error reporting
}

# Show execution summary
show_execution_summary() {
    echo ""
    log_info "Execution Summary:"
    log_info "  Total commands: $TOTAL_COMMANDS"
    log_info "  Failed commands: $FAILED_COMMANDS"
    log_info "  Success rate: $(( (TOTAL_COMMANDS - FAILED_COMMANDS) * 100 / TOTAL_COMMANDS ))%"
}

# Auto-discover commands in the calling script
discover_commands() {
    local script_file="${BASH_SOURCE[1]}"
    if [[ -f "$script_file" ]]; then
        grep -E "^[[:space:]]*command_[a-zA-Z_][a-zA-Z0-9_]*\(\)" "$script_file" | \
            sed -E 's/^[[:space:]]*command_([a-zA-Z_][a-zA-Z0-9_]*).*/\1/' | \
            sort
    fi
}

# Show standardized help message
show_help() {
    echo -e "${BLUE}$PIPELINE_DESCRIPTION${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    
    # Auto-discover and show commands
    local commands
    commands=$(discover_commands)
    if [[ -n "$commands" ]]; then
        while IFS= read -r cmd; do
            # Try to get description from function comments
            local description="No description available"
            echo "  $(printf "%-20s" "$cmd") $description"
        done <<< "$commands"
    else
        echo "  No commands discovered (implement command_* functions)"
    fi
    
    echo ""
    echo "Global Options:"
    echo "  --debug                Enable debug mode (direct execution, no tracking)"
    echo "  --verbose              Enable verbose output"
    echo "  --no-tracking          Disable command tracking"
    echo "  --help, -h             Show this help message"
    echo ""
    echo "Framework Info:"
    echo "  Pipeline: $PIPELINE_NAME v$PIPELINE_VERSION"
    echo "  Base Class: CLIPipelineBase v$CLI_BASE_VERSION"
    echo "  Script: ${BASH_SOURCE[1]}"
}

# Command routing function (to be called by pipelines)
route_command() {
    local command="$1"
    shift
    
    if [[ -z "$command" ]]; then
        log_error "No command specified"
        show_help
        exit 1
    fi
    
    # Handle help command specially
    if [[ "$command" == "help" ]]; then
        show_help
        return 0
    fi
    
    # Check if command function exists
    local command_function="command_$command"
    if declare -f "$command_function" > /dev/null; then
        log_debug "Routing to command: $command"
        "$command_function" "$@"
    else
        log_error "Unknown command: $command"
        echo ""
        show_help
        exit 1
    fi
}

# Utility function to check if a service exists
check_service_available() {
    local service_name="$1"
    local service_path="$PROJECT_ROOT/packages/shared/services/$service_name"
    
    if [[ -d "$service_path" ]]; then
        log_debug "Service available: $service_name"
        return 0
    else
        log_warn "Service not available: $service_name"
        return 1
    fi
}

# Load refactored service (with error handling)
load_service() {
    local service_name="$1"
    local service_path="$PROJECT_ROOT/packages/shared/services/$service_name-refactored"
    local fallback_path="$PROJECT_ROOT/packages/shared/services/$service_name"
    
    if [[ -d "$service_path" ]]; then
        log_debug "Loading refactored service: $service_name"
        # Note: This would typically involve requiring/importing in TypeScript context
        echo "$service_path"
        return 0
    elif [[ -d "$fallback_path" ]]; then
        log_warn "Using non-refactored service: $service_name (add to refactoring list)"
        echo "$fallback_path"
        return 0
    else
        log_error "Service not found: $service_name"
        return 1
    fi
}

# Health check function (can be overridden)
health_check() {
    log_info "Running basic health check for $PIPELINE_NAME"
    
    # Check project structure
    if [[ ! -d "$PROJECT_ROOT" ]]; then
        log_error "Project root not found: $PROJECT_ROOT"
        return 1
    fi
    
    # Check environment
    if [[ ! -f "$PROJECT_ROOT/.env.development" ]]; then
        log_warn "Environment file missing: $PROJECT_ROOT/.env.development"
    fi
    
    # Check tracking service
    if [[ "$ENABLE_TRACKING" == "true" && -z "$COMMAND_TRACKER" ]]; then
        log_warn "Command tracking requested but tracker not found"
    fi
    
    log_success "Basic health check passed"
    return 0
}

# Export functions that pipelines need
export -f init_cli_pipeline
export -f track_and_execute
export -f log_info log_success log_warn log_error log_debug log_timing
export -f handle_error
export -f show_help
export -f route_command
export -f check_service_available
export -f load_service
export -f health_check

# Set trap for cleanup on exit
cleanup_on_exit() {
    if [[ $TOTAL_COMMANDS -gt 0 && "$VERBOSE_MODE" == "true" ]]; then
        show_execution_summary
    fi
}

trap cleanup_on_exit EXIT