#!/usr/bin/env bash

# auth-cli.sh - Migrated to CLI Pipeline Framework
# DHG Authentication CLI - authentication management

# Source the base class
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../base-classes/ServiceCLIPipeline.sh"

# Pipeline configuration
PIPELINE_NAME="auth"
PIPELINE_DESCRIPTION="DHG Authentication CLI - authentication management"
PIPELINE_VERSION="2.0.0"

# Initialize pipeline
init_cli_pipeline "$PIPELINE_NAME" "$PIPELINE_DESCRIPTION" "$@"

# Service setup
setup_service_integrations() {
    # Check for auth service
    if check_service_available "auth-service"; then
        log_success "Auth service available"
    else
        log_warn "Auth service not available - using direct implementation"
    fi
}

# Initialize services
setup_service_integrations

# Command: login - Login with email and password
command_login() {
    local description="Login with email and password"
    
    log_info "🔐 DHG Authentication - Login"
    echo ""
    
    # Get email
    local email="${EMAIL:-}"
    if [[ -z "$email" ]]; then
        read -p "Email: " email
    fi
    
    # Get password (hidden input)
    local password="${PASSWORD:-}"
    if [[ -z "$password" ]]; then
        read -s -p "Password: " password
        echo ""
    fi
    
    # Run login command
    track_and_execute "login" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" login --email "$email" --password "$password"
}

# Command: logout - Logout current session
command_logout() {
    local description="Logout current session"
    
    log_info "🔐 DHG Authentication - Logout"
    
    track_and_execute "logout" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" logout
}

# Command: whoami - Show current authenticated user
command_whoami() {
    local description="Show current authenticated user"
    
    log_info "🔐 DHG Authentication - Current User"
    
    local api_key_arg=""
    if [[ -n "${API_KEY:-}" ]]; then
        api_key_arg="--api-key \"$API_KEY\""
    fi
    
    track_and_execute "whoami" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" whoami $api_key_arg
}

# Command: token - Token management (subcommands)
command_token() {
    local subcommand="$1"
    shift
    
    case "$subcommand" in
        create)
            command_token_create "$@"
            ;;
        list)
            command_token_list "$@"
            ;;
        revoke)
            command_token_revoke "$@"
            ;;
        *)
            log_error "Unknown token subcommand: $subcommand"
            echo "Valid subcommands: create, list, revoke"
            return 1
            ;;
    esac
}

# Token subcommand: create
command_token_create() {
    local token_name="$1"
    local description="Create a new CLI authentication token"
    
    if [[ -z "$token_name" ]]; then
        read -p "Token name: " token_name
    fi
    
    log_info "🔐 DHG Authentication - Create Token"
    
    track_and_execute "token_create" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" token-create "$token_name"
}

# Token subcommand: list
command_token_list() {
    local description="List all CLI tokens"
    
    log_info "🔐 DHG Authentication - List Tokens"
    
    track_and_execute "token_list" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" token-list
}

# Token subcommand: revoke
command_token_revoke() {
    local token_id="$1"
    local description="Revoke a CLI token"
    
    if [[ -z "$token_id" ]]; then
        # Show token list first
        command_token_list
        echo ""
        read -p "Token ID to revoke: " token_id
    fi
    
    log_info "🔐 DHG Authentication - Revoke Token"
    
    track_and_execute "token_revoke" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" token-revoke "$token_id"
}

# Command: profile - Show user profile
command_profile() {
    local subcommand="${1:-show}"
    
    if [[ "$subcommand" == "update" ]]; then
        shift
        command_profile_update "$@"
    else
        local description="Show user profile"
        log_info "🔐 DHG Authentication - User Profile"
        
        track_and_execute "profile" "$description" \
            cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" profile
    fi
}

# Profile subcommand: update
command_profile_update() {
    local description="Update user profile"
    
    log_info "🔐 DHG Authentication - Update Profile"
    echo ""
    
    read -p "Full name (leave empty to skip): " full_name
    
    local name_arg=""
    if [[ -n "$full_name" ]]; then
        name_arg="--name \"$full_name\""
    fi
    
    track_and_execute "profile_update" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" profile-update $name_arg
}

# Command: test - Test authentication service
command_test() {
    local description="Test authentication service"
    
    log_info "🔐 DHG Authentication - Service Test"
    
    track_and_execute "test" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/auth-cli-commands.ts" test
}

# Command: verify-migration - Verify email allowlist migration
command_verify_migration() {
    local description="Verify email allowlist migration"
    
    log_info "🔐 DHG Authentication - Verify Email Allowlist Migration"
    
    track_and_execute "verify_migration" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/verify-email-allowlist-migration.ts"
}

# Command: sync-auth-ids - Sync auth_user_id fields
command_sync_auth_ids() {
    local description="Sync auth_user_id fields in auth_allowed_emails"
    
    log_info "🔄 DHG Authentication - Sync Auth User IDs"
    
    track_and_execute "sync_auth_ids" "$description" \
        cd "$PROJECT_ROOT" && npx ts-node "$SCRIPT_DIR/commands/sync-auth-user-ids.ts"
}

# Command: health-check - Run health check for auth pipeline
command_health_check() {
    local description="Run health check for auth pipeline"
    
    if [[ -f "$SCRIPT_DIR/health-check.sh" ]]; then
        track_and_execute "health_check" "$description" \
            "$SCRIPT_DIR/health-check.sh"
    else
        # Basic health check
        health_check_service "auth"
    fi
}

# Override show_help to add command-specific details
show_help() {
    echo -e "${BLUE}DHG Authentication CLI${NC}"
    echo ""
    echo "USAGE:"
    echo "  $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  login                    Login with email and password"
    echo "  logout                   Logout current session"
    echo "  whoami                   Show current authenticated user"
    echo "  token create [name]      Create a new CLI authentication token"
    echo "  token list               List all CLI tokens"
    echo "  token revoke [id]        Revoke a CLI token"
    echo "  profile                  Show user profile"
    echo "  profile update           Update user profile"
    echo "  test                     Test authentication service"
    echo "  verify-migration         Verify email allowlist migration"
    echo "  sync-auth-ids            Sync auth_user_id fields in auth_allowed_emails"
    echo "  health-check             Run health check for auth pipeline"
    echo "  help                     Show this help message"
    echo ""
    echo "OPTIONS:"
    echo "  --api-key [key]          Use specific API key for authentication"
    echo "  --email [email]          Email for login"
    echo "  --password [password]    Password for login (use with caution)"
    echo "  --debug                  Enable debug mode"
    echo "  --verbose                Enable verbose output"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 login"
    echo "  $0 token create my-automation"
    echo "  $0 whoami --api-key abc123"
    echo "  $0 profile update"
}

# Parse command-specific options
API_KEY=""
EMAIL=""
PASSWORD=""

# Custom argument parsing to handle auth-specific options
while [[ $# -gt 0 ]]; do
    case $1 in
        --api-key)
            API_KEY="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        *)
            # Let standard parsing handle the rest
            break
            ;;
    esac
done

# Handle hyphenated commands
case "$1" in
    verify-migration)
        shift
        command_verify_migration "$@"
        ;;
    sync-auth-ids)
        shift
        command_sync_auth_ids "$@"
        ;;
    health-check)
        shift
        command_health_check "$@"
        ;;
    *)
        # Let base class handle standard routing
        route_command "$@"
        ;;
esac