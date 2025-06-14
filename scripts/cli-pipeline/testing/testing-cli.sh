#!/usr/bin/env bash

# Testing CLI Pipeline - Refactored Version
# Comprehensive testing for CLI pipelines using SimpleCLIPipeline base class

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
PIPELINE_NAME="testing"
PIPELINE_DESCRIPTION="Comprehensive testing framework for CLI pipelines"
PIPELINE_VERSION="2.0.0"

# Initialize the pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Command implementations

command_test-existence() {
    local pipeline="${1:-}"
    
    if [[ -z "$pipeline" ]]; then
        log_error "Pipeline name required"
        log_info "Usage: $SCRIPT_NAME test-existence <pipeline-name>"
        return 1
    fi
    
    log_info "Testing command existence for pipeline: $pipeline"
    
    # Try TypeScript version first, with bash fallback
    if [[ -f "$SCRIPT_DIR/commands/test-command-existence.ts" ]]; then
        track_and_execute "test-existence" "Test command existence for $pipeline" \
            npx ts-node "$SCRIPT_DIR/commands/test-command-existence.ts" "$pipeline"
    else
        log_warn "TypeScript test not available, using basic check..."
        if [[ -f "$PROJECT_ROOT/scripts/cli-pipeline/$pipeline/${pipeline}-cli.sh" ]]; then
            log_success "Pipeline exists: $pipeline"
        else
            log_error "Pipeline not found: $pipeline"
            return 1
        fi
    fi
}

command_test-priority() {
    local level="${1:-1}"
    
    # Validate level is 1-3
    if [[ ! "$level" =~ ^[1-3]$ ]]; then
        log_error "Invalid priority level: $level (must be 1-3)"
        return 1
    fi
    
    log_info "Testing priority level $level pipelines..."
    
    # Priority definitions
    local -a level1=("database" "dev_tasks" "google_sync" "document" "ai")
    local -a level2=("auth" "monitoring" "deployment" "servers" "work_summaries")
    local -a level3=("docs" "scripts" "media_processing" "email" "presentations")
    
    # Get appropriate array based on level
    local pipelines_var="level$level[@]"
    local pipelines=("${!pipelines_var}")
    
    if [[ -f "$SCRIPT_DIR/commands/test-priority-pipelines.ts" ]]; then
        track_and_execute "test-priority" "Test priority level $level pipelines" \
            npx ts-node "$SCRIPT_DIR/commands/test-priority-pipelines.ts" "$level"
    else
        log_warn "Testing ${#pipelines[@]} level $level pipelines in fallback mode..."
        for p in "${pipelines[@]}"; do
            log_info "Testing $p..."
            command_test_existence "$p"
        done
    fi
}

command_test-pipeline() {
    local pipeline="${1:-}"
    
    if [[ -z "$pipeline" ]]; then
        log_error "Pipeline name required"
        log_info "Usage: $SCRIPT_NAME test-pipeline <pipeline-name>"
        return 1
    fi
    
    log_info "Running comprehensive tests for $pipeline..."
    
    # Run multiple test types
    log_info "1. Testing command existence..."
    command_test_existence "$pipeline"
    
    # Check for service integration
    log_info "2. Checking service availability..."
    if check_service_available "TestingService"; then
        log_success "TestingService available"
    else
        log_warn "TestingService not available - add to missing services"
    fi
    
    # Future test types
    # log_info "3. Testing command tracking..."
    # log_info "4. Testing error handling..."
}

command_test-all() {
    log_info "Testing all registered pipelines..."
    
    if [[ -f "$SCRIPT_DIR/commands/test-all-pipelines.ts" ]]; then
        track_and_execute "test-all" "Test all registered pipelines" \
            npx ts-node "$SCRIPT_DIR/commands/test-all-pipelines.ts"
    else
        log_warn "Testing all pipelines in fallback mode..."
        local count=0
        find "$PROJECT_ROOT/scripts/cli-pipeline" -name '*-cli.sh' -type f | while read -r f; do
            local pipeline=$(basename "$(dirname "$f")")
            log_info "Testing $pipeline..."
            command_test_existence "$pipeline"
            ((count++))
        done
        log_success "Tested $count pipelines"
    fi
}

command_coverage() {
    local pipeline="${1:-}"
    
    if [[ -z "$pipeline" ]]; then
        log_error "Pipeline name required"
        log_info "Usage: $SCRIPT_NAME coverage <pipeline-name>"
        return 1
    fi
    
    log_info "Calculating test coverage for $pipeline..."
    
    if [[ -f "$SCRIPT_DIR/commands/show-coverage.ts" ]]; then
        track_and_execute "coverage" "Show test coverage for $pipeline" \
            npx ts-node "$SCRIPT_DIR/commands/show-coverage.ts" "$pipeline"
    else
        log_warn "Coverage analysis not available in fallback mode"
        log_info "Pipeline: $pipeline"
        log_info "Status: Coverage tracking requires TypeScript implementation"
    fi
}

command_report() {
    log_info "Generating comprehensive test report..."
    
    if [[ -f "$SCRIPT_DIR/commands/generate-report.ts" ]]; then
        track_and_execute "report" "Generate comprehensive test report" \
            npx ts-node "$SCRIPT_DIR/commands/generate-report.ts"
    else
        log_warn "Generating basic report in fallback mode..."
        echo ""
        echo "📊 Test Report (Fallback Mode)"
        echo "============================"
        echo "Generated: $(date)"
        echo "Pipeline: $PIPELINE_NAME v$PIPELINE_VERSION"
        echo ""
        echo "Pipelines found: $(find "$PROJECT_ROOT/scripts/cli-pipeline" -name '*-cli.sh' -type f | wc -l)"
        echo ""
        echo "Base class health:"
        health_check
    fi
}

command_health-check() {
    log_info "Checking testing infrastructure health..."
    
    # Run base health check
    health_check || return 1
    
    # Additional testing-specific checks
    local health_status="healthy"
    local issues=()
    
    # Check for TypeScript commands
    if [[ ! -d "$SCRIPT_DIR/commands" ]]; then
        health_status="degraded"
        issues+=("Commands directory missing")
    fi
    
    # Check for test services
    if ! check_service_available "TestingService"; then
        health_status="degraded" 
        issues+=("TestingService not available")
    fi
    
    # Check for test data
    if [[ ! -f "$PROJECT_ROOT/supabase/migrations/20250610_create_test_results_table.sql" ]]; then
        health_status="degraded"
        issues+=("Test results table migration missing")
    fi
    
    if [[ -f "$SCRIPT_DIR/commands/health-check.ts" ]]; then
        track_and_execute "health-check" "Check testing infrastructure health" \
            npx ts-node "$SCRIPT_DIR/commands/health-check.ts"
    else
        log_info "Health Status: $health_status"
        if [[ ${#issues[@]} -gt 0 ]]; then
            log_warn "Issues found:"
            for issue in "${issues[@]}"; do
                echo "  - $issue"
            done
        else
            log_success "No issues found"
        fi
    fi
}

# Override the base show_help to add testing-specific information
show_help() {
    cat << EOF
$PIPELINE_DESCRIPTION
Version: $PIPELINE_VERSION

USAGE:
  $SCRIPT_NAME <command> [options]

COMMANDS:
  test-existence <pipeline>    Test command existence for a pipeline
  test-priority [level]        Test priority pipelines (default: level 1)
  test-pipeline <pipeline>     Run all tests for a specific pipeline
  test-all                     Test all registered pipelines
  coverage <pipeline>          Show test coverage for a pipeline
  report                       Generate comprehensive test report
  health-check                 Check testing infrastructure health
  help                         Show this help message

PRIORITY LEVELS:
  1 - Critical pipelines (database, dev_tasks, google_sync, document, ai)
  2 - Core pipelines (auth, monitoring, deployment, servers, work_summaries)
  3 - Support pipelines (docs, scripts, media_processing, email, presentations)

EXAMPLES:
  $SCRIPT_NAME test-existence database
  $SCRIPT_NAME test-priority 1
  $SCRIPT_NAME test-pipeline dev_tasks
  $SCRIPT_NAME coverage database
  $SCRIPT_NAME report

DEBUG MODE:
  DEBUG=1 $SCRIPT_NAME <command>  # Enable debug output

TRACKING:
  Command execution is automatically tracked when tracking service is available.
  Disable with: DISABLE_TRACKING=1 $SCRIPT_NAME <command>

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