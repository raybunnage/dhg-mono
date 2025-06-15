#!/bin/bash

# Test runner for ALPHA group CLI pipelines
# Tests basic functionality (help and health-check) for each pipeline

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_PIPELINE_DIR="$PROJECT_ROOT/scripts/cli-pipeline"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}ALPHA GROUP CLI PIPELINE TEST RUNNER${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# ALPHA group pipelines (all except GAMMA group)
ALPHA_PIPELINES=(
    "all_pipelines:all-pipelines-cli.sh"
    "classify:classify-cli.sh"
    "database:database-cli.sh"
    "deployment:deployment-cli.sh"
    "deprecation:deprecation-cli.sh"
    "dev_tasks:dev-tasks-cli.sh"
    "docs:docs-cli.sh"
    "document:doc-cli.sh"
    "document_archiving:document-archiving-cli.sh"
    "document_types:document-types-cli.sh"
    "drive_filter:drive-filter-cli.sh"
    "element_criteria:element-criteria-cli.sh"
    "experts:experts-cli.sh"
    "google_sync:google-sync-cli.sh"
    "media-analytics:media-analytics-cli.sh"
    "media-processing:media-processing-cli.sh"
    "mime_types:mime-types-cli.sh"
    "monitoring:monitoring-cli.sh"
    "presentations:presentations-cli.sh"
    "prompt_service:prompt-service-cli.sh"
    "proxy:proxy-cli.sh"
    "refactor_tracking:refactor-tracking-cli.sh"
    "registry:registry-cli.sh"
    "servers:servers-cli.sh"
    "service_dependencies:service-dependencies-cli.sh"
    "shared-services:shared-services-cli.sh"
    "system:system-cli.sh"
    "testing:testing-cli.sh"
    "tracking:tracking-cli.sh"
    "utilities:utilities-cli.sh"
)

# Results tracking
TOTAL_PIPELINES=0
PASSED_HELP=0
PASSED_HEALTH=0
FAILED_PIPELINES=0
declare -a FAILED_LIST=()
declare -a HELP_PASSED=()
declare -a HELP_FAILED=()
declare -a HEALTH_PASSED=()
declare -a HEALTH_FAILED=()
declare -a NOT_FOUND=()

echo "Testing ${#ALPHA_PIPELINES[@]} ALPHA group pipelines..."
echo ""

# Test each pipeline
for pipeline_info in "${ALPHA_PIPELINES[@]}"; do
    IFS=':' read -r pipeline_dir cli_script <<< "$pipeline_info"
    script_path="$CLI_PIPELINE_DIR/$pipeline_dir/$cli_script"
    
    echo -e "${CYAN}Testing: $pipeline_dir${NC}"
    ((TOTAL_PIPELINES++))
    
    # Check if script exists
    if [[ ! -f "$script_path" ]]; then
        echo -e "  ${RED}❌ Script not found: $cli_script${NC}"
        NOT_FOUND+=("$pipeline_dir")
        ((FAILED_PIPELINES++))
        FAILED_LIST+=("$pipeline_dir")
        echo ""
        continue
    fi
    
    # Make executable
    chmod +x "$script_path" 2>/dev/null || true
    
    # Test help command
    if "$script_path" help >/dev/null 2>&1 || "$script_path" --help >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Help command works${NC}"
        HELP_PASSED+=("$pipeline_dir")
        ((PASSED_HELP++))
        help_ok=true
    else
        echo -e "  ${RED}❌ Help command failed${NC}"
        HELP_FAILED+=("$pipeline_dir")
        help_ok=false
    fi
    
    # Test health-check command
    if "$script_path" health-check >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Health check works${NC}"
        HEALTH_PASSED+=("$pipeline_dir")
        ((PASSED_HEALTH++))
        health_ok=true
    else
        echo -e "  ${YELLOW}⚠️  Health check not available or failed${NC}"
        HEALTH_FAILED+=("$pipeline_dir")
        health_ok=false
    fi
    
    # Overall result
    if [[ "$help_ok" == true ]]; then
        echo -e "  ${GREEN}✅ OVERALL: PASS${NC}"
    else
        echo -e "  ${RED}❌ OVERALL: FAIL${NC}"
        ((FAILED_PIPELINES++))
        FAILED_LIST+=("$pipeline_dir")
    fi
    
    echo ""
done

# Summary
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}ALPHA GROUP TEST SUMMARY${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "Total pipelines tested: $TOTAL_PIPELINES"
echo -e "Help command passed: ${GREEN}$PASSED_HELP${NC} / $TOTAL_PIPELINES"
echo -e "Health check passed: ${GREEN}$PASSED_HEALTH${NC} / $TOTAL_PIPELINES"
echo -e "Overall failed: ${RED}$FAILED_PIPELINES${NC}"
echo ""

# Detailed breakdown
if [[ ${#NOT_FOUND[@]} -gt 0 ]]; then
    echo -e "${RED}Scripts not found (${#NOT_FOUND[@]}):${NC}"
    for p in "${NOT_FOUND[@]}"; do
        echo "  - $p"
    done
    echo ""
fi

if [[ ${#HELP_FAILED[@]} -gt 0 ]]; then
    echo -e "${RED}Help command failed (${#HELP_FAILED[@]}):${NC}"
    for p in "${HELP_FAILED[@]}"; do
        if [[ ! " ${NOT_FOUND[@]} " =~ " ${p} " ]]; then
            echo "  - $p"
        fi
    done
    echo ""
fi

echo -e "${GREEN}Help command passed (${#HELP_PASSED[@]}):${NC}"
if [[ ${#HELP_PASSED[@]} -eq 0 ]]; then
    echo "  (none)"
else
    for p in "${HELP_PASSED[@]}"; do
        echo "  - $p"
    done
fi
echo ""

echo -e "${GREEN}Health check passed (${#HEALTH_PASSED[@]}):${NC}"
if [[ ${#HEALTH_PASSED[@]} -eq 0 ]]; then
    echo "  (none)"
else
    for p in "${HEALTH_PASSED[@]}"; do
        echo "  - $p"
    done
fi

# Exit status
if [[ $FAILED_PIPELINES -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}🎉 All ALPHA pipelines passed basic tests!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  $FAILED_PIPELINES ALPHA pipelines failed basic tests${NC}"
    exit 1
fi