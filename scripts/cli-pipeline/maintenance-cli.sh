#!/bin/bash

# Maintenance CLI for checking and maintaining code quality
# Refactored to use SimpleCLIPipeline base class

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source the base class
source "$SCRIPT_DIR/base-classes/SimpleCLIPipeline.sh" || {
    echo "Error: Failed to source SimpleCLIPipeline.sh from $SCRIPT_DIR/base-classes/"
    exit 1
}

# Initialize with pipeline name
init_cli_pipeline "maintenance" "DHG Maintenance CLI"

# Define commands

# Help command  
command_help() {
    show_help
}

command_health-check() {
    local verbose=false
    
    # Parse options
    for arg in "$@"; do
        case $arg in
            --verbose)
                verbose=true
                shift
                ;;
        esac
    done
    
    log_info "Running health check on CLI pipeline code..."
    
    # Check if health-check-services.js exists
    local health_check_script="$SCRIPT_DIR/health-check-services.js"
    if [[ -f "$health_check_script" ]]; then
        if $verbose; then
            node "$health_check_script" --verbose
        else
            node "$health_check_script"
        fi
    else
        log_warn "health-check-services.js not found at $health_check_script"
        # Fallback to basic health check
        log_info "Running basic health check"
        if [[ -d "$PROJECT_ROOT/packages/shared/services" ]]; then
            log_success "Shared services directory exists"
        else
            log_error "Shared services directory not found"
        fi
    fi
}

command_singleton-usage() {
    local verbose=false
    
    # Parse options  
    for arg in "$@"; do
        case $arg in
            --verbose)
                verbose=true
                shift
                ;;
        esac
    done
    
    log_info "Checking for correct singleton service usage..."
    
    # Use the same health-check-services.js script
    local health_check_script="$SCRIPT_DIR/health-check-services.js"
    if [[ -f "$health_check_script" ]]; then
        if $verbose; then
            node "$health_check_script" --verbose
        else
            node "$health_check_script"
        fi
    else
        log_warn "health-check-services.js not found"
        # Fallback implementation
        log_info "Checking for direct createClient usage..."
        if grep -r "createClient(" "$PROJECT_ROOT/packages/shared/services" 2>/dev/null | grep -v "SupabaseClientService"; then
            log_error "Found direct createClient usage in shared services"
        else
            log_success "No direct createClient usage found"
        fi
    fi
}

command_check-google-sync() {
    log_info "Checking Google Drive sync implementation..."
    
    local check_script="$SCRIPT_DIR/check-google-sync.ts"
    if [[ -f "$check_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$check_script" "$@"
    else
        log_warn "check-google-sync.ts not found"
        log_info "Fallback: Checking for GoogleDriveService usage..."
        if grep -r "GoogleDriveService" "$PROJECT_ROOT/packages/shared/services" 2>/dev/null; then
            log_success "GoogleDriveService found in shared services"
        else
            log_warn "GoogleDriveService not found"
        fi
    fi
}

command_check-find-folder() {
    log_info "Checking find-folder implementation..."
    
    local check_script="$SCRIPT_DIR/check-find-folder.ts"
    if [[ -f "$check_script" ]]; then
        cd "$PROJECT_ROOT" && npx ts-node "$check_script" "$@"
    else
        log_warn "check-find-folder.ts not found"
        log_info "Fallback: Checking for folder search implementations..."
        if grep -r "findFolder\|find-folder" "$PROJECT_ROOT/packages/shared/services" 2>/dev/null; then
            log_success "Folder search implementation found"
        else
            log_warn "No folder search implementation found"
        fi
    fi
}

# Override the help function to add examples
show_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo ""
    echo "USAGE:"
    echo "  ./maintenance-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  (* = frequently used commands based on usage statistics)"
    echo ""
    echo "MAINTENANCE:"
    echo "  * health-check        Run a health check on the CLI pipeline code (10 uses)"
    echo "    singleton-usage     Check for correct usage of singleton services"
    echo "    check-google-sync   Check sync-and-update-metadata implementation"
    echo "    check-find-folder   Check find-folder implementation"
    echo ""
    echo "SYSTEM:"
    echo "    help                Show this help message"
    echo ""
    echo "OPTIONS:"
    echo "  --verbose           Show more detailed output"
    echo ""
    echo "EXAMPLES:"
    echo ""
    echo "MAINTENANCE:"
    echo "  # Run a health check on the CLI pipeline code"
    echo "  ./maintenance-cli.sh health-check"
    echo ""
    echo "  # Check for correct usage of singleton services"
    echo "  ./maintenance-cli.sh singleton-usage --verbose"
}

# Main execution
route_command "$@"