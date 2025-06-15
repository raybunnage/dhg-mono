#!/bin/bash

# Run all tests for Alpha pipelines
# Infrastructure & System Management pipelines

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Alpha pipelines list
ALPHA_PIPELINES=(
    "testing"
    "utilities"
    "system"
    "registry"
    "tracking"
    "maintenance"
    "continuous"
    "proxy"
    "servers"
    "monitoring"
    "shared-services"
    "service-dependencies"
    "refactor-tracking"
    "deprecation"
    "all-pipelines"
    "database"
    "deployment"
)

# Test tracking
TOTAL_PIPELINES=${#ALPHA_PIPELINES[@]}
PASSED_PIPELINES=0
FAILED_PIPELINES=0
SKIPPED_PIPELINES=0

# Results storage
declare -A TEST_RESULTS
declare -A TEST_TIMES

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Alpha Pipeline Test Suite${NC}"
echo -e "${BLUE}    Infrastructure & System Management${NC}"
echo -e "${BLUE}========================================${NC}"
echo
echo "Testing $TOTAL_PIPELINES pipelines..."
echo

# Function to run test for a single pipeline
run_pipeline_test() {
    local pipeline="$1"
    local test_file="$PROJECT_ROOT/scripts/cli-pipeline/$pipeline/tests/test-$pipeline-cli.sh"
    
    echo -e "\n${CYAN}Testing $pipeline pipeline...${NC}"
    
    # Check if test exists
    if [[ ! -f "$test_file" ]]; then
        echo -e "${YELLOW}⚠️  SKIPPED${NC}: No test file found at $test_file"
        ((SKIPPED_PIPELINES++))
        TEST_RESULTS["$pipeline"]="SKIPPED"
        return 0
    fi
    
    # Run the test with timing
    local start_time=$(date +%s)
    if bash "$test_file" > /tmp/test-$pipeline.log 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        TEST_TIMES["$pipeline"]=$duration
        echo -e "${GREEN}✅ PASSED${NC} (${duration}s)"
        ((PASSED_PIPELINES++))
        TEST_RESULTS["$pipeline"]="PASSED"
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        TEST_TIMES["$pipeline"]=$duration
        echo -e "${RED}❌ FAILED${NC} (${duration}s)"
        echo "  See /tmp/test-$pipeline.log for details"
        ((FAILED_PIPELINES++))
        TEST_RESULTS["$pipeline"]="FAILED"
        
        # Show last few lines of error
        echo "  Error output:"
        tail -n 5 /tmp/test-$pipeline.log | sed 's/^/    /'
    fi
}

# Generate tests if they don't exist
if [[ "$1" == "--generate" ]] || [[ "$1" == "-g" ]]; then
    echo "Generating missing tests first..."
    bash "$SCRIPT_DIR/generate-alpha-tests.sh"
    echo
fi

# Run tests for all pipelines
start_time=$(date +%s)

for pipeline in "${ALPHA_PIPELINES[@]}"; do
    run_pipeline_test "$pipeline"
done

end_time=$(date +%s)
total_duration=$((end_time - start_time))

# Summary report
echo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}         Test Summary Report${NC}"
echo -e "${BLUE}========================================${NC}"
echo
echo "Total pipelines tested: $TOTAL_PIPELINES"
echo -e "Passed: ${GREEN}$PASSED_PIPELINES${NC}"
echo -e "Failed: ${RED}$FAILED_PIPELINES${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED_PIPELINES${NC}"
echo "Total time: ${total_duration}s"
echo

# Detailed results
echo -e "${BLUE}Pipeline Results:${NC}"
echo "----------------------------------------"
printf "%-25s %-10s %s\n" "Pipeline" "Status" "Time"
echo "----------------------------------------"

for pipeline in "${ALPHA_PIPELINES[@]}"; do
    status="${TEST_RESULTS[$pipeline]}"
    time="${TEST_TIMES[$pipeline]:-0}s"
    
    case "$status" in
        "PASSED")
            printf "%-25s ${GREEN}%-10s${NC} %s\n" "$pipeline" "$status" "$time"
            ;;
        "FAILED")
            printf "%-25s ${RED}%-10s${NC} %s\n" "$pipeline" "$status" "$time"
            ;;
        "SKIPPED")
            printf "%-25s ${YELLOW}%-10s${NC} %s\n" "$pipeline" "$status" "-"
            ;;
    esac
done

echo "----------------------------------------"

# Failed test details
if [[ $FAILED_PIPELINES -gt 0 ]]; then
    echo
    echo -e "${RED}Failed Pipelines:${NC}"
    for pipeline in "${ALPHA_PIPELINES[@]}"; do
        if [[ "${TEST_RESULTS[$pipeline]}" == "FAILED" ]]; then
            echo "  - $pipeline (see /tmp/test-$pipeline.log)"
        fi
    done
fi

# Success/failure message
echo
if [[ $FAILED_PIPELINES -eq 0 ]]; then
    echo -e "${GREEN}✅ All Alpha pipeline tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the logs.${NC}"
    exit 1
fi