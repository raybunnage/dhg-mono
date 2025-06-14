#!/bin/bash

# Test suite for classify-cli-refactored.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/classify-cli-refactored.sh"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_command() {
    local test_name="$1"
    local command="$2"
    
    echo -n "Testing $test_name... "
    
    if $CLI_SCRIPT $command >/dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

echo "Testing classify-cli-refactored.sh"
echo "=================================="

# Test help commands
test_command "help command" "help"
test_command "help flag" "--help"
test_command "help flag short" "-h"

# Test health check
test_command "health-check" "health-check"

# Test command routing
test_command "list command routing" "list"
test_command "classify-subjects routing" "classify-subjects --dry-run"

# Test error handling
echo -n "Testing unknown command handling... "
if $CLI_SCRIPT unknown-command 2>&1 | grep -q "Unknown command"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test command with ID requirement
test_command "get command routing" "get test-id"

# Summary
echo ""
echo "=================================="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi