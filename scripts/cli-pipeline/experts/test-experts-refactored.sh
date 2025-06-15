#!/bin/bash

# Test suite for experts-cli-refactored.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/experts-cli-refactored.sh"

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

# Test routing function (checks if command is recognized)
test_routing() {
    local test_name="$1"
    local command="$2"
    
    echo -n "Testing $test_name routing... "
    
    # Check if the command is routed (will show "Executing:" in output)
    if $CLI_SCRIPT $command 2>&1 | grep -q "Executing:"; then
        echo -e "${GREEN}PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAILED${NC}"
        ((TESTS_FAILED++))
    fi
}

echo "Testing experts-cli-refactored.sh"
echo "================================="

# Test help commands
test_command "help command" "help"
test_command "help flag" "--help"

# Test health check (actually executes)
test_command "health-check" "health-check"

# Test add-expert validation
echo -n "Testing add-expert missing name... "
if $CLI_SCRIPT add-expert 2>&1 | grep -q "expert-name is required"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test command routing
test_routing "list-experts" "list-experts"
test_routing "assign-folder-experts" "assign-folder-experts"
test_routing "propagate-expert-ids" "propagate-expert-ids"

# Test add-expert with dry-run (won't actually add)
test_routing "add-expert with params" "add-expert --expert-name TestExpert --dry-run"

# Test pass-through to TypeScript
test_routing "main command" "main"

# Summary
echo ""
echo "================================="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi