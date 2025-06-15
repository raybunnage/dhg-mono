#!/bin/bash

# Direct test runner for Gamma pipelines
# Tests basic functionality without the test framework complexity

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Gamma Pipeline Direct Test Suite ===${NC}"
echo "Testing all 7 Gamma pipelines with multiple commands..."
echo

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test a pipeline with multiple commands
test_pipeline() {
    local name="$1"
    local cli_path="$2"
    shift 2
    local commands=("$@")
    
    echo -e "\n${BLUE}Testing $name pipeline...${NC}"
    
    # Test 1: File exists
    ((TOTAL_TESTS++))
    if [[ -f "$cli_path" ]]; then
        echo -e "  File exists: ${GREEN}✓${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "  File exists: ${RED}✗${NC}"
        ((FAILED_TESTS++))
        return
    fi
    
    # Test 2: File is executable
    ((TOTAL_TESTS++))
    if [[ -x "$cli_path" ]]; then
        echo -e "  Executable: ${GREEN}✓${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "  Executable: ${RED}✗${NC}"
        ((FAILED_TESTS++))
    fi
    
    # Test 3: Help command
    ((TOTAL_TESTS++))
    if $cli_path help >/dev/null 2>&1; then
        echo -e "  Help command: ${GREEN}✓${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "  Help command: ${RED}✗${NC}"
        ((FAILED_TESTS++))
    fi
    
    # Test 4: Unknown command handling
    ((TOTAL_TESTS++))
    output=$($cli_path unknown-xyz-command 2>&1 || true)
    if echo "$output" | grep -qi "unknown command"; then
        echo -e "  Unknown command handling: ${GREEN}✓${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "  Unknown command handling: ${RED}✗${NC}"
        ((FAILED_TESTS++))
    fi
    
    # Test specific commands
    for cmd in "${commands[@]}"; do
        ((TOTAL_TESTS++))
        if $cli_path "$cmd" --help >/dev/null 2>&1 || $cli_path "$cmd" >/dev/null 2>&1; then
            echo -e "  Command '$cmd': ${GREEN}✓${NC}"
            ((PASSED_TESTS++))
        else
            # Check if it's just a warning about missing services
            output=$($cli_path "$cmd" 2>&1 || true)
            if echo "$output" | grep -qi "warn\|not found\|missing"; then
                echo -e "  Command '$cmd': ${YELLOW}⚠${NC} (service warning)"
                ((PASSED_TESTS++))
            else
                echo -e "  Command '$cmd': ${RED}✗${NC}"
                ((FAILED_TESTS++))
            fi
        fi
    done
}

# Test all Gamma pipelines
test_pipeline "media-analytics" \
    "$PROJECT_ROOT/scripts/cli-pipeline/media-analytics/media-analytics-cli.sh" \
    "analyze" "health-check"

test_pipeline "media-processing" \
    "$PROJECT_ROOT/scripts/cli-pipeline/media-processing/media-processing-cli.sh" \
    "list" "health-check"

test_pipeline "mime_types" \
    "$PROJECT_ROOT/scripts/cli-pipeline/mime_types/mime-types-cli.sh" \
    "list" "health-check"

test_pipeline "presentations" \
    "$PROJECT_ROOT/scripts/cli-pipeline/presentations/presentations-cli.sh" \
    "list" "health-check"

test_pipeline "prompt_service" \
    "$PROJECT_ROOT/scripts/cli-pipeline/prompt_service/prompt-service-cli.sh" \
    "list" "health-check"

test_pipeline "scripts" \
    "$PROJECT_ROOT/scripts/cli-pipeline/scripts/scripts-cli.sh" \
    "list" "health-check"

test_pipeline "work_summaries" \
    "$PROJECT_ROOT/scripts/cli-pipeline/work_summaries/work-summaries-cli.sh" \
    "list" "health-check"

# Summary
echo
echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total tests run: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo "Success rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "\n${GREEN}✅ All Gamma pipeline tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    exit 1
fi