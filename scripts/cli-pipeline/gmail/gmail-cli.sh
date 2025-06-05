#!/bin/bash

# Gmail CLI Pipeline
# This script provides a command-line interface for Gmail operations

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Source common functions if available
if [ -f "$PROJECT_ROOT/scripts/cli-pipeline/common/functions.sh" ]; then
    source "$PROJECT_ROOT/scripts/cli-pipeline/common/functions.sh"
fi

# Function to track command usage
track_command() {
    local command_name=$1
    local options=$2
    
    # Run the tracking script if it exists
    if [ -f "$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/track-command.ts" ]; then
        npx ts-node "$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/track-command.ts" \
            --pipeline="gmail" \
            --command="$command_name" \
            --options="$options" \
            2>/dev/null || true
    fi
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to show help
show_help() {
    echo "Gmail CLI Pipeline"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  sync-emails         Sync emails from Gmail"
    echo "  process-emails      Process emails with AI"
    echo "  manage-addresses    Manage important email addresses"
    echo "  analyze-concepts    Analyze email concepts"
    echo "  export-data        Export email data"
    echo "  test-connection    Test database connection"
    echo "  stats              Show email statistics"
    echo "  import-sqlite      Import SQLite email data from CSV files"
    echo "  status             Show pipeline status"
    echo "  help               Show this help message"
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

# Function to check dependencies
check_dependencies() {
    local missing_deps=()
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    # Check for Python
    if ! command -v python3 &> /dev/null; then
        missing_deps+=("python3")
    fi
    
    # Check for ts-node
    if ! command -v npx &> /dev/null; then
        missing_deps+=("npx")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_color "$RED" "Error: Missing dependencies: ${missing_deps[*]}"
        print_color "$YELLOW" "Please install the missing dependencies and try again."
        exit 1
    fi
}

# Function to sync emails
sync_emails() {
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
    
    print_color "$BLUE" "Syncing emails from the last $days days..."
    track_command "sync-emails" "--days=$days --importance=$importance"
    
    # Check if TypeScript file exists
    if [ -f "$SCRIPT_DIR/sync-emails.ts" ]; then
        npx ts-node "$SCRIPT_DIR/sync-emails.ts" --days="$days" --importance="$importance"
    else
        print_color "$YELLOW" "sync-emails.ts not found. Creating placeholder..."
        # For now, just show a message
        print_color "$GREEN" "Email sync functionality will be implemented soon."
    fi
}

# Function to process emails
process_emails() {
    local limit=50
    
    # Parse options
    for arg in "$@"; do
        case $arg in
            --limit=*)
                limit="${arg#*=}"
                ;;
        esac
    done
    
    print_color "$BLUE" "Processing up to $limit emails..."
    track_command "process-emails" "--limit=$limit"
    
    if [ -f "$SCRIPT_DIR/process-emails.ts" ]; then
        npx ts-node "$SCRIPT_DIR/process-emails.ts" --limit="$limit"
    else
        print_color "$GREEN" "Email processing functionality will be implemented soon."
    fi
}

# Function to manage addresses
manage_addresses() {
    local action=$1
    shift
    
    track_command "manage-addresses" "$action $*"
    
    case $action in
        add)
            local email=$1
            local importance=1
            shift
            
            for arg in "$@"; do
                case $arg in
                    --importance=*)
                        importance="${arg#*=}"
                        ;;
                esac
            done
            
            print_color "$BLUE" "Adding email address: $email with importance level $importance"
            
            if [ -f "$SCRIPT_DIR/manage-addresses.ts" ]; then
                npx ts-node "$SCRIPT_DIR/manage-addresses.ts" add "$email" --importance="$importance"
            else
                print_color "$GREEN" "Address management functionality will be implemented soon."
            fi
            ;;
        list)
            print_color "$BLUE" "Listing important email addresses..."
            
            if [ -f "$SCRIPT_DIR/manage-addresses.ts" ]; then
                npx ts-node "$SCRIPT_DIR/manage-addresses.ts" list
            else
                print_color "$GREEN" "Address listing functionality will be implemented soon."
            fi
            ;;
        remove)
            local email=$1
            print_color "$BLUE" "Removing email address: $email"
            
            if [ -f "$SCRIPT_DIR/manage-addresses.ts" ]; then
                npx ts-node "$SCRIPT_DIR/manage-addresses.ts" remove "$email"
            else
                print_color "$GREEN" "Address removal functionality will be implemented soon."
            fi
            ;;
        *)
            print_color "$RED" "Unknown action: $action"
            echo "Usage: $0 manage-addresses [add|list|remove] [email] [options]"
            exit 1
            ;;
    esac
}

# Function to analyze concepts
analyze_concepts() {
    local from_date=""
    
    # Parse options
    for arg in "$@"; do
        case $arg in
            --from=*)
                from_date="${arg#*=}"
                ;;
        esac
    done
    
    print_color "$BLUE" "Analyzing email concepts..."
    track_command "analyze-concepts" "--from=$from_date"
    
    if [ -f "$SCRIPT_DIR/analyze-concepts.ts" ]; then
        npx ts-node "$SCRIPT_DIR/analyze-concepts.ts" --from="$from_date"
    else
        print_color "$GREEN" "Concept analysis functionality will be implemented soon."
    fi
}

# Function to export data
export_data() {
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
    
    print_color "$BLUE" "Exporting email data as $format to $output..."
    track_command "export-data" "--format=$format --output=$output"
    
    if [ -f "$SCRIPT_DIR/export-data.ts" ]; then
        npx ts-node "$SCRIPT_DIR/export-data.ts" --format="$format" --output="$output"
    else
        print_color "$GREEN" "Export functionality will be implemented soon."
    fi
}

# Function to test connection
test_connection() {
    print_color "$BLUE" "Testing database connection..."
    track_command "test-connection" ""
    
    if [ -f "$SCRIPT_DIR/test-connection.ts" ]; then
        npx ts-node "$SCRIPT_DIR/test-connection.ts"
    else
        print_color "$RED" "test-connection.ts not found."
    fi
}

# Function to show stats
show_stats() {
    print_color "$BLUE" "Generating email statistics..."
    track_command "stats" ""
    
    if [ -f "$SCRIPT_DIR/stats.ts" ]; then
        npx ts-node "$SCRIPT_DIR/stats.ts"
    else
        print_color "$RED" "stats.ts not found."
    fi
}

# Function to import SQLite data
import_sqlite() {
    print_color "$BLUE" "Importing SQLite email data from CSV files..."
    track_command "import-sqlite" "$*"
    
    if [ -f "$SCRIPT_DIR/import-sqlite-data-simple.js" ]; then
        node "$SCRIPT_DIR/import-sqlite-data-simple.js" "$@"
    else
        print_color "$RED" "import-sqlite-data-simple.js not found."
    fi
}

# Function to show status
show_status() {
    print_color "$BLUE" "Gmail Pipeline Status"
    echo "===================="
    
    track_command "status" ""
    
    # Check if status script exists
    if [ -f "$SCRIPT_DIR/show-status.ts" ]; then
        npx ts-node "$SCRIPT_DIR/show-status.ts"
    else
        # Show basic status
        print_color "$YELLOW" "Status functionality not yet implemented."
        echo ""
        echo "Available commands:"
        echo "- sync-emails"
        echo "- process-emails"
        echo "- manage-addresses"
        echo "- analyze-concepts"
        echo "- export-data"
        echo "- test-connection"
        echo "- stats"
    fi
}

# Main command handler
main() {
    # Check dependencies first
    check_dependencies
    
    # Get the command
    local command=${1:-help}
    shift || true
    
    # Handle the command
    case $command in
        sync-emails)
            sync_emails "$@"
            ;;
        process-emails)
            process_emails "$@"
            ;;
        manage-addresses)
            manage_addresses "$@"
            ;;
        analyze-concepts)
            analyze_concepts "$@"
            ;;
        export-data)
            export_data "$@"
            ;;
        test-connection)
            test_connection "$@"
            ;;
        stats)
            show_stats "$@"
            ;;
        import-sqlite)
            import_sqlite "$@"
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_color "$RED" "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run the main function
main "$@"