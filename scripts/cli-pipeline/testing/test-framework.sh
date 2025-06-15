#!/bin/bash

# CLI Pipeline Test Framework
# Shared utilities for testing all pipelines

set -e

# Colors for test output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0
CURRENT_TEST=""

# Initialize test environment
init_test_environment() {
    local test_name="$1"
    echo -e "${BLUE}=== Starting Test Suite: $test_name ===${NC}"
    TEST_COUNT=0
    PASS_COUNT=0
    FAIL_COUNT=0
    
    # Create temporary test directory
    TEST_TEMP_DIR="$(mktemp -d)"
    export TEST_TEMP_DIR
    
    # Setup test database connection (using existing dev database for now)
    export TEST_DATABASE_URL="$SUPABASE_URL"
    export TEST_DATABASE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
    
    echo "Test temp directory: $TEST_TEMP_DIR"
}

# Cleanup test environment
cleanup_test_environment() {
    if [ -n "$TEST_TEMP_DIR" ] && [ -d "$TEST_TEMP_DIR" ]; then
        rm -rf "$TEST_TEMP_DIR"
    fi
    
    echo -e "\n${BLUE}=== Test Results ===${NC}"
    echo "Total tests: $TEST_COUNT"
    echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
    echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
    
    if [ $FAIL_COUNT -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ $FAIL_COUNT tests failed${NC}"
        return 1
    fi
}

# Start a test case
start_test() {
    local test_description="$1"
    CURRENT_TEST="$test_description"
    ((TEST_COUNT++))
    echo -e "\n${YELLOW}Test $TEST_COUNT: $test_description${NC}"
}

# Assert command succeeds
assert_command_succeeds() {
    local description="$1"
    shift
    local command="$@"
    
    echo "  Running: $command"
    if eval "$command" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ PASS${NC}: $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "  ${RED}❌ FAIL${NC}: $description"
        echo "    Command failed: $command"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Assert command fails (for negative testing)
assert_command_fails() {
    local description="$1"
    shift
    local command="$@"
    
    echo "  Running: $command"
    if eval "$command" >/dev/null 2>&1; then
        echo -e "  ${RED}❌ FAIL${NC}: $description"
        echo "    Command should have failed but succeeded: $command"
        ((FAIL_COUNT++))
        return 1
    else
        echo -e "  ${GREEN}✅ PASS${NC}: $description"
        ((PASS_COUNT++))
        return 0
    fi
}

# Assert output contains text
assert_output_contains() {
    local description="$1"
    local expected_text="$2"
    shift 2
    local command="$@"
    
    echo "  Running: $command"
    local output
    output=$(eval "$command" 2>&1)
    
    if echo "$output" | grep -q "$expected_text"; then
        echo -e "  ${GREEN}✅ PASS${NC}: $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "  ${RED}❌ FAIL${NC}: $description"
        echo "    Expected to find: '$expected_text'"
        echo "    Actual output: '$output'"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Assert file exists
assert_file_exists() {
    local description="$1"
    local file_path="$2"
    
    if [ -f "$file_path" ]; then
        echo -e "  ${GREEN}✅ PASS${NC}: $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "  ${RED}❌ FAIL${NC}: $description"
        echo "    File not found: $file_path"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Assert file does not exist
assert_file_not_exists() {
    local description="$1"
    local file_path="$2"
    
    if [ ! -f "$file_path" ]; then
        echo -e "  ${GREEN}✅ PASS${NC}: $description"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "  ${RED}❌ FAIL${NC}: $description"
        echo "    File should not exist but does: $file_path"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Create test script file
create_test_script() {
    local script_name="$1"
    local script_content="$2"
    local script_path="$TEST_TEMP_DIR/$script_name"
    
    echo "$script_content" > "$script_path"
    chmod +x "$script_path"
    echo "$script_path"
}

# Create test git repository
create_test_git_repo() {
    local repo_name="$1"
    local repo_path="$TEST_TEMP_DIR/$repo_name"
    
    mkdir -p "$repo_path"
    cd "$repo_path"
    
    git init
    git config user.email "test@example.com"
    git config user.name "Test User"
    
    # Create initial commit
    echo "# Test Repository" > README.md
    git add README.md
    git commit -m "Initial commit"
    
    echo "$repo_path"
}

# Mock environment for testing
setup_mock_environment() {
    # Create mock .env file for testing
    export TEST_ENV_FILE="$TEST_TEMP_DIR/.env.test"
    cat > "$TEST_ENV_FILE" << EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
CLAUDE_API_KEY=test-claude-api-key
TEST_MODE=true
EOF
}

# Helper to run pipeline command in test environment
run_pipeline_command() {
    local pipeline_script="$1"
    shift
    local command_args="$@"
    
    cd "$TEST_TEMP_DIR"
    "$pipeline_script" $command_args
}

# Export all functions
export -f init_test_environment
export -f cleanup_test_environment
export -f start_test
export -f assert_command_succeeds
export -f assert_command_fails
export -f assert_output_contains
export -f assert_file_exists
export -f assert_file_not_exists
export -f create_test_script
export -f create_test_git_repo
export -f setup_mock_environment
export -f run_pipeline_command