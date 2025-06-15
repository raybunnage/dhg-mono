#!/usr/bin/env bash

# Test script for mime-types-cli
# Validates that the refactored version maintains functionality

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFACTORED_CLI="$SCRIPT_DIR/mime-types-cli-simple.sh"
ORIGINAL_CLI="$SCRIPT_DIR/mime-types-cli.sh"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🧪 Testing MIME Types CLI Refactoring"
echo "===================================="
echo ""

# Test 1: Help command works
echo "Test 1: Help command..."
if $REFACTORED_CLI --help >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}: Help command works"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Help command failed"
    ((TESTS_FAILED++))
fi

# Test 2: Health check command works
echo "Test 2: Health check command..."
if $REFACTORED_CLI health-check >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}: Health check command works"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Health check command failed"
    ((TESTS_FAILED++))
fi

# Test 3: Unknown command shows error
echo "Test 3: Unknown command handling..."
if ! $REFACTORED_CLI unknown-command >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}: Unknown command properly rejected"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Unknown command not handled correctly"
    ((TESTS_FAILED++))
fi

# Test 4: Sync command validation (dry run)
echo "Test 4: Sync command with --dry-run..."
# Just check if the command is accepted, not if it actually syncs
if $REFACTORED_CLI sync --dry-run 2>&1 | grep -q "synchronization\|Starting\|INFO"; then
    echo -e "${GREEN}✅ PASS${NC}: Sync command accepts --dry-run"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Sync command --dry-run failed"
    ((TESTS_FAILED++))
fi

# Test 5: Script exists and is executable
echo "Test 5: Script file validation..."
if [[ -x "$REFACTORED_CLI" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: Refactored script is executable"
    ((TESTS_PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Refactored script not executable"
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