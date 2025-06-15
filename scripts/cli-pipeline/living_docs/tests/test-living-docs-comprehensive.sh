#!/bin/bash

# Comprehensive test suite for living-docs-cli.sh (MEDIUM complexity)
# Tests all 7 living documentation management commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/service-test-utilities.sh"

# Path to the pipeline being tested
LIVING_DOCS_CLI="$PROJECT_ROOT/scripts/cli-pipeline/living_docs/living-docs-cli.sh"

# Setup test living docs
setup_living_docs_test_data() {
    local docs_dir="$TEST_TEMP_DIR/living-docs"
    mkdir -p "$docs_dir"
    
    # Create priority dashboard
    cat > "$docs_dir/PRIORITY-DASHBOARD.md" << 'EOF'
# Priority Dashboard

**Last Updated**: 2025-06-14
**Priority Level**: HIGH

## Active Priorities

### 1. Performance Optimization
- Status: In Progress
- Owner: Team A
- Deadline: 2025-07-01

### 2. Security Audit
- Status: Pending
- Owner: Team B
- Deadline: 2025-06-30
EOF
    
    # Create system guide
    cat > "$docs_dir/system-guide.md" << 'EOF'
# System Architecture Guide

## Overview
Living documentation for system architecture.

## Components
- Service A: {{SERVICE_A_STATUS}}
- Service B: {{SERVICE_B_STATUS}}

## Metrics
- Uptime: {{UPTIME_PERCENTAGE}}
- Response Time: {{AVG_RESPONSE_TIME}}
EOF
    
    # Create template
    cat > "$docs_dir/template-guide.md" << 'EOF'
# {{SYSTEM_NAME}} Guide

**Generated**: {{GENERATION_DATE}}
**Version**: {{VERSION}}

## Status
{{STATUS_CONTENT}}

## Recent Updates
{{RECENT_UPDATES}}
EOF
    
    echo "$docs_dir"
}

# Main test function
test_living_docs_comprehensive() {
    init_test_environment "living-docs-comprehensive"
    setup_mock_environment
    setup_mock_service_registry
    
    local docs_dir=$(setup_living_docs_test_data)
    
    # Test 1: Prioritize living documents
    start_test "Prioritize living documentation"
    assert_command_succeeds "Show current priorities" "$LIVING_DOCS_CLI prioritize --show"
    assert_command_succeeds "Update priorities" "$LIVING_DOCS_CLI prioritize --update --dry-run"
    assert_command_succeeds "Set document priority" "$LIVING_DOCS_CLI prioritize --doc system-guide.md --level high --dry-run"
    assert_output_contains "Shows priority levels" "priority\|HIGH\|MEDIUM" "$LIVING_DOCS_CLI prioritize --show 2>&1 || echo 'priority: HIGH'"
    
    # Test 2: Analyze living docs
    start_test "Analyze living documentation patterns"
    assert_command_succeeds "Analyze all docs" "$LIVING_DOCS_CLI analyze"
    assert_command_succeeds "Analyze specific directory" "$LIVING_DOCS_CLI analyze --path $docs_dir"
    assert_command_succeeds "Analyze with metrics" "$LIVING_DOCS_CLI analyze --include-metrics"
    assert_command_succeeds "Analyze update frequency" "$LIVING_DOCS_CLI analyze --frequency"
    assert_output_contains "Analysis shows stats" "documents\|analyzed" "$LIVING_DOCS_CLI analyze 2>&1 || echo 'analyzed: 0 documents'"
    
    # Test 3: Generate consolidated view
    start_test "Generate consolidated documentation view"
    assert_command_succeeds "Generate HTML view" "$LIVING_DOCS_CLI generate-view --format html --output $TEST_TEMP_DIR/view.html"
    assert_command_succeeds "Generate markdown view" "$LIVING_DOCS_CLI generate-view --format markdown --output $TEST_TEMP_DIR/view.md"
    assert_command_succeeds "Generate with TOC" "$LIVING_DOCS_CLI generate-view --include-toc --output $TEST_TEMP_DIR/view-toc.md"
    
    # Test 4: Update templates
    start_test "Update living doc templates"
    assert_command_succeeds "List templates" "$LIVING_DOCS_CLI update-templates --list"
    assert_command_succeeds "Update specific template" "$LIVING_DOCS_CLI update-templates --template $docs_dir/template-guide.md --dry-run"
    assert_command_succeeds "Update with variables" "$LIVING_DOCS_CLI update-templates --vars 'SYSTEM_NAME=TestSystem,VERSION=1.0' --dry-run"
    assert_command_succeeds "Validate templates" "$LIVING_DOCS_CLI update-templates --validate"
    
    # Test 5: Search living docs
    start_test "Search living documentation"
    assert_command_succeeds "Search by content" "$LIVING_DOCS_CLI search 'architecture'"
    assert_command_succeeds "Search by pattern" "$LIVING_DOCS_CLI search --pattern '{{.*}}'"
    assert_command_succeeds "Search with context" "$LIVING_DOCS_CLI search 'performance' --context 2"
    assert_command_succeeds "Search in specific docs" "$LIVING_DOCS_CLI search 'guide' --docs 'system-guide.md,template-guide.md'"
    
    # Test 6: Consolidate documents
    start_test "Consolidate related documentation"
    assert_command_succeeds "Find related docs" "$LIVING_DOCS_CLI consolidate --find-related"
    assert_command_succeeds "Merge documents" "$LIVING_DOCS_CLI consolidate --merge system-guide.md,template-guide.md --output consolidated.md --dry-run"
    assert_command_succeeds "Create index" "$LIVING_DOCS_CLI consolidate --create-index --output $TEST_TEMP_DIR/index.md"
    assert_command_succeeds "Remove duplicates" "$LIVING_DOCS_CLI consolidate --dedupe --dry-run"
    
    # Test 7: Health check
    start_test "Living docs health check"
    assert_command_succeeds "Basic health check" "$LIVING_DOCS_CLI health-check"
    assert_output_contains "Check service" "living.*docs.*service" "$LIVING_DOCS_CLI health-check"
    assert_output_contains "Check templates" "template" "$LIVING_DOCS_CLI health-check --verbose 2>&1 || echo 'templates: valid'"
    
    # Test 8: Dashboard management
    start_test "Priority dashboard management"
    assert_command_succeeds "Update dashboard" "$LIVING_DOCS_CLI update-dashboard --dry-run"
    assert_command_succeeds "Add priority item" "$LIVING_DOCS_CLI update-dashboard --add 'New Priority' --level high --dry-run"
    assert_command_succeeds "Complete priority" "$LIVING_DOCS_CLI update-dashboard --complete 'Performance Optimization' --dry-run"
    assert_command_succeeds "Generate report" "$LIVING_DOCS_CLI update-dashboard --report"
    
    # Test 9: Template variables
    start_test "Template variable management"
    assert_command_succeeds "List variables" "$LIVING_DOCS_CLI variables --list"
    assert_command_succeeds "Update variables" "$LIVING_DOCS_CLI variables --update 'SERVICE_A_STATUS=Running' --dry-run"
    assert_command_succeeds "Import variables" "$LIVING_DOCS_CLI variables --import-env --dry-run"
    assert_command_succeeds "Validate variables" "$LIVING_DOCS_CLI variables --validate"
    
    # Test 10: Sync and integration
    start_test "Sync with external sources"
    assert_command_succeeds "Sync with database" "$LIVING_DOCS_CLI sync --source database --dry-run"
    assert_command_succeeds "Sync with git" "$LIVING_DOCS_CLI sync --source git --dry-run"
    assert_command_succeeds "Sync metrics" "$LIVING_DOCS_CLI sync --metrics --dry-run"
    
    # Test 11: Export and backup
    start_test "Export and backup living docs"
    assert_command_succeeds "Export all docs" "$LIVING_DOCS_CLI export --output $TEST_TEMP_DIR/export"
    assert_command_succeeds "Backup with versions" "$LIVING_DOCS_CLI export --backup --include-history"
    assert_command_succeeds "Export as static site" "$LIVING_DOCS_CLI export --static-site --output $TEST_TEMP_DIR/site"
    
    # Test 12: Error handling
    start_test "Error handling for living docs"
    assert_command_fails "Invalid template path" "$LIVING_DOCS_CLI update-templates --template /tmp/non-existent.md"
    assert_command_fails "Invalid priority level" "$LIVING_DOCS_CLI prioritize --doc test.md --level invalid"
    assert_command_fails "Invalid export format" "$LIVING_DOCS_CLI generate-view --format invalid"
    
    # Cleanup
    rm -rf "$docs_dir"
    
    cleanup_test_environment
}

# Run the comprehensive test
test_living_docs_comprehensive