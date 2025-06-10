#!/bin/bash

# Element Criteria CLI Pipeline - Manage success criteria and quality gates for elements
# Usage: ./element-criteria-cli.sh [command] [options]

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Track command usage
track_command() {
    local command=$1
    # Try to track command, but don't fail if tracking is not available
    if [ -f "$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh" ]; then
        "$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh" track-command "element-criteria-$command" "element_criteria" >/dev/null 2>&1 || true
    fi
}

# Function to show help
show_help() {
    cat << EOF
🎯 Element Criteria CLI Pipeline

Manage success criteria and quality gates for elements (app features, CLI commands, services).

USAGE:
    ./element-criteria-cli.sh [command] [options]

COMMANDS:
    Criteria Management:
    add-criteria         Add success criteria to an element
    add-gate            Add quality gate to an element
    list-criteria       List criteria for an element
    list-gates          List gates for an element
    apply-template      Apply a criteria template to an element
    
    Template Management:
    list-templates      List available criteria templates
    create-template     Create a new criteria template
    
    Analysis & Reports:
    suggest             Suggest criteria for an element
    coverage-report     Show elements with/without criteria
    element-hierarchy   Show app hierarchy with criteria counts
    
    Data Population:
    populate-sample     Populate sample criteria for testing
    import-from-tasks   Import existing task criteria to elements
    
    Utility Commands:
    help               Show this help message
    health-check       Run health check for element criteria pipeline

EXAMPLES:
    # Add criteria to an app feature
    ./element-criteria-cli.sh add-criteria --type app_feature --id <uuid> --title "Loads without errors"
    
    # List all templates
    ./element-criteria-cli.sh list-templates
    
    # Apply template to element
    ./element-criteria-cli.sh apply-template --template-id <uuid> --element-type app_feature --element-id <uuid>
    
    # Generate coverage report
    ./element-criteria-cli.sh coverage-report --app dhg-hub
    
    # Populate sample data
    ./element-criteria-cli.sh populate-sample --app dhg-admin-code

EOF
}

# Main command handler
case "${1:-help}" in
    # Criteria Management
    add-criteria)
        echo "➕ Adding success criteria..."
        track_command "add-criteria"
        shift
        cd "$SCRIPT_DIR" && npx ts-node add-criteria.ts "$@"
        ;;
        
    add-gate)
        echo "🚪 Adding quality gate..."
        track_command "add-gate"
        shift
        cd "$SCRIPT_DIR" && npx ts-node add-gate.ts "$@"
        ;;
        
    list-criteria)
        echo "📋 Listing criteria..."
        track_command "list-criteria"
        shift
        cd "$SCRIPT_DIR" && npx ts-node list-criteria.ts "$@"
        ;;
        
    list-gates)
        echo "🚪 Listing gates..."
        track_command "list-gates"
        shift
        cd "$SCRIPT_DIR" && npx ts-node list-gates.ts "$@"
        ;;
        
    apply-template)
        echo "📋 Applying template..."
        track_command "apply-template"
        shift
        cd "$SCRIPT_DIR" && npx ts-node apply-template.ts "$@"
        ;;
        
    # Template Management
    list-templates)
        echo "📚 Listing templates..."
        track_command "list-templates"
        shift
        cd "$SCRIPT_DIR" && npx ts-node list-templates.ts "$@"
        ;;
        
    create-template)
        echo "✨ Creating template..."
        track_command "create-template"
        shift
        cd "$SCRIPT_DIR" && npx ts-node create-template.ts "$@"
        ;;
        
    # Analysis & Reports
    suggest)
        echo "💡 Suggesting criteria..."
        track_command "suggest"
        shift
        cd "$SCRIPT_DIR" && npx ts-node suggest-criteria.ts "$@"
        ;;
        
    coverage-report)
        echo "📊 Generating coverage report..."
        track_command "coverage-report"
        shift
        cd "$SCRIPT_DIR" && npx ts-node coverage-report.ts "$@"
        ;;
        
    element-hierarchy)
        echo "🏗️ Showing element hierarchy..."
        track_command "element-hierarchy"
        shift
        cd "$SCRIPT_DIR" && npx ts-node element-hierarchy.ts "$@"
        ;;
        
    # Data Population
    populate-sample)
        echo "🎯 Populating sample criteria..."
        track_command "populate-sample"
        shift
        cd "$SCRIPT_DIR" && npx ts-node populate-sample-criteria.ts "$@"
        ;;
        
    import-from-tasks)
        echo "📥 Importing from tasks..."
        track_command "import-from-tasks"
        shift
        cd "$SCRIPT_DIR" && npx ts-node import-from-tasks.ts "$@"
        ;;
        
    # Utility Commands
    health-check)
        echo "🏥 Running health check for element criteria pipeline..."
        track_command "health-check"
        if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
            echo "❌ Missing required environment variables"
            exit 1
        fi
        echo "✅ element_criteria pipeline is healthy"
        ;;
        
    # Help
    help|--help|-h|"")
        show_help
        ;;
        
    *)
        echo "❌ Unknown command: $1"
        echo "Run './element-criteria-cli.sh help' for usage information"
        exit 1
        ;;
esac