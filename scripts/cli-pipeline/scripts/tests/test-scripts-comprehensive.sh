#!/bin/bash

# Comprehensive test suite for scripts-cli.sh (COMPLEX pipeline)
# Tests all 8 commands with realistic scenarios

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# Path to the pipeline being tested
SCRIPTS_CLI="$PROJECT_ROOT/scripts/cli-pipeline/scripts/scripts-cli.sh"

# Test data setup
create_test_scripts() {
    local test_dir="$1"
    
    # Create test script files
    cat > "$test_dir/test-script-1.ts" << 'EOF'
#!/usr/bin/env ts-node
// Test script for validation
console.log("Hello from test script 1");
EOF
    
    cat > "$test_dir/test-script-2.sh" << 'EOF'
#!/bin/bash
# Another test script
echo "Test script 2 output"
EOF
    
    cat > "$test_dir/archived-script.js" << 'EOF'
// This is an archived script
console.log("Should be archived");
EOF
    
    chmod +x "$test_dir"/*.{ts,sh,js} 2>/dev/null || true
}

# Main test function
test_scripts_comprehensive() {
    init_test_environment "scripts-cli-comprehensive"
    setup_mock_environment
    
    local test_scripts_dir="$TEST_TEMP_DIR/test-scripts"
    mkdir -p "$test_scripts_dir"
    create_test_scripts "$test_scripts_dir"
    
    # Test 1: Full sync operation
    start_test "Full sync of all scripts with AI classification"
    assert_command_succeeds "Sync command executes" "$SCRIPTS_CLI sync --dry-run"
    assert_output_contains "Sync shows summary" "scripts found" "$SCRIPTS_CLI sync --dry-run"
    
    # Test 2: Classify single script
    start_test "Classify a single script file"
    if [[ -n "$CLAUDE_API_KEY" ]]; then
        assert_command_succeeds "Classify typescript file" "$SCRIPTS_CLI classify $test_scripts_dir/test-script-1.ts"
    else
        log_warn "Skipping classify test - CLAUDE_API_KEY not set"
    fi
    
    # Test 3: List scripts with various filters
    start_test "List scripts with filtering options"
    assert_command_succeeds "List all scripts" "$SCRIPTS_CLI list"
    assert_command_succeeds "List by pipeline filter" "$SCRIPTS_CLI list --pipeline scripts"
    assert_command_succeeds "List by type filter" "$SCRIPTS_CLI list --type utility"
    assert_command_succeeds "List recent scripts" "$SCRIPTS_CLI list --recent 7"
    assert_command_succeeds "List including archived" "$SCRIPTS_CLI list --archived"
    
    # Test 4: Search functionality
    start_test "Search scripts by content or metadata"
    assert_command_succeeds "Search for console.log" "$SCRIPTS_CLI search console"
    assert_output_contains "Search returns results format" "Search results" "$SCRIPTS_CLI search echo"
    
    # Test 5: Archive script operation
    start_test "Archive a script file"
    local archive_target="$test_scripts_dir/archived-script.js"
    if [[ -f "$archive_target" ]]; then
        assert_command_succeeds "Archive script" "$SCRIPTS_CLI archive $archive_target --dry-run"
        assert_output_contains "Archive shows target" "Would archive" "$SCRIPTS_CLI archive $archive_target --dry-run"
    fi
    
    # Test 6: Register new script
    start_test "Manually register a new script"
    assert_command_succeeds "Register with tags" "$SCRIPTS_CLI register $test_scripts_dir/test-script-1.ts --tags 'test,validation' --dry-run"
    
    # Test 7: Statistics display
    start_test "Show script statistics and insights"
    assert_command_succeeds "Display stats" "$SCRIPTS_CLI stats"
    assert_output_contains "Stats show totals" "Total scripts" "$SCRIPTS_CLI stats"
    
    # Test 8: Health check comprehensive
    start_test "Comprehensive health check"
    assert_command_succeeds "Health check runs" "$SCRIPTS_CLI health-check"
    assert_output_contains "Check environment" "health check" "$SCRIPTS_CLI health-check"
    
    # Test 9: Error handling for invalid files
    start_test "Error handling for invalid operations"
    assert_command_fails "Classify non-existent file" "$SCRIPTS_CLI classify /tmp/non-existent-script.ts"
    assert_command_fails "Archive non-existent file" "$SCRIPTS_CLI archive /tmp/non-existent.sh"
    
    # Test 10: Batch operations
    start_test "Batch script operations"
    # Test listing multiple scripts at once
    assert_output_contains "List shows multiple results" "test-script" "$SCRIPTS_CLI list --path $test_scripts_dir"
    
    # Cleanup
    rm -rf "$test_scripts_dir"
    
    cleanup_test_environment
}

# Run the comprehensive test
test_scripts_comprehensive