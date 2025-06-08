#!/bin/bash

# System utilities CLI pipeline
# Handles system-level operations like service registry management

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Load command tracking functions
source "../track-command.sh"

# Function to show help
show_help() {
    echo "System Utilities CLI"
    echo ""
    echo "Usage: ./system-cli.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  populate-services      Scan and populate the service registry"
    echo "  show-services          Display all registered services"
    echo "  show-apps             Display all registered applications"
    echo "  show-pipelines        Display all registered CLI pipelines"
    echo "  analyze-dependencies  Analyze and map service dependencies"
    echo "  health-check          Run system health checks"
    echo "  help                  Show this help message"
    echo ""
}

# Process commands
case "$1" in
    "populate-services")
        track_command "system" "populate-services"
        echo "🔄 Populating service registry..."
        ts-node populate-service-registry.ts
        ;;
        
    "show-services")
        track_command "system" "show-services"
        echo "📦 Registered Services:"
        ts-node show-services.ts
        ;;
        
    "show-apps")
        track_command "system" "show-apps"
        echo "🎯 Registered Applications:"
        ts-node show-applications.ts
        ;;
        
    "show-pipelines")
        track_command "system" "show-pipelines"
        echo "🔧 Registered CLI Pipelines:"
        ts-node show-pipelines.ts
        ;;
        
    "analyze-dependencies")
        track_command "system" "analyze-dependencies"
        echo "🔍 Analyzing service dependencies..."
        ts-node analyze-dependencies.ts
        ;;
        
    "health-check")
        track_command "system" "health-check"
        echo "🏥 Running system health checks..."
        ts-node health-check.ts
        ;;
        
    "help"|"--help"|"-h"|"")
        show_help
        ;;
        
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac