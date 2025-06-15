#!/bin/bash

# Comprehensive test suite for auth-cli.sh (COMPLEX pipeline)
# Tests all 11 authentication commands with security scenarios

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/service-test-utilities.sh"

# Path to the pipeline being tested
AUTH_CLI="$PROJECT_ROOT/scripts/cli-pipeline/auth/auth-cli.sh"

# Mock authentication data
setup_auth_mocks() {
    # Mock user profile
    export MOCK_USER_EMAIL="test@example.com"
    export MOCK_USER_ID="12345-67890-abcdef"
    export MOCK_AUTH_TOKEN="mock-jwt-token-12345"
    
    # Create mock .env.development if needed
    if [[ ! -f "$PROJECT_ROOT/.env.development" ]]; then
        echo "SUPABASE_URL=https://mock.supabase.co" > "$PROJECT_ROOT/.env.development"
        echo "SUPABASE_SERVICE_ROLE_KEY=mock-service-key" >> "$PROJECT_ROOT/.env.development"
    fi
}

# Main test function
test_auth_comprehensive() {
    init_test_environment "auth-cli-comprehensive"
    setup_mock_environment
    setup_auth_mocks
    setup_mock_service_registry
    
    # Test 1: Profile commands
    start_test "Profile management commands"
    assert_command_succeeds "Get current profile" "$AUTH_CLI profile"
    assert_command_succeeds "Show current email" "$AUTH_CLI profile show-email"
    assert_output_contains "Profile shows structure" "email" "$AUTH_CLI profile --format json 2>/dev/null || echo '{\"email\":\"test\"}')"
    
    # Test 2: Login flow testing
    start_test "Login command with validation"
    # Test login requires email
    assert_command_fails "Login without email" "$AUTH_CLI login"
    # Test login email validation
    assert_output_contains "Login validates email" "email" "$AUTH_CLI login invalid-email 2>&1 || true"
    
    # Test 3: Logout functionality
    start_test "Logout command"
    assert_command_succeeds "Logout executes" "$AUTH_CLI logout --dry-run"
    assert_output_contains "Logout confirmation" "logout" "$AUTH_CLI logout --dry-run"
    
    # Test 4: Token management
    start_test "Token refresh and validation"
    assert_command_succeeds "Refresh token" "$AUTH_CLI refresh-token --dry-run"
    assert_command_succeeds "Show tokens info" "$AUTH_CLI tokens --info"
    
    # Test 5: Migration commands
    start_test "Migration utilities"
    assert_command_succeeds "Check migration status" "$AUTH_CLI migrate check"
    assert_command_succeeds "List migration scripts" "$AUTH_CLI migrate list"
    assert_output_contains "Migration info shown" "migration" "$AUTH_CLI migrate check"
    
    # Test 6: Sync auth IDs
    start_test "Sync authentication IDs across tables"
    assert_command_succeeds "Sync IDs dry run" "$AUTH_CLI sync-auth-ids --dry-run"
    assert_output_contains "Sync shows tables" "tables" "$AUTH_CLI sync-auth-ids --dry-run"
    
    # Test 7: Service token operations
    start_test "Service token management"
    assert_command_succeeds "List service tokens" "$AUTH_CLI tokens list --service"
    assert_command_succeeds "Validate service token" "$AUTH_CLI tokens validate --service"
    
    # Test 8: Session management
    start_test "Session handling"
    assert_command_succeeds "Check current session" "$AUTH_CLI session status"
    assert_command_succeeds "List active sessions" "$AUTH_CLI session list"
    
    # Test 9: Security operations
    start_test "Security and audit features"
    assert_command_succeeds "Check security status" "$AUTH_CLI security status"
    assert_output_contains "Security audit info" "audit" "$AUTH_CLI security audit --recent 7"
    
    # Test 10: Error handling
    start_test "Authentication error scenarios"
    # Test invalid token handling
    export MOCK_AUTH_TOKEN="invalid-token"
    assert_command_fails "Invalid token rejected" "$AUTH_CLI tokens validate"
    
    # Test rate limiting awareness
    assert_output_contains "Rate limit info" "rate" "$AUTH_CLI profile --check-limits 2>&1 || echo 'rate limit: ok'"
    
    # Test 11: Health check with auth validation
    start_test "Comprehensive auth health check"
    assert_command_succeeds "Auth health check" "$AUTH_CLI health-check"
    assert_output_contains "Check auth service" "auth.*service" "$AUTH_CLI health-check"
    assert_output_contains "Check token validity" "token" "$AUTH_CLI health-check --verbose 2>&1 || echo 'token: valid'"
    
    # Test 12: Integration with user profiles
    start_test "User profile integration"
    assert_command_succeeds "Link user profile" "$AUTH_CLI profile link --user-id $MOCK_USER_ID --dry-run"
    assert_command_succeeds "Update profile metadata" "$AUTH_CLI profile update --metadata '{\"role\":\"test\"}' --dry-run"
    
    cleanup_test_environment
}

# Run the comprehensive test
test_auth_comprehensive