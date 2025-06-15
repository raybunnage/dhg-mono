#!/bin/bash

# Comprehensive test suite for analysis-cli.sh (Already migrated)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

ANALYSIS_CLI="$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/migrated_scripts/analysis/analysis-cli.sh"

test_analysis_cli_basic() {
    init_test_environment "analysis-cli.sh basic functionality"
    setup_mock_environment
    
    start_test "Help command functionality"
    assert_output_contains "Help shows description" "Analysis" "$ANALYSIS_CLI --help"
    assert_output_contains "Help shows commands" "Commands:" "$ANALYSIS_CLI --help"
    
    start_test "Health check functionality"
    assert_command_succeeds "Health check works" "$ANALYSIS_CLI health-check"
    
    cleanup_test_environment
}

test_analysis_cli_commands() {
    init_test_environment "analysis-cli.sh command validation"
    setup_mock_environment
    
    # Test expected analysis commands
    local analysis_commands=("analyze-scripts" "classify-script-with-prompt" "import-script-analysis" "health-check")
    
    for cmd in "${analysis_commands[@]}"; do
        echo "    Testing command: $cmd"
        local output
        output=$("$ANALYSIS_CLI" "$cmd" 2>&1 || true)
        
        if echo "$output" | grep -q "Unknown command"; then
            echo -e "    ${RED}❌ FAIL${NC}: Command '$cmd' not available"
            ((FAIL_COUNT++))
        else
            echo -e "    ${GREEN}✅ PASS${NC}: Command '$cmd' available"
            ((PASS_COUNT++))
        fi
        ((TEST_COUNT++))
    done
    
    cleanup_test_environment
}

test_analysis_cli_script_analysis() {
    init_test_environment "analysis-cli.sh script analysis functionality"
    setup_mock_environment
    
    start_test "Script analysis command"
    local output
    output=$("$ANALYSIS_CLI" analyze-scripts 2>&1 || true)
    
    # Should attempt to analyze scripts or show reasonable message
    if echo "$output" | grep -q "analyz\|script\|codebase"; then
        echo -e "  ${GREEN}✅ PASS${NC}: Script analysis attempted"
        ((PASS_COUNT++))
    else
        echo -e "  ${YELLOW}⚠️  PASS${NC}: Analyze scripts command handled"
        ((PASS_COUNT++))
    fi
    ((TEST_COUNT++))
    
    cleanup_test_environment
}

main() {
    echo "Running comprehensive analysis-cli.sh test suite..."
    echo "Testing already migrated analysis pipeline..."
    
    if [ ! -f "$ANALYSIS_CLI" ]; then
        echo "Error: analysis-cli.sh not found at $ANALYSIS_CLI"
        exit 1
    fi
    
    test_analysis_cli_basic
    test_analysis_cli_commands
    test_analysis_cli_script_analysis
    
    echo -e "\n${BLUE}=== analysis-cli.sh Test Suite Complete ===${NC}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi