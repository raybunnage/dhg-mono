#!/bin/bash

# Test suite for doc-cli-refactored.sh
# Tests: help, health-check, document operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/doc-cli-refactored.sh"

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

echo "=== Testing doc-cli-refactored.sh ==="
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
run_test "help command" "$CLI_SCRIPT help" "Core document management"

# Test 3: Sync-docs command exists
run_test "sync-docs command exists" "$CLI_SCRIPT help" "sync-docs.*Sync filesystem"

# Test 4: Find-new command exists
run_test "find-new command exists" "$CLI_SCRIPT help" "find-new.*Find and add new"

# Test 5: Classify-doc command exists
run_test "classify-doc command exists" "$CLI_SCRIPT help" "classify-doc.*Classify a single"

# Test 6: Tag-doc command exists
run_test "tag-doc command exists" "$CLI_SCRIPT help" "tag-doc.*Add tags"

# Test 7: Version display
run_test "version in help" "$CLI_SCRIPT help" "Version: 1.0.0"

# Test 8: Environment loading
run_test "environment loading" "$CLI_SCRIPT help" "Environment variables loaded"

# Test 9: Invalid command
run_test "invalid command handling" "$CLI_SCRIPT invalid-cmd" "Unknown command"

# Test 10: Mark-important command exists
run_test "mark-important command exists" "$CLI_SCRIPT help" "mark-important.*Set importance"

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