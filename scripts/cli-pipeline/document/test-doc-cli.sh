#!/usr/bin/env bash

# Test script for doc-cli refactoring
# Validates functionality preservation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFACTORED_CLI="$SCRIPT_DIR/doc-cli-refactored.sh"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🧪 Testing Document CLI Refactoring"
echo "==================================="
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

# Test 3: Missing parameters - classify-doc
echo "Test 3: Missing parameter handling (classify-doc)..."
if $REFACTORED_CLI classify-doc 2>&1 | grep -q "Missing required argument"; then
    echo -e "${GREEN}✅ PASS${NC}: Missing parameter detected"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Missing parameter not detected"
    ((TESTS_FAILED++))
fi

# Test 4: Missing parameters - tag-doc
echo "Test 4: Missing parameter handling (tag-doc)..."
if $REFACTORED_CLI tag-doc docs/test.md 2>&1 | grep -q "Missing required arguments"; then
    echo -e "${GREEN}✅ PASS${NC}: Missing tags detected"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Missing tags not detected"
    ((TESTS_FAILED++))
fi

# Test 5: Invalid importance score
echo "Test 5: Invalid importance score validation..."
if $REFACTORED_CLI mark-important docs/test.md 10 2>&1 | grep -q "between 1 and 5"; then
    echo -e "${GREEN}✅ PASS${NC}: Invalid score rejected"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Invalid score not validated"
    ((TESTS_FAILED++))
fi

# Test 6: Valid importance score format
echo "Test 6: Valid importance score format..."
if $REFACTORED_CLI mark-important docs/test.md 3 2>&1 | grep -q "Setting importance\|INFO"; then
    echo -e "${GREEN}✅ PASS${NC}: Valid score accepted"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Valid score not processed"
    ((TESTS_FAILED++))
fi

# Test 7: Environment loading
echo "Test 7: Environment loading..."
if $REFACTORED_CLI help 2>&1 | grep -q "Environment variables loaded"; then
    echo -e "${GREEN}✅ PASS${NC}: Environment loaded"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Environment not loaded"
    ((TESTS_FAILED++))
fi

# Test 8: Command structure preservation
echo "Test 8: Command structure..."
HELP_OUTPUT=$($REFACTORED_CLI --help 2>&1)
if echo "$HELP_OUTPUT" | grep -q "sync-docs" && \
   echo "$HELP_OUTPUT" | grep -q "find-new" && \
   echo "$HELP_OUTPUT" | grep -q "classify-doc" && \
   echo "$HELP_OUTPUT" | grep -q "tag-doc" && \
   echo "$HELP_OUTPUT" | grep -q "mark-important" && \
   echo "$HELP_OUTPUT" | grep -q "enable-auto-update"; then
    echo -e "${GREEN}✅ PASS${NC}: All commands present"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Some commands missing"
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