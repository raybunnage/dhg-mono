#!/bin/bash

# Test runner for SimpleCLIPipeline proof-of-concept
# Runs tests for the 3 simplest pipelines

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}CLI Pipeline Testing Proof-of-Concept${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""
echo "Testing 3 SimpleCLIPipeline implementations:"
echo "1. scripts-cli.sh"
echo "2. test-git-cli.sh (in git/ directory)"
echo "3. work-summaries-cli.sh"
echo ""

# Function to run a test suite
run_test_suite() {
    local test_script="$1"
    local suite_name="$2"
    
    echo -e "${YELLOW}Running test suite: $suite_name${NC}"
    echo "Test script: $test_script"
    echo ""
    
    ((TOTAL_SUITES++))
    
    if [ ! -f "$test_script" ]; then
        echo -e "${RED}❌ Test script not found: $test_script${NC}"
        ((FAILED_SUITES++))
        return 1
    fi
    
    # Make sure test script is executable
    chmod +x "$test_script"
    
    # Run the test suite
    if "$test_script"; then
        echo -e "${GREEN}✅ Test suite passed: $suite_name${NC}"
        ((PASSED_SUITES++))
        return 0
    else
        echo -e "${RED}❌ Test suite failed: $suite_name${NC}"
        ((FAILED_SUITES++))
        return 1
    fi
}

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Warning: Not in a git repository. Some git tests may fail.${NC}"
    fi
    
    # Check if environment variables are set
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo -e "${YELLOW}⚠️  Warning: Supabase environment variables not set. Some tests may fail.${NC}"
    fi
    
    # Check if required directories exist
    if [ ! -d "$PROJECT_ROOT/scripts/cli-pipeline" ]; then
        echo -e "${RED}❌ Error: CLI pipeline directory not found${NC}"
        exit 1
    fi
    
    echo "Prerequisites check complete."
    echo ""
}

# Main test execution
main() {
    cd "$PROJECT_ROOT"
    
    check_prerequisites
    
    echo -e "${BLUE}Starting test execution...${NC}"
    echo ""
    
    # Run test suites for the 3 simple pipelines
    run_test_suite "$PROJECT_ROOT/scripts/cli-pipeline/scripts/tests/test-scripts-cli.sh" "scripts-cli.sh"
    echo ""
    
    run_test_suite "$PROJECT_ROOT/scripts/cli-pipeline/git/tests/test-git-cli.sh" "test-git-cli.sh"
    echo ""
    
    run_test_suite "$PROJECT_ROOT/scripts/cli-pipeline/work_summaries/tests/test-work-summaries-cli.sh" "work-summaries-cli.sh"
    echo ""
    
    # Summary
    echo -e "${BLUE}=======================================${NC}"
    echo -e "${BLUE}Test Execution Summary${NC}"
    echo -e "${BLUE}=======================================${NC}"
    echo ""
    echo "Total test suites: $TOTAL_SUITES"
    echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
    echo -e "Failed: ${RED}$FAILED_SUITES${NC}"
    echo ""
    
    if [ $FAILED_SUITES -eq 0 ]; then
        echo -e "${GREEN}🎉 All test suites passed!${NC}"
        echo ""
        echo "This proves that comprehensive testing is feasible for CLI pipelines."
        echo "The test framework provides:"
        echo "  ✅ Command validation"
        echo "  ✅ Error condition testing"
        echo "  ✅ Framework integration verification"
        echo "  ✅ Edge case handling"
        echo ""
        echo "Next steps:"
        echo "  1. Extend this approach to ServiceCLIPipeline tests"
        echo "  2. Add database integration testing"
        echo "  3. Create service mocking capabilities"
        echo "  4. Add performance and load testing"
        return 0
    else
        echo -e "${RED}❌ $FAILED_SUITES test suite(s) failed${NC}"
        echo ""
        echo "Review the failed tests above to identify issues."
        echo "Common causes:"
        echo "  • Missing environment variables"
        echo "  • Missing TypeScript dependencies"
        echo "  • Pipeline script bugs"
        echo "  • Test framework issues"
        return 1
    fi
}

# Make test framework executable
chmod +x "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# Run main function
main "$@"