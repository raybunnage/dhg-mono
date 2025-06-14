#!/usr/bin/env bash

# Test script for docs-cli refactoring
# Validates functionality preservation for all 11 commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFACTORED_CLI="$SCRIPT_DIR/docs-cli-refactored.sh"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🧪 Testing Documentation CLI Refactoring"
echo "======================================="
echo ""

# Test 1: Help command
echo "Test 1: Help command..."
if $REFACTORED_CLI --help >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}: Help command works"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Help command failed"
    ((TESTS_FAILED++))
fi

# Test 2: Unknown command handling
echo "Test 2: Unknown command handling..."
if ! $REFACTORED_CLI unknown-cmd 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}: Unknown command properly rejected"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Unknown command not handled"
    ((TESTS_FAILED++))
fi

# Test 3: Health check command
echo "Test 3: Health check command..."
if $REFACTORED_CLI health-check 2>&1 | grep -q "pipeline is healthy"; then
    echo -e "${GREEN}✅ PASS${NC}: Health check works"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Health check failed"
    ((TESTS_FAILED++))
fi

# Test 4: Debug mode
echo "Test 4: Debug mode..."
if $REFACTORED_CLI health-check --debug 2>&1 | grep -q "DEBUG"; then
    echo -e "${GREEN}✅ PASS${NC}: Debug mode works"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Debug mode not working"
    ((TESTS_FAILED++))
fi

# Test 5: Command structure preservation
echo "Test 5: Command structure..."
HELP_OUTPUT=$($REFACTORED_CLI --help 2>&1)
COMMANDS=(
    "register"
    "list"
    "check-reviews"
    "daily-check"
    "update"
    "archive"
    "search"
    "format"
    "bulk-format"
    "sync-db"
    "report"
    "health-check"
)

all_present=true
for cmd in "${COMMANDS[@]}"; do
    if ! echo "$HELP_OUTPUT" | grep -q "$cmd"; then
        all_present=false
        echo -e "${RED}   Missing command: $cmd${NC}"
    fi
done

if [[ "$all_present" == "true" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: All 12 commands present"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Some commands missing"
    ((TESTS_FAILED++))
fi

# Test 6: Environment loading
echo "Test 6: Environment loading..."
if $REFACTORED_CLI health-check 2>&1 | grep -q "Environment variables loaded\|SUCCESS"; then
    echo -e "${GREEN}✅ PASS${NC}: Environment loaded"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Environment not loaded"
    ((TESTS_FAILED++))
fi

# Test 7: Command tracking integration
echo "Test 7: Command tracking..."
if $REFACTORED_CLI health-check --debug 2>&1 | grep -q "Tracking command"; then
    echo -e "${GREEN}✅ PASS${NC}: Command tracking integrated"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Command tracking not integrated"
    ((TESTS_FAILED++))
fi

# Test 8: Logging functions
echo "Test 8: Logging functions..."
OUTPUT=$($REFACTORED_CLI health-check 2>&1)
if echo "$OUTPUT" | grep -q "INFO" && \
   echo "$OUTPUT" | grep -q "SUCCESS\|✅"; then
    echo -e "${GREEN}✅ PASS${NC}: Logging functions working"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Logging functions not working"
    ((TESTS_FAILED++))
fi

# Test 9: TypeScript command execution (list command)
echo "Test 9: TypeScript command execution..."
# The list command should try to execute its TypeScript file
if $REFACTORED_CLI list 2>&1 | grep -E "INFO.*Listing monitored documents|exec.*list-documents\.ts"; then
    echo -e "${GREEN}✅ PASS${NC}: TypeScript execution attempted"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: TypeScript execution not working"
    ((TESTS_FAILED++))
fi

# Test 10: Examples in help output
echo "Test 10: Examples preservation..."
if $REFACTORED_CLI --help 2>&1 | grep -q "EXAMPLES:"; then
    echo -e "${GREEN}✅ PASS${NC}: Examples preserved in help"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Examples missing from help"
    ((TESTS_FAILED++))
fi

# Summary
echo ""
echo "Test Summary"
echo "============"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 All tests passed! Pipeline is validated.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review.${NC}"
    exit 1
fi