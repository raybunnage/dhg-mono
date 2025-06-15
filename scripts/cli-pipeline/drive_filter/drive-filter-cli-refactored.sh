#!/bin/bash

# Drive Filter Management CLI - Refactored
# Manages Google Drive filter profiles for selective synchronization

# Define the script and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Pipeline metadata
PIPELINE_NAME="drive_filter"
PIPELINE_DESCRIPTION="Google Drive filter profile management"
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
        log_error "Command implementation not found: $ts_file"
        return 1
    fi
    
    track_command "$command_name" "cd '$PROJECT_ROOT' && npx ts-node '$ts_file' $@"
}

# Help command
cmd_help() {
    echo "$PIPELINE_DESCRIPTION"
    echo "Version: $PIPELINE_VERSION"
    echo ""
    echo "Usage: $(basename "$0") COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  create-profile        Create a new filter profile"
    echo "    --name NAME         Profile name (required)"
    echo "    --description DESC  Profile description"
    echo "  update-profile        Update an existing filter profile"
    echo "    --id ID             Profile ID (required)"
    echo "    --name NAME         New profile name"
    echo "    --description DESC  New description"
    echo "  delete-profile        Delete a filter profile"
    echo "    --id ID             Profile ID (required)"
    echo "  list-profiles         List all filter profiles"
    echo "    --active-only       Show only active profiles"
    echo "  set-active-profile    Set a profile as active"
    echo "    --id ID             Profile ID (required)"
    echo "  get-active-profile    Get the currently active profile"
    echo "  add-drive             Add a drive to a profile's included list"
    echo "    --profile-id ID     Profile ID (required)"
    echo "    --drive-id ID       Drive ID to add (required)"
    echo "  remove-drive          Remove a drive from a profile's included list"
    echo "    --profile-id ID     Profile ID (required)"
    echo "    --drive-id ID       Drive ID to remove (required)"
    echo "  list-drives           List all drives included in a profile"
    echo "    --profile-id ID     Profile ID (required)"
    echo "  apply-migrations      Apply the database migrations for filters"
    echo "  health-check          Run a health check on the filter service"
    echo "    --verbose, -v       Show detailed output"
    echo "  help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $(basename "$0") create-profile --name \"Work Files\" --description \"Only work-related drives\""
    echo "  $(basename "$0") add-drive --profile-id 123 --drive-id abc456"
    echo "  $(basename "$0") list-profiles --active-only"
}

# Command: create-profile
cmd_create_profile() {
    execute_ts_command "create-profile" "$SCRIPT_DIR/commands/create-profile.ts" "$@"
}

# Command: update-profile
cmd_update_profile() {
    execute_ts_command "update-profile" "$SCRIPT_DIR/commands/update-profile.ts" "$@"
}

# Command: delete-profile
cmd_delete_profile() {
    execute_ts_command "delete-profile" "$SCRIPT_DIR/commands/delete-profile.ts" "$@"
}

# Command: list-profiles
cmd_list_profiles() {
    execute_ts_command "list-profiles" "$SCRIPT_DIR/commands/list-profiles.ts" "$@"
}

# Command: set-active-profile
cmd_set_active_profile() {
    execute_ts_command "set-active-profile" "$SCRIPT_DIR/commands/set-active-profile.ts" "$@"
}

# Command: get-active-profile
cmd_get_active_profile() {
    execute_ts_command "get-active-profile" "$SCRIPT_DIR/commands/get-active-profile.ts" "$@"
}

# Command: add-drive
cmd_add_drive() {
    execute_ts_command "add-drive" "$SCRIPT_DIR/commands/add-drive-to-profile.ts" "$@"
}

# Command: remove-drive
cmd_remove_drive() {
    execute_ts_command "remove-drive" "$SCRIPT_DIR/commands/remove-drive-from-profile.ts" "$@"
}

# Command: list-drives
cmd_list_drives() {
    execute_ts_command "list-drives" "$SCRIPT_DIR/commands/list-drives-in-profile.ts" "$@"
}

# Command: apply-migrations
cmd_apply_migrations() {
    execute_ts_command "apply-migrations" "$SCRIPT_DIR/commands/apply-migrations.ts" "$@"
}

# Command: health-check
cmd_health_check() {
    local verbose=false
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --verbose|-v)
                verbose=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    log_info "Running health check for $PIPELINE_NAME pipeline..."
    
    # Check environment variables
    if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
        log_error "Missing required environment variables"
        [[ "$verbose" == "true" ]] && echo "Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
        return 1
    fi
    
    # Check for command implementations
    local missing_commands=()
    for cmd_file in create-profile.ts update-profile.ts delete-profile.ts list-profiles.ts; do
        if [[ ! -f "$SCRIPT_DIR/commands/$cmd_file" ]]; then
            missing_commands+=("$cmd_file")
        fi
    done
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        log_error "Missing command implementations: ${missing_commands[*]}"
        return 1
    fi
    
    # Run TypeScript health check if available
    if [[ -f "$SCRIPT_DIR/commands/health-check.ts" ]]; then
        execute_ts_command "health-check" "$SCRIPT_DIR/commands/health-check.ts" "$@"
    else
        log_success "$PIPELINE_NAME pipeline is healthy"
    fi
}

# Main command handler
main() {
    case "${1:-help}" in
        create-profile)
            shift
            cmd_create_profile "$@"
            ;;
        update-profile)
            shift
            cmd_update_profile "$@"
            ;;
        delete-profile)
            shift
            cmd_delete_profile "$@"
            ;;
        list-profiles)
            shift
            cmd_list_profiles "$@"
            ;;
        set-active-profile)
            shift
            cmd_set_active_profile "$@"
            ;;
        get-active-profile)
            shift
            cmd_get_active_profile "$@"
            ;;
        add-drive)
            shift
            cmd_add_drive "$@"
            ;;
        remove-drive)
            shift
            cmd_remove_drive "$@"
            ;;
        list-drives)
            shift
            cmd_list_drives "$@"
            ;;
        apply-migrations)
            shift
            cmd_apply_migrations "$@"
            ;;
        health-check)
            shift
            cmd_health_check "$@"
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            log_error "Unknown command: $1"
            cmd_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"