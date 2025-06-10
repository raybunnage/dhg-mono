#!/bin/bash

# Testing CLI Pipeline
# Orchestrates shared services testing with registry-driven intelligence

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_NAME="testing"

# Source common functions if they exist
if [ -f "$SCRIPT_DIR/../core/load-env.sh" ]; then
    source "$SCRIPT_DIR/../core/load-env.sh"
fi

# Command tracking function
track_command() {
    local command="$1"
    local description="$2"
    local pipeline="$PIPELINE_NAME"
    
    # Basic tracking - log the command execution
    echo "$(date): $pipeline/$command - $description" >> "$SCRIPT_DIR/../../../logs/command-tracking.log" 2>/dev/null || true
}

# Help function
show_help() {
    echo "Testing CLI Pipeline - Phase 1 & 2 Implementation"
    echo ""
    echo "PHASE 1 COMMANDS:"
    echo "  setup-infrastructure    Set up testing database tables and views"
    echo "  test-critical           Test the 5 critical services (unit tests only)"
    echo "  health-report           Get health report for all services"
    echo "  validate-service <name> Test a specific service"
    echo ""
    echo "PHASE 2 COMMANDS (Coming Soon):"
    echo "  test-all                Test all 37 active services"
    echo "  test-integration        Run integration tests"
    echo "  run-suite [priority]    Run full test suite (critical/important/standard)"
    echo ""
    echo "UTILITY COMMANDS:"
    echo "  health-check            Check testing pipeline health"
    echo "  --help                  Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 setup-infrastructure"
    echo "  $0 test-critical"
    echo "  $0 validate-service SupabaseClientService"
    echo "  $0 health-report"
}

# Main command processing
case "${1:-}" in
    "setup-infrastructure")
        track_command "setup-infrastructure" "Setting up testing database infrastructure"
        echo "🚀 Setting up testing infrastructure..."
        cd "$SCRIPT_DIR" && ts-node setup-infrastructure.ts
        ;;
    
    "test-critical")
        track_command "test-critical" "Testing 5 critical services with unit tests"
        echo "🧪 Testing critical services..."
        cd "$SCRIPT_DIR" && ts-node test-critical-services.ts
        ;;
    
    "validate-service")
        if [ -z "$2" ]; then
            echo "❌ Error: Service name required"
            echo "Usage: $0 validate-service <service-name>"
            exit 1
        fi
        track_command "validate-service" "Testing specific service: $2"
        echo "🔍 Testing service: $2"
        cd "$SCRIPT_DIR" && ts-node validate-single-service.ts "$2"
        ;;
    
    "health-report")
        track_command "health-report" "Generating service health report"
        echo "📊 Generating health report..."
        cd "$SCRIPT_DIR" && ts-node generate-health-report.ts
        ;;
    
    "test-all")
        track_command "test-all" "Testing all 37 active services (Phase 2)"
        echo "🧪 Testing all services (Phase 2)..."
        cd "$SCRIPT_DIR" && ts-node test-all-services.ts
        ;;
    
    "run-suite")
        priority="${2:-all}"
        track_command "run-suite" "Running test suite with priority: $priority"
        echo "🏃 Running test suite (priority: $priority)..."
        cd "$SCRIPT_DIR" && ts-node run-test-suite.ts "$priority"
        ;;
    
    "health-check")
        track_command "health-check" "Checking testing pipeline health"
        echo "🏥 Testing pipeline health check..."
        cd "$SCRIPT_DIR" && ts-node health-check.ts
        ;;
    
    "--help"|"help"|"")
        show_help
        ;;
    
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac