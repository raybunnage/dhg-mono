#!/usr/bin/env bash

# Example Simple CLI Pipeline - Proof of concept for migration
# This demonstrates how to migrate a simple CLI to the new base class system

# Source the Simple CLI Pipeline base class
source "$(dirname "${BASH_SOURCE[0]}")/SimpleCLIPipeline.sh"

# Pipeline configuration
PIPELINE_NAME="example"
PIPELINE_DESCRIPTION="Example Simple CLI Pipeline - demonstrates base class usage"
PIPELINE_VERSION="1.0.0"

# Initialize the pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Command implementations using the new base class

# Simple database query command
command_query() {
    local table_name="$1"
    
    if [[ -z "$table_name" ]]; then
        log_error "Table name required"
        log_info "Usage: $0 query <table_name>"
        return 1
    fi
    
    execute_db_query "list_$table_name" "SELECT * FROM $table_name LIMIT 10"
}

# File operation command
command_file_info() {
    local file_path="$1"
    
    if [[ -z "$file_path" ]]; then
        log_error "File path required"
        log_info "Usage: $0 file-info <file_path>"
        return 1
    fi
    
    execute_file_operation "exists" "$file_path"
    execute_file_operation "size" "$file_path"
}

# Example command that uses refactored services
command_test_services() {
    log_info "Testing service availability"
    
    # Check what services are available
    local services=("database-service" "logger-service" "file-service")
    
    for service in "${services[@]}"; do
        if check_service_available "$service"; then
            local service_path
            service_path=$(load_service "$service")
            log_success "Service $service available at: $service_path"
        else
            log_warn "Service $service not available - add to missing services list"
        fi
    done
}

# Health check command (override base health check)
command_health() {
    log_info "Running example pipeline health check"
    
    # Call base health check
    health_check
    
    # Add pipeline-specific health checks
    if [[ ! -d "$PROJECT_ROOT/scripts/cli-pipeline" ]]; then
        log_error "CLI pipeline directory missing"
        return 1
    fi
    
    log_success "Example pipeline health check passed"
}

# Command to demonstrate tracking
command_tracked_operation() {
    local operation="$1"
    
    case "$operation" in
        "fast")
            track_and_execute "fast_op" "Quick operation demonstration" \
                sleep 1
            ;;
        "slow")
            track_and_execute "slow_op" "Slow operation demonstration" \
                sleep 5
            ;;
        *)
            log_error "Unknown operation: $operation"
            log_info "Usage: $0 tracked-operation <fast|slow>"
            return 1
            ;;
    esac
}

# Main command routing
case "$1" in
    "")
        log_error "No command specified"
        show_help
        exit 1
        ;;
    *)
        route_command "$@"
        ;;
esac