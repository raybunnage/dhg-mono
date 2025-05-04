#!/bin/bash
# Health check script for Media Processing CLI pipeline

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/media-processing-health-check.log"

# Initialize log file
echo "Media Processing CLI Pipeline Health Check - $(date)" > "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

# Load environment variables
if [ -f "$ROOT_DIR/.env.development" ]; then
  source "$ROOT_DIR/.env.development"
fi

echo "Running Media Processing CLI Pipeline health check..."
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
        const { data, error } = await supabase.from('sources_google').select('count(*)', { count: 'exact', head: true });
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

# Run health check
run_health_check() {
  local status=0
  
  check_supabase
  if [ $? -ne 0 ]; then
    status=1
  else
    echo "✅ Media Processing CLI Pipeline health check passed" | tee -a "$LOG_FILE"
  fi
  
  return $status
}

# Execute health check
run_health_check
exit $?