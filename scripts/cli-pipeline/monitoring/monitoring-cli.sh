#!/bin/bash

# Monitoring CLI - Continuous monitoring for DHG monorepo folders
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
init_cli_pipeline "monitoring" "DHG Monitoring CLI - Continuous folder monitoring"

# Function to ensure dependencies are installed
ensure_deps() {
    if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
        log_info "Installing monitoring dependencies..."
        cd "$SCRIPT_DIR" && npm install
    fi
}

# Function to run folder monitor with fallback
run_folder_monitor() {
    local command="$1"
    shift
    
    local monitor_script="$SCRIPT_DIR/folder-monitor.ts"
    if [[ -f "$monitor_script" ]]; then
        ensure_deps
        cd "$SCRIPT_DIR" && npx tsx folder-monitor.ts "$command" "$@"
    else
        log_warn "folder-monitor.ts not found"
        log_info "Fallback: Basic $command operation"
        case "$command" in
            scan)
                local folder="$1"
                log_info "Would scan folder: $folder"
                if [[ -d "$PROJECT_ROOT/$folder" ]]; then
                    log_success "Folder exists: $PROJECT_ROOT/$folder"
                    find "$PROJECT_ROOT/$folder" -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | wc -l | xargs echo "Files found:"
                else
                    log_error "Folder not found: $folder"
                fi
                ;;
            watch)
                log_info "Watch mode would monitor: $1"
                ;;
            history|trends)
                log_info "$command would show historical data for: $1"
                ;;
        esac
    fi
}

# Define commands

command_help() {
    show_help
}

command_scan() {
    local folder="$1"
    
    if [[ -z "$folder" ]]; then
        log_error "Folder path required"
        echo "Usage: ./monitoring-cli.sh scan <folder>"
        return 1
    fi
    
    log_info "Scanning folder: $folder"
    run_folder_monitor "scan" "$@"
}

command_watch() {
    local folder="$1"
    
    if [[ -z "$folder" ]]; then
        log_error "Folder path required"
        echo "Usage: ./monitoring-cli.sh watch <folder> [--interval seconds]"
        return 1
    fi
    
    log_info "Watching folder: $folder"
    run_folder_monitor "watch" "$@"
}

command_quick() {
    local folder="$1"
    
    if [[ -z "$folder" ]]; then
        log_error "Folder path required"
        echo "Usage: ./monitoring-cli.sh quick <folder>"
        return 1
    fi
    
    log_info "Quick scan of $folder (last 24 hours)..."
    run_folder_monitor "scan" "$folder" --since 1d
}

command_report() {
    local folder="$1"
    
    if [[ -z "$folder" ]]; then
        log_error "Folder path required"
        echo "Usage: ./monitoring-cli.sh report <folder>"
        return 1
    fi
    
    log_info "Generating detailed report for $folder..."
    run_folder_monitor "scan" "$folder" --save
}

command_history() {
    local folder="$1"
    
    if [[ -z "$folder" ]]; then
        log_error "Folder path required"
        echo "Usage: ./monitoring-cli.sh history <folder> [--days N]"
        return 1
    fi
    
    log_info "Showing monitoring history for: $folder"
    run_folder_monitor "history" "$@"
}

command_trends() {
    local folder="$1"
    
    if [[ -z "$folder" ]]; then
        log_error "Folder path required"
        echo "Usage: ./monitoring-cli.sh trends <folder>"
        return 1
    fi
    
    log_info "Showing monitoring trends for: $folder"
    run_folder_monitor "trends" "$@"
}

command_health() {
    log_info "Running health checks..."
    
    # Run existing health check from maintenance pipeline
    local maintenance_script="$PROJECT_ROOT/scripts/cli-pipeline/maintenance-cli.sh"
    if [[ -f "$maintenance_script" ]]; then
        "$maintenance_script" health-check
    else
        log_warn "maintenance-cli.sh not found"
        log_info "Basic health check:"
        log_success "Monitoring CLI is functional"
    fi
}

command_health-check() {
    log_info "Running monitoring pipeline health check..."
    
    local health_check_script="$SCRIPT_DIR/health-check.sh"
    if [[ -f "$health_check_script" ]]; then
        bash "$health_check_script"
    else
        log_warn "health-check.sh not found"
        log_info "Basic pipeline health check:"
        if [[ -f "$SCRIPT_DIR/folder-monitor.ts" ]]; then
            log_success "folder-monitor.ts exists"
        else
            log_error "folder-monitor.ts missing"
        fi
        if [[ -f "$SCRIPT_DIR/package.json" ]]; then
            log_success "package.json exists"
        else
            log_error "package.json missing"
        fi
    fi
}

# Override help to add monitoring-specific examples
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    log_success "Continuous monitoring for monorepo folders"
    echo ""
    echo "USAGE:"
    echo "  ./monitoring-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  scan <folder>          Scan a folder for insights"
    echo "  watch <folder>         Continuously monitor a folder"
    echo "  quick <folder>         Quick scan (last 24h)"
    echo "  report <folder>        Generate detailed report with DB save"
    echo "  history <folder>       Show historical monitoring data"
    echo "  trends <folder>        Show monitoring trends over time"
    echo "  health                 Run health checks"
    echo "  health-check           Run health check for monitoring pipeline"
    echo "  help                   Show this help message"
    echo ""
    echo "OPTIONS:"
    echo "  --since <time>         Time filter (e.g., 1d, 1w, 1m)"
    echo "  --interval <seconds>   Watch interval for continuous monitoring"
    echo "  --save                 Save results to database"
    echo "  --days <N>             Number of days for history"
    echo ""
    echo "EXAMPLES:"
    echo "  ./monitoring-cli.sh scan apps/dhg-improve-experts"
    echo "  ./monitoring-cli.sh watch packages/shared/services --interval 15"
    echo "  ./monitoring-cli.sh quick apps/dhg-hub"
    echo "  ./monitoring-cli.sh history apps/dhg-hub --days 30"
    echo "  ./monitoring-cli.sh trends packages/shared/services"
}

# Main execution
route_command "$@"