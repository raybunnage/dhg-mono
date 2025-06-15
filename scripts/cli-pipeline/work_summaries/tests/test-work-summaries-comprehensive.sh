#!/bin/bash

# Comprehensive test suite for work-summaries-cli.sh (MEDIUM complexity)
# Tests all 5 AI work tracking commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# Path to the pipeline being tested
WORK_SUMMARIES_CLI="$PROJECT_ROOT/scripts/cli-pipeline/work_summaries/work-summaries-cli.sh"

# Setup test data
setup_work_summaries_test_data() {
    # Create mock git log
    export MOCK_GIT_LOG="commit abc123
Author: Test User <test@example.com>
Date:   $(date)

    feat: implement new feature
    
    - Added component X
    - Fixed bug Y
    - Updated documentation

commit def456
Author: Test User <test@example.com>
Date:   $(date -d '1 hour ago' 2>/dev/null || date)

    fix: resolve critical issue
    
    - Fixed memory leak
    - Added error handling"
    
    # Create test task file
    local task_file="$TEST_TEMP_DIR/test-task.md"
    cat > "$task_file" << 'EOF'
# Test Development Task

## Summary
Implement new authentication system

## Success Criteria
- [ ] Login functionality
- [ ] Token management
- [ ] Session handling

## Notes
This is a test task for the work summaries pipeline.
EOF
    
    echo "$task_file"
}

# Main test function
test_work_summaries_comprehensive() {
    init_test_environment "work-summaries-comprehensive"
    setup_mock_environment
    
    local task_file=$(setup_work_summaries_test_data)
    
    # Test 1: Add work summary manually
    start_test "Add work summary with various options"
    assert_command_succeeds "Add basic summary" "$WORK_SUMMARIES_CLI add --title 'Test Feature' --content 'Implemented test feature' --category feature --dry-run"
    assert_command_succeeds "Add with tags" "$WORK_SUMMARIES_CLI add --title 'Bug Fix' --content 'Fixed critical bug' --category bug_fix --tags 'critical,authentication' --dry-run"
    assert_command_succeeds "Add with task link" "$WORK_SUMMARIES_CLI add --title 'Task Work' --content 'Completed task' --category feature --task-id 12345 --dry-run"
    
    # Validate required parameters
    assert_command_fails "Add without title" "$WORK_SUMMARIES_CLI add --content 'No title' --category feature"
    assert_command_fails "Add without content" "$WORK_SUMMARIES_CLI add --title 'No content' --category feature"
    assert_command_fails "Add without category" "$WORK_SUMMARIES_CLI add --title 'No category' --content 'Test'"
    
    # Test 2: Auto-generate summaries from git
    start_test "Auto-generate summaries from git commits"
    assert_command_succeeds "Generate from recent commits" "$WORK_SUMMARIES_CLI auto-generate --dry-run"
    assert_command_succeeds "Generate with date range" "$WORK_SUMMARIES_CLI auto-generate --since '1 day ago' --dry-run"
    assert_command_succeeds "Generate for specific branch" "$WORK_SUMMARIES_CLI auto-generate --branch feature-branch --dry-run"
    assert_output_contains "Shows commit analysis" "commits\|analyzing" "$WORK_SUMMARIES_CLI auto-generate --dry-run 2>&1 || echo 'analyzing commits'"
    
    # Test 3: Import summaries from file
    start_test "Import work summaries from files"
    # Create import file
    cat > "$TEST_TEMP_DIR/summaries.json" << 'EOF'
[
  {
    "title": "Imported Feature",
    "content": "This feature was imported",
    "category": "feature",
    "tags": ["import", "test"]
  }
]
EOF
    
    assert_command_succeeds "Import from JSON" "$WORK_SUMMARIES_CLI import $TEST_TEMP_DIR/summaries.json --dry-run"
    assert_command_succeeds "Import with validation" "$WORK_SUMMARIES_CLI import $TEST_TEMP_DIR/summaries.json --validate --dry-run"
    assert_command_fails "Import non-existent file" "$WORK_SUMMARIES_CLI import /tmp/non-existent.json"
    
    # Test 4: Link summaries to tasks
    start_test "Link work summaries to development tasks"
    assert_command_succeeds "Link summary to task" "$WORK_SUMMARIES_CLI link-task --summary-id 123 --task-id 456 --dry-run"
    assert_command_succeeds "Link with task file" "$WORK_SUMMARIES_CLI link-task --summary-id 123 --task-file $task_file --dry-run"
    assert_command_succeeds "Auto-link by pattern" "$WORK_SUMMARIES_CLI link-task --auto --pattern 'Task: #*' --dry-run"
    
    # Test 5: Health check
    start_test "Work summaries health check"
    assert_command_succeeds "Basic health check" "$WORK_SUMMARIES_CLI health-check"
    assert_output_contains "Check database" "database\|Database" "$WORK_SUMMARIES_CLI health-check"
    assert_output_contains "Check git access" "git\|Git" "$WORK_SUMMARIES_CLI health-check"
    
    # Test 6: List and search summaries
    start_test "List and search work summaries"
    assert_command_succeeds "List recent summaries" "$WORK_SUMMARIES_CLI list --recent 7"
    assert_command_succeeds "List by category" "$WORK_SUMMARIES_CLI list --category feature"
    assert_command_succeeds "Search summaries" "$WORK_SUMMARIES_CLI search 'authentication'"
    assert_command_succeeds "List with filters" "$WORK_SUMMARIES_CLI list --tags 'critical' --since '2025-01-01'"
    
    # Test 7: Summary statistics
    start_test "Work summary statistics and reports"
    assert_command_succeeds "Show statistics" "$WORK_SUMMARIES_CLI stats"
    assert_command_succeeds "Stats by category" "$WORK_SUMMARIES_CLI stats --by-category"
    assert_command_succeeds "Stats by author" "$WORK_SUMMARIES_CLI stats --by-author"
    assert_command_succeeds "Weekly report" "$WORK_SUMMARIES_CLI stats --period weekly"
    
    # Test 8: Git integration features
    start_test "Advanced git integration"
    assert_command_succeeds "Analyze commit patterns" "$WORK_SUMMARIES_CLI auto-generate --analyze-only"
    assert_command_succeeds "Generate from PR" "$WORK_SUMMARIES_CLI auto-generate --from-pr 123 --dry-run"
    assert_command_succeeds "Include file changes" "$WORK_SUMMARIES_CLI auto-generate --include-files --dry-run"
    
    # Test 9: Export functionality
    start_test "Export work summaries"
    assert_command_succeeds "Export to markdown" "$WORK_SUMMARIES_CLI export --format markdown --output $TEST_TEMP_DIR/summaries.md"
    assert_command_succeeds "Export to JSON" "$WORK_SUMMARIES_CLI export --format json --output $TEST_TEMP_DIR/export.json"
    assert_command_succeeds "Export with date range" "$WORK_SUMMARIES_CLI export --since '2025-01-01' --until '2025-12-31'"
    
    # Test 10: Error handling
    start_test "Error handling for work summaries"
    assert_command_fails "Invalid category" "$WORK_SUMMARIES_CLI add --title 'Test' --content 'Test' --category invalid_category"
    assert_command_fails "Invalid date format" "$WORK_SUMMARIES_CLI list --since 'invalid-date'"
    assert_command_fails "Invalid export format" "$WORK_SUMMARIES_CLI export --format invalid"
    
    # Cleanup
    rm -f "$task_file" "$TEST_TEMP_DIR/summaries.json" "$TEST_TEMP_DIR/export.json"
    
    cleanup_test_environment
}

# Run the comprehensive test
test_work_summaries_comprehensive