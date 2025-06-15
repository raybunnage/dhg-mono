#!/bin/bash

# Test suite for document-pipeline-service-cli-refactored.sh
# Tests: help, health-check, pipeline operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/document-pipeline-service-cli-refactored.sh"

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

echo "=== Testing document-pipeline-service-cli-refactored.sh ==="
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
run_test "help command" "$CLI_SCRIPT help" "Document pipeline and document type"

# Test 3: Health check
run_test "health-check command" "$CLI_SCRIPT health-check --skip-database --skip-claude" "health"

# Test 4: Test-connection command exists
run_test "test-connection command exists" "$CLI_SCRIPT help" "test-connection.*Test connection"

# Test 5: Sync command exists
run_test "sync command exists" "$CLI_SCRIPT help" "sync.*Synchronize database"

# Test 6: Version display
run_test "version in help" "$CLI_SCRIPT help" "Version: 1.0.0"

# Test 7: Find-new command exists
run_test "find-new command exists" "$CLI_SCRIPT help" "find-new.*Find and insert new"

# Test 8: Environment loading
run_test "environment loading" "$CLI_SCRIPT help" "Loading environment variables"

# Test 9: All command exists
run_test "all command exists" "$CLI_SCRIPT help" "all.*Run the complete pipeline"

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