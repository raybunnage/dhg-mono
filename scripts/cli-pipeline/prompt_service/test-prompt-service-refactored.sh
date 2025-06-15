#!/bin/bash

# Test suite for prompt-service-cli-refactored.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/prompt-service-cli-refactored.sh"

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

echo "Testing prompt-service-cli-refactored.sh"
echo "========================================"

# Test help commands
test_command "help command" "help"
test_command "help flag" "--help"

# Test health check (uses fallback)
test_command "health-check" "health-check"

# Test template commands
test_command "template help" "template help"
test_routing "template list" "template list-templates"

# Test template validation
echo -n "Testing template view validation... "
if $CLI_SCRIPT template view-template 2>&1 | grep -q "Template name is required"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing template associate validation... "
if $CLI_SCRIPT template associate-template 2>&1 | grep -q "Prompt name and template name are required"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test command routing (will have compilation errors but tests routing)
test_routing "list" "list"
test_routing "summarize-metadata" "summarize-metadata"

# Summary
echo ""
echo "========================================"
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi