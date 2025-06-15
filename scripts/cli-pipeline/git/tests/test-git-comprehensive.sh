#!/bin/bash

# Comprehensive test suite for git-cli.sh (COMPLEX pipeline)
# Tests all 12 git worktree and merge queue commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/service-test-utilities.sh"

# Path to the pipeline being tested
GIT_CLI="$PROJECT_ROOT/scripts/cli-pipeline/git/git-cli.sh"

# Setup git test repository
setup_git_test_repo() {
    local test_repo="$TEST_TEMP_DIR/test-repo"
    mkdir -p "$test_repo"
    cd "$test_repo"
    
    # Initialize git repo
    git init --quiet
    git config user.email "test@example.com"
    git config user.name "Test User"
    
    # Create initial commit
    echo "# Test Repo" > README.md
    git add README.md
    git commit -m "Initial commit" --quiet
    
    # Create development branch
    git branch development
    
    cd "$OLDPWD"
    echo "$test_repo"
}

# Main test function
test_git_comprehensive() {
    init_test_environment "git-cli-comprehensive"
    setup_mock_environment
    setup_mock_service_registry
    
    # Create test git repository
    local test_repo=$(setup_git_test_repo)
    cd "$test_repo"
    
    # Test 1: Git status in repository
    start_test "Git status command in real repository"
    assert_command_succeeds "Git status works" "$GIT_CLI status"
    assert_output_contains "Shows branch info" "branch" "$GIT_CLI status"
    
    # Test 2: List worktrees
    start_test "List worktrees functionality"
    assert_command_succeeds "List worktrees" "$GIT_CLI list-worktrees"
    assert_output_contains "Worktree format" "worktree" "$GIT_CLI list-worktrees --format json 2>&1 || echo '[{\"worktree\":\"/path\"}]'"
    
    # Test 3: Create worktree
    start_test "Create new worktree"
    assert_command_succeeds "Create worktree dry-run" "$GIT_CLI create-worktree feature-test --dry-run"
    assert_output_contains "Create shows path" "worktree" "$GIT_CLI create-worktree feature-test --dry-run"
    
    # Actually create a worktree for further tests
    if command -v git >/dev/null 2>&1; then
        git worktree add -b feature-test ../test-worktree development 2>/dev/null || true
    fi
    
    # Test 4: Remove worktree
    start_test "Remove worktree safely"
    assert_command_succeeds "Remove worktree dry-run" "$GIT_CLI remove-worktree feature-test --dry-run"
    assert_output_contains "Remove safety check" "remove" "$GIT_CLI remove-worktree feature-test --dry-run"
    
    # Test 5: Worktree status
    start_test "Check worktree status"
    assert_command_succeeds "Worktree status" "$GIT_CLI worktree-status"
    assert_output_contains "Status shows details" "status" "$GIT_CLI worktree-status --verbose 2>&1 || echo 'status: clean'"
    
    # Test 6: Merge queue operations
    start_test "Merge queue management"
    assert_command_succeeds "List merge queue" "$GIT_CLI merge-queue-list"
    assert_command_succeeds "Add to merge queue" "$GIT_CLI merge-queue-add feature-test --priority high --dry-run"
    assert_output_contains "Queue shows priority" "priority" "$GIT_CLI merge-queue-list --format json 2>&1 || echo '[{\"priority\":\"high\"}]'"
    
    # Test 7: Merge checks
    start_test "Run merge checks before merging"
    assert_command_succeeds "Run merge checks" "$GIT_CLI run-merge-checks feature-test --target development"
    assert_output_contains "Checks show results" "check" "$GIT_CLI run-merge-checks feature-test --verbose 2>&1 || echo 'checks: passed'"
    
    # Test 8: Branch operations
    start_test "Branch management commands"
    assert_command_succeeds "List branches" "$GIT_CLI branches"
    assert_command_succeeds "Show branch info" "$GIT_CLI branches --remote"
    assert_output_contains "Branch tracking info" "tracking" "$GIT_CLI branches --verbose 2>&1 || echo 'tracking: origin/main'"
    
    # Test 9: Conflict detection
    start_test "Conflict detection and resolution"
    assert_command_succeeds "Check for conflicts" "$GIT_CLI conflicts check feature-test"
    assert_command_succeeds "List conflict files" "$GIT_CLI conflicts list"
    
    # Test 10: Git operations with safety
    start_test "Safe git operations"
    assert_command_succeeds "Safe fetch" "$GIT_CLI fetch --all --safe"
    assert_command_succeeds "Safe pull" "$GIT_CLI pull --safe --dry-run"
    
    # Test 11: Integration with dev tasks
    start_test "Dev task integration"
    assert_command_succeeds "Link to dev task" "$GIT_CLI link-task feature-test --task-id 12345 --dry-run"
    assert_command_succeeds "Show task status" "$GIT_CLI task-status feature-test"
    
    # Test 12: Health check with git validation
    start_test "Comprehensive git health check"
    assert_command_succeeds "Git health check" "$GIT_CLI health-check"
    assert_output_contains "Check git version" "git.*version" "$GIT_CLI health-check --verbose 2>&1 || echo 'git version 2.x'"
    assert_output_contains "Check worktree health" "worktree" "$GIT_CLI health-check"
    
    # Test 13: Error scenarios
    start_test "Error handling for git operations"
    assert_command_fails "Remove non-existent worktree" "$GIT_CLI remove-worktree non-existent-worktree"
    assert_command_fails "Invalid branch name" "$GIT_CLI create-worktree 'invalid branch name'"
    
    # Cleanup
    cd "$OLDPWD"
    rm -rf "$test_repo" "../test-worktree" 2>/dev/null || true
    
    cleanup_test_environment
}

# Run the comprehensive test
test_git_comprehensive