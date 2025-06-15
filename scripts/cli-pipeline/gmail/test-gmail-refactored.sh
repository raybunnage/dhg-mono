#!/bin/bash

# Test suite for gmail-cli-refactored.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/gmail-cli-refactored.sh"

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

echo "Testing gmail-cli-refactored.sh"
echo "======================================"

# Test help command
test_command "help command" "help"
test_command "help flag" "--help"

# Test command presence and error handling
test_command "status command" "status"

# Test manage-addresses subcommands
test_command "manage-addresses list routing" "manage-addresses list"

# Test error handling
echo -n "Testing unknown command handling... "
if $CLI_SCRIPT unknown-command 2>&1 | grep -q "Unknown command"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing manage-addresses missing email... "
if $CLI_SCRIPT manage-addresses add 2>&1 | grep -q "Email address required"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing manage-addresses unknown action... "
if $CLI_SCRIPT manage-addresses invalid-action 2>&1 | grep -q "Unknown action"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Summary
echo ""
echo "======================================"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi