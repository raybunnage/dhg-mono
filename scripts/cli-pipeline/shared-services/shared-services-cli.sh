#!/bin/bash

# Shared Services CLI - Manage shared services compliance, testing, and monitoring
# This script provides comprehensive management for all shared services

set -e

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load environment and tracking
# Find .env.development from project root
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
if [ -f "$PROJECT_ROOT/.env.development" ]; then
    set -a
    source "$PROJECT_ROOT/.env.development"
    set +a
    echo "Loaded environment from $PROJECT_ROOT/.env.development"
else
    echo "ERROR: .env.development not found"
    exit 1
fi

# Command tracking function
track_command() {
    local command_name="$1"
    shift
    echo "🔍 Tracking command: $command_name"
    # For now, skip tracking until we implement it properly
    # ../all_pipelines/all-pipelines-cli.sh track-command shared-services "$command_name" --app "shared-services" "$@"
}

# Function to run TypeScript files
run_ts() {
    ts-node "$@"
}

# Show help
show_help() {
    echo "Shared Services CLI - Comprehensive service management"
    echo ""
    echo "Usage: ./shared-services-cli.sh <command> [options]"
    echo ""
    echo "Commands:"
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
    echo "Examples:"
    echo "  ./shared-services-cli.sh discover"
    echo "  ./shared-services-cli.sh analyze"
    echo "  ./shared-services-cli.sh list --needs-work"
    echo "  ./shared-services-cli.sh show SupabaseClientService"
    echo "  ./shared-services-cli.sh monitor"
    echo ""
}

# Main command handling
case "$1" in
    discover)
        track_command "discover"
        echo "🔍 Smart service discovery (analysis mode)..."
        echo "Note: Auto-registration disabled to prevent duplicates"
        run_ts smart-discovery.ts
        ;;
        
    analyze)
        track_command "analyze"
        echo "📊 Analyzing all services..."
        run_ts analyze-and-rate-services.ts
        ;;
        
    monitor)
        track_command "monitor"
        echo "👁️ Running continuous monitoring..."
        echo ""
        echo "Step 1: Discovering new services..."
        run_ts discover-new-services.ts
        echo ""
        echo "Step 2: Analyzing all services..."
        run_ts analyze-and-rate-services.ts
        echo ""
        echo "✅ Monitoring complete!"
        ;;
        
    health-check)
        track_command "health-check"
        run_ts shared-services-cli.ts health-check
        ;;
        
    list)
        track_command "list" "$@"
        shift
        run_ts shared-services-cli.ts list "$@"
        ;;
        
    show)
        if [ -z "$2" ]; then
            echo "❌ Error: Please specify a service name"
            echo "Usage: ./shared-services-cli.sh show <service-name>"
            exit 1
        fi
        track_command "show" "$2"
        run_ts shared-services-cli.ts show "$2"
        ;;
        
    report)
        track_command "report" "$@"
        shift
        run_ts shared-services-cli.ts report "$@"
        ;;
        
    refactor)
        if [ -z "$2" ]; then
            echo "❌ Error: Please specify a service name"
            echo "Usage: ./shared-services-cli.sh refactor <service-name>"
            exit 1
        fi
        track_command "refactor" "$2"
        echo "🔧 Refactoring $2..."
        # TODO: Implement refactoring
        echo "Refactoring functionality coming soon!"
        ;;
        
    test)
        if [ -z "$2" ]; then
            echo "❌ Error: Please specify a service name"
            echo "Usage: ./shared-services-cli.sh test <service-name>"
            exit 1
        fi
        track_command "test" "$2"
        echo "🧪 Testing $2..."
        # TODO: Implement testing
        echo "Testing functionality coming soon!"
        ;;
        
    validate)
        track_command "validate"
        echo "✅ Validating all services against checklist..."
        run_ts analyze-and-rate-services.ts
        ;;
        
    continuous)
        track_command "continuous"
        echo "🔄 Running continuous improvement scan..."
        echo ""
        # Run discovery
        echo "Phase 1: Service Discovery..."
        run_ts discover-new-services.ts
        echo ""
        # Run analysis
        echo "Phase 2: Service Analysis..."
        run_ts analyze-and-rate-services.ts
        echo ""
        # Run database monitoring
        echo "Phase 3: Database Change Monitoring..."
        run_ts continuous-database-monitor.ts
        echo ""
        # Run database standards check
        echo "Phase 4: Database Standards Enforcement..."
        run_ts database-standards-enforcer.ts
        echo ""
        # Run cleanup detection
        echo "Phase 5: Orphaned Object Detection..."
        run_ts database-cleanup.ts
        echo ""
        # Generate report
        echo "Phase 6: Generating report..."
        run_ts shared-services-cli.ts report
        echo ""
        echo "✅ Continuous improvement scan complete!"
        ;;
        
    db-monitor)
        track_command "db-monitor"
        echo "🗄️ Running database change monitoring..."
        run_ts continuous-database-monitor.ts
        ;;
        
    db-standards)
        track_command "db-standards"
        echo "📋 Checking database standards compliance..."
        run_ts database-standards-enforcer.ts
        ;;
        
    db-cleanup)
        track_command "db-cleanup"
        echo "🧹 Detecting orphaned database objects..."
        run_ts database-cleanup.ts
        ;;
        
    archive-detect)
        track_command "archive-detect"
        echo "🔍 Detecting old/unused code for archival..."
        run_ts archive-detection.ts
        ;;
        
    help|--help|-h|"")
        show_help
        ;;
        
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac