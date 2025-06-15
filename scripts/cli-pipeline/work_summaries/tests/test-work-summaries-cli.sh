#!/bin/bash

# Test suite for work-summaries-cli.sh
# Tests the SimpleCLIPipeline work summaries functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# Path to the pipeline being tested
WORK_SUMMARIES_CLI="$PROJECT_ROOT/scripts/cli-pipeline/work_summaries/work-summaries-cli.sh"

# Test basic functionality
test_work_summaries_basic() {
    init_test_environment "work-summaries-cli.sh basic functionality"
    setup_mock_environment
    
    # Test 1: Help command
    start_test "Help command displays usage information"
    assert_output_contains "Help shows usage" "Usage:" "$WORK_SUMMARIES_CLI --help"
    assert_output_contains "Help shows commands" "Commands:" "$WORK_SUMMARIES_CLI --help"
    
    # Test 2: Health check
    start_test "Health check runs successfully"
    assert_command_succeeds "Health check passes" "$WORK_SUMMARIES_CLI health-check"
    
    # Test 3: Invalid command handling
    start_test "Invalid command handling"
    assert_command_fails "Invalid command rejected" "$WORK_SUMMARIES_CLI invalid-command-xyz"
    assert_output_contains "Error for invalid command" "Unknown command" "$WORK_SUMMARIES_CLI invalid-command-xyz"
    
    cleanup_test_environment
}

# Test command argument validation
test_command_arguments() {
    init_test_environment "work-summaries-cli.sh argument validation"
    setup_mock_environment
    
    # Test add command without required arguments
    start_test "Add command argument validation"
    
    # Add command should require arguments (will likely fail due to missing args)
    # But should not show "Unknown command"
    local add_output
    add_output=$("$WORK_SUMMARIES_CLI" add 2>&1 || true)
    
    if echo "$add_output" | grep -q "Unknown command"; then
        echo -e "  ${RED}❌ FAIL${NC}: Add command not recognized"
        ((FAIL_COUNT++))
    else
        echo -e "  ${GREEN}✅ PASS${NC}: Add command properly routed"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    # Test auto command
    start_test "Auto command recognition"
    local auto_output
    auto_output=$("$WORK_SUMMARIES_CLI" auto 2>&1 || true)
    
    if echo "$auto_output" | grep -q "Unknown command"; then
        echo -e "  ${RED}❌ FAIL${NC}: Auto command not recognized"
        ((FAIL_COUNT++))
    else
        echo -e "  ${GREEN}✅ PASS${NC}: Auto command properly routed"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}

# Test work summaries with mock data
test_work_summaries_mock_data() {
    init_test_environment "work-summaries-cli.sh with mock data"
    setup_mock_environment
    
    # Create mock files that the commands might look for
    start_test "Commands with potential file dependencies"
    
    # Test import command (might look for claude_code_prompts.txt)
    local import_output
    import_output=$("$WORK_SUMMARIES_CLI" import 2>&1 || true)
    
    # Should not crash with "Unknown command"
    if echo "$import_output" | grep -q "Unknown command"; then
        echo -e "  ${RED}❌ FAIL${NC}: Import command not recognized"
        ((FAIL_COUNT++))
    else
        echo -e "  ${GREEN}✅ PASS${NC}: Import command properly routed"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    # Test link-tasks command
    start_test "Link tasks command"
    local link_output
    link_output=$("$WORK_SUMMARIES_CLI" link-tasks 2>&1 || true)
    
    if echo "$link_output" | grep -q "Unknown command"; then
        echo -e "  ${RED}❌ FAIL${NC}: Link-tasks command not recognized"
        ((FAIL_COUNT++))
    else
        echo -e "  ${GREEN}✅ PASS${NC}: Link-tasks command properly routed"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}

# Test integration with TypeScript files
test_typescript_integration() {
    init_test_environment "work-summaries-cli.sh TypeScript integration"
    setup_mock_environment
    
    start_test "TypeScript file dependencies"
    
    # Check if the TypeScript files exist that the commands depend on
    local ts_files=(
        "$PROJECT_ROOT/scripts/cli-pipeline/work_summaries/add-summary.ts"
        "$PROJECT_ROOT/scripts/cli-pipeline/work_summaries/auto-summary.ts"
        "$PROJECT_ROOT/scripts/cli-pipeline/work_summaries/import-from-prompts.ts"
    )
    
    for ts_file in "${ts_files[@]}"; do
        local file_name=$(basename "$ts_file")
        if [ -f "$ts_file" ]; then
            echo -e "  ${GREEN}✅ PASS${NC}: TypeScript file exists: $file_name"
            ((PASS_COUNT++))
        else
            echo -e "  ${YELLOW}⚠️  WARN${NC}: TypeScript file missing: $file_name"
            # Don't count as failure since files might be optional
        fi
        ((TEST_COUNT++))
    done
    
    cleanup_test_environment
}

# Test framework integration and command routing
test_framework_integration() {
    init_test_environment "Framework integration"
    setup_mock_environment
    
    start_test "Command routing verification"
    
    # Test that all expected commands are routed correctly
    local commands=("add" "auto" "import" "link-tasks" "health-check")
    
    for cmd in "${commands[@]}"; do
        local output
        output=$("$WORK_SUMMARIES_CLI" "$cmd" 2>&1 || true)
        
        if echo "$output" | grep -q "Unknown command"; then
            echo -e "  ${RED}❌ FAIL${NC}: Command '$cmd' not properly routed"
            ((FAIL_COUNT++))
        else
            echo -e "  ${GREEN}✅ PASS${NC}: Command '$cmd' properly routed"
            ((PASS_COUNT++))
        fi
        ((TEST_COUNT++))
    done
    
    # Test help variations
    start_test "Help command variations"
    assert_command_succeeds "Help with --help" "$WORK_SUMMARIES_CLI --help"
    assert_command_succeeds "Help with -h" "$WORK_SUMMARIES_CLI -h"
    assert_command_succeeds "Help with help" "$WORK_SUMMARIES_CLI help"
    
    cleanup_test_environment
}

# Test edge cases and error conditions
test_edge_cases() {
    init_test_environment "work-summaries-cli.sh edge cases"
    setup_mock_environment
    
    # Test with very long arguments
    start_test "Long argument handling"
    local long_string=$(printf 'a%.0s' {1..500})
    
    # Should not crash the script
    local output
    output=$("$WORK_SUMMARIES_CLI" add "$long_string" 2>&1 || true)
    
    # Should handle gracefully (may fail, but should not crash)
    if echo "$output" | grep -q "Segmentation fault\|core dumped"; then
        echo -e "  ${RED}❌ FAIL${NC}: Script crashed with long arguments"
        ((FAIL_COUNT++))
    else
        echo -e "  ${GREEN}✅ PASS${NC}: Script handled long arguments gracefully"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    # Test empty arguments
    start_test "Empty argument handling"
    assert_command_succeeds "Empty args handled" "$WORK_SUMMARIES_CLI" # Should show help
    
    cleanup_test_environment
}

# Run all tests
main() {
    echo "Running work-summaries-cli.sh test suite..."
    echo "Testing pipeline: $WORK_SUMMARIES_CLI"
    
    if [ ! -f "$WORK_SUMMARIES_CLI" ]; then
        echo "Error: work-summaries-cli.sh not found at $WORK_SUMMARIES_CLI"
        exit 1
    fi
    
    # Run test suites
    test_work_summaries_basic
    test_command_arguments
    test_work_summaries_mock_data
    test_typescript_integration
    test_framework_integration
    test_edge_cases
    
    echo -e "\n${BLUE}=== work-summaries-cli.sh Test Suite Complete ===${NC}"
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi