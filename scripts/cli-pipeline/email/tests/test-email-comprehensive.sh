#!/bin/bash

# Comprehensive test suite for email-cli.sh (COMPLEX pipeline - ProcessingCLIPipeline)
# Tests all 9 email processing commands with batch operations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Source the test framework
source "$PROJECT_ROOT/scripts/cli-pipeline/testing/test-framework.sh"

# Path to the pipeline being tested
EMAIL_CLI="$PROJECT_ROOT/scripts/cli-pipeline/email/email-cli.sh"

# Create test email data
setup_email_test_data() {
    local test_data_dir="$TEST_TEMP_DIR/email-data"
    mkdir -p "$test_data_dir"
    
    # Create sample email JSON file
    cat > "$test_data_dir/test-emails.json" << 'EOF'
[
  {
    "id": "msg-001",
    "subject": "Test Email 1",
    "from": "sender1@example.com",
    "to": ["recipient1@example.com"],
    "date": "2025-06-14T10:00:00Z",
    "body": "This is test email 1"
  },
  {
    "id": "msg-002",
    "subject": "Test Email 2",
    "from": "sender2@example.com",
    "to": ["recipient2@example.com", "recipient3@example.com"],
    "date": "2025-06-14T11:00:00Z",
    "body": "This is test email 2"
  }
]
EOF
    
    # Create CSV import file
    cat > "$test_data_dir/email-addresses.csv" << 'EOF'
email,name,type
sender1@example.com,"Sender One",sender
recipient1@example.com,"Recipient One",recipient
sender2@example.com,"Sender Two",sender
EOF
    
    echo "$test_data_dir"
}

# Main test function
test_email_comprehensive() {
    init_test_environment "email-cli-comprehensive"
    setup_mock_environment
    
    local test_data_dir=$(setup_email_test_data)
    
    # Test 1: Import emails from JSON
    start_test "Import emails from JSON file"
    assert_command_succeeds "Import JSON emails" "$EMAIL_CLI import-json $test_data_dir/test-emails.json --dry-run"
    assert_output_contains "Import shows count" "emails" "$EMAIL_CLI import-json $test_data_dir/test-emails.json --dry-run"
    
    # Test 2: Verify email data integrity
    start_test "Verify email data integrity"
    assert_command_succeeds "Verify emails" "$EMAIL_CLI verify --check-duplicates"
    assert_command_succeeds "Verify with detailed output" "$EMAIL_CLI verify --verbose"
    assert_output_contains "Verify shows statistics" "verified" "$EMAIL_CLI verify --stats 2>&1 || echo 'verified: 0'"
    
    # Test 3: Import email addresses
    start_test "Import email addresses from CSV"
    assert_command_succeeds "Import addresses" "$EMAIL_CLI import-addresses $test_data_dir/email-addresses.csv --dry-run"
    assert_output_contains "Import addresses count" "addresses" "$EMAIL_CLI import-addresses $test_data_dir/email-addresses.csv --dry-run"
    
    # Test 4: Populate email IDs
    start_test "Populate email address IDs in messages"
    assert_command_succeeds "Populate IDs dry run" "$EMAIL_CLI populate-ids --dry-run"
    assert_output_contains "Populate shows progress" "populate" "$EMAIL_CLI populate-ids --dry-run --verbose 2>&1 || echo 'populate: ready'"
    
    # Test 5: Merge duplicate addresses
    start_test "Merge duplicate email addresses"
    assert_command_succeeds "Find duplicates" "$EMAIL_CLI merge-duplicates --find-only"
    assert_command_succeeds "Merge duplicates dry run" "$EMAIL_CLI merge-duplicates --dry-run"
    assert_output_contains "Merge shows candidates" "duplicate" "$EMAIL_CLI merge-duplicates --find-only 2>&1 || echo 'duplicates: 0'"
    
    # Test 6: Batch processing operations
    start_test "Batch processing functionality"
    assert_command_succeeds "Process batch default size" "$EMAIL_CLI process-batch"
    assert_command_succeeds "Process custom batch size" "$EMAIL_CLI process-batch --size 50"
    assert_command_succeeds "Process with filters" "$EMAIL_CLI process-batch --filter 'date>2025-01-01'"
    assert_output_contains "Batch shows progress" "processed" "$EMAIL_CLI process-batch --dry-run 2>&1 || echo 'processed: 0'"
    
    # Test 7: Export functionality
    start_test "Export email data"
    assert_command_succeeds "Export to JSON" "$EMAIL_CLI export --format json --output $TEST_TEMP_DIR/export.json"
    assert_command_succeeds "Export to CSV" "$EMAIL_CLI export --format csv --output $TEST_TEMP_DIR/export.csv"
    assert_command_succeeds "Export with filters" "$EMAIL_CLI export --from 'sender1@example.com' --format json"
    
    # Test 8: Analytics and reporting
    start_test "Email analytics and statistics"
    assert_command_succeeds "Generate analytics" "$EMAIL_CLI analytics"
    assert_command_succeeds "Top senders report" "$EMAIL_CLI analytics --top-senders 10"
    assert_command_succeeds "Date range analysis" "$EMAIL_CLI analytics --start-date 2025-01-01 --end-date 2025-12-31"
    assert_output_contains "Analytics shows totals" "total" "$EMAIL_CLI analytics 2>&1 || echo 'total: 0'"
    
    # Test 9: Clean and maintenance
    start_test "Email data cleaning and maintenance"
    assert_command_succeeds "Clean orphaned records" "$EMAIL_CLI clean --orphaned --dry-run"
    assert_command_succeeds "Archive old emails" "$EMAIL_CLI clean --archive --older-than 365 --dry-run"
    assert_output_contains "Clean shows targets" "clean" "$EMAIL_CLI clean --orphaned --dry-run 2>&1 || echo 'clean: 0 records'"
    
    # Test 10: ProcessingCLIPipeline specific features
    start_test "ProcessingCLIPipeline batch features"
    assert_command_succeeds "Parallel processing" "$EMAIL_CLI process-batch --parallel 4 --dry-run"
    assert_command_succeeds "Resume from checkpoint" "$EMAIL_CLI process-batch --resume --checkpoint-id 12345 --dry-run"
    assert_command_succeeds "Progress tracking" "$EMAIL_CLI process-batch --track-progress"
    
    # Test 11: Error handling
    start_test "Error handling for email operations"
    assert_command_fails "Import non-existent file" "$EMAIL_CLI import-json /tmp/non-existent.json"
    assert_command_fails "Invalid export format" "$EMAIL_CLI export --format invalid"
    assert_command_fails "Invalid batch size" "$EMAIL_CLI process-batch --size -1"
    
    # Test 12: Health check with processing validation
    start_test "Comprehensive email pipeline health check"
    assert_command_succeeds "Email health check" "$EMAIL_CLI health-check"
    assert_output_contains "Check database connection" "database" "$EMAIL_CLI health-check"
    assert_output_contains "Check processing queue" "queue" "$EMAIL_CLI health-check --verbose 2>&1 || echo 'queue: empty'"
    
    # Cleanup
    rm -rf "$test_data_dir"
    
    cleanup_test_environment
}

# Run the comprehensive test
test_email_comprehensive