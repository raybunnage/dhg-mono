#!/bin/bash

# Master test runner for all comprehensive CLI pipeline tests
# Runs detailed tests for each pipeline based on complexity

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}COMPREHENSIVE CLI PIPELINE TEST RUNNER${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "Running comprehensive tests for all Gamma CLI pipelines"
echo "Tests are organized by complexity level:"
echo ""

# Define pipelines by complexity
declare -A COMPLEX_PIPELINES=(
    ["scripts"]="scripts/cli-pipeline/scripts/tests/test-scripts-comprehensive.sh"
    ["auth"]="scripts/cli-pipeline/auth/tests/test-auth-comprehensive.sh"
    ["git"]="scripts/cli-pipeline/git/tests/test-git-comprehensive.sh"
    ["email"]="scripts/cli-pipeline/email/tests/test-email-comprehensive.sh"
    ["gmail"]="scripts/cli-pipeline/gmail/tests/test-gmail-comprehensive.sh"
    ["continuous-docs"]="scripts/cli-pipeline/continuous_docs/tests/test-continuous-docs-comprehensive.sh"
)

declare -A MEDIUM_PIPELINES=(
    ["ai"]="scripts/cli-pipeline/ai/tests/test-ai-comprehensive.sh"
    ["work-summaries"]="scripts/cli-pipeline/work_summaries/tests/test-work-summaries-comprehensive.sh"
    ["living-docs"]="scripts/cli-pipeline/living_docs/tests/test-living-docs-comprehensive.sh"
    ["git-workflow"]="scripts/cli-pipeline/git_workflow/tests/test-git-workflow-comprehensive.sh"
)

declare -A SIMPLE_PIPELINES=(
    ["test-git"]="scripts/cli-pipeline/git/tests/test-test-git-comprehensive.sh"
)

# Results tracking
TOTAL_PIPELINES=0
PASSED_PIPELINES=0
FAILED_PIPELINES=0
declare -a FAILED_PIPELINE_NAMES=()

# Function to run a test suite
run_test_suite() {
    local pipeline_name="$1"
    local test_script="$2"
    local complexity="$3"
    
    echo -e "${YELLOW}Testing $pipeline_name (${complexity} complexity)...${NC}"
    
    if [[ ! -f "$PROJECT_ROOT/$test_script" ]]; then
        echo -e "${RED}❌ Test script not found: $test_script${NC}"
        ((FAILED_PIPELINES++))
        FAILED_PIPELINE_NAMES+=("$pipeline_name")
        return 1
    fi
    
    # Make script executable
    chmod +x "$PROJECT_ROOT/$test_script"
    
    # Run the test
    if "$PROJECT_ROOT/$test_script" > "/tmp/${pipeline_name}-test.log" 2>&1; then
        echo -e "${GREEN}✅ PASSED: $pipeline_name${NC}"
        ((PASSED_PIPELINES++))
    else
        echo -e "${RED}❌ FAILED: $pipeline_name${NC}"
        echo "  See /tmp/${pipeline_name}-test.log for details"
        # Show last few lines of error
        echo -e "${YELLOW}  Last error lines:${NC}"
        tail -5 "/tmp/${pipeline_name}-test.log" | sed 's/^/    /'
        ((FAILED_PIPELINES++))
        FAILED_PIPELINE_NAMES+=("$pipeline_name")
    fi
    
    ((TOTAL_PIPELINES++))
    echo ""
}

# Check prerequisites
echo -e "${CYAN}Checking prerequisites...${NC}"

if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Supabase environment variables not set${NC}"
    echo "  Some tests may fail. Set up .env.development file with:"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_ROLE_KEY"
fi

if [[ -z "$CLAUDE_API_KEY" ]]; then
    echo -e "${YELLOW}⚠️  Warning: CLAUDE_API_KEY not set${NC}"
    echo "  AI-related tests will be skipped"
fi

echo ""

# Run tests by complexity level
echo -e "${PURPLE}=== COMPLEX PIPELINES (6) ===${NC}"
for pipeline in "${!COMPLEX_PIPELINES[@]}"; do
    run_test_suite "$pipeline" "${COMPLEX_PIPELINES[$pipeline]}" "COMPLEX"
done

echo -e "${PURPLE}=== MEDIUM PIPELINES (4) ===${NC}"
for pipeline in "${!MEDIUM_PIPELINES[@]}"; do
    run_test_suite "$pipeline" "${MEDIUM_PIPELINES[$pipeline]}" "MEDIUM"
done

echo -e "${PURPLE}=== SIMPLE PIPELINES (1) ===${NC}"
for pipeline in "${!SIMPLE_PIPELINES[@]}"; do
    run_test_suite "$pipeline" "${SIMPLE_PIPELINES[$pipeline]}" "SIMPLE"
done

# Summary
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}COMPREHENSIVE TEST SUMMARY${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "Total pipelines tested: $TOTAL_PIPELINES"
echo -e "Passed: ${GREEN}$PASSED_PIPELINES${NC}"
echo -e "Failed: ${RED}$FAILED_PIPELINES${NC}"
echo ""

if [[ $FAILED_PIPELINES -gt 0 ]]; then
    echo -e "${RED}Failed pipelines:${NC}"
    for pipeline in "${FAILED_PIPELINE_NAMES[@]}"; do
        echo "  - $pipeline (see /tmp/${pipeline}-test.log)"
    done
    echo ""
fi

# Generate detailed report
REPORT_FILE="$PROJECT_ROOT/temp/comprehensive-test-report-$(date +%Y%m%d-%H%M%S).md"
mkdir -p "$PROJECT_ROOT/temp"

cat > "$REPORT_FILE" << EOF
# Comprehensive CLI Pipeline Test Report

**Date**: $(date)
**Total Pipelines**: $TOTAL_PIPELINES
**Passed**: $PASSED_PIPELINES
**Failed**: $FAILED_PIPELINES

## Test Results by Complexity

### Complex Pipelines (${#COMPLEX_PIPELINES[@]})
$(for p in "${!COMPLEX_PIPELINES[@]}"; do
    if [[ " ${FAILED_PIPELINE_NAMES[@]} " =~ " $p " ]]; then
        echo "- ❌ $p"
    else
        echo "- ✅ $p"
    fi
done)

### Medium Pipelines (${#MEDIUM_PIPELINES[@]})
$(for p in "${!MEDIUM_PIPELINES[@]}"; do
    if [[ " ${FAILED_PIPELINE_NAMES[@]} " =~ " $p " ]]; then
        echo "- ❌ $p"
    else
        echo "- ✅ $p"
    fi
done)

### Simple Pipelines (${#SIMPLE_PIPELINES[@]})
$(for p in "${!SIMPLE_PIPELINES[@]}"; do
    if [[ " ${FAILED_PIPELINE_NAMES[@]} " =~ " $p " ]]; then
        echo "- ❌ $p"
    else
        echo "- ✅ $p"
    fi
done)

## Environment
- SUPABASE_URL: $(if [[ -n "$SUPABASE_URL" ]]; then echo "Set"; else echo "Not set"; fi)
- CLAUDE_API_KEY: $(if [[ -n "$CLAUDE_API_KEY" ]]; then echo "Set"; else echo "Not set"; fi)
- Git Branch: $(git branch --show-current)

## Notes
- Complex pipelines test 7+ commands with heavy service integration
- Medium pipelines test 4-6 commands with moderate integration
- Simple pipelines test 1-3 commands with basic functionality
EOF

echo -e "${CYAN}Detailed report saved to: $REPORT_FILE${NC}"

# Exit with appropriate code
if [[ $FAILED_PIPELINES -eq 0 ]]; then
    echo -e "${GREEN}🎉 All comprehensive tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Review the logs for details.${NC}"
    exit 1
fi