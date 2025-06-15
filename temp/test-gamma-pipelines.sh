#!/bin/bash

# Test script for all Gamma group pipelines
# Tests functionality and captures results

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_LOG="$SCRIPT_DIR/gamma-pipeline-test-results.log"

# Clear previous results
> "$TEST_LOG"

echo "=== GAMMA PIPELINE TESTING REPORT ===" | tee -a "$TEST_LOG"
echo "Date: $(date)" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

# Function to test a pipeline
test_pipeline() {
    local name="$1"
    local script_path="$2"
    local test_command="$3"
    
    echo "Testing: $name" | tee -a "$TEST_LOG"
    echo "Script: $script_path" | tee -a "$TEST_LOG"
    echo "Command: $test_command" | tee -a "$TEST_LOG"
    
    if [ -f "$script_path" ]; then
        echo "✅ Script exists" | tee -a "$TEST_LOG"
        
        # Test help command
        echo "  Help test:" | tee -a "$TEST_LOG"
        if "$script_path" --help >/dev/null 2>&1; then
            echo "    ✅ Help command works" | tee -a "$TEST_LOG"
        else
            echo "    ❌ Help command failed" | tee -a "$TEST_LOG"
        fi
        
        # Test specific command if provided
        if [ -n "$test_command" ]; then
            echo "  Health check test:" | tee -a "$TEST_LOG"
            if "$script_path" "$test_command" >/dev/null 2>&1; then
                echo "    ✅ $test_command works" | tee -a "$TEST_LOG"
            else
                echo "    ❌ $test_command failed" | tee -a "$TEST_LOG"
            fi
        fi
    else
        echo "❌ Script not found" | tee -a "$TEST_LOG"
    fi
    echo "" | tee -a "$TEST_LOG"
}

cd "$PROJECT_ROOT"

# Test all Gamma pipelines
test_pipeline "Scripts CLI" "./scripts/cli-pipeline/scripts/scripts-cli.sh" "health-check"
test_pipeline "Test Git CLI" "./scripts/cli-pipeline/git/test-git-cli.sh" "list"
test_pipeline "AI CLI" "./scripts/cli-pipeline/ai/ai-cli.sh" "health-check"
test_pipeline "Auth CLI" "./scripts/cli-pipeline/auth/auth-cli.sh" "health-check"
test_pipeline "Git CLI" "./scripts/cli-pipeline/git/git-cli.sh" "health-check"
test_pipeline "Gmail CLI" "./scripts/cli-pipeline/gmail/gmail-cli.sh" "health-check"
test_pipeline "Continuous Docs CLI" "./scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh" "health-check"
test_pipeline "Living Docs CLI" "./scripts/cli-pipeline/living_docs/living-docs-cli.sh" "health-check"
test_pipeline "Work Summaries CLI" "./scripts/cli-pipeline/work_summaries/work-summaries-cli.sh" "health-check"
test_pipeline "Git Workflow CLI" "./scripts/cli-pipeline/git_workflow/git-workflow-cli.sh" "health-check"
test_pipeline "Email CLI" "./scripts/cli-pipeline/email/email-cli.sh" "health-check"
test_pipeline "Analysis CLI" "./scripts/cli-pipeline/all_pipelines/migrated_scripts/analysis/analysis-cli.sh" "health-check"
test_pipeline "Archive CLI" "./scripts/cli-pipeline/all_pipelines/migrated_scripts/archive/archive-cli.sh" "health-check"

echo "=== SUMMARY ===" | tee -a "$TEST_LOG"
echo "Test completed. Results saved to: $TEST_LOG" | tee -a "$TEST_LOG"

# Count successes and failures
TOTAL_TESTS=$(grep -c "Testing:" "$TEST_LOG")
SCRIPT_EXISTS=$(grep -c "✅ Script exists" "$TEST_LOG")
HELP_WORKS=$(grep -c "✅ Help command works" "$TEST_LOG")
HEALTH_WORKS=$(grep -c "✅.*works" "$TEST_LOG" | grep -v "Help")

echo "Total pipelines tested: $TOTAL_TESTS" | tee -a "$TEST_LOG"
echo "Scripts found: $SCRIPT_EXISTS/$TOTAL_TESTS" | tee -a "$TEST_LOG"
echo "Help commands working: $HELP_WORKS/$TOTAL_TESTS" | tee -a "$TEST_LOG"
echo "Health/test commands working: $HEALTH_WORKS/$TOTAL_TESTS" | tee -a "$TEST_LOG"