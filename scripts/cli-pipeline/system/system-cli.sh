#!/usr/bin/env bash

# System CLI Pipeline - Refactored Version
# System-level operations and service registry management using SimpleCLIPipeline base class

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
PIPELINE_NAME="system"
PIPELINE_DESCRIPTION="System-level operations and service registry management"
PIPELINE_VERSION="2.0.0"

# Initialize the pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Note: This pipeline could potentially use ServiceCLIPipeline in the future
# since it manages service registries, but SimpleCLIPipeline works for now

# Command implementations

command_populate-services() {
    log_info "Scanning and populating the service registry"
    
    if [[ -f "$SCRIPT_DIR/populate-service-registry.ts" ]]; then
        track_and_execute "populate-services" "Populate service registry" \
            ts-node "$SCRIPT_DIR/populate-service-registry.ts"
    else
        log_error "populate-service-registry.ts not found"
        return 1
    fi
}

command_show-services() {
    log_info "Displaying all registered services"
    
    # Check if TypeScript file exists, otherwise use fallback
    if [[ -f "$SCRIPT_DIR/show-services.ts" ]]; then
        track_and_execute "show-services" "Display registered services" \
            ts-node "$SCRIPT_DIR/show-services.ts"
    else
        log_warn "show-services.ts not found, using database query fallback"
        execute_db_query "show_services" \
            "SELECT name, type, status, location FROM shared_services ORDER BY name"
    fi
}

command_show-apps() {
    log_info "Displaying all registered applications"
    
    if [[ -f "$SCRIPT_DIR/show-applications.ts" ]]; then
        track_and_execute "show-apps" "Display registered applications" \
            ts-node "$SCRIPT_DIR/show-applications.ts"
    else
        log_warn "show-applications.ts not found, using directory scan"
        log_info "Applications in $PROJECT_ROOT/apps/:"
        ls -1 "$PROJECT_ROOT/apps/" | grep -v "^\\." | while read -r app; do
            if [[ -d "$PROJECT_ROOT/apps/$app" ]]; then
                echo "  - $app"
            fi
        done
    fi
}

command_show-pipelines() {
    log_info "Displaying all registered CLI pipelines"
    
    if [[ -f "$SCRIPT_DIR/show-pipelines.ts" ]]; then
        track_and_execute "show-pipelines" "Display registered CLI pipelines" \
            ts-node "$SCRIPT_DIR/show-pipelines.ts"
    else
        log_warn "show-pipelines.ts not found, using database query"
        execute_db_query "show_pipelines" \
            "SELECT name, display_name, status, description FROM command_pipelines ORDER BY name"
    fi
}

command_analyze-dependencies() {
    log_info "Analyzing and mapping service dependencies"
    
    if [[ -f "$SCRIPT_DIR/analyze-dependencies.ts" ]]; then
        track_and_execute "analyze-dependencies" "Analyze service dependencies" \
            ts-node "$SCRIPT_DIR/analyze-dependencies.ts"
    else
        log_error "analyze-dependencies.ts not found"
        return 1
    fi
}

command_apply-registry-migration() {
    log_info "Applying service registry migration"
    
    if [[ -f "$SCRIPT_DIR/apply-service-registry-migration.ts" ]]; then
        track_and_execute "apply-registry-migration" "Apply registry migration" \
            ts-node "$SCRIPT_DIR/apply-service-registry-migration.ts"
    else
        log_error "apply-service-registry-migration.ts not found"
        return 1
    fi
}

command_health-check() {
    log_info "Running system health checks"
    
    # Run base health check
    health_check || return 1
    
    # Additional system-specific checks
    local health_status="healthy"
    local issues=()
    
    # Check for key system scripts
    local key_scripts=(
        "populate-service-registry.ts"
        "analyze-dependencies.ts"
    )
    
    for script in "${key_scripts[@]}"; do
        if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
            health_status="degraded"
            issues+=("Missing script: $script")
        fi
    done
    
    # Check for service availability
    if ! check_service_available "SystemService"; then
        health_status="degraded"
        issues+=("SystemService not available")
    fi
    
    if ! check_service_available "HealthCheckService"; then
        health_status="degraded"
        issues+=("HealthCheckService not available")
    fi
    
    # Check database connectivity for registry operations
    if ! execute_db_query "test_connection" "SELECT 1 as connected" >/dev/null 2>&1; then
        health_status="critical"
        issues+=("Database connection failed")
    fi
    
    # Try TypeScript health check if available
    if [[ -f "$SCRIPT_DIR/health-check.ts" ]]; then
        track_and_execute "health-check" "Run comprehensive health check" \
            ts-node "$SCRIPT_DIR/health-check.ts"
    else
        log_info "System Health Status: $health_status"
        if [[ ${#issues[@]} -gt 0 ]]; then
            log_warn "Issues found:"
            for issue in "${issues[@]}"; do
                echo "  - $issue"
            done
        else
            log_success "All system checks passed"
        fi
    fi
}

command_show-migrated() {
    log_info "Showing migrated scripts"
    
    if [[ -d "$SCRIPT_DIR/migrated_scripts" ]]; then
        log_info "Migrated scripts in $SCRIPT_DIR/migrated_scripts:"
        ls -la "$SCRIPT_DIR/migrated_scripts/"
    else
        log_warn "No migrated scripts directory found"
    fi
}

# Override the base show_help to add system-specific information
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

USAGE:
  $SCRIPT_NAME <command> [options]

COMMANDS:
  populate-services      Scan and populate the service registry
  show-services          Display all registered services
  show-apps             Display all registered applications
  show-pipelines        Display all registered CLI pipelines
  analyze-dependencies  Analyze and map service dependencies
  apply-registry-migration  Apply service registry database migration
  show-migrated         Display migrated scripts
  health-check          Run system health checks
  help                  Show this help message

EXAMPLES:
  # Populate service registry
  $SCRIPT_NAME populate-services
  
  # Show all services
  $SCRIPT_NAME show-services
  
  # Analyze dependencies
  $SCRIPT_NAME analyze-dependencies
  
  # Check system health
  $SCRIPT_NAME health-check

DEBUG MODE:
  DEBUG=1 $SCRIPT_NAME <command>  # Enable debug output

NOTES:
  - This pipeline manages system-level operations and the service registry
  - Database connectivity is required for most operations
  - Consider migrating to ServiceCLIPipeline base class in the future

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