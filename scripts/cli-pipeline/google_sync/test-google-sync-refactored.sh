#!/bin/bash

# Test suite for google-sync-cli-refactored.sh
# Tests: help, health-check, dry-run mode, command tracking

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/google-sync-cli-refactored.sh"

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

echo "=== Testing google-sync-cli-refactored.sh ==="
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
run_test "help command" "$CLI_SCRIPT help" "Google Drive synchronization"

# Test 3: Health check
run_test "health-check command" "$CLI_SCRIPT health-check" "health check"

# Test 4: Sync-all with dry-run
run_test "sync-all --dry-run" "$CLI_SCRIPT sync-all --dry-run" "sync-all"

# Test 5: List command with limit
run_test "list --limit 5" "$CLI_SCRIPT list --limit 5" "list"

# Test 6: Invalid command
run_test "invalid command handling" "$CLI_SCRIPT invalid-command" "TypeScript file not found"

# Test 7: Version display
run_test "version in help" "$CLI_SCRIPT help" "Version: 2.0.0"

# Test 8: Command tracking
run_test "command tracking wrapper" "$CLI_SCRIPT help" "INFO.*google_sync"

# Test 9: Environment loading
run_test "environment loading" "$CLI_SCRIPT help" "Loading environment variables"

# Test 10: Classify command exists
run_test "classify command exists" "$CLI_SCRIPT help" "classify.*Universal"

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