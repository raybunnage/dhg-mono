#!/usr/bin/env bash

# SimpleCLIPipeline.sh - For straightforward, single-purpose CLI tools
# Extends CLIPipelineBase with utilities for simple command execution

# Source the base class
source "$(dirname "${BASH_SOURCE[0]}")/CLIPipelineBase.sh"

# Simple pipeline specific functions

# Quick parameter validation for simple commands
validate_simple_params() {
    local required_params=("$@")
    local missing_params=()
    
    for param in "${required_params[@]}"; do
        if [[ -z "${!param}" ]]; then
            missing_params+=("$param")
        fi
    done
    
    if [[ ${#missing_params[@]} -gt 0 ]]; then
        log_error "Missing required parameters: ${missing_params[*]}"
        return 1
    fi
    
    return 0
}

# Execute a simple command with basic validation
execute_simple_command() {
    local command_name="$1"
    local description="$2"
    shift 2
    
    log_info "Executing simple command: $command_name"
    
    # Simple pre-execution validation
    if [[ $# -eq 0 ]]; then
        log_error "No command provided to execute"
        return 1
    fi
    
    # Execute with tracking
    track_and_execute "$command_name" "$description" "$@"
}

# Quick database query execution (using database service)
execute_db_query() {
    local query_name="$1"
    local query="$2"
    
    log_info "Executing database query: $query_name"
    
    # Check if database service is available
    if ! check_service_available "database-service"; then
        log_error "Database service not available"
        return 1
    fi
    
    # Execute via database service
    local db_service_path
    db_service_path=$(load_service "database-service")
    
    if [[ $? -eq 0 ]]; then
        track_and_execute "$query_name" "Database query: $query_name" \
            npx ts-node -e "
                import { DatabaseService } from '$db_service_path';
                const db = DatabaseService.getInstance();
                db.executeQuery('$query').then(console.log).catch(console.error);
            "
    else
        log_error "Failed to load database service"
        return 1
    fi
}

# Simple file operations
execute_file_operation() {
    local operation="$1"
    local file_path="$2"
    shift 2
    
    case "$operation" in
        "exists")
            if [[ -f "$file_path" ]]; then
                log_success "File exists: $file_path"
                return 0
            else
                log_error "File not found: $file_path"
                return 1
            fi
            ;;
        "size")
            if [[ -f "$file_path" ]]; then
                local size
                size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null)
                log_info "File size: $file_path = $size bytes"
                return 0
            else
                log_error "File not found: $file_path"
                return 1
            fi
            ;;
        "copy")
            local dest_path="$1"
            track_and_execute "copy_file" "Copy $file_path to $dest_path" \
                cp "$file_path" "$dest_path"
            ;;
        "move")
            local dest_path="$1"
            track_and_execute "move_file" "Move $file_path to $dest_path" \
                mv "$file_path" "$dest_path"
            ;;
        *)
            log_error "Unknown file operation: $operation"
            return 1
            ;;
    esac
}

# Generate usage examples for simple commands
show_simple_usage_examples() {
    echo "Examples:"
    echo "  $0 command1                    Execute command1"
    echo "  $0 command2 --param value      Execute command2 with parameter"
    echo "  $0 --debug command1            Execute command1 in debug mode"
    echo "  $0 --help                      Show this help message"
}

# Override the base show_help to include simple-specific info
show_help() {
    echo -e "${BLUE}$PIPELINE_DESCRIPTION${NC}"
    echo -e "${CYAN}(Simple CLI Pipeline)${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    
    # Auto-discover and show commands
    local commands
    commands=$(discover_commands)
    if [[ -n "$commands" ]]; then
        while IFS= read -r cmd; do
            echo "  $(printf "%-20s" "$cmd") Execute $cmd"
        done <<< "$commands"
    fi
    
    echo ""
    echo "Global Options:"
    echo "  --debug                Enable debug mode"
    echo "  --verbose              Enable verbose output"
    echo "  --help, -h             Show this help message"
    echo ""
    
    show_simple_usage_examples
    
    echo ""
    echo "Framework Info:"
    echo "  Type: Simple CLI Pipeline"
    echo "  Pipeline: $PIPELINE_NAME v$PIPELINE_VERSION"
    echo "  Base Class: CLIPipelineBase v$CLI_BASE_VERSION"
}

# Export simple pipeline functions
export -f validate_simple_params
export -f execute_simple_command  
export -f execute_db_query
export -f execute_file_operation
export -f show_simple_usage_examples