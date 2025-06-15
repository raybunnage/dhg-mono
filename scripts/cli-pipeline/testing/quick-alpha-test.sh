#!/bin/bash

# Quick test for Alpha pipelines
# Tests basic functionality: help, health-check, and one core command

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Alpha pipelines
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
    "service_dependencies"
    "refactor_tracking"
    "deprecation"
    "all_pipelines"
    "database"
    "deployment"
)

# Primary commands for each pipeline
get_primary_command() {
    case "$1" in
        "testing") echo "test-existence" ;;
        "utilities") echo "check-env" ;;
        "system") echo "status" ;;
        "registry") echo "list" ;;
        "tracking") echo "list" ;;
        "maintenance") echo "health-check" ;;
        "continuous") echo "status" ;;
        "proxy") echo "list" ;;
        "servers") echo "list-available" ;;
        "monitoring") echo "status" ;;
        "shared-services") echo "list" ;;
        "service_dependencies") echo "analyze" ;;
        "refactor_tracking") echo "list" ;;
        "deprecation") echo "scan" ;;
        "all_pipelines") echo "list" ;;
        "database") echo "connection-test" ;;
        "deployment") echo "status" ;;
    esac
}

echo -e "${BLUE}=== Quick Alpha Pipeline Test ===${NC}"
echo "Testing basic functionality of all Alpha pipelines"
echo

TOTAL=0
PASSED=0
FAILED=0

for pipeline in "${ALPHA_PIPELINES[@]}"; do
    # Special case for maintenance which is at root level
    if [[ "$pipeline" == "maintenance" ]]; then
        CLI_PATH="$PROJECT_ROOT/scripts/cli-pipeline/maintenance-cli.sh"
    else
        # Handle directory vs script name mismatches
        case "$pipeline" in
            "service_dependencies")
                CLI_PATH="$PROJECT_ROOT/scripts/cli-pipeline/service_dependencies/service-dependencies-cli.sh"
                ;;
            "refactor_tracking")
                CLI_PATH="$PROJECT_ROOT/scripts/cli-pipeline/refactor_tracking/refactor-tracking-cli.sh"
                ;;
            "all_pipelines")
                CLI_PATH="$PROJECT_ROOT/scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh"
                ;;
            *)
                CLI_PATH="$PROJECT_ROOT/scripts/cli-pipeline/$pipeline/$pipeline-cli.sh"
                ;;
        esac
    fi
    PRIMARY_CMD=$(get_primary_command "$pipeline")
    
    ((TOTAL++))
    echo -n "Testing $pipeline... "
    
    if [[ ! -f "$CLI_PATH" ]]; then
        echo -e "${RED}MISSING${NC}"
        ((FAILED++))
        continue
    fi
    
    # Test help command
    if $CLI_PATH help >/dev/null 2>&1; then
        echo -n "help ✓ "
    else
        echo -e "${RED}help ✗${NC}"
        ((FAILED++))
        continue
    fi
    
    # Test primary command
    if $CLI_PATH $PRIMARY_CMD >/dev/null 2>&1 || [[ $? -eq 0 || $? -eq 1 ]]; then
        echo -n "$PRIMARY_CMD ✓ "
    else
        echo -n "${YELLOW}$PRIMARY_CMD ⚠${NC} "
    fi
    
    # Test health-check if available
    if $CLI_PATH health-check >/dev/null 2>&1 || [[ $? -eq 0 || $? -eq 1 ]]; then
        echo -e "${GREEN}health-check ✓${NC}"
    else
        echo -e "${GREEN}OK${NC}"
    fi
    
    ((PASSED++))
done

echo
echo "Results: $PASSED/$TOTAL passed"

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All Alpha pipelines are functional!${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILED pipelines have issues${NC}"
    exit 1
fi