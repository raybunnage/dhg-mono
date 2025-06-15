#!/bin/bash

# Run all Beta group pipeline tests
# This script runs all 17 test suites and provides a summary

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_PIPELINES=0
PASSED_PIPELINES=0
FAILED_PIPELINES=0
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0

# Arrays to track results
declare -a FAILED_SCRIPTS=()
declare -a PIPELINE_RESULTS=()

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       Running All Beta Group Pipeline Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to run a test and capture results
run_pipeline_test() {
    local pipeline_name="$1"
    local test_path="$2"
    
    echo -e "${YELLOW}Testing $pipeline_name...${NC}"
    
    if [[ ! -f "$test_path" ]]; then
        echo -e "${RED}  ❌ Test script not found: $test_path${NC}"
        ((FAILED_PIPELINES++))
        FAILED_SCRIPTS+=("$pipeline_name (not found)")
        return
    fi
    
    # Run the test and capture output
    output=$("$test_path" 2>&1)
    exit_code=$?
    
    # Extract test counts from output - handle different formats
    # Format 1: "Tests Passed: [0;32m10[0m"
    if [[ $output =~ Tests\ Passed:.*\[0\;32m([0-9]+) ]]; then
        tests_passed="${BASH_REMATCH[1]}"
    # Format 2: "Tests passed: 10"
    elif [[ $output =~ Tests\ passed:\ ([0-9]+) ]]; then
        tests_passed="${BASH_REMATCH[1]}"
    else
        tests_passed=0
    fi
    
    # Format 1: "Tests Failed: [0;31m0[0m"
    if [[ $output =~ Tests\ Failed:.*\[0\;31m([0-9]+) ]]; then
        tests_failed="${BASH_REMATCH[1]}"
    # Format 2: "Tests failed: 0"
    elif [[ $output =~ Tests\ failed:\ ([0-9]+) ]]; then
        tests_failed="${BASH_REMATCH[1]}"
    else
        tests_failed=0
    fi
    
    total_tests=$((tests_passed + tests_failed))
    
    # Update counters
    ((TOTAL_PIPELINES++))
    ((TOTAL_TESTS += total_tests))
    ((TOTAL_PASSED += tests_passed))
    ((TOTAL_FAILED += tests_failed))
    
    # Check if pipeline passed
    if [[ $exit_code -eq 0 ]] && [[ $tests_failed -eq 0 ]]; then
        echo -e "${GREEN}  ✅ PASSED: $tests_passed/$total_tests tests${NC}"
        ((PASSED_PIPELINES++))
        PIPELINE_RESULTS+=("$pipeline_name: $tests_passed/$total_tests ✅")
    else
        echo -e "${RED}  ❌ FAILED: $tests_passed/$total_tests tests${NC}"
        ((FAILED_PIPELINES++))
        FAILED_SCRIPTS+=("$pipeline_name ($tests_passed/$total_tests)")
        PIPELINE_RESULTS+=("$pipeline_name: $tests_passed/$total_tests ❌")
    fi
    echo ""
}

# Get the base directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run all Beta group tests
echo -e "${BLUE}LOW Complexity Pipelines:${NC}"
run_pipeline_test "mime-types-cli" "$SCRIPT_DIR/mime_types/test-mime-types-refactored.sh"
run_pipeline_test "doc-cli" "$SCRIPT_DIR/document/test-doc-refactored.sh"
run_pipeline_test "docs-cli" "$SCRIPT_DIR/docs/test-docs-refactored.sh"
run_pipeline_test "document-pipeline-service-cli" "$SCRIPT_DIR/document/test-document-pipeline-service-refactored.sh"
run_pipeline_test "drive-filter-cli" "$SCRIPT_DIR/drive_filter/test-drive-filter-refactored.sh"
run_pipeline_test "gmail-cli" "$SCRIPT_DIR/gmail/test-gmail-refactored.sh"

echo -e "${BLUE}MEDIUM Complexity Pipelines:${NC}"
run_pipeline_test "media-analytics-cli" "$SCRIPT_DIR/media-analytics/test-media-analytics-refactored.sh"
run_pipeline_test "classify-cli" "$SCRIPT_DIR/classify/test-classify-refactored.sh"
run_pipeline_test "document-types-cli" "$SCRIPT_DIR/document_types/test-document-types-refactored.sh"
run_pipeline_test "experts-cli" "$SCRIPT_DIR/experts/test-experts-refactored.sh"
run_pipeline_test "presentations-cli" "$SCRIPT_DIR/presentations/test-presentations-refactored.sh"
run_pipeline_test "prompt-service-cli" "$SCRIPT_DIR/prompt_service/test-prompt-service-refactored.sh"
run_pipeline_test "element-criteria-cli" "$SCRIPT_DIR/element_criteria/test-element-criteria-refactored.sh"
run_pipeline_test "document-archiving-cli" "$SCRIPT_DIR/document_archiving/test-document-archiving-refactored.sh"

echo -e "${BLUE}HIGH Complexity Pipelines:${NC}"
run_pipeline_test "google-sync-cli" "$SCRIPT_DIR/google_sync/test-google-sync-refactored.sh"
run_pipeline_test "dev-tasks-cli" "$SCRIPT_DIR/dev_tasks/test-dev-tasks-refactored.sh"
run_pipeline_test "media-processing-cli" "$SCRIPT_DIR/media-processing/test-media-processing-refactored.sh"

# Print summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    TEST SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Pipelines Tested:  ${TOTAL_PIPELINES}"
echo -e "Pipelines Passed:  ${GREEN}${PASSED_PIPELINES}${NC}"
echo -e "Pipelines Failed:  ${RED}${FAILED_PIPELINES}${NC}"
echo ""
echo -e "Total Tests Run:   ${TOTAL_TESTS}"
echo -e "Tests Passed:      ${GREEN}${TOTAL_PASSED}${NC}"
echo -e "Tests Failed:      ${RED}${TOTAL_FAILED}${NC}"
echo ""

# Show detailed results
echo -e "${BLUE}Detailed Results:${NC}"
for result in "${PIPELINE_RESULTS[@]}"; do
    echo "  $result"
done

# Show failed scripts if any
if [[ ${#FAILED_SCRIPTS[@]} -gt 0 ]]; then
    echo ""
    echo -e "${RED}Failed Pipelines:${NC}"
    for failed in "${FAILED_SCRIPTS[@]}"; do
        echo -e "  ${RED}❌ $failed${NC}"
    done
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Exit with appropriate code
if [[ $FAILED_PIPELINES -eq 0 ]]; then
    echo -e "${GREEN}🎉 All Beta group pipeline tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please check the output above.${NC}"
    exit 1
fi