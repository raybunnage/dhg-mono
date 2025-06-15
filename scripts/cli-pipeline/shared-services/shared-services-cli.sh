#!/bin/bash

# Shared Services CLI - Manage shared services compliance, testing, and monitoring
# This script provides comprehensive management for all shared services
# Refactored to use SimpleCLIPipeline base class

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the base class
source "$SCRIPT_DIR/../base-classes/SimpleCLIPipeline.sh" || {
    echo "Error: Failed to source SimpleCLIPipeline.sh"
    exit 1
}

# Initialize with pipeline name
init_cli_pipeline "shared-services" "Shared Services CLI - Comprehensive service management"

# Function to run TypeScript files with fallback
run_ts_with_fallback() {
    local script_name="$1"
    shift
    
    local script_path="$SCRIPT_DIR/$script_name"
    if [[ -f "$script_path" ]]; then
        cd "$SCRIPT_DIR" && npx ts-node "$script_name" "$@"
    else
        log_warn "$script_name not found"
        log_info "Fallback: Basic ${script_name%.ts} operation"
        case "$script_name" in
            "discover-new-services.ts"|"smart-discovery.ts")
                log_info "Would discover services in packages/shared/services"
                find "$PROJECT_ROOT/packages/shared/services" -name "*.ts" -type f | head -10 | sed 's|.*/||g' | sed 's|\.ts$||g' | xargs -I {} echo "  - Found service: {}"
                ;;
            "analyze-and-rate-services.ts")
                log_info "Would analyze service compliance and health"
                ;;
            "shared-services-cli.ts")
                log_info "Would run advanced shared services operations"
                ;;
            "continuous-database-monitor.ts")
                log_info "Would monitor database changes"
                ;;
            "database-standards-enforcer.ts")
                log_info "Would check database standards"
                ;;
            "database-cleanup.ts")
                log_info "Would detect orphaned database objects"
                ;;
            "archive-detection.ts")
                log_info "Would detect old/unused code for archival"
                ;;
        esac
    fi
}

# Define commands

command_help() {
    show_help
}

command_discover() {
    log_info "🔍 Smart service discovery (analysis mode)..."
    log_info "Note: Auto-registration disabled to prevent duplicates"
    run_ts_with_fallback "smart-discovery.ts"
}

command_analyze() {
    log_info "📊 Analyzing all services..."
    run_ts_with_fallback "analyze-and-rate-services.ts"
}

command_monitor() {
    log_info "👁️ Running continuous monitoring..."
    echo ""
    echo "Step 1: Discovering new services..."
    run_ts_with_fallback "discover-new-services.ts"
    echo ""
    echo "Step 2: Analyzing all services..."
    run_ts_with_fallback "analyze-and-rate-services.ts"
    echo ""
    log_success "✅ Monitoring complete!"
}

command_health-check() {
    log_info "Running shared services health check..."
    run_ts_with_fallback "shared-services-cli.ts" "health-check"
}

command_list() {
    log_info "Listing services with filters..."
    run_ts_with_fallback "shared-services-cli.ts" "list" "$@"
}

command_show() {
    local service_name="$1"
    
    if [[ -z "$service_name" ]]; then
        log_error "Please specify a service name"
        echo "Usage: ./shared-services-cli.sh show <service-name>"
        return 1
    fi
    
    log_info "Showing details for service: $service_name"
    run_ts_with_fallback "shared-services-cli.ts" "show" "$service_name"
}

command_report() {
    log_info "Generating comprehensive report..."
    run_ts_with_fallback "shared-services-cli.ts" "report" "$@"
}

command_refactor() {
    local service_name="$1"
    
    if [[ -z "$service_name" ]]; then
        log_error "Please specify a service name"
        echo "Usage: ./shared-services-cli.sh refactor <service-name>"
        return 1
    fi
    
    log_info "🔧 Refactoring $service_name..."
    log_warn "Refactoring functionality coming soon!"
}

command_test() {
    local service_name="$1"
    
    if [[ -z "$service_name" ]]; then
        log_error "Please specify a service name"
        echo "Usage: ./shared-services-cli.sh test <service-name>"
        return 1
    fi
    
    log_info "🧪 Testing $service_name..."
    log_warn "Testing functionality coming soon!"
}

command_validate() {
    log_info "✅ Validating all services against checklist..."
    run_ts_with_fallback "analyze-and-rate-services.ts"
}

command_continuous() {
    log_info "🔄 Running continuous improvement scan..."
    echo ""
    # Run discovery
    echo "Phase 1: Service Discovery..."
    run_ts_with_fallback "discover-new-services.ts"
    echo ""
    # Run analysis
    echo "Phase 2: Service Analysis..."
    run_ts_with_fallback "analyze-and-rate-services.ts"
    echo ""
    # Run database monitoring
    echo "Phase 3: Database Change Monitoring..."
    run_ts_with_fallback "continuous-database-monitor.ts"
    echo ""
    # Run database standards check
    echo "Phase 4: Database Standards Enforcement..."
    run_ts_with_fallback "database-standards-enforcer.ts"
    echo ""
    # Run cleanup detection
    echo "Phase 5: Orphaned Object Detection..."
    run_ts_with_fallback "database-cleanup.ts"
    echo ""
    # Generate report
    echo "Phase 6: Generating report..."
    run_ts_with_fallback "shared-services-cli.ts" "report"
    echo ""
    log_success "✅ Continuous improvement scan complete!"
}

command_db-monitor() {
    log_info "🗄️ Running database change monitoring..."
    run_ts_with_fallback "continuous-database-monitor.ts"
}

command_db-standards() {
    log_info "📋 Checking database standards compliance..."
    run_ts_with_fallback "database-standards-enforcer.ts"
}

command_db-cleanup() {
    log_info "🧹 Detecting orphaned database objects..."
    run_ts_with_fallback "database-cleanup.ts"
}

command_archive-detect() {
    log_info "🔍 Detecting old/unused code for archival..."
    run_ts_with_fallback "archive-detection.ts"
}

# Override help to add comprehensive examples
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "USAGE:"
    echo "  ./shared-services-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  discover              Discover new services not yet registered"
    echo "  analyze               Analyze all services for compliance and health"
    echo "  monitor               Run continuous monitoring (discover + analyze)"
    echo "  health-check          Quick health check of all services"
    echo "  list [options]        List services with filters"
    echo "    --health <status>     Filter by health (essential/active/low-usage/deprecated)"
    echo "    --needs-work          Show services needing refactoring"
    echo "    --no-tests           Show services without tests"
    echo "    --unused             Show unused services"
    echo "  show <service>        Show detailed info about a service"
    echo "  report [--format]     Generate comprehensive report (markdown/json)"
    echo "  refactor <service>    Refactor a service to be compliant"
    echo "  test <service>        Run tests for a specific service"
    echo "  validate              Validate all services against checklist"
    echo "  continuous            Run continuous improvement scan"
    echo "  db-monitor            Monitor database changes and apply maintenance"
    echo "  db-standards          Check database against standards and generate fixes"
    echo "  db-cleanup            Detect and clean orphaned database objects"
    echo "  archive-detect        Detect old/unused code for archival before continuous improvement"
    echo "  help                  Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  ./shared-services-cli.sh discover"
    echo "  ./shared-services-cli.sh analyze"
    echo "  ./shared-services-cli.sh list --needs-work"
    echo "  ./shared-services-cli.sh show SupabaseClientService"
    echo "  ./shared-services-cli.sh monitor"
    echo "  ./shared-services-cli.sh continuous"
}

# Main execution
route_command "$@"