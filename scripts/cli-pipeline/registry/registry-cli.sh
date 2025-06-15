#!/usr/bin/env bash

# Registry CLI Pipeline - Refactored Version
# Service dependency mapping and analysis using SimpleCLIPipeline base class

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
PIPELINE_NAME="registry"
PIPELINE_DESCRIPTION="Service dependency mapping and analysis for the DHG monorepo"
PIPELINE_VERSION="2.0.0"

# Initialize the pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Core Registry Commands

command_scan-services() {
    log_info "Scanning shared services directory..."
    
    track_and_execute "scan-services" "Scan packages/shared/services directory" \
        npx ts-node "$SCRIPT_DIR/scan-services.ts" "$@"
}

command_scan-apps() {
    log_info "Scanning applications directory..."
    
    track_and_execute "scan-apps" "Scan apps directory for applications" \
        npx ts-node "$SCRIPT_DIR/scan-apps.ts" "$@"
}

command_scan-app-features() {
    log_info "Scanning app features (pages, components, hooks)..."
    
    track_and_execute "scan-app-features" "Scan app features" \
        npx ts-node "$SCRIPT_DIR/scan-app-features.ts" "$@"
}

command_scan-pipelines() {
    log_info "Scanning CLI pipelines..."
    
    track_and_execute "scan-pipelines" "Scan CLI pipelines in scripts/cli-pipeline" \
        npx ts-node "$SCRIPT_DIR/scan-pipelines.ts" "$@"
}

command_populate-registry() {
    log_info "Populating registry with all components..."
    
    track_and_execute "populate-registry" "Run all scanners and populate registry" \
        npx ts-node "$SCRIPT_DIR/populate-registry.ts" "$@"
}

# Analysis Commands

command_analyze-dependencies() {
    log_info "Analyzing and mapping service dependencies..."
    
    track_and_execute "analyze-dependencies" "Analyze service dependencies" \
        npx ts-node "$SCRIPT_DIR/analyze-dependencies.ts" "$@"
}

command_find-unused() {
    log_info "Finding services with no dependencies..."
    
    track_and_execute "find-unused" "Find unused services" \
        npx ts-node "$SCRIPT_DIR/find-unused.ts" "$@"
}

command_generate-report() {
    log_info "Generating comprehensive dependency report..."
    
    track_and_execute "generate-report" "Generate dependency report" \
        npx ts-node "$SCRIPT_DIR/generate-report.ts" "$@"
}

command_find-pipeline-gaps() {
    log_info "Finding services used in apps but not CLI pipelines..."
    
    track_and_execute "find-pipeline-gaps" "Find pipeline coverage gaps" \
        npx ts-node "$SCRIPT_DIR/find-pipeline-gaps.ts" "$@"
}

# Additional analysis commands found in directory

command_check-coverage() {
    log_info "Checking registry coverage..."
    
    if [[ -f "$SCRIPT_DIR/check-coverage.js" ]]; then
        track_and_execute "check-coverage" "Check registry coverage" \
            node "$SCRIPT_DIR/check-coverage.js" "$@"
    else
        log_error "check-coverage.js not found"
        return 1
    fi
}

command_validate-unused() {
    log_info "Validating unused services..."
    
    if [[ -f "$SCRIPT_DIR/validate-unused-services.ts" ]]; then
        track_and_execute "validate-unused" "Validate unused services" \
            npx ts-node "$SCRIPT_DIR/validate-unused-services.ts" "$@"
    else
        log_error "validate-unused-services.ts not found"
        return 1
    fi
}

# Utility Commands

command_clear-registry() {
    log_warn "Clearing registry data - this cannot be undone!"
    
    # Add confirmation prompt
    read -p "Are you sure you want to clear all registry data? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Clear operation cancelled"
        return 0
    fi
    
    if [[ -f "$SCRIPT_DIR/clear-registry.ts" ]]; then
        track_and_execute "clear-registry" "Clear all registry data" \
            npx ts-node "$SCRIPT_DIR/clear-registry.ts" "$@"
    else
        log_warn "clear-registry.ts not found, using database query"
        execute_db_query "clear_registry" \
            "TRUNCATE shared_services, app_registrations, command_pipelines CASCADE"
    fi
}

command_refresh() {
    log_info "Refreshing existing registry entries..."
    
    if [[ -f "$SCRIPT_DIR/refresh-registry.ts" ]]; then
        track_and_execute "refresh" "Update existing registry entries" \
            npx ts-node "$SCRIPT_DIR/refresh-registry.ts" "$@"
    else
        log_warn "refresh-registry.ts not found, running populate instead"
        command_populate-registry "$@"
    fi
}

command_validate() {
    log_info "Validating registry data integrity..."
    
    if [[ -f "$SCRIPT_DIR/validate-registry.ts" ]]; then
        track_and_execute "validate" "Validate registry data" \
            npx ts-node "$SCRIPT_DIR/validate-registry.ts" "$@"
    else
        log_warn "validate-registry.ts not found, using basic validation"
        execute_db_query "validate_registry" \
            "SELECT 'Services' as type, COUNT(*) as count FROM shared_services UNION ALL SELECT 'Apps', COUNT(*) FROM app_registrations UNION ALL SELECT 'Pipelines', COUNT(*) FROM command_pipelines"
    fi
}

# Health check command
command_health-check() {
    log_info "Running registry pipeline health check..."
    
    # Run base health check
    health_check || return 1
    
    # Additional registry-specific checks
    local health_status="healthy"
    local issues=()
    
    # Check for key registry scripts
    local key_scripts=(
        "scan-services.ts"
        "scan-apps.ts"
        "scan-pipelines.ts"
        "populate-registry.ts"
        "analyze-dependencies.ts"
        "find-unused.ts"
        "generate-report.ts"
    )
    
    local available_scripts=0
    for script in "${key_scripts[@]}"; do
        if [[ -f "$SCRIPT_DIR/$script" ]]; then
            ((available_scripts++))
        else
            issues+=("Missing script: $script")
        fi
    done
    
    if [[ $available_scripts -lt ${#key_scripts[@]} ]]; then
        health_status="degraded"
    fi
    
    # Check for service availability
    if ! check_service_available "RegistryService"; then
        health_status="degraded"
        issues+=("RegistryService not available")
    fi
    
    if ! check_service_available "DatabaseService"; then
        health_status="critical"
        issues+=("DatabaseService not available")
    fi
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        health_status="critical"
        issues+=("Missing required environment variables")
    fi
    
    # Try TypeScript health check if available
    if [[ -f "$SCRIPT_DIR/check-health-checks.ts" ]]; then
        track_and_execute "health-check" "Run comprehensive health check" \
            npx ts-node "$SCRIPT_DIR/check-health-checks.ts"
    else
        log_info "Registry Health Status: $health_status"
        log_info "Available Scripts: $available_scripts/${#key_scripts[@]}"
        
        if [[ ${#issues[@]} -gt 0 ]]; then
            log_warn "Issues found:"
            for issue in "${issues[@]}"; do
                echo "  - $issue"
            done
        else
            log_success "All registry checks passed"
        fi
    fi
}

# Override the base show_help to add registry-specific information
show_help() {
    cat << EOF
🗂️  $PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

USAGE:
  $SCRIPT_NAME <command> [options]

CORE REGISTRY COMMANDS:
  scan-services         Scan packages/shared/services directory
  scan-apps            Scan apps directory for applications
  scan-app-features    Scan app features (pages, components, hooks)
  scan-pipelines       Scan CLI pipelines in scripts/cli-pipeline
  populate-registry    Run all scanners and populate registry

ANALYSIS COMMANDS:
  analyze-dependencies  Analyze and map service dependencies
  find-unused          Find services with no dependencies
  generate-report      Generate comprehensive dependency report
  find-pipeline-gaps   Find services used in apps but not CLI
  check-coverage       Check registry coverage completeness
  validate-unused      Validate unused services analysis

UTILITY COMMANDS:
  clear-registry       Clear all registry data (use with caution!)
  refresh             Update existing registry entries
  validate            Validate registry data integrity
  health-check        Run registry pipeline health check
  help               Show this help message

EXAMPLES:
  # Initial population of registry
  $SCRIPT_NAME populate-registry
  
  # Find unused services that can be archived
  $SCRIPT_NAME find-unused
  
  # Analyze dependencies for a specific app
  $SCRIPT_NAME analyze-dependencies --app dhg-hub
  
  # Generate markdown report
  $SCRIPT_NAME generate-report --format markdown

DEBUG MODE:
  DEBUG=1 $SCRIPT_NAME <command>  # Enable debug output

ENVIRONMENT:
  Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

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