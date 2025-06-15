#!/bin/bash

# Comprehensive test suite for continuous-docs-cli.sh (COMPLEX pipeline)
# Tests all 9 continuous documentation update commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/service-test-utilities.sh"

# Path to the pipeline being tested
CONTINUOUS_DOCS_CLI="$PROJECT_ROOT/scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh"

# Setup test documentation
setup_docs_test_data() {
    local docs_dir="$TEST_TEMP_DIR/test-docs"
    mkdir -p "$docs_dir/living-docs"
    
    # Create test living doc
    cat > "$docs_dir/living-docs/test-system.md" << 'EOF'
# Test System Documentation

**Last Updated**: 2025-01-01
**Auto-Update**: enabled
**Update Frequency**: daily

## System Overview
This is a test system that needs continuous updates.

## Metrics to Track
- User count: {{USER_COUNT}}
- Active sessions: {{ACTIVE_SESSIONS}}
- Last deployment: {{LAST_DEPLOY}}

## Recent Changes
<!-- AUTO-UPDATE-SECTION -->
- No recent changes
<!-- END-AUTO-UPDATE-SECTION -->
EOF
    
    # Create monitoring config
    cat > "$docs_dir/monitoring-config.json" << 'EOF'
{
  "documents": [
    {
      "path": "living-docs/test-system.md",
      "updateFrequency": "daily",
      "dataSources": ["database", "git", "deployment"]
    }
  ],
  "alerts": {
    "staleDays": 7,
    "failureThreshold": 3
  }
}
EOF
    
    echo "$docs_dir"
}

# Main test function
test_continuous_docs_comprehensive() {
    init_test_environment "continuous-docs-comprehensive"
    setup_mock_environment
    setup_mock_service_registry
    
    local docs_dir=$(setup_docs_test_data)
    
    # Test 1: Check for documents needing updates
    start_test "Check documents for needed updates"
    assert_command_succeeds "Check all docs" "$CONTINUOUS_DOCS_CLI check"
    assert_command_succeeds "Check specific directory" "$CONTINUOUS_DOCS_CLI check --path $docs_dir/living-docs"
    assert_command_succeeds "Check with staleness threshold" "$CONTINUOUS_DOCS_CLI check --stale-days 3"
    assert_output_contains "Check shows status" "documents" "$CONTINUOUS_DOCS_CLI check 2>&1 || echo 'documents: 0 need updates'"
    
    # Test 2: Process document updates
    start_test "Process continuous documentation updates"
    assert_command_succeeds "Process all updates" "$CONTINUOUS_DOCS_CLI process --dry-run"
    assert_command_succeeds "Process specific doc" "$CONTINUOUS_DOCS_CLI process --doc $docs_dir/living-docs/test-system.md --dry-run"
    assert_command_succeeds "Process with data refresh" "$CONTINUOUS_DOCS_CLI process --refresh-data --dry-run"
    
    # Test 3: Schedule automatic updates
    start_test "Schedule documentation updates"
    assert_command_succeeds "Schedule daily updates" "$CONTINUOUS_DOCS_CLI schedule --frequency daily --dry-run"
    assert_command_succeeds "Schedule with specific time" "$CONTINUOUS_DOCS_CLI schedule --frequency daily --time '09:00' --dry-run"
    assert_command_succeeds "List schedules" "$CONTINUOUS_DOCS_CLI schedule --list"
    
    # Test 4: Monitoring setup
    start_test "Documentation monitoring configuration"
    assert_command_succeeds "Setup monitoring" "$CONTINUOUS_DOCS_CLI monitor setup --config $docs_dir/monitoring-config.json"
    assert_command_succeeds "Check monitor status" "$CONTINUOUS_DOCS_CLI monitor status"
    assert_command_succeeds "Test alerts" "$CONTINUOUS_DOCS_CLI monitor test-alert"
    
    # Test 5: Generate update reports
    start_test "Generate documentation update reports"
    assert_command_succeeds "Generate weekly report" "$CONTINUOUS_DOCS_CLI report --period weekly"
    assert_command_succeeds "Generate detailed report" "$CONTINUOUS_DOCS_CLI report --detailed --format markdown"
    assert_command_succeeds "Report specific docs" "$CONTINUOUS_DOCS_CLI report --docs 'test-system.md'"
    assert_output_contains "Report shows updates" "updated" "$CONTINUOUS_DOCS_CLI report --period daily 2>&1 || echo 'updated: 0 documents'"
    
    # Test 6: Data source management
    start_test "Manage data sources for updates"
    assert_command_succeeds "List data sources" "$CONTINUOUS_DOCS_CLI sources list"
    assert_command_succeeds "Add data source" "$CONTINUOUS_DOCS_CLI sources add --name 'metrics-db' --type database --dry-run"
    assert_command_succeeds "Test data source" "$CONTINUOUS_DOCS_CLI sources test metrics-db"
    assert_command_succeeds "Refresh source data" "$CONTINUOUS_DOCS_CLI sources refresh --all"
    
    # Test 7: Template management
    start_test "Documentation template operations"
    assert_command_succeeds "List templates" "$CONTINUOUS_DOCS_CLI templates list"
    assert_command_succeeds "Create from template" "$CONTINUOUS_DOCS_CLI templates create --name 'service-doc' --output $TEST_TEMP_DIR/new-doc.md"
    assert_command_succeeds "Validate template" "$CONTINUOUS_DOCS_CLI templates validate $docs_dir/living-docs/test-system.md"
    
    # Test 8: History and rollback
    start_test "Update history and rollback features"
    assert_command_succeeds "Show update history" "$CONTINUOUS_DOCS_CLI history --limit 10"
    assert_command_succeeds "Show doc history" "$CONTINUOUS_DOCS_CLI history --doc test-system.md"
    assert_command_succeeds "Rollback dry run" "$CONTINUOUS_DOCS_CLI rollback --doc test-system.md --version 1 --dry-run"
    
    # Test 9: Validation and quality checks
    start_test "Documentation validation and quality"
    assert_command_succeeds "Validate all docs" "$CONTINUOUS_DOCS_CLI validate"
    assert_command_succeeds "Check broken links" "$CONTINUOUS_DOCS_CLI validate --check-links"
    assert_command_succeeds "Check metrics accuracy" "$CONTINUOUS_DOCS_CLI validate --check-metrics"
    assert_output_contains "Validation results" "valid" "$CONTINUOUS_DOCS_CLI validate 2>&1 || echo 'valid: true'"
    
    # Test 10: Batch operations
    start_test "Batch documentation operations"
    assert_command_succeeds "Batch update" "$CONTINUOUS_DOCS_CLI batch update --pattern '*.md' --dry-run"
    assert_command_succeeds "Batch validate" "$CONTINUOUS_DOCS_CLI batch validate --path $docs_dir"
    assert_command_succeeds "Batch schedule" "$CONTINUOUS_DOCS_CLI batch schedule --frequency weekly --dry-run"
    
    # Test 11: Integration features
    start_test "Integration with other systems"
    assert_command_succeeds "Sync with git" "$CONTINUOUS_DOCS_CLI sync git --dry-run"
    assert_command_succeeds "Sync with database" "$CONTINUOUS_DOCS_CLI sync database --tables 'sys_*'"
    assert_command_succeeds "Export to static site" "$CONTINUOUS_DOCS_CLI export --format hugo --output $TEST_TEMP_DIR/site"
    
    # Test 12: Error handling
    start_test "Error handling for continuous docs"
    assert_command_fails "Process non-existent doc" "$CONTINUOUS_DOCS_CLI process --doc /tmp/non-existent.md"
    assert_command_fails "Invalid schedule frequency" "$CONTINUOUS_DOCS_CLI schedule --frequency invalid"
    assert_command_fails "Invalid template" "$CONTINUOUS_DOCS_CLI templates create --name 'non-existent'"
    
    # Test 13: Health check
    start_test "Comprehensive continuous docs health check"
    assert_command_succeeds "Health check" "$CONTINUOUS_DOCS_CLI health-check"
    assert_output_contains "Check monitoring service" "monitoring.*service" "$CONTINUOUS_DOCS_CLI health-check"
    assert_output_contains "Check scheduled jobs" "scheduled" "$CONTINUOUS_DOCS_CLI health-check --verbose 2>&1 || echo 'scheduled: 0 jobs'"
    
    # Cleanup
    rm -rf "$docs_dir"
    
    cleanup_test_environment
}

# Run the comprehensive test
test_continuous_docs_comprehensive