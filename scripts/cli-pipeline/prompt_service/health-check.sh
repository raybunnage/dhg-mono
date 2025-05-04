#!/bin/bash
# Health check script for Prompt Service CLI pipeline

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/prompt-service-health-check.log"

# Initialize log file
echo "Prompt Service CLI Pipeline Health Check - $(date)" > "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

# Load environment variables
if [ -f "$ROOT_DIR/.env.development" ]; then
  source "$ROOT_DIR/.env.development"
fi

echo "Running Prompt Service CLI Pipeline health check..."
echo "Results will be logged to $LOG_FILE"

# Check if Supabase connection is working
check_supabase() {
  echo "Checking Supabase connection..." >> "$LOG_FILE"
  
  if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Supabase credentials not found in environment" >> "$LOG_FILE"
    return 1
  fi
  
  # Use the SupabaseClientService to test the connection
  SUPABASE_TEST_RESULT=$(cd "$ROOT_DIR" && npx ts-node -e "
    const { SupabaseClientService } = require('./packages/shared/services/supabase-client');
    async function testConnection() {
      try {
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data, error } = await supabase.from('prompts').select('count(*)', { count: 'exact', head: true });
        if (error) {
          console.log('❌ Supabase connection test failed:', error.message);
          return 1;
        }
        console.log('✅ Supabase connection successful');
        return 0;
      } catch (err: any) {
        console.log('❌ Error testing Supabase connection:', err.message || String(err));
        return 1;
      }
    }
    testConnection().then(code => process.exit(code));
  ")
  
  echo "$SUPABASE_TEST_RESULT" >> "$LOG_FILE"
  if [[ "$SUPABASE_TEST_RESULT" == *"connection successful"* ]]; then
    return 0
  else
    return 1
  fi
}

# Check if Anthropic Claude API is working
check_claude_api() {
  echo "Checking Claude API..." >> "$LOG_FILE"
  
  if [ -z "$CLI_CLAUDE_API_KEY" ]; then
    echo "❌ Claude API key not found in environment" >> "$LOG_FILE"
    return 1
  fi
  
  # Use the SupabaseClientService to test the connection
  CLAUDE_TEST_RESULT=$(cd "$ROOT_DIR" && npx ts-node -e "
    const { claudeService } = require('./packages/shared/services/claude-service');
    async function testClaudeApi() {
      try {
        const response = await claudeService.sendPrompt('Hello, are you working?');
        if (response && response.length > 0) {
          console.log('✅ Claude API is working properly');
          return 0;
        } else {
          console.log('❌ Claude API test failed: Empty response');
          return 1;
        }
      } catch (err: any) {
        console.log('❌ Error testing Claude API:', err.message || String(err));
        return 1;
      }
    }
    testClaudeApi().then(code => process.exit(code));
  ")
  
  echo "$CLAUDE_TEST_RESULT" >> "$LOG_FILE"
  if [[ "$CLAUDE_TEST_RESULT" == *"API is working properly"* ]]; then
    return 0
  else
    return 1
  fi
}

# Run health check
run_health_check() {
  local status=0
  
  check_supabase
  supabase_status=$?
  
  check_claude_api
  claude_status=$?
  
  if [ $supabase_status -ne 0 ] || [ $claude_status -ne 0 ]; then
    status=1
    echo "❌ Prompt Service CLI Pipeline health check failed" | tee -a "$LOG_FILE"
  else
    echo "✅ Prompt Service CLI Pipeline health check passed" | tee -a "$LOG_FILE"
  fi
  
  return $status
}

# Execute health check
run_health_check
exit $?