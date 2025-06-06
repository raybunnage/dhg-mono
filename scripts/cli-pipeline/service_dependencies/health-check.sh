#!/bin/bash

# Service Dependencies Pipeline Health Check
# Verifies that the dependency mapping system is functioning correctly

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🏥 Service Dependencies Pipeline Health Check"
echo "============================================"
echo ""

HEALTH_STATUS=0

# Check 1: Database connectivity
echo -n "📊 Database connection... "
if command -v psql >/dev/null 2>&1; then
    if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
        echo -e "${GREEN}✅ Database credentials available${NC}"
    else
        echo -e "${RED}❌ Missing database credentials${NC}"
        HEALTH_STATUS=1
    fi
else
    echo -e "${YELLOW}⚠️ psql not available, skipping detailed check${NC}"
fi

# Check 2: Required directories exist
echo -n "📁 Required directories... "
DIRS_TO_CHECK=(
    "$ROOT_DIR/packages/shared/services"
    "$ROOT_DIR/apps"
    "$ROOT_DIR/scripts/cli-pipeline"
)

MISSING_DIRS=0
for dir in "${DIRS_TO_CHECK[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${RED}❌ Missing directory: $dir${NC}"
        MISSING_DIRS=$((MISSING_DIRS + 1))
        HEALTH_STATUS=1
    fi
done

if [ $MISSING_DIRS -eq 0 ]; then
    echo -e "${GREEN}✅ All required directories present${NC}"
fi

# Check 3: Core dependency tables exist
echo -n "🗃️ Dependency tables... "
TABLE_CHECK_SQL="SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('services_registry', 'apps_registry', 'cli_pipelines_registry');"

# This would need actual database connection to check
echo -e "${YELLOW}⚠️ Table check requires database connection${NC}"

# Check 4: TypeScript compilation
echo -n "🔧 TypeScript setup... "
if [ -f "$ROOT_DIR/tsconfig.node.json" ]; then
    echo -e "${GREEN}✅ TypeScript configuration available${NC}"
else
    echo -e "${RED}❌ Missing tsconfig.node.json${NC}"
    HEALTH_STATUS=1
fi

# Check 5: Command scripts directory
echo -n "📋 Command scripts... "
if [ -d "$SCRIPT_DIR/commands" ]; then
    SCRIPT_COUNT=$(find "$SCRIPT_DIR/commands" -name "*.ts" | wc -l)
    echo -e "${GREEN}✅ Commands directory exists ($SCRIPT_COUNT scripts)${NC}"
else
    echo -e "${RED}❌ Commands directory missing${NC}"
    HEALTH_STATUS=1
fi

# Check 6: Shared services detection
echo -n "🔗 Shared services... "
if [ -d "$ROOT_DIR/packages/shared/services" ]; then
    SERVICE_COUNT=$(find "$ROOT_DIR/packages/shared/services" -name "*.ts" -type f | wc -l)
    echo -e "${GREEN}✅ Found $SERVICE_COUNT service files${NC}"
else
    echo -e "${RED}❌ Shared services directory not found${NC}"
    HEALTH_STATUS=1
fi

# Check 7: Apps detection
echo -n "📱 Applications... "
if [ -d "$ROOT_DIR/apps" ]; then
    APP_COUNT=$(find "$ROOT_DIR/apps" -maxdepth 1 -type d | grep -v "^$ROOT_DIR/apps$" | wc -l)
    echo -e "${GREEN}✅ Found $APP_COUNT applications${NC}"
else
    echo -e "${RED}❌ Apps directory not found${NC}"
    HEALTH_STATUS=1
fi

# Check 8: CLI pipelines detection
echo -n "⚙️ CLI pipelines... "
if [ -d "$ROOT_DIR/scripts/cli-pipeline" ]; then
    PIPELINE_COUNT=$(find "$ROOT_DIR/scripts/cli-pipeline" -name "*-cli.sh" | wc -l)
    echo -e "${GREEN}✅ Found $PIPELINE_COUNT CLI pipelines${NC}"
else
    echo -e "${RED}❌ CLI pipelines directory not found${NC}"
    HEALTH_STATUS=1
fi

echo ""
echo "============================================"

if [ $HEALTH_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ Service Dependencies Pipeline is healthy${NC}"
    exit 0
else
    echo -e "${RED}❌ Service Dependencies Pipeline has issues${NC}"
    echo ""
    echo "🔧 To fix issues:"
    echo "  1. Ensure database migration has been run"
    echo "  2. Verify environment variables are set"
    echo "  3. Check that all required directories exist"
    exit 1
fi