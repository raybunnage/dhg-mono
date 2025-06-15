#!/bin/bash

# Element Criteria CLI Pipeline - Refactored
# Manage success criteria and quality gates for elements

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="element_criteria"
PIPELINE_DESCRIPTION="Success criteria and quality gates management"
PIPELINE_VERSION="1.0.0"

# Load environment variables
ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [[ -f "$ENV_DEV_FILE" ]]; then
    echo "ℹ️  INFO [$PIPELINE_NAME] Loading environment variables from .env.development..."
    export $(grep -E "SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|CLAUDE_API_KEY" "$ENV_DEV_FILE" | grep -v '^#' | xargs)
fi

# Logging functions
log_info() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  INFO [$PIPELINE_NAME] $*"
}

log_error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ ERROR [$PIPELINE_NAME] $*" >&2
}

log_success() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ✅ SUCCESS [$PIPELINE_NAME] $*"
}

# Command tracking wrapper
track_command() {
    local command_name="$1"
    shift
    local full_command="$@"
    
    # Log command execution
    log_info "Executing: $command_name"
    
    # Try to use tracking service if available
    local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
    if [[ -f "$TRACKER_TS" ]]; then
        npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$PIPELINE_NAME" "$command_name" "$full_command" 2>&1
    else
        eval "$full_command"
    fi
}

# Execute TypeScript command
execute_ts_command() {
    local command_name="$1"
    local ts_file="$2"
    shift 2
    
    if [[ ! -f "$ts_file" ]]; then
        log_error "TypeScript implementation not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "cd '$SCRIPT_DIR' && npx ts-node '$ts_file' $@"
}

# Help command
cmd_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "🎯 Element Criteria CLI Pipeline"
    echo ""
    echo "Manage success criteria and quality gates for elements (app features, CLI commands, services)."
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "COMMANDS:"
    echo ""
    echo "CRITERIA MANAGEMENT:"
    echo "  add-criteria         Add success criteria to an element"
    echo "  add-gate            Add quality gate to an element"
    echo "  list-criteria       List criteria for an element"
    echo "  list-gates          List gates for an element"
    echo "  apply-template      Apply a criteria template to an element"
    echo ""
    echo "TEMPLATE MANAGEMENT:"
    echo "  list-templates      List available criteria templates"
    echo "  create-template     Create a new criteria template"
    echo ""
    echo "ANALYSIS & REPORTS:"
    echo "  suggest             Suggest criteria for an element"
    echo "  coverage-report     Show elements with/without criteria"
    echo "  element-hierarchy   Show app hierarchy with criteria counts"
    echo ""
    echo "DATA POPULATION:"
    echo "  populate-sample     Populate sample criteria for testing"
    echo "  import-from-tasks   Import existing task criteria to elements"
    echo ""
    echo "SYSTEM:"
    echo "  health-check        Run health check for pipeline"
    echo "  help                Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  # Add criteria to an app feature"
    echo "  $(basename "$0") add-criteria --type app_feature --id <uuid> --title \"Loads without errors\""
    echo ""
    echo "  # List all templates"
    echo "  $(basename "$0") list-templates"
    echo ""
    echo "  # Apply template to element"
    echo "  $(basename "$0") apply-template --template-id <uuid> --element-type app_feature --element-id <uuid>"
    echo ""
    echo "  # Generate coverage report"
    echo "  $(basename "$0") coverage-report --app dhg-hub"
    echo ""
    echo "  # Populate sample data"
    echo "  $(basename "$0") populate-sample --app dhg-admin-code"
}

# Command: health-check
cmd_health_check() {
    log_info "Running health check for $PIPELINE_NAME pipeline..."
    
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    log_success "$PIPELINE_NAME pipeline is healthy"
}

# Main command handler
main() {
    case "${1:-help}" in
        # Criteria Management
        add-criteria)
            echo "➕ Adding success criteria..."
            shift
            execute_ts_command "add-criteria" "$SCRIPT_DIR/add-criteria.ts" "$@"
            ;;
        add-gate)
            echo "🚪 Adding quality gate..."
            shift
            execute_ts_command "add-gate" "$SCRIPT_DIR/add-gate.ts" "$@"
            ;;
        list-criteria)
            echo "📋 Listing criteria..."
            shift
            execute_ts_command "list-criteria" "$SCRIPT_DIR/list-criteria.ts" "$@"
            ;;
        list-gates)
            echo "🚪 Listing gates..."
            shift
            execute_ts_command "list-gates" "$SCRIPT_DIR/list-gates.ts" "$@"
            ;;
        apply-template)
            echo "📋 Applying template..."
            shift
            execute_ts_command "apply-template" "$SCRIPT_DIR/apply-template.ts" "$@"
            ;;
            
        # Template Management
        list-templates)
            echo "📚 Listing templates..."
            shift
            execute_ts_command "list-templates" "$SCRIPT_DIR/list-templates.ts" "$@"
            ;;
        create-template)
            echo "✨ Creating template..."
            shift
            execute_ts_command "create-template" "$SCRIPT_DIR/create-template.ts" "$@"
            ;;
            
        # Analysis & Reports
        suggest)
            echo "💡 Suggesting criteria..."
            shift
            execute_ts_command "suggest" "$SCRIPT_DIR/suggest-criteria.ts" "$@"
            ;;
        coverage-report)
            echo "📊 Generating coverage report..."
            shift
            execute_ts_command "coverage-report" "$SCRIPT_DIR/coverage-report.ts" "$@"
            ;;
        element-hierarchy)
            echo "🏗️ Showing element hierarchy..."
            shift
            execute_ts_command "element-hierarchy" "$SCRIPT_DIR/element-hierarchy.ts" "$@"
            ;;
            
        # Data Population
        populate-sample)
            echo "🎯 Populating sample criteria..."
            shift
            execute_ts_command "populate-sample" "$SCRIPT_DIR/populate-sample-criteria.ts" "$@"
            ;;
        import-from-tasks)
            echo "📥 Importing from tasks..."
            shift
            execute_ts_command "import-from-tasks" "$SCRIPT_DIR/import-from-tasks.ts" "$@"
            ;;
            
        # System
        health-check)
            shift
            cmd_health_check "$@"
            ;;
            
        # Help
        help|--help|-h)
            cmd_help
            ;;
            
        # Unknown command
        *)
            log_error "Unknown command: $1"
            echo "Run '$(basename "$0") help' for usage information"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"