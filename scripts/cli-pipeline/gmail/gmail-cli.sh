#!/bin/bash

# Gmail CLI Pipeline
# This script provides a command-line interface for Gmail operations

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Source the ServiceCLIPipeline base class
source "$SCRIPT_DIR/../base-classes/ServiceCLIPipeline.sh"

# Define service-specific variables
PIPELINE_NAME="gmail"
PIPELINE_DESCRIPTION="Gmail CLI Pipeline - Email synchronization and management"
SERVICE_NAME="gmail-service"
SERVICE_CHECK_COMMAND="test-connection"

# Gmail-specific commands array
declare -a GMAIL_COMMANDS=(
    "sync-emails:Sync emails from Gmail"
    "process-emails:Process emails with AI"
    "manage-addresses:Manage important email addresses"
    "analyze-concepts:Analyze email concepts"
    "export-data:Export email data"
    "test-connection:Test database connection"
    "stats:Show email statistics"
    "import-sqlite:Import SQLite email data from CSV files"
    "status:Show pipeline status"
)

# Initialize the pipeline
init_service_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION"

# Command implementations
command_sync_emails() {
    local days=7
    local importance=""
    
    # Parse options
    for arg in "$@"; do
        case $arg in
            --days=*)
                days="${arg#*=}"
                ;;
            --importance=*)
                importance="${arg#*=}"
                ;;
        esac
    done
    
    print_info "Syncing emails from the last $days days..."
    
    # Check if TypeScript file exists
    if [ -f "$SCRIPT_DIR/sync-emails.ts" ]; then
        npx ts-node "$SCRIPT_DIR/sync-emails.ts" --days="$days" --importance="$importance"
    else
        print_warning "sync-emails.ts not found. Creating placeholder..."
        print_success "Email sync functionality will be implemented soon."
    fi
}

command_process_emails() {
    local limit=50
    
    # Parse options
    for arg in "$@"; do
        case $arg in
            --limit=*)
                limit="${arg#*=}"
                ;;
        esac
    done
    
    print_info "Processing up to $limit emails..."
    
    if [ -f "$SCRIPT_DIR/process-emails.ts" ]; then
        npx ts-node "$SCRIPT_DIR/process-emails.ts" --limit="$limit"
    else
        print_success "Email processing functionality will be implemented soon."
    fi
}

command_manage_addresses() {
    local action=$1
    shift || true
    
    case $action in
        add)
            local email=$1
            local importance=1
            shift || true
            
            for arg in "$@"; do
                case $arg in
                    --importance=*)
                        importance="${arg#*=}"
                        ;;
                esac
            done
            
            print_info "Adding email address: $email with importance level $importance"
            
            if [ -f "$SCRIPT_DIR/manage-addresses.ts" ]; then
                npx ts-node "$SCRIPT_DIR/manage-addresses.ts" add "$email" --importance="$importance"
            else
                print_success "Address management functionality will be implemented soon."
            fi
            ;;
        list)
            print_info "Listing important email addresses..."
            
            if [ -f "$SCRIPT_DIR/manage-addresses.ts" ]; then
                npx ts-node "$SCRIPT_DIR/manage-addresses.ts" list
            else
                print_success "Address listing functionality will be implemented soon."
            fi
            ;;
        remove)
            local email=$1
            print_info "Removing email address: $email"
            
            if [ -f "$SCRIPT_DIR/manage-addresses.ts" ]; then
                npx ts-node "$SCRIPT_DIR/manage-addresses.ts" remove "$email"
            else
                print_success "Address removal functionality will be implemented soon."
            fi
            ;;
        *)
            print_error "Unknown action: $action"
            echo "Usage: $0 manage-addresses [add|list|remove] [email] [options]"
            return 1
            ;;
    esac
}

command_analyze_concepts() {
    local from_date=""
    
    # Parse options
    for arg in "$@"; do
        case $arg in
            --from=*)
                from_date="${arg#*=}"
                ;;
        esac
    done
    
    print_info "Analyzing email concepts..."
    
    if [ -f "$SCRIPT_DIR/analyze-concepts.ts" ]; then
        npx ts-node "$SCRIPT_DIR/analyze-concepts.ts" --from="$from_date"
    else
        print_success "Concept analysis functionality will be implemented soon."
    fi
}

command_export_data() {
    local format="csv"
    local output="./exports/"
    
    # Parse options
    for arg in "$@"; do
        case $arg in
            --format=*)
                format="${arg#*=}"
                ;;
            --output=*)
                output="${arg#*=}"
                ;;
        esac
    done
    
    print_info "Exporting email data as $format to $output..."
    
    if [ -f "$SCRIPT_DIR/export-data.ts" ]; then
        npx ts-node "$SCRIPT_DIR/export-data.ts" --format="$format" --output="$output"
    else
        print_success "Export functionality will be implemented soon."
    fi
}

command_test_connection() {
    print_info "Testing database connection..."
    
    if [ -f "$SCRIPT_DIR/test-connection.ts" ]; then
        npx ts-node "$SCRIPT_DIR/test-connection.ts"
    else
        print_error "test-connection.ts not found."
    fi
}

command_stats() {
    print_info "Generating email statistics..."
    
    if [ -f "$SCRIPT_DIR/stats.ts" ]; then
        npx ts-node "$SCRIPT_DIR/stats.ts"
    else
        print_error "stats.ts not found."
    fi
}

command_import_sqlite() {
    print_info "Importing SQLite email data from CSV files..."
    
    if [ -f "$SCRIPT_DIR/import-sqlite-data-simple.js" ]; then
        node "$SCRIPT_DIR/import-sqlite-data-simple.js" "$@"
    else
        print_error "import-sqlite-data-simple.js not found."
    fi
}

command_status() {
    print_info "Gmail Pipeline Status"
    echo "===================="
    
    # Check if status script exists
    if [ -f "$SCRIPT_DIR/show-status.ts" ]; then
        npx ts-node "$SCRIPT_DIR/show-status.ts"
    else
        # Show basic status
        print_warning "Status functionality not yet implemented."
        echo ""
        echo "Available commands:"
        for cmd_desc in "${GMAIL_COMMANDS[@]}"; do
            IFS=':' read -r cmd desc <<< "$cmd_desc"
            echo "- $cmd: $desc"
        done
    fi
}

# Override show_help to add Gmail-specific options
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    for cmd_desc in "${GMAIL_COMMANDS[@]}"; do
        IFS=':' read -r cmd desc <<< "$cmd_desc"
        printf "  %-20s %s\n" "$cmd" "$desc"
    done
    
    # Add service commands
    echo ""
    echo "Service Commands:"
    printf "  %-20s %s\n" "service-status" "Check service health status"
    printf "  %-20s %s\n" "service-restart" "Restart the service"
    printf "  %-20s %s\n" "service-logs" "View service logs"
    printf "  %-20s %s\n" "health-check" "Run comprehensive health check"
    
    echo ""
    echo "Options:"
    echo "  --days=N           Number of days to sync (default: 7)"
    echo "  --limit=N          Limit number of items to process"
    echo "  --importance=N     Importance level filter (1-3)"
    echo "  --format=FORMAT    Export format (csv, json)"
    echo "  --output=PATH      Output directory for exports"
    echo ""
    echo "Examples:"
    echo "  $0 sync-emails --days=7"
    echo "  $0 process-emails --limit=50"
    echo "  $0 manage-addresses add 'email@example.com' --importance=2"
    echo "  $0 export-data --format=csv --output=./exports/"
}

# Main command routing
case "${1:-help}" in
    sync-emails)
        shift
        track_and_execute "sync-emails" command_sync_emails "$@"
        ;;
    process-emails)
        shift
        track_and_execute "process-emails" command_process_emails "$@"
        ;;
    manage-addresses)
        shift
        track_and_execute "manage-addresses" command_manage_addresses "$@"
        ;;
    analyze-concepts)
        shift
        track_and_execute "analyze-concepts" command_analyze_concepts "$@"
        ;;
    export-data)
        shift
        track_and_execute "export-data" command_export_data "$@"
        ;;
    test-connection)
        shift
        track_and_execute "test-connection" command_test_connection "$@"
        ;;
    stats)
        shift
        track_and_execute "stats" command_stats "$@"
        ;;
    import-sqlite)
        shift
        track_and_execute "import-sqlite" command_import_sqlite "$@"
        ;;
    status)
        shift
        track_and_execute "status" command_status "$@"
        ;;
    # Service management commands
    service-status)
        shift
        track_and_execute "service-status" health_check_service "${SERVICE_NAME:-$1}" "$@"
        ;;
    service-restart)
        shift
        track_and_execute "service-restart" restart_service "${SERVICE_NAME:-$1}" "$@"
        ;;
    service-logs)
        shift
        track_and_execute "service-logs" show_service_logs "${SERVICE_NAME:-$1}" "$@"
        ;;
    health-check)
        shift
        track_and_execute "health-check" health_check_all "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac