#!/bin/bash

# Test suite for maintenance CLI pipeline
# Special case - maintenance-cli.sh is at root level

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# The CLI script to test (at root of cli-pipeline)
CLI_SCRIPT="$PROJECT_ROOT/scripts/cli-pipeline/maintenance-cli.sh"

# Initialize test environment
init_test_environment "maintenance CLI Pipeline"

# Test 1: Script exists and is executable
start_test "Script existence and permissions"
assert_file_exists "$CLI_SCRIPT"
assert_file_executable "$CLI_SCRIPT"

# Test 2: Help command works
start_test "Help command"
assert_command_success "$CLI_SCRIPT" "help"
assert_command_output_contains "$CLI_SCRIPT help" "maintenance"

# Test 3: Basic commands
start_test "Basic commands availability"
assert_command_exists "$CLI_SCRIPT" "health-check"
assert_command_exists "$CLI_SCRIPT" "clean-temp"
assert_command_exists "$CLI_SCRIPT" "clean-logs"

# Cleanup and summarize
cleanup_test_environment

# Exit with appropriate code
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
fi

exit 0
