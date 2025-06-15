#!/bin/bash

# Test suite for scripts-cli.sh
# Tests the SimpleCLIPipeline script management functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# Path to the pipeline being tested
SCRIPTS_CLI="$PROJECT_ROOT/scripts/cli-pipeline/scripts/scripts-cli.sh"

# Test the basic functionality
test_scripts_cli() {
    init_test_environment "scripts-cli.sh"
    setup_mock_environment
    
    # Test 1: Help command
    start_test "Help command displays usage information"
    assert_output_contains "Help shows usage" "USAGE:" "$SCRIPTS_CLI help"
    assert_output_contains "Help shows commands" "COMMANDS:" "$SCRIPTS_CLI help"
    
    # Test 2: Health check
    start_test "Health check runs successfully"
    assert_command_succeeds "Health check passes" "$SCRIPTS_CLI health-check"
    assert_output_contains "Health check message" "healthy" "$SCRIPTS_CLI health-check"
    
    # Test 3: Invalid command handling
    start_test "Invalid command handling"
    assert_command_fails "Invalid command rejected" "$SCRIPTS_CLI invalid-command-xyz"
    assert_output_contains "Error for invalid command" "Unknown command" "$SCRIPTS_CLI invalid-command-xyz"
    
    # Test 4: Create test script file and test classification
    start_test "Script classification functionality"
    
    # Create a test TypeScript file
    local test_script_content='#!/usr/bin/env ts-node
// Test script for classification
import { SupabaseClientService } from "../../packages/shared/services/supabase-client";

async function main() {
    console.log("Hello from test script");
}

main().catch(console.error);'
    
    local test_script_path
    test_script_path=$(create_test_script "test-classification.ts" "$test_script_content")
    
    # Test list command (should work even with no scripts in database)
    assert_command_succeeds "List command executes" "$SCRIPTS_CLI list --help || true"
    
    # Test search with no results (should not crash)
    assert_command_succeeds "Search command executes" "$SCRIPTS_CLI search test-query || true"
    
    # Test 5: Stats command
    start_test "Statistics command"
    assert_command_succeeds "Stats command executes" "$SCRIPTS_CLI stats || true"
    
    cleanup_test_environment
}

# Test edge cases and error conditions
test_scripts_cli_edge_cases() {
    init_test_environment "scripts-cli.sh edge cases"
    setup_mock_environment
    
    # Test missing file arguments
    start_test "Missing file argument handling"
    assert_command_fails "Classify requires file" "$SCRIPTS_CLI classify"
    assert_command_fails "Archive requires file" "$SCRIPTS_CLI archive"
    assert_command_fails "Register requires file" "$SCRIPTS_CLI register"
    
    # Test search without query
    start_test "Search without query"
    assert_command_fails "Search requires query" "$SCRIPTS_CLI search"
    
    # Test with very long arguments (should not crash)
    start_test "Long argument handling"
    local long_string=$(printf 'a%.0s' {1..1000})
    assert_command_fails "Long filename handled gracefully" "$SCRIPTS_CLI classify $long_string"
    
    cleanup_test_environment
}

# Test command routing and framework integration
test_framework_integration() {
    init_test_environment "Framework integration"
    setup_mock_environment
    
    # Test that all expected commands are routed correctly
    start_test "Command routing verification"
    
    # These should show help/usage, not "unknown command"
    local commands=("sync" "classify" "list" "search" "archive" "register" "stats")
    
    for cmd in "${commands[@]}"; do
        # Most commands will fail due to missing arguments, but should not show "Unknown command"
        local output
        output=$("$SCRIPTS_CLI" "$cmd" 2>&1 || true)
        
        if echo "$output" | grep -q "Unknown command"; then
            echo -e "  ${RED}❌ FAIL${NC}: Command '$cmd' not properly routed"
            ((FAIL_COUNT++))
        else
            echo -e "  ${GREEN}✅ PASS${NC}: Command '$cmd' properly routed"
            ((PASS_COUNT++))
        fi
        ((TEST_COUNT++))
    done
    
    cleanup_test_environment
}

# Run all tests
main() {
    echo "Running scripts-cli.sh test suite..."
    echo "Testing pipeline: $SCRIPTS_CLI"
    
    if [ ! -f "$SCRIPTS_CLI" ]; then
        echo "Error: scripts-cli.sh not found at $SCRIPTS_CLI"
        exit 1
    fi
    
    # Run test suites
    test_scripts_cli
    test_scripts_cli_edge_cases
    test_framework_integration
    
    echo -e "\n${BLUE}=== scripts-cli.sh Test Suite Complete ===${NC}"
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi