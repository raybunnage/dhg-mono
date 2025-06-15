#!/bin/bash

# Simple test runner for Alpha pipelines
# Just runs each CLI with help command to verify basic functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Alpha Pipeline Simple Test Suite ===${NC}"
echo "Testing help command for all Alpha pipelines..."
echo

PASSED=0
FAILED=0
TOTAL=0

# Test function
test_pipeline() {
    local name="$1"
    local cli_path="$2"
    
    ((TOTAL++))
    echo -n "Testing $name... "
    
    if [[ ! -f "$cli_path" ]]; then
        echo -e "${RED}NOT FOUND${NC}"
        ((FAILED++))
        return
    fi
    
    if $cli_path help >/dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        ((FAILED++))
    fi
}

# Test all Alpha pipelines
test_pipeline "testing" "$PROJECT_ROOT/scripts/cli-pipeline/testing/testing-cli.sh"
test_pipeline "utilities" "$PROJECT_ROOT/scripts/cli-pipeline/utilities/utilities-cli.sh"
test_pipeline "system" "$PROJECT_ROOT/scripts/cli-pipeline/system/system-cli.sh"
test_pipeline "registry" "$PROJECT_ROOT/scripts/cli-pipeline/registry/registry-cli.sh"
test_pipeline "tracking" "$PROJECT_ROOT/scripts/cli-pipeline/tracking/tracking-cli.sh"
test_pipeline "maintenance" "$PROJECT_ROOT/scripts/cli-pipeline/maintenance-cli.sh"
test_pipeline "continuous" "$PROJECT_ROOT/scripts/cli-pipeline/continuous/continuous-cli.sh"
test_pipeline "proxy" "$PROJECT_ROOT/scripts/cli-pipeline/proxy/proxy-cli.sh"
test_pipeline "servers" "$PROJECT_ROOT/scripts/cli-pipeline/servers/servers-cli.sh"
test_pipeline "monitoring" "$PROJECT_ROOT/scripts/cli-pipeline/monitoring/monitoring-cli.sh"
test_pipeline "shared-services" "$PROJECT_ROOT/scripts/cli-pipeline/shared-services/shared-services-cli.sh"
test_pipeline "service_dependencies" "$PROJECT_ROOT/scripts/cli-pipeline/service_dependencies/service-dependencies-cli.sh"
test_pipeline "refactor_tracking" "$PROJECT_ROOT/scripts/cli-pipeline/refactor_tracking/refactor-tracking-cli.sh"
test_pipeline "deprecation" "$PROJECT_ROOT/scripts/cli-pipeline/deprecation/deprecation-cli.sh"
test_pipeline "all_pipelines" "$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh"
test_pipeline "database" "$PROJECT_ROOT/scripts/cli-pipeline/database/database-cli.sh"
test_pipeline "deployment" "$PROJECT_ROOT/scripts/cli-pipeline/deployment/deployment-cli.sh"

# Summary
echo
echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All Alpha pipelines pass basic test!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some pipelines failed${NC}"
    exit 1
fi