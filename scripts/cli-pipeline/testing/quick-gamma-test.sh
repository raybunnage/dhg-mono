#!/bin/bash

# Quick test runner for Gamma CLI pipelines
# Just runs basic health checks and help tests

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Pipelines to test (Gamma group)
PIPELINES=(
    "scripts:scripts/cli-pipeline/scripts/scripts-cli.sh"
    "test-git:scripts/cli-pipeline/git/test-git-cli.sh"
    "work-summaries:scripts/cli-pipeline/work_summaries/work-summaries-cli.sh"
    "ai:scripts/cli-pipeline/ai/ai-cli.sh"
    "auth:scripts/cli-pipeline/auth/auth-cli.sh"
    "git:scripts/cli-pipeline/git/git-cli.sh"
    "gmail:scripts/cli-pipeline/gmail/gmail-cli.sh"
    "continuous-docs:scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh"
    "living-docs:scripts/cli-pipeline/living_docs/living-docs-cli.sh"
    "email:scripts/cli-pipeline/email/email-cli.sh"
    "git-workflow:scripts/cli-pipeline/git_workflow/git-workflow-cli.sh"
)

echo -e "${BLUE}Quick Gamma CLI Pipeline Test${NC}"
echo "============================================"
echo ""

TOTAL_PIPELINES=${#PIPELINES[@]}
PASSED_PIPELINES=0
FAILED_PIPELINES=0

for pipeline_info in "${PIPELINES[@]}"; do
    IFS=':' read -r pipeline_name script_path <<< "$pipeline_info"
    
    echo -e "${YELLOW}Testing: $pipeline_name${NC}"
    
    # Test 1: Help command
    if "$script_path" help >/dev/null 2>&1; then
        echo "  ✅ Help command works"
        help_ok=true
    else
        echo "  ❌ Help command failed"
        help_ok=false
    fi
    
    # Test 2: Health check (if available)
    if "$script_path" health-check >/dev/null 2>&1; then
        echo "  ✅ Health check works"
        health_ok=true
    else
        echo "  ⚠️  Health check not available or failed"
        health_ok=false
    fi
    
    # Overall result
    if [[ "$help_ok" == true ]]; then
        echo -e "  ${GREEN}✅ PASS${NC}: $pipeline_name"
        ((PASSED_PIPELINES++))
    else
        echo -e "  ${RED}❌ FAIL${NC}: $pipeline_name"
        ((FAILED_PIPELINES++))
    fi
    
    echo ""
done

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}SUMMARY${NC}"
echo -e "${BLUE}============================================${NC}"
echo "Total pipelines tested: $TOTAL_PIPELINES"
echo -e "Passed: ${GREEN}$PASSED_PIPELINES${NC}"
echo -e "Failed: ${RED}$FAILED_PIPELINES${NC}"

if [[ $FAILED_PIPELINES -eq 0 ]]; then
    echo -e "${GREEN}🎉 All pipelines passed basic tests!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some pipelines failed basic tests${NC}"
    exit 1
fi