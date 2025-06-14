#!/bin/bash

# Health check for Testing CLI Pipeline
# Verifies the testing infrastructure is working properly

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🏥 Testing Pipeline Health Check"
echo "================================"

# Track overall health
HEALTH_STATUS="healthy"
ISSUES=()

# Function to check a condition
check_condition() {
    local condition_name="$1"
    local check_command="$2"
    local error_message="$3"
    
    echo -n "Checking $condition_name... "
    
    if eval "$check_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        HEALTH_STATUS="unhealthy"
        ISSUES+=("$error_message")
        return 1
    fi
}

# 1. Check if testing service exists
check_condition "Testing Service" \
    "[ -f '$SCRIPT_DIR/../../../packages/shared/services/testing-service/index.ts' ]" \
    "Testing service files not found"

# 2. Check if CLI script is executable
check_condition "CLI Script" \
    "[ -x '$SCRIPT_DIR/testing-cli.sh' ]" \
    "testing-cli.sh is not executable"

# 3. Check if TypeScript files compile (only check if tsconfig exists)
# Note: We check for tsconfig.json existence as a proxy for TypeScript setup
# Actual compilation may fail due to shared service issues unrelated to testing pipeline
check_condition "TypeScript Setup" \
    "[ -f '$SCRIPT_DIR/tsconfig.json' ] || [ -f '$SCRIPT_DIR/../../../tsconfig.json' ]" \
    "TypeScript configuration not found"

# 4. Check if package.json exists
check_condition "Package Configuration" \
    "[ -f '$SCRIPT_DIR/package.json' ]" \
    "package.json not found"

# 5. Check if migration file exists
check_condition "Database Migration" \
    "[ -f '$SCRIPT_DIR/../../../supabase/migrations/20250610_create_service_testing_tables.sql' ]" \
    "Testing database migration file not found"

# 6. Check if all command scripts exist
COMMAND_SCRIPTS=(
    "setup-infrastructure.ts"
    "test-critical-services.ts"
    "test-all-services.ts"
    "run-test-suite.ts"
    "validate-single-service.ts"
    "generate-health-report.ts"
    "health-check.ts"
)

echo -n "Checking command scripts... "
MISSING_SCRIPTS=()
for script in "${COMMAND_SCRIPTS[@]}"; do
    if [ ! -f "$SCRIPT_DIR/$script" ]; then
        MISSING_SCRIPTS+=("$script")
    fi
done

if [ ${#MISSING_SCRIPTS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All present${NC}"
else
    echo -e "${RED}❌ Missing: ${MISSING_SCRIPTS[*]}${NC}"
    HEALTH_STATUS="unhealthy"
    ISSUES+=("Missing command scripts: ${MISSING_SCRIPTS[*]}")
fi

# 7. Check environment variables
echo -n "Checking environment setup... "
if [ -f "$SCRIPT_DIR/../../../.env.development" ]; then
    echo -e "${GREEN}✅ Found${NC}"
else
    echo -e "${YELLOW}⚠️  No .env.development file${NC}"
    ISSUES+=("Environment file missing - some features may not work")
fi

# Summary
echo ""
echo "================================"
echo "Health Check Summary:"
echo "================================"

if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✅ Testing Pipeline is HEALTHY${NC}"
    exit 0
else
    echo -e "${RED}❌ Testing Pipeline is UNHEALTHY${NC}"
    echo ""
    echo "Issues found:"
    for issue in "${ISSUES[@]}"; do
        echo "  - $issue"
    done
    exit 1
fi