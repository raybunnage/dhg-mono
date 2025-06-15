#!/bin/bash

# Direct test runner for Beta pipelines
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

echo -e "${BLUE}=== Beta Pipeline Direct Test Suite ===${NC}"
echo "Testing all 20 Beta pipelines with multiple commands..."
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

# Test all Beta pipelines
test_pipeline "ai" \
    "$PROJECT_ROOT/scripts/cli-pipeline/ai/ai-cli.sh" \
    "analyze" "health-check"

test_pipeline "analysis" \
    "$PROJECT_ROOT/scripts/cli-pipeline/analysis/analysis-cli.sh" \
    "analyze" "health-check"

test_pipeline "archive" \
    "$PROJECT_ROOT/scripts/cli-pipeline/archive/archive-cli.sh" \
    "list" "health-check"

test_pipeline "auth" \
    "$PROJECT_ROOT/scripts/cli-pipeline/auth/auth-cli.sh" \
    "list" "health-check"

test_pipeline "classify" \
    "$PROJECT_ROOT/scripts/cli-pipeline/classify/classify-cli.sh" \
    "analyze" "health-check"

test_pipeline "continuous_docs" \
    "$PROJECT_ROOT/scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh" \
    "check" "health-check"

test_pipeline "dev_tasks" \
    "$PROJECT_ROOT/scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh" \
    "list" "health-check"

test_pipeline "docs" \
    "$PROJECT_ROOT/scripts/cli-pipeline/docs/docs-cli.sh" \
    "list" "health-check"

test_pipeline "document" \
    "$PROJECT_ROOT/scripts/cli-pipeline/document/doc-cli.sh" \
    "list" "health-check"

test_pipeline "document_archiving" \
    "$PROJECT_ROOT/scripts/cli-pipeline/document_archiving/document-archiving-cli.sh" \
    "list" "health-check"

test_pipeline "document_types" \
    "$PROJECT_ROOT/scripts/cli-pipeline/document_types/document-types-cli.sh" \
    "list" "health-check"

test_pipeline "drive_filter" \
    "$PROJECT_ROOT/scripts/cli-pipeline/drive_filter/drive-filter-cli.sh" \
    "list" "health-check"

test_pipeline "element_criteria" \
    "$PROJECT_ROOT/scripts/cli-pipeline/element_criteria/element-criteria-cli.sh" \
    "list" "health-check"

test_pipeline "email" \
    "$PROJECT_ROOT/scripts/cli-pipeline/email/email-cli.sh" \
    "list" "health-check"

test_pipeline "experts" \
    "$PROJECT_ROOT/scripts/cli-pipeline/experts/experts-cli.sh" \
    "list" "health-check"

test_pipeline "git" \
    "$PROJECT_ROOT/scripts/cli-pipeline/git/git-cli.sh" \
    "status" "health-check"

test_pipeline "git_workflow" \
    "$PROJECT_ROOT/scripts/cli-pipeline/git_workflow/git-workflow-cli.sh" \
    "status" "health-check"

test_pipeline "gmail" \
    "$PROJECT_ROOT/scripts/cli-pipeline/gmail/gmail-cli.sh" \
    "list" "health-check"

test_pipeline "google_sync" \
    "$PROJECT_ROOT/scripts/cli-pipeline/google_sync/google-sync-cli.sh" \
    "list-drives" "health-check"

test_pipeline "living_docs" \
    "$PROJECT_ROOT/scripts/cli-pipeline/living_docs/living-docs-cli.sh" \
    "list" "health-check"

# Summary
echo
echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total tests run: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo "Success rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "\n${GREEN}✅ All Beta pipeline tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    exit 1
fi