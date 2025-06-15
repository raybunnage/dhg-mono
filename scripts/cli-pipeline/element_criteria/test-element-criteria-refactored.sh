#!/bin/bash

# Test suite for element-criteria-cli-refactored.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_SCRIPT="$SCRIPT_DIR/element-criteria-cli-refactored.sh"

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

echo "Testing element-criteria-cli-refactored.sh"
echo "=========================================="

# Test help commands
test_command "help command" "help"
test_command "help flag" "--help"

# Test health check
test_command "health-check" "health-check"

# Test command routing (will show file not found but tests routing)
echo -n "Testing list-templates routing... "
if $CLI_SCRIPT list-templates 2>&1 | grep -q "TypeScript implementation not found"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing coverage-report routing... "
if $CLI_SCRIPT coverage-report 2>&1 | grep -q "TypeScript implementation not found"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing suggest routing... "
if $CLI_SCRIPT suggest 2>&1 | grep -q "TypeScript implementation not found"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing add-criteria routing... "
if $CLI_SCRIPT add-criteria 2>&1 | grep -q "TypeScript implementation not found"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test error handling
echo -n "Testing unknown command handling... "
if $CLI_SCRIPT unknown-command 2>&1 | grep -q "Unknown command"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Test emoji output
echo -n "Testing emoji output... "
if $CLI_SCRIPT list-templates 2>&1 | grep -q "📚 Listing templates"; then
    echo -e "${GREEN}PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}FAILED${NC}"
    ((TESTS_FAILED++))
fi

# Summary
echo ""
echo "=========================================="
echo "Tests passed: $TESTS_PASSED"
echo "Tests failed: $TESTS_FAILED"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi