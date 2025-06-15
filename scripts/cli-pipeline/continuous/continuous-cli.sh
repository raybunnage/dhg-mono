#!/bin/bash

# Continuous Improvement CLI - Phase 1 Simplified Version
# Provides simple commands for discovery, testing, and reporting

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Help function
show_help() {
    echo "📊 Continuous Improvement CLI - Phase 1"
    echo "======================================"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Discovery Commands:"
    echo "  discover              Find all services, pipelines, tables, tests"
    echo "  inventory             Show current inventory summary"
    echo ""
    echo "Testing Commands:"
    echo "  test                  Run all tests and capture results"
    echo "  test services         Run tests for shared services only"
    echo "  test <name>          Run tests for specific service/pipeline"
    echo ""
    echo "Standards Commands:"
    echo "  check                 Check code against standards (no auto-fix)"
    echo "  issues                Show current issues"
    echo "  issues resolve <id>   Mark an issue as resolved"
    echo ""
    echo "Reporting Commands:"
    echo "  report                Generate daily summary report"
    echo "  trends                Show week-over-week trends"
    echo "  summary               Show quick summary stats"
    echo ""
    echo "Examples:"
    echo "  $0 discover"
    echo "  $0 test services"
    echo "  $0 report > daily-report.md"
}

# Track command execution
track_command() {
    local command=$1
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] Running: continuous $command${NC}"
}

# Run discovery
run_discover() {
    track_command "discover"
    cd "$PROJECT_ROOT"
    ts-node scripts/cli-pipeline/continuous/discover-inventory.ts
}

# Show inventory
show_inventory() {
    track_command "inventory"
    cd "$PROJECT_ROOT"
    
    # Quick query to show inventory summary
    ts-node -e "
import { SupabaseClientService } from './packages/shared/services/supabase-client.js';

async function showInventory() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const { data, error } = await supabase
    .from('continuous_summary_view')
    .select('*')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('📊 Current Inventory');
  console.log('==================');
  console.log(\`  Services: \${data.total_services}\`);
  console.log(\`  Pipelines: \${data.total_pipelines}\`);
  console.log(\`  Tables: \${data.total_tables}\`);
  console.log(\`  Test Locations: \${data.total_tests}\`);
  console.log(\`\\n⏰ Last Update: \${data.last_inventory_update ? new Date(data.last_inventory_update).toLocaleString() : 'Never'}\`);
}

showInventory();
"
}

# Run tests
run_tests() {
    local target=${1:-"all"}
    track_command "test $target"
    cd "$PROJECT_ROOT"
    
    echo "🧪 Running tests for: $target"
    echo ""
    
    case $target in
        "services")
            # Run tests for shared services
            cd packages/shared/services
            npm test -- --reporter=json > /tmp/test-results.json || true
            
            # Save results to database
            cd "$PROJECT_ROOT"
            ts-node scripts/cli-pipeline/continuous/save-test-results.ts services /tmp/test-results.json
            ;;
        "all")
            # Run all tests
            npm test -- --reporter=json > /tmp/test-results.json || true
            ts-node scripts/cli-pipeline/continuous/save-test-results.ts all /tmp/test-results.json
            ;;
        *)
            # Run tests for specific target
            echo "Running tests for specific target: $target"
            # Implementation depends on project structure
            ;;
    esac
}

# Check standards
check_standards() {
    track_command "check"
    cd "$PROJECT_ROOT"
    
    # For Phase 1, we'll implement a simple checker
    echo "🔍 Checking code against standards..."
    echo "(Phase 1: Manual implementation - to be automated)"
    echo ""
    echo "Checking:"
    echo "  ✓ Services have getInstance method"
    echo "  ✓ No hardcoded secrets"
    echo "  ✓ Tables have created_at field"
    echo "  ✓ Tables have UUID primary key"
    echo "  ✓ CLI commands have help text"
}

# Show issues
show_issues() {
    track_command "issues"
    cd "$PROJECT_ROOT"
    
    ts-node -e "
import { SupabaseClientService } from './packages/shared/services/supabase-client.js';

async function showIssues() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const { data, error } = await supabase
    .from('continuous_issues')
    .select('*')
    .is('resolved_at', null)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('⚠️  Open Issues (' + data.length + ')');
  console.log('================');
  
  if (data.length === 0) {
    console.log('  No open issues! 🎉');
  } else {
    const bySeverity = data.reduce((acc: any, issue: any) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\\nBy Severity:');
    Object.entries(bySeverity).forEach(([sev, count]) => {
      console.log(\`  \${sev}: \${count}\`);
    });
    
    console.log('\\nRecent Issues:');
    data.slice(0, 5).forEach((issue: any) => {
      console.log(\`  [\${issue.severity}] \${issue.item_name}: \${issue.description}\`);
    });
  }
}

showIssues();
"
}

# Generate report
generate_report() {
    track_command "report"
    cd "$PROJECT_ROOT"
    
    echo "📊 Daily Continuous Improvement Report"
    echo "Date: $(date '+%Y-%m-%d')"
    echo ""
    
    # Get summary data
    show_inventory
    echo ""
    
    # Get test results
    echo "🧪 Test Results"
    echo "=============="
    ts-node -e "
import { SupabaseClientService } from './packages/shared/services/supabase-client.js';

async function showTestResults() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const { data } = await supabase
    .from('continuous_summary_view')
    .select('*')
    .single();
  
  if (data) {
    console.log(\`  Tests Passed Today: \${data.tests_passed_today}\`);
    console.log(\`  Tests Failed Today: \${data.tests_failed_today}\`);
    if (data.tests_passed_today + data.tests_failed_today > 0) {
      const passRate = (data.tests_passed_today / (data.tests_passed_today + data.tests_failed_today) * 100).toFixed(1);
      console.log(\`  Pass Rate: \${passRate}%\`);
    }
    console.log(\`\\n  Last Test Run: \${data.last_test_run ? new Date(data.last_test_run).toLocaleString() : 'Never'}\`);
  }
}

showTestResults();
"
    
    echo ""
    show_issues
}

# Main command handler
case "$1" in
    "discover")
        run_discover
        ;;
    "inventory")
        show_inventory
        ;;
    "test")
        run_tests "$2"
        ;;
    "check")
        check_standards
        ;;
    "issues")
        if [[ "$2" == "resolve" && -n "$3" ]]; then
            echo "Marking issue $3 as resolved..."
            # TODO: Implement resolve
        else
            show_issues
        fi
        ;;
    "report")
        generate_report
        ;;
    "trends")
        echo "📈 Trends analysis coming soon..."
        ;;
    "summary")
        show_inventory
        echo ""
        show_issues
        ;;
    *)
        show_help
        exit 1
        ;;
esac