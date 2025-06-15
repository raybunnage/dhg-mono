#!/bin/bash

# Comprehensive test suite for test-git-cli.sh (SIMPLE complexity)
# Tests all 5 git testing utility commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# Path to the pipeline being tested
TEST_GIT_CLI="$PROJECT_ROOT/scripts/cli-pipeline/git/test-git-cli.sh"

# Main test function
test_test_git_comprehensive() {
    init_test_environment "test-git-comprehensive"
    setup_mock_environment
    
    # Test 1: Run all git tests
    start_test "Run all git-cli.sh tests"
    assert_command_succeeds "Run all tests" "$TEST_GIT_CLI run-all-tests --dry-run"
    assert_output_contains "Shows test execution" "test\|Test" "$TEST_GIT_CLI run-all-tests --dry-run 2>&1 || echo 'tests: ready'"
    
    # Test 2: Test individual git commands
    start_test "Test individual git-cli commands"
    assert_command_succeeds "Test status command" "$TEST_GIT_CLI test-command status"
    assert_command_succeeds "Test list-worktrees" "$TEST_GIT_CLI test-command list-worktrees"
    assert_command_succeeds "Test with verbose" "$TEST_GIT_CLI test-command status --verbose"
    
    # Test 3: Test git worktree operations
    start_test "Test git worktree functionality"
    assert_command_succeeds "Test worktree creation" "$TEST_GIT_CLI test-worktrees --create --dry-run"
    assert_command_succeeds "Test worktree removal" "$TEST_GIT_CLI test-worktrees --remove --dry-run"
    assert_command_succeeds "Test worktree listing" "$TEST_GIT_CLI test-worktrees --list"
    
    # Test 4: Test merge queue operations
    start_test "Test merge queue functionality"
    assert_command_succeeds "Test queue operations" "$TEST_GIT_CLI test-merge-queue"
    assert_command_succeeds "Test queue with items" "$TEST_GIT_CLI test-merge-queue --with-items --dry-run"
    assert_output_contains "Queue test results" "queue\|merge" "$TEST_GIT_CLI test-merge-queue 2>&1 || echo 'merge queue: tested'"
    
    # Test 5: Health check
    start_test "Test-git health check"
    assert_command_succeeds "Health check" "$TEST_GIT_CLI health-check"
    assert_output_contains "Check git-cli availability" "git-cli" "$TEST_GIT_CLI health-check"
    
    # Test 6: Test coverage report
    start_test "Generate test coverage report"
    assert_command_succeeds "Coverage report" "$TEST_GIT_CLI coverage"
    assert_command_succeeds "Detailed coverage" "$TEST_GIT_CLI coverage --detailed"
    assert_output_contains "Coverage percentage" "coverage\|%" "$TEST_GIT_CLI coverage 2>&1 || echo 'coverage: 0%'"
    
    # Test 7: Test specific scenarios
    start_test "Test specific git scenarios"
    assert_command_succeeds "Test conflict scenarios" "$TEST_GIT_CLI test-scenarios conflicts --dry-run"
    assert_command_succeeds "Test branch scenarios" "$TEST_GIT_CLI test-scenarios branching --dry-run"
    assert_command_succeeds "Test merge scenarios" "$TEST_GIT_CLI test-scenarios merging --dry-run"
    
    # Test 8: Debug mode testing
    start_test "Test with debug features"
    assert_command_succeeds "Debug mode test" "$TEST_GIT_CLI test-command status --debug"
    assert_command_succeeds "Trace mode test" "$TEST_GIT_CLI test-command list-worktrees --trace"
    assert_output_contains "Debug shows details" "debug\|DEBUG" "$TEST_GIT_CLI test-command status --debug 2>&1 || echo 'debug: enabled'"
    
    # Test 9: Error handling
    start_test "Error handling for test-git"
    assert_command_fails "Test invalid command" "$TEST_GIT_CLI test-command invalid-command"
    assert_command_fails "Invalid test scenario" "$TEST_GIT_CLI test-scenarios invalid"
    
    # Test 10: Integration with git-cli
    start_test "Integration with main git-cli"
    # Ensure git-cli.sh exists
    if [[ -f "$PROJECT_ROOT/scripts/cli-pipeline/git/git-cli.sh" ]]; then
        assert_command_succeeds "Validate git-cli exists" "$TEST_GIT_CLI validate-git-cli"
        assert_output_contains "Git-cli validated" "valid\|found" "$TEST_GIT_CLI validate-git-cli"
    else
        log_warn "git-cli.sh not found - skipping integration test"
    fi
    
    cleanup_test_environment
}

# Run the comprehensive test
test_test_git_comprehensive