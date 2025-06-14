#!/bin/bash

# All Pipelines CLI - Master CLI for running health checks across all pipelines
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
init_cli_pipeline "all_pipelines" "All Pipelines CLI - Master CLI for pipeline health checks and management"

# Function to run all-pipelines commands with fallback
run_all_pipelines_command() {
    local command_type="$1"
    local script_name="$2"
    shift 2
    
    case "$command_type" in
        "shell")
            local script_path="$SCRIPT_DIR/$script_name"
            if [[ -f "$script_path" ]]; then
                bash "$script_path" "$@"
            else
                log_warn "$script_name not found"
                log_info "Fallback: Basic ${script_name%.sh} operation"
                case "$script_name" in
                    "run-all-health-checks.sh")
                        log_info "Would run health checks across all CLI pipelines"
                        echo "  - Would check each pipeline in scripts/cli-pipeline/"
                        ;;
                    "clear-all-caches.sh"|"clear-app-cache.sh"|"dev-fresh.sh"|"nuclear-clean.sh"|"app-reinstall.sh")
                        log_info "Would perform cache/dependency management operation"
                        ;;
                esac
            fi
            ;;
        "typescript")
            local script_path="$SCRIPT_DIR/$script_name"
            if [[ -f "$script_path" ]]; then
                cd "$PROJECT_ROOT" && npx ts-node "$script_path" "$@"
            else
                log_warn "$script_name not found"
                log_info "Fallback: Basic ${script_name%.ts} operation"
                case "$script_name" in
                    "cli.ts")
                        log_info "Would run all-pipelines TypeScript CLI operation"
                        ;;
                    "check-deprecated-commands.ts"|"update-deprecated-to-archive.ts")
                        log_info "Would manage deprecated command status"
                        ;;
                    "populate-command-registry.ts"|"populate-pipeline-tables.ts"|"sync-command-status.ts")
                        log_info "Would populate/sync pipeline registry data"
                        ;;
                esac
            fi
            ;;
    esac
}

# Define commands

command_help() {
    show_help
}

# MONITORING COMMANDS
command_master-health-check() {
    log_info "Running health checks for all pipelines..."
    run_all_pipelines_command "shell" "run-all-health-checks.sh" "$@"
}

# REPORTING COMMANDS
command_usage-report() {
    log_info "Generating CLI command usage report..."
    run_all_pipelines_command "typescript" "cli.ts" "usage-report" "$@"
}

command_classification-rollup() {
    log_info "Generating subject classification rollup report..."
    run_all_pipelines_command "typescript" "cli.ts" "classification-rollup" "$@"
}

# CACHE MANAGEMENT COMMANDS
command_clear-cache() {
    log_info "Clearing caches via TypeScript (limited functionality)..."
    run_all_pipelines_command "typescript" "cli.ts" "clear-cache" "$@"
}

command_quick-restart() {
    log_info "Quick restart - kills Vite and clears Vite cache only..."
    run_all_pipelines_command "typescript" "cli.ts" "quick-restart" "$@"
}

command_clear-all-caches() {
    log_info "Clearing ALL caches comprehensively (Vite, dist, build, etc.)..."
    run_all_pipelines_command "shell" "clear-all-caches.sh" "$@"
}

command_clear-app-cache() {
    local app_name="$1"
    
    if [[ -z "$app_name" ]]; then
        log_error "App name required"
        echo "Usage: ./all-pipelines-cli.sh clear-app-cache <app>"
        echo "Example: ./all-pipelines-cli.sh clear-app-cache dhg-audio"
        return 1
    fi
    
    log_info "Clearing cache for app: $app_name"
    run_all_pipelines_command "shell" "clear-app-cache.sh" "$@"
}

command_dev-fresh() {
    local app_name="$1"
    
    if [[ -z "$app_name" ]]; then
        log_error "App name required"
        echo "Usage: ./all-pipelines-cli.sh dev-fresh <app>"
        echo "Example: ./all-pipelines-cli.sh dev-fresh dhg-hub"
        return 1
    fi
    
    log_info "Clearing cache and starting fresh dev server for: $app_name"
    run_all_pipelines_command "shell" "dev-fresh.sh" "$@"
}

command_app-reinstall() {
    local app_name="$1"
    
    if [[ -z "$app_name" ]]; then
        log_error "App name required"
        echo "Usage: ./all-pipelines-cli.sh app-reinstall <app>"
        echo "Example: ./all-pipelines-cli.sh app-reinstall dhg-admin-code"
        return 1
    fi
    
    log_info "Reinstalling node_modules for app: $app_name"
    run_all_pipelines_command "shell" "app-reinstall.sh" "$@"
}

command_nuclear-clean() {
    local target="$1"
    
    if [[ -z "$target" ]]; then
        log_error "Target required (app name or 'all')"
        echo "Usage: ./all-pipelines-cli.sh nuclear-clean <app|all>"
        echo "Example: ./all-pipelines-cli.sh nuclear-clean dhg-admin-code"
        echo "Example: ./all-pipelines-cli.sh nuclear-clean all"
        return 1
    fi
    
    log_warn "NUCLEAR option - removes ALL caches and node_modules for: $target"
    run_all_pipelines_command "shell" "nuclear-clean.sh" "$@"
}

# SYSTEM COMMANDS
command_check-deprecated-commands() {
    log_info "Checking deprecated commands that should be archived..."
    run_all_pipelines_command "typescript" "check-deprecated-commands.ts" "$@"
}

command_update-deprecated-to-archive() {
    log_info "Updating all deprecated commands to archived status..."
    run_all_pipelines_command "typescript" "update-deprecated-to-archive.ts" "$@"
}

command_populate-command-registry() {
    log_info "Scanning all pipelines and populating command registry..."
    run_all_pipelines_command "typescript" "populate-command-registry.ts" "$@"
}

command_populate-pipeline-tables() {
    log_info "Populating database table usage for each pipeline..."
    run_all_pipelines_command "typescript" "populate-pipeline-tables.ts" "$@"
}

command_sync-command-status() {
    log_info "Syncing command status by scanning CLI files..."
    run_all_pipelines_command "typescript" "sync-command-status.ts" "$@"
}

# Override help to add comprehensive all-pipelines examples
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "USAGE:"
    echo "  ./all-pipelines-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  (* = frequently used commands based on usage statistics)"
    echo ""
    echo "MONITORING:"
    echo "  * master-health-check       Run health checks for all pipelines and report status (25 uses)"
    echo ""
    echo "REPORTING:"
    echo "  * usage-report              Generate a markdown report of CLI command usage (6 uses)"
    echo "  * classification-rollup     Generate a rollup report of subject classifications (8 uses)"
    echo ""
    echo "CACHE MANAGEMENT:"
    echo "  * clear-cache               Clear caches via TypeScript (limited functionality)"
    echo "  * clear-all-caches          Clear ALL caches comprehensively (Vite, dist, build, etc.)"
    echo "  * clear-app-cache <app>     Clear cache for a specific app (e.g., dhg-audio)"
    echo "  * dev-fresh <app>           Clear cache and start fresh dev server for an app"
    echo "    quick-restart             Quick restart - kills Vite and clears Vite cache only"
    echo "  * app-reinstall <app>       Reinstall node_modules for a specific app only (targeted fix)"
    echo "    nuclear-clean <app|all>   NUCLEAR option - removes ALL caches and node_modules, forces reinstall"
    echo ""
    echo "SYSTEM:"
    echo "    check-deprecated-commands Check deprecated commands that should be archived"
    echo "    update-deprecated-to-archive Update all deprecated commands to archived status"
    echo "    populate-command-registry Scan all pipelines and populate command registry"
    echo "    populate-pipeline-tables  Populate database table usage for each pipeline"
    echo "  * sync-command-status       Sync command status by scanning CLI files for active/deprecated commands"
    echo "    help                      Show this help message"
    echo ""
    echo "COMMON OPTIONS:"
    echo ""
    echo "  For master-health-check:"
    echo "    --verbose                 Display detailed output from each health check"
    echo "    --include <pipelines>     Comma-separated list of pipelines to include"
    echo ""
    echo "  For usage-report:"
    echo "    --days <number>           Number of days to look back (default: 30)"
    echo "    --output <path>           Custom output file path"
    echo ""
    echo "  For classification-rollup:"
    echo "    --min-count <number>      Minimum count to include in report (default: 1)"
    echo "    --format <format>         Output format: markdown or json (default: markdown)"
    echo ""
    echo "  For clear-cache:"
    echo "    --verbose                 Show detailed output during cleanup"
    echo "    --skip-browser            Skip browser cache clearing instructions"
    echo "    --nuclear                 Remove all node_modules (requires full reinstall)"
    echo ""
    echo "  For quick-restart:"
    echo "    --app <name>              App name to restart (e.g., dhg-admin-explore)"
    echo ""
    echo "EXAMPLES:"
    echo ""
    echo "MONITORING:"
    echo "  # Run health checks for all pipelines"
    echo "  ./all-pipelines-cli.sh master-health-check"
    echo ""
    echo "  # Run health checks for specific pipelines"
    echo "  ./all-pipelines-cli.sh master-health-check --include google_sync,document"
    echo ""
    echo "REPORTING:"
    echo "  # Generate a CLI usage report"
    echo "  ./all-pipelines-cli.sh usage-report"
    echo ""
    echo "  # Generate a classification rollup report"
    echo "  ./all-pipelines-cli.sh classification-rollup"
    echo ""
    echo "CACHE MANAGEMENT:"
    echo "  # Clear all caches across the entire monorepo"
    echo "  ./all-pipelines-cli.sh clear-all-caches"
    echo ""
    echo "  # Clear cache for a specific app"
    echo "  ./all-pipelines-cli.sh clear-app-cache dhg-audio"
    echo ""
    echo "  # Clear cache and start fresh dev server"
    echo "  ./all-pipelines-cli.sh dev-fresh dhg-hub"
    echo ""
    echo "  # Reinstall node_modules for just one app (keeps root and other apps intact)"
    echo "  ./all-pipelines-cli.sh app-reinstall dhg-admin-code"
    echo ""
    echo "  # Nuclear clean for a specific app (removes all caches and node_modules)"
    echo "  ./all-pipelines-cli.sh nuclear-clean dhg-admin-code"
    echo ""
    echo "  # Nuclear clean for entire monorepo"
    echo "  ./all-pipelines-cli.sh nuclear-clean all"
}

# Main execution
route_command "$@"