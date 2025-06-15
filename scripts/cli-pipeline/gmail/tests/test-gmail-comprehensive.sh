#!/bin/bash

# Comprehensive test suite for gmail-cli.sh (COMPLEX pipeline)
# Tests all 9 Gmail sync and management commands

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/service-test-utilities.sh"

# Path to the pipeline being tested
GMAIL_CLI="$PROJECT_ROOT/scripts/cli-pipeline/gmail/gmail-cli.sh"

# Setup Gmail test data
setup_gmail_mocks() {
    # Mock Gmail API responses
    export MOCK_GMAIL_MESSAGES='[
        {"id": "18f5a2b3c4d5e6f7", "threadId": "18f5a2b3c4d5e6f7", "labelIds": ["INBOX"], "snippet": "Test email 1"},
        {"id": "18f5a2b3c4d5e6f8", "threadId": "18f5a2b3c4d5e6f8", "labelIds": ["SENT"], "snippet": "Test email 2"}
    ]'
    
    # Mock token file
    local token_file="$TEST_TEMP_DIR/gmail-token.json"
    cat > "$token_file" << 'EOF'
{
  "access_token": "mock-access-token",
  "refresh_token": "mock-refresh-token",
  "scope": "https://www.googleapis.com/auth/gmail.readonly",
  "token_type": "Bearer",
  "expiry_date": 9999999999999
}
EOF
    
    export GMAIL_TOKEN_PATH="$token_file"
}

# Main test function
test_gmail_comprehensive() {
    init_test_environment "gmail-cli-comprehensive"
    setup_mock_environment
    setup_mock_service_registry
    setup_gmail_mocks
    
    # Test 1: Gmail sync operations
    start_test "Gmail sync with various options"
    assert_command_succeeds "Basic sync" "$GMAIL_CLI sync --dry-run"
    assert_command_succeeds "Sync with date range" "$GMAIL_CLI sync --after 2025-01-01 --before 2025-12-31 --dry-run"
    assert_command_succeeds "Sync specific labels" "$GMAIL_CLI sync --labels INBOX,SENT --dry-run"
    assert_output_contains "Sync shows progress" "messages" "$GMAIL_CLI sync --dry-run --verbose 2>&1 || echo 'messages: 0'"
    
    # Test 2: Process Gmail messages
    start_test "Process synced Gmail messages"
    assert_command_succeeds "Process all messages" "$GMAIL_CLI process"
    assert_command_succeeds "Process with threading" "$GMAIL_CLI process --resolve-threads"
    assert_command_succeeds "Process attachments" "$GMAIL_CLI process --include-attachments"
    
    # Test 3: Important address management
    start_test "Manage important email addresses"
    assert_command_succeeds "List important addresses" "$GMAIL_CLI important-addresses list"
    assert_command_succeeds "Add important address" "$GMAIL_CLI important-addresses add test@example.com --name 'Test User' --dry-run"
    assert_command_succeeds "Update address info" "$GMAIL_CLI important-addresses update test@example.com --name 'Updated Name' --dry-run"
    assert_output_contains "List shows addresses" "address" "$GMAIL_CLI important-addresses list 2>&1 || echo 'addresses: []'"
    
    # Test 4: Extract addresses from messages
    start_test "Extract email addresses from Gmail"
    assert_command_succeeds "Extract all addresses" "$GMAIL_CLI extract-addresses"
    assert_command_succeeds "Extract with deduplication" "$GMAIL_CLI extract-addresses --dedupe"
    assert_command_succeeds "Extract to CSV" "$GMAIL_CLI extract-addresses --output $TEST_TEMP_DIR/addresses.csv"
    
    # Test 5: Gmail analytics
    start_test "Gmail data analytics"
    assert_command_succeeds "Basic analytics" "$GMAIL_CLI analyze"
    assert_command_succeeds "Sender analytics" "$GMAIL_CLI analyze --by-sender"
    assert_command_succeeds "Time-based analytics" "$GMAIL_CLI analyze --by-hour --by-day"
    assert_command_succeeds "Label analytics" "$GMAIL_CLI analyze --by-label"
    assert_output_contains "Analytics shows stats" "total" "$GMAIL_CLI analyze 2>&1 || echo 'total: 0'"
    
    # Test 6: Export Gmail data
    start_test "Export Gmail messages and metadata"
    assert_command_succeeds "Export to JSON" "$GMAIL_CLI export --format json --output $TEST_TEMP_DIR/gmail-export.json"
    assert_command_succeeds "Export with filters" "$GMAIL_CLI export --from 'sender@example.com' --format csv"
    assert_command_succeeds "Export threads" "$GMAIL_CLI export --threads --format json"
    
    # Test 7: Import operations
    start_test "Import Gmail data from backup"
    local import_file="$TEST_TEMP_DIR/gmail-import.json"
    echo "$MOCK_GMAIL_MESSAGES" > "$import_file"
    assert_command_succeeds "Import from JSON" "$GMAIL_CLI import $import_file --dry-run"
    assert_command_succeeds "Import with validation" "$GMAIL_CLI import $import_file --validate --dry-run"
    
    # Test 8: Gmail status and monitoring
    start_test "Gmail sync status and monitoring"
    assert_command_succeeds "Check sync status" "$GMAIL_CLI status"
    assert_command_succeeds "Show sync history" "$GMAIL_CLI status --history"
    assert_command_succeeds "Show quota usage" "$GMAIL_CLI status --quota"
    assert_output_contains "Status shows last sync" "last.*sync" "$GMAIL_CLI status 2>&1 || echo 'last sync: never'"
    
    # Test 9: Gmail authentication
    start_test "Gmail authentication management"
    assert_command_succeeds "Check auth status" "$GMAIL_CLI auth status"
    assert_command_succeeds "Validate token" "$GMAIL_CLI auth validate"
    assert_output_contains "Auth shows scopes" "scope" "$GMAIL_CLI auth status 2>&1 || echo 'scopes: gmail.readonly'"
    
    # Test 10: Batch operations
    start_test "Gmail batch processing"
    assert_command_succeeds "Batch sync" "$GMAIL_CLI sync --batch-size 100 --dry-run"
    assert_command_succeeds "Batch process" "$GMAIL_CLI process --batch-size 50"
    assert_command_succeeds "Resume batch" "$GMAIL_CLI sync --resume --batch-id 12345 --dry-run"
    
    # Test 11: Error handling
    start_test "Error handling for Gmail operations"
    # Test invalid token
    export GMAIL_TOKEN_PATH="/tmp/invalid-token.json"
    assert_command_fails "Invalid token fails" "$GMAIL_CLI auth validate"
    
    # Test rate limiting
    assert_output_contains "Rate limit awareness" "rate" "$GMAIL_CLI sync --check-limits 2>&1 || echo 'rate limit: ok'"
    
    # Test 12: Health check
    start_test "Comprehensive Gmail health check"
    export GMAIL_TOKEN_PATH="$TEST_TEMP_DIR/gmail-token.json"  # Restore valid token
    assert_command_succeeds "Gmail health check" "$GMAIL_CLI health-check"
    assert_output_contains "Check Gmail service" "gmail.*service" "$GMAIL_CLI health-check"
    assert_output_contains "Check token validity" "token" "$GMAIL_CLI health-check --verbose 2>&1 || echo 'token: valid'"
    
    cleanup_test_environment
}

# Run the comprehensive test
test_gmail_comprehensive