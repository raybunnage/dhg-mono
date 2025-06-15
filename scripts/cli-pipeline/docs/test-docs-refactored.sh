#!/bin/bash

# Test suite for docs-cli-refactored.sh
# Tests: help, health-check, documentation management

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/docs-cli-refactored.sh"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"
    
    echo -n "Testing $test_name... "
    
    # Run the command and capture output
    output=$($command 2>&1)
    exit_code=$?
    
    # Check if the expected pattern is found
    if [[ $output =~ $expected_pattern ]] || ([[ -z "$expected_pattern" ]] && [[ $exit_code -eq 0 ]]); then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAILED${NC}"
        echo "  Command: $command"
        echo "  Expected pattern: $expected_pattern"
        echo "  Output: ${output:0:200}..."
        ((TESTS_FAILED++))
    fi
}

echo "=== Testing docs-cli-refactored.sh ==="
echo ""

# Test 1: Script exists and is executable
if [[ -x "$CLI_SCRIPT" ]]; then
    echo -e "Script is executable: ${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "Script is executable: ${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test 2: Help command
run_test "help command" "$CLI_SCRIPT help" "Documentation management with monitoring"

# Test 3: Health check
run_test "health-check command" "$CLI_SCRIPT health-check" "health"

# Test 4: List command exists
run_test "list command exists" "$CLI_SCRIPT help" "list.*List all monitored"

# Test 5: Register command exists
run_test "register command exists" "$CLI_SCRIPT help" "register.*Register a new living"

# Test 6: Version display
run_test "version in help" "$CLI_SCRIPT help" "Version: 1.0.0"

# Test 7: Check-reviews command exists
run_test "check-reviews command exists" "$CLI_SCRIPT help" "check-reviews.*Show documents needing"

# Test 8: Archive command exists
run_test "archive command exists" "$CLI_SCRIPT help" "archive.*Archive old documentation"

# Test 9: Search command exists
run_test "search command exists" "$CLI_SCRIPT help" "search.*Search archived"

# Test 10: Update command exists
run_test "update command exists" "$CLI_SCRIPT help" "update.*Update document and reset"

# Test 11: Invalid command
run_test "invalid command handling" "$CLI_SCRIPT invalid-cmd" "Unknown command"

echo ""
echo "=== Test Summary ==="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

# Exit with appropriate code
if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi