#!/bin/bash
# Health check script for Presentations CLI pipeline

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/presentations-health-check.log"

# Initialize log file
echo "Presentations CLI Pipeline Health Check - $(date)" > "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

# Load environment variables
if [ -f "$ROOT_DIR/.env.development" ]; then
  source "$ROOT_DIR/.env.development"
fi

echo "Running Presentations CLI Pipeline health check..."
echo "Results will be logged to $LOG_FILE"

# Check if Supabase connection is working
check_supabase() {
  echo "Checking Supabase connection..." >> "$LOG_FILE"
  
  if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Supabase credentials not found in environment" >> "$LOG_FILE"
    return 1
  fi
  
  # Use the SupabaseClientService to test the connection - double check the script to ensure it runs properly
  SUPABASE_TEST_RESULT=$(cd "$ROOT_DIR" && node -e "
    async function testConnection() {
      try {
        const { createClient } = require('@supabase/supabase-js');
        
        // Get credentials directly from env
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing required Supabase credentials');
        }
        
        // Create a client directly
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Test presentations table
        const { data, error } = await supabase
          .from('presentations')
          .select('id')
          .limit(1);
          
        if (error) {
          throw new Error('Failed to query presentations table: ' + error.message);
        }
        
        console.log('✅ Supabase connection successful');
        return 0;
      } catch (err) {
        console.log('❌ Error testing Supabase connection:', err.message || String(err));
        return 1;
      }
    }
    
    testConnection()
      .then(code => process.exit(code))
      .catch(err => {
        console.log('❌ Fatal error in connection test:', err.message || String(err));
        process.exit(1);
      });
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
    echo "✅ Presentations CLI Pipeline health check passed" | tee -a "$LOG_FILE"
  fi
  
  return $status
}

# Execute health check
run_health_check
exit $?