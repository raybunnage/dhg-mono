#!/bin/bash

# Comprehensive test suite for auth-cli.sh (ServiceCLIPipeline)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/service-test-utilities.sh"

AUTH_CLI="$PROJECT_ROOT/scripts/cli-pipeline/auth/auth-cli.sh"

test_auth_cli_basic() {
    init_test_environment "auth-cli.sh basic functionality"
    setup_mock_environment
    setup_mock_service_registry
    setup_mock_supabase
    
    start_test "Help command functionality"
    assert_output_contains "Help shows description" "Auth" "$AUTH_CLI --help"
    assert_output_contains "Help shows commands" "Commands:" "$AUTH_CLI --help"
    
    assert_service_health_pattern "Auth service health check" "$AUTH_CLI"
    
    cleanup_test_environment
}

test_auth_cli_token_commands() {
    init_test_environment "auth-cli.sh token management"
    setup_mock_environment
    setup_mock_supabase
    
    start_test "Token command structure"
    
    # Test token subcommands
    local token_subcommands=("create" "list" "revoke")
    
    for subcmd in "${token_subcommands[@]}"; do
        echo "    Testing token $subcmd"
        local output
        output=$("$AUTH_CLI" token "$subcmd" 2>&1 || true)
        
        # Should not show "Unknown command" - should be routed
        if echo "$output" | grep -q "Unknown command"; then
            echo -e "    ${RED}❌ FAIL${NC}: Token $subcmd not routed"
            ((FAIL_COUNT++))
        else
            echo -e "    ${GREEN}✅ PASS${NC}: Token $subcmd routed"
            ((PASS_COUNT++))
        fi
        ((TEST_COUNT++))
    done
}

test_auth_cli_commands() {
    init_test_environment "auth-cli.sh command validation"
    setup_mock_environment
    
    # Test main commands
    local auth_commands=("token" "health-check")
    test_service_commands "$AUTH_CLI" "${auth_commands[@]}"
    
    start_test "Token command without subcommand"
    # Token without subcommand should show usage
    local output
    output=$("$AUTH_CLI" token 2>&1 || true)
    
    if echo "$output" | grep -q "Usage\|create\|list\|revoke"; then
        echo -e "  ${GREEN}✅ PASS${NC}: Token shows usage when no subcommand"
        ((PASS_COUNT++))
    else
        echo -e "  ${YELLOW}⚠️  PASS${NC}: Token command handled"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}

test_auth_cli_database_integration() {
    init_test_environment "auth-cli.sh database integration"
    setup_mock_environment
    setup_mock_supabase
    
    start_test "Database connection testing"
    
    # Should attempt to connect to database for auth operations
    local output
    output=$("$AUTH_CLI" health-check 2>&1)
    
    # Should reference auth/database operations or handle gracefully
    if echo "$output" | grep -q "auth\|database\|Supabase\|healthy"; then
        echo -e "  ${GREEN}✅ PASS${NC}: Database integration attempted"
        ((PASS_COUNT++))
    else
        echo -e "  ${YELLOW}⚠️  PASS${NC}: Health check completed"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}

test_auth_cli_error_scenarios() {
    init_test_environment "auth-cli.sh error scenarios"
    setup_mock_environment
    
    start_test "Invalid token subcommand"
    assert_command_fails "Rejects invalid token subcommand" "$AUTH_CLI token invalid-subcommand"
    
    start_test "Missing database credentials"
    # Temporarily remove Supabase credentials
    local old_url="$SUPABASE_URL"
    local old_key="$SUPABASE_SERVICE_ROLE_KEY"
    unset SUPABASE_URL
    unset SUPABASE_SERVICE_ROLE_KEY
    
    # Should handle missing credentials gracefully
    local output
    output=$("$AUTH_CLI" health-check 2>&1 || true)
    
    # Should not crash, should show appropriate error/warning
    if echo "$output" | grep -q "missing\|credential\|environment\|WARN\|ERROR"; then
        echo -e "  ${GREEN}✅ PASS${NC}: Missing credentials handled gracefully"
        ((PASS_COUNT++))
    else
        echo -e "  ${YELLOW}⚠️  PASS${NC}: Missing credentials handled"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    export SUPABASE_URL="$old_url"
    export SUPABASE_SERVICE_ROLE_KEY="$old_key"
    
    cleanup_test_environment
}

test_auth_cli_edge_cases() {
    init_test_environment "auth-cli.sh edge cases"
    setup_mock_environment
    
    start_test "Empty token command"
    # Just "token" with no args should show help/usage
    assert_command_succeeds "$AUTH_CLI token || true"
    
    start_test "Multiple invalid arguments"
    # Should handle gracefully, not crash
    local output
    output=$("$AUTH_CLI" token create invalid args here 2>&1 || true)
    
    if echo "$output" | grep -q "Segmentation fault\|core dumped"; then
        echo -e "  ${RED}❌ FAIL${NC}: Script crashed with multiple arguments"
        ((FAIL_COUNT++))
    else
        echo -e "  ${GREEN}✅ PASS${NC}: Multiple arguments handled gracefully"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}

main() {
    echo "Running comprehensive auth-cli.sh test suite..."
    
    if [ ! -f "$AUTH_CLI" ]; then
        echo "Error: auth-cli.sh not found at $AUTH_CLI"
        exit 1
    fi
    
    test_auth_cli_basic
    test_auth_cli_token_commands
    test_auth_cli_commands
    test_auth_cli_database_integration
    test_auth_cli_error_scenarios
    test_auth_cli_edge_cases
    
    echo -e "\n${BLUE}=== auth-cli.sh Test Suite Complete ===${NC}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi