#!/usr/bin/env bash

# scripts-cli.sh - Migrated to CLI Pipeline Framework
# Comprehensive script management system

# Source the base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../base-classes/SimpleCLIPipeline.sh"

# Pipeline configuration
PIPELINE_NAME="scripts"
PIPELINE_DESCRIPTION="Comprehensive script management system"
PIPELINE_VERSION="2.0.0"

# Initialize pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Service setup
setup_service_integrations() {
    # Most services are handled by the TypeScript files
    # This function can be expanded when services are refactored
    log_debug "Service integrations ready"
}

# Initialize services
setup_service_integrations

# Command: sync - Full sync of all scripts with AI classification
command_sync() {
    local description="Full sync of all scripts with AI classification"
    
    track_and_execute "sync" "$description" \
        npx ts-node "$SCRIPT_DIR/sync-all-scripts.ts" "$@"
}

# Command: classify - Classify a single script file
command_classify() {
    local file="$1"
    local description="Classify a single script file"
    
    if [[ -z "$file" ]]; then
        log_error "File path required"
        echo "Usage: $0 classify <file>"
        return 1
    fi
    
    track_and_execute "classify" "$description" \
        npx ts-node "$SCRIPT_DIR/classify-script.ts" "$@"
}

# Command: list - List scripts with filtering options
command_list() {
    local description="List scripts with filtering options"
    
    track_and_execute "list" "$description" \
        npx ts-node "$SCRIPT_DIR/list-scripts.ts" "$@"
}

# Command: search - Search scripts by content or metadata
command_search() {
    local query="$1"
    local description="Search scripts by content or metadata"
    
    if [[ -z "$query" ]]; then
        log_error "Search query required"
        echo "Usage: $0 search <query>"
        return 1
    fi
    
    track_and_execute "search" "$description" \
        npx ts-node "$SCRIPT_DIR/search-scripts.ts" "$@"
}

# Command: archive - Move script to archive folder
command_archive() {
    local file="$1"
    local description="Move script to archive folder"
    
    if [[ -z "$file" ]]; then
        log_error "File path required"
        echo "Usage: $0 archive <file>"
        return 1
    fi
    
    track_and_execute "archive" "$description" \
        npx ts-node "$SCRIPT_DIR/archive-script.ts" "$@"
}

# Command: register - Manually register a new script
command_register() {
    local file="$1"
    local description="Manually register a new script"
    
    if [[ -z "$file" ]]; then
        log_error "File path required"
        echo "Usage: $0 register <file> [--tags 'tag1,tag2']"
        return 1
    fi
    
    track_and_execute "register" "$description" \
        npx ts-node "$SCRIPT_DIR/register-script.ts" "$@"
}

# Command: stats - Show script statistics and insights
command_stats() {
    local description="Show script statistics and insights"
    
    track_and_execute "stats" "$description" \
        npx ts-node "$SCRIPT_DIR/script-stats.ts" "$@"
}

# Command: health-check - Check if the scripts pipeline is working
command_health_check() {
    local description="Check if the scripts pipeline is working"
    
    log_info "🏥 Running health check for scripts pipeline..."
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_error "Missing required environment variables"
        return 1
    fi
    
    # Run basic health check
    track_and_execute "health_check" "$description" \
        bash -c "echo '✅ Scripts pipeline is healthy'"
}

# Override show_help to add command-specific details
show_help() {
    echo -e "${BLUE}Scripts CLI - Comprehensive script management system${NC}"
    echo ""
    echo "USAGE:"
    echo "  $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  (* = frequently used commands)"
    echo ""
    echo "SCRIPT MANAGEMENT:"
    echo "  * sync                    Full sync of all scripts with AI classification"
    echo "    classify <file>         Classify a single script file"
    echo "    list [options]          List scripts with filtering options"
    echo "      --pipeline <name>       Filter by CLI pipeline"
    echo "      --type <type>           Filter by document type"
    echo "      --recent <days>         Show recently modified"
    echo "      --archived              Include archived scripts"
    echo "    search <query>          Search scripts by content or metadata"
    echo "    archive <file>          Move script to archive folder"
    echo "    register <file>         Manually register a new script"
    echo "    stats                   Show script statistics and insights"
    echo ""
    echo "SYSTEM:"
    echo "    health-check            Check if the scripts pipeline is working"
    echo "    help                    Show this help message"
    echo ""
    echo "GLOBAL OPTIONS:"
    echo "    --debug                 Enable debug mode"
    echo "    --verbose               Enable verbose output"
    echo ""
    echo "EXAMPLES:"
    echo ""
    echo "SYNC & CLASSIFICATION:"
    echo "  # Sync all scripts with AI classification"
    echo "  $0 sync"
    echo ""
    echo "  # Classify a single script"
    echo "  $0 classify ./some-script.ts"
    echo ""
    echo "BROWSING & SEARCHING:"
    echo "  # List all scripts in google_sync pipeline"
    echo "  $0 list --pipeline google_sync"
    echo ""
    echo "  # Show scripts modified in last 7 days"
    echo "  $0 list --recent 7"
    echo ""
    echo "  # Search for scripts containing 'supabase'"
    echo "  $0 search supabase"
    echo ""
    echo "MANAGEMENT:"
    echo "  # Archive a legacy script"
    echo "  $0 archive ./old-script.sh"
    echo ""
    echo "  # Register a new script with tags"
    echo "  $0 register ./new-script.ts --tags 'backup,database'"
    echo ""
    echo "  # View comprehensive statistics"
    echo "  $0 stats"
}

# Main command routing
route_command "$@"