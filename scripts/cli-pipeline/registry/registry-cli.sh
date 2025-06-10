#!/bin/bash

# Registry CLI Pipeline - Service dependency mapping and analysis
# Usage: ./registry-cli.sh [command] [options]

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Track command usage
track_command() {
    local command=$1
    # Try to track command, but don't fail if tracking is not available
    if [ -f "$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh" ]; then
        "$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh" track-command "registry-$command" "registry" >/dev/null 2>&1 || true
    fi
}

# Function to show help
show_help() {
    cat << EOF
🗂️  Registry CLI Pipeline

Service dependency mapping and analysis for the DHG monorepo.

USAGE:
    ./registry-cli.sh [command] [options]

COMMANDS:
    Core Registry Commands:
    scan-services       Scan packages/shared/services directory
    scan-apps          Scan apps directory for applications
    scan-app-features  Scan app features (pages, components, hooks)
    scan-pipelines     Scan CLI pipelines in scripts/cli-pipeline
    populate-registry  Run all scanners and populate registry
    
    Analysis Commands:
    analyze-dependencies  Analyze and map service dependencies
    find-unused          Find services with no dependencies
    generate-report      Generate comprehensive dependency report
    find-pipeline-gaps   Find services used in apps but not CLI
    
    Utility Commands:
    clear-registry     Clear all registry data (use with caution)
    refresh           Update existing registry entries
    validate          Validate registry data integrity
    help              Show this help message

EXAMPLES:
    # Initial population of registry
    ./registry-cli.sh populate-registry
    
    # Find unused services that can be archived
    ./registry-cli.sh find-unused
    
    # Analyze dependencies for a specific app
    ./registry-cli.sh analyze-dependencies --app dhg-hub
    
    # Generate markdown report
    ./registry-cli.sh generate-report --format markdown

EOF
}

# Main command handler
case "${1:-help}" in
    # Core Registry Commands
    scan-services)
        echo "🔍 Scanning shared services..."
        track_command "scan-services"
        shift
        cd "$SCRIPT_DIR" && npx ts-node scan-services.ts "$@"
        ;;
        
    scan-apps)
        echo "🔍 Scanning applications..."
        track_command "scan-apps"
        shift
        cd "$SCRIPT_DIR" && npx ts-node scan-apps.ts "$@"
        ;;
        
    scan-app-features)
        echo "🔍 Scanning app features..."
        track_command "scan-app-features"
        shift
        cd "$SCRIPT_DIR" && npx ts-node scan-app-features.ts "$@"
        ;;
        
    scan-pipelines)
        echo "🔍 Scanning CLI pipelines..."
        track_command "scan-pipelines"
        shift
        cd "$SCRIPT_DIR" && npx ts-node scan-pipelines.ts "$@"
        ;;
        
    populate-registry)
        echo "📦 Populating registry with all components..."
        track_command "populate-registry"
        shift
        cd "$SCRIPT_DIR" && npx ts-node populate-registry.ts "$@"
        ;;
        
    # Analysis Commands
    analyze-dependencies)
        echo "🔗 Analyzing service dependencies..."
        track_command "analyze-dependencies"
        shift
        cd "$SCRIPT_DIR" && npx ts-node analyze-dependencies.ts "$@"
        ;;
        
    find-unused)
        echo "🔍 Finding unused services..."
        track_command "find-unused"
        shift
        cd "$SCRIPT_DIR" && npx ts-node find-unused.ts "$@"
        ;;
        
    generate-report)
        echo "📊 Generating dependency report..."
        track_command "generate-report"
        shift
        cd "$SCRIPT_DIR" && npx ts-node generate-report.ts "$@"
        ;;
        
    find-pipeline-gaps)
        echo "🔍 Finding pipeline coverage gaps..."
        track_command "find-pipeline-gaps"
        shift
        cd "$SCRIPT_DIR" && npx ts-node find-pipeline-gaps.ts "$@"
        ;;
        
    # Utility Commands
    clear-registry)
        echo "⚠️  Clearing registry data..."
        track_command "clear-registry"
        shift
        cd "$SCRIPT_DIR" && npx ts-node clear-registry.ts "$@"
        ;;
        
    refresh)
        echo "🔄 Refreshing registry entries..."
        track_command "refresh"
        shift
        cd "$SCRIPT_DIR" && npx ts-node refresh-registry.ts "$@"
        ;;
        
    validate)
        echo "✅ Validating registry data..."
        track_command "validate"
        shift
        cd "$SCRIPT_DIR" && npx ts-node validate-registry.ts "$@"
        ;;
        
    # Help
    help|--help|-h|"")
        show_help
        ;;
        
    *)
        echo "❌ Unknown command: $1"
        echo "Run './registry-cli.sh help' for usage information"
        exit 1
        ;;
  health-check)
    echo "🏥 Running health check for registry pipeline..."
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "❌ Missing required environment variables"
      exit 1
    fi
    echo "✅ registry pipeline is healthy"
    ;;
esac
