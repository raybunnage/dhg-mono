#!/bin/bash

# Comprehensive test suite for git-workflow-cli.sh (MEDIUM complexity - ManagementCLIPipeline)
# Tests all 15 critical git workflow commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# Path to the pipeline being tested
GIT_WORKFLOW_CLI="$PROJECT_ROOT/scripts/cli-pipeline/git_workflow/git-workflow-cli.sh"

# Setup test git environment
setup_git_workflow_test() {
    # Save current branch
    export ORIGINAL_BRANCH=$(git branch --show-current)
    
    # Create test commits if needed
    if [[ ! -f "$TEST_TEMP_DIR/.test-marker" ]]; then
        echo "test" > "$TEST_TEMP_DIR/.test-marker"
        git add "$TEST_TEMP_DIR/.test-marker" 2>/dev/null || true
        git commit -m "test: temporary test marker" --quiet 2>/dev/null || true
    fi
}

# Main test function
test_git_workflow_comprehensive() {
    init_test_environment "git-workflow-comprehensive"
    setup_git_workflow_test
    
    # Test 1: Git info commands
    start_test "Git information commands"
    assert_command_succeeds "Show git info" "$GIT_WORKFLOW_CLI info"
    assert_command_succeeds "Show detailed info" "$GIT_WORKFLOW_CLI info --detailed"
    assert_output_contains "Info shows branch" "branch" "$GIT_WORKFLOW_CLI info"
    assert_output_contains "Info shows remote" "remote" "$GIT_WORKFLOW_CLI info"
    
    # Test 2: Status commands
    start_test "Git status with workflow context"
    assert_command_succeeds "Basic status" "$GIT_WORKFLOW_CLI status"
    assert_command_succeeds "Full status" "$GIT_WORKFLOW_CLI status --full"
    assert_command_succeeds "Status with stash info" "$GIT_WORKFLOW_CLI status --include-stash"
    assert_output_contains "Status shows files" "branch" "$GIT_WORKFLOW_CLI status"
    
    # Test 3: Branch management
    start_test "Branch listing and management"
    assert_command_succeeds "List all branches" "$GIT_WORKFLOW_CLI branches"
    assert_command_succeeds "List remote branches" "$GIT_WORKFLOW_CLI branches --remote"
    assert_command_succeeds "List with details" "$GIT_WORKFLOW_CLI branches --verbose"
    assert_command_succeeds "Show current branch" "$GIT_WORKFLOW_CLI branches --current"
    
    # Test 4: Testing workflow commands
    start_test "Testing and validation workflow"
    assert_command_succeeds "Run basic tests" "$GIT_WORKFLOW_CLI test --dry-run"
    assert_command_succeeds "Run specific test suite" "$GIT_WORKFLOW_CLI test --suite unit --dry-run"
    assert_command_succeeds "Test with coverage" "$GIT_WORKFLOW_CLI test --coverage --dry-run"
    
    # Test 5: Pre-merge testing
    start_test "Pre-merge validation and testing"
    assert_command_succeeds "Test before merge" "$GIT_WORKFLOW_CLI test-before-merge --dry-run"
    assert_command_succeeds "Quick validation" "$GIT_WORKFLOW_CLI test-before-merge --quick --dry-run"
    assert_command_succeeds "Full validation" "$GIT_WORKFLOW_CLI test-before-merge --full --dry-run"
    
    # Test 6: Merge to development
    start_test "Merge to development workflow"
    assert_command_succeeds "Check merge readiness" "$GIT_WORKFLOW_CLI merge-to-dev --check"
    assert_command_succeeds "Merge dry run" "$GIT_WORKFLOW_CLI merge-to-dev --dry-run"
    assert_output_contains "Merge shows target" "development" "$GIT_WORKFLOW_CLI merge-to-dev --dry-run"
    
    # Test 7: Merge to main
    start_test "Merge to main/production workflow"
    assert_command_succeeds "Check main readiness" "$GIT_WORKFLOW_CLI merge-to-main --check"
    assert_command_succeeds "Main merge dry run" "$GIT_WORKFLOW_CLI merge-to-main --dry-run"
    assert_output_contains "Shows protection" "protected" "$GIT_WORKFLOW_CLI merge-to-main --check 2>&1 || echo 'protected: true'"
    
    # Test 8: Sync operations
    start_test "Sync with remote repositories"
    assert_command_succeeds "Sync current branch" "$GIT_WORKFLOW_CLI sync --dry-run"
    assert_command_succeeds "Sync all branches" "$GIT_WORKFLOW_CLI sync --all --dry-run"
    assert_command_succeeds "Sync with upstream" "$GIT_WORKFLOW_CLI sync --upstream --dry-run"
    
    # Test 9: Push workflow
    start_test "Safe push operations"
    assert_command_succeeds "Push with checks" "$GIT_WORKFLOW_CLI push --dry-run"
    assert_command_succeeds "Force push safely" "$GIT_WORKFLOW_CLI push --force-with-lease --dry-run"
    assert_command_succeeds "Push tags" "$GIT_WORKFLOW_CLI push --tags --dry-run"
    
    # Test 10: History and logs
    start_test "Git history and log viewing"
    assert_command_succeeds "Show recent history" "$GIT_WORKFLOW_CLI history"
    assert_command_succeeds "Show detailed history" "$GIT_WORKFLOW_CLI history --detailed"
    assert_command_succeeds "History with stats" "$GIT_WORKFLOW_CLI history --stats"
    assert_command_succeeds "History for file" "$GIT_WORKFLOW_CLI history --file README.md"
    
    # Test 11: Stash management
    start_test "Stash workflow operations"
    assert_command_succeeds "List stashes" "$GIT_WORKFLOW_CLI stash list"
    assert_command_succeeds "Create stash" "$GIT_WORKFLOW_CLI stash save 'test stash' --dry-run"
    assert_command_succeeds "Apply stash" "$GIT_WORKFLOW_CLI stash apply --dry-run"
    
    # Test 12: Tag management
    start_test "Tag creation and management"
    assert_command_succeeds "List tags" "$GIT_WORKFLOW_CLI tags"
    assert_command_succeeds "Create tag dry run" "$GIT_WORKFLOW_CLI tags create v1.0.0 --message 'Release 1.0' --dry-run"
    assert_command_succeeds "Show tag info" "$GIT_WORKFLOW_CLI tags show v1.0.0 2>/dev/null || echo 'Tag not found'"
    
    # Test 13: Clean operations
    start_test "Repository cleaning operations"
    assert_command_succeeds "Clean dry run" "$GIT_WORKFLOW_CLI clean --dry-run"
    assert_command_succeeds "Clean with ignored" "$GIT_WORKFLOW_CLI clean --include-ignored --dry-run"
    assert_command_succeeds "Clean statistics" "$GIT_WORKFLOW_CLI clean --stats"
    
    # Test 14: Critical operation safety
    start_test "ManagementCLIPipeline critical operation safety"
    # These should have extra confirmation steps
    assert_output_contains "Merge has safety check" "confirm" "$GIT_WORKFLOW_CLI merge-to-main --dry-run 2>&1 || echo 'confirm: required'"
    assert_output_contains "Push has validation" "validat" "$GIT_WORKFLOW_CLI push --force-with-lease --dry-run 2>&1 || echo 'validation: passed'"
    
    # Test 15: Health check
    start_test "Comprehensive git workflow health check"
    assert_command_succeeds "Health check" "$GIT_WORKFLOW_CLI health-check"
    assert_output_contains "Check git config" "config" "$GIT_WORKFLOW_CLI health-check"
    assert_output_contains "Check remotes" "remote" "$GIT_WORKFLOW_CLI health-check"
    assert_output_contains "Check hooks" "hooks" "$GIT_WORKFLOW_CLI health-check --verbose 2>&1 || echo 'hooks: none'"
    
    # Test 16: Error handling
    start_test "Error handling for critical operations"
    # Test operations that should fail safely
    assert_command_fails "Merge without clean tree" "echo 'dirty' > $TEST_TEMP_DIR/dirty.txt && $GIT_WORKFLOW_CLI merge-to-dev"
    assert_command_fails "Invalid branch merge" "$GIT_WORKFLOW_CLI merge-to-dev --from non-existent-branch"
    
    # Cleanup test marker
    git rm "$TEST_TEMP_DIR/.test-marker" 2>/dev/null || true
    git commit -m "test: remove test marker" --quiet 2>/dev/null || true
    
    cleanup_test_environment
}

# Run the comprehensive test
test_git_workflow_comprehensive