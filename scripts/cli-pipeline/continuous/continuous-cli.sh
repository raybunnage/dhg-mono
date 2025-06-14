#!/bin/bash

# Continuous Improvement CLI - Phase 1
# Keep it simple, measure what matters

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo "Continuous Improvement CLI - Phase 1"
    echo ""
    echo "Philosophy: Start simple, measure first, learn fast"
    echo ""
    echo "Usage: ./continuous-cli.sh <command>"
    echo ""
    echo "Commands:"
    echo "  test            Run all tests (services, apps, CLIs)"
    echo "  discover        Find all services, pipelines, tables"  
    echo "  check           Check against basic standards"
    echo "  report          Generate daily summary report"
    echo "  trends          Show week-over-week changes"
    echo "  daily           Run full daily check (test + discover + check)"
    echo "  help            Show this help"
    echo ""
    echo "Examples:"
    echo "  ./continuous-cli.sh test"
    echo "  ./continuous-cli.sh daily"
    echo ""
}

run_tests() {
    echo -e "${BLUE}🧪 Running Tests${NC}"
    echo "Testing what exists, measuring what matters"
    echo ""
    ts-node "$SCRIPT_DIR/simple-test-runner.ts"
}

discover_inventory() {
    echo -e "${BLUE}🔍 Discovering Inventory${NC}"
    echo "Finding all services, pipelines, and tables"
    echo ""
    
    # Use existing discovery from shared-services
    cd "$PROJECT_ROOT/scripts/cli-pipeline/shared-services"
    ts-node discover-new-services.ts
}

check_standards() {
    echo -e "${BLUE}📋 Checking Standards${NC}"
    echo "Validating against .continuous/standards.yaml"
    echo ""
    echo "⚠️  Standards checking not yet implemented"
    echo "Phase 1: Focus on test execution and discovery first"
}

generate_report() {
    echo -e "${BLUE}📊 Daily Report${NC}"
    echo "$(date '+%Y-%m-%d %H:%M')"
    echo ""
    
    # Check if we have test results
    if [ -f ".continuous/test-results.json" ]; then
        echo "📈 Latest test results:"
        # Show last result from JSON (simple jq alternative)
        echo "   (Results saved in .continuous/test-results.json)"
    else
        echo "❌ No test results found. Run './continuous-cli.sh test' first"
    fi
    
    echo ""
    echo "📦 Current inventory:"
    echo "   Services: $(find packages/shared/services -name "*.ts" | grep -v test | wc -l)"
    echo "   CLI Pipelines: $(find scripts/cli-pipeline -name "*-cli.sh" | wc -l)"
    echo "   Apps: $(find apps -name package.json | wc -l)"
    
    echo ""
    echo "💡 Next steps:"
    echo "   - Run tests daily"
    echo "   - Address any failing tests"
    echo "   - Review trends weekly"
}

show_trends() {
    echo -e "${BLUE}📈 Trends${NC}"
    echo ""
    
    if [ -f ".continuous/test-results.json" ]; then
        echo "Test results history (last 7 days):"
        echo "   Data: .continuous/test-results.json"
        echo "   ⚠️  Trend analysis not yet implemented"
        echo "   Phase 1: Focus on daily measurement first"
    else
        echo "❌ No historical data found"
        echo "   Run tests for a few days to see trends"
    fi
}

run_daily() {
    echo -e "${GREEN}🔄 Daily Continuous Improvement Check${NC}"
    echo "Running: test + discover + basic checks"
    echo ""
    
    run_tests
    echo ""
    discover_inventory  
    echo ""
    generate_report
    
    echo ""
    echo -e "${GREEN}✅ Daily check complete!${NC}"
    echo ""
    echo "📝 Summary:"
    echo "   - Tests executed and results saved"
    echo "   - Inventory updated"
    echo "   - Report generated"
    echo ""
    echo "📅 Next: Review results and run again tomorrow"
}

# Main command handling
case "${1:-help}" in
    test)
        run_tests
        ;;
    discover)
        discover_inventory
        ;;
    check)
        check_standards
        ;;
    report)
        generate_report
        ;;
    trends)
        show_trends
        ;;
    daily)
        run_daily
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac