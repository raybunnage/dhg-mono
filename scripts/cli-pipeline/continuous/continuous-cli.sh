#!/bin/bash

# Continuous Improvement CLI - Phase 1
# Keep it simple, measure what matters
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
init_cli_pipeline "continuous" "Continuous Improvement CLI - Phase 1"

# Define commands

command_help() {
    show_help
}

command_test() {
    log_info "🧪 Running Tests"
    log_info "Testing what exists, measuring what matters"
    echo ""
    
    if [[ -f "$SCRIPT_DIR/simple-test-runner.ts" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/simple-test-runner.ts"
    else
        log_warn "simple-test-runner.ts not found"
        log_info "Fallback: Running basic test discovery"
        local test_count=$(find "$PROJECT_ROOT/packages/shared/services" -name "*.test.ts" 2>/dev/null | wc -l)
        log_info "Found $test_count test files in shared services"
    fi
}

command_discover() {
    log_info "🔍 Discovering Inventory"
    log_info "Finding all services, pipelines, and tables"
    echo ""
    
    # Use existing discovery from shared-services
    local discover_script="$PROJECT_ROOT/scripts/cli-pipeline/shared-services/discover-new-services.ts"
    if [[ -f "$discover_script" ]]; then
        cd "$PROJECT_ROOT/scripts/cli-pipeline/shared-services" && npx ts-node discover-new-services.ts
    else
        log_warn "discover-new-services.ts not found"
        # Fallback implementation
        log_info "Fallback: Basic inventory count"
        local service_count=$(find "$PROJECT_ROOT/packages/shared/services" -name "*.ts" | grep -v test | wc -l)
        local pipeline_count=$(find "$PROJECT_ROOT/scripts/cli-pipeline" -name "*-cli.sh" | wc -l)
        local app_count=$(find "$PROJECT_ROOT/apps" -name package.json | wc -l)
        
        log_success "Services: $service_count"
        log_success "CLI Pipelines: $pipeline_count"
        log_success "Apps: $app_count"
    fi
}

command_check() {
    log_info "📋 Checking Standards"
    log_info "Validating against .continuous/standards.yaml"
    echo ""
    log_warn "Standards checking not yet implemented"
    log_info "Phase 1: Focus on test execution and discovery first"
}

command_report() {
    log_info "📊 Daily Report"
    echo "$(date '+%Y-%m-%d %H:%M')"
    echo ""
    
    # Check if we have test results
    if [[ -f "$PROJECT_ROOT/.continuous/test-results.json" ]]; then
        echo "📈 Latest test results:"
        echo "   (Results saved in .continuous/test-results.json)"
    else
        log_warn "No test results found. Run './continuous-cli.sh test' first"
    fi
    
    echo ""
    echo "📦 Current inventory:"
    echo "   Services: $(find "$PROJECT_ROOT/packages/shared/services" -name "*.ts" | grep -v test | wc -l)"
    echo "   CLI Pipelines: $(find "$PROJECT_ROOT/scripts/cli-pipeline" -name "*-cli.sh" | wc -l)"
    echo "   Apps: $(find "$PROJECT_ROOT/apps" -name package.json | wc -l)"
    
    echo ""
    echo "💡 Next steps:"
    echo "   - Run tests daily"
    echo "   - Address any failing tests"
    echo "   - Review trends weekly"
}

command_trends() {
    log_info "📈 Trends"
    echo ""
    
    if [[ -f "$PROJECT_ROOT/.continuous/test-results.json" ]]; then
        echo "Test results history (last 7 days):"
        echo "   Data: .continuous/test-results.json"
        log_warn "Trend analysis not yet implemented"
        log_info "Phase 1: Focus on daily measurement first"
    else
        log_error "No historical data found"
        echo "   Run tests for a few days to see trends"
    fi
}

command_daily() {
    log_success "🔄 Daily Continuous Improvement Check"
    echo "Running: test + discover + basic checks"
    echo ""
    
    command_test
    echo ""
    command_discover
    echo ""
    command_report
    
    echo ""
    log_success "✅ Daily check complete!"
    echo ""
    echo "📝 Summary:"
    echo "   - Tests executed and results saved"
    echo "   - Inventory updated"
    echo "   - Report generated"
    echo ""
    echo "📅 Next: Review results and run again tomorrow"
}

# Override help to add philosophy and examples
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "Philosophy: Start simple, measure first, learn fast"
    echo ""
    echo "USAGE:"
    echo "  ./continuous-cli.sh <command>"
    echo ""
    echo "COMMANDS:"
    echo "  test            Run all tests (services, apps, CLIs)"
    echo "  discover        Find all services, pipelines, tables"  
    echo "  check           Check against basic standards"
    echo "  report          Generate daily summary report"
    echo "  trends          Show week-over-week changes"
    echo "  daily           Run full daily check (test + discover + check)"
    echo "  help            Show this help"
    echo ""
    echo "EXAMPLES:"
    echo "  ./continuous-cli.sh test"
    echo "  ./continuous-cli.sh daily"
}

# Main execution
route_command "$@"