#!/bin/bash
# debug-supabase.sh - Debug script to check Supabase credentials

# Print all available Supabase environment variables
echo "DEBUG: Checking available Supabase environment variables..."
echo "  SUPABASE_URL=${SUPABASE_URL:-not set}"
echo "  SUPABASE_KEY=${SUPABASE_KEY:+set (length: ${#SUPABASE_KEY})}"  # Don't print the actual key
echo "  SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:+set (length: ${#SUPABASE_SERVICE_ROLE_KEY})}"  # Don't print the actual key
echo "  CLI_SUPABASE_URL=${CLI_SUPABASE_URL:-not set}"
echo "  CLI_SUPABASE_KEY=${CLI_SUPABASE_KEY:+set (length: ${#CLI_SUPABASE_KEY})}"  # Don't print the actual key
echo "  VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-not set}"
echo "  VITE_SUPABASE_SERVICE_ROLE_KEY=${VITE_SUPABASE_SERVICE_ROLE_KEY:+set (length: ${#VITE_SUPABASE_SERVICE_ROLE_KEY})}"  # Don't print the actual key

# Set Supabase credentials using available environment variables
# First try CLI_ prefixed vars, then non-prefixed, then VITE_ prefixed
EFFECTIVE_SUPABASE_URL="${CLI_SUPABASE_URL:-${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}}"
EFFECTIVE_SUPABASE_KEY="${CLI_SUPABASE_KEY:-${SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY:-}}}}"

echo "  Using EFFECTIVE_SUPABASE_URL=${EFFECTIVE_SUPABASE_URL:-not set}"
echo "  Using EFFECTIVE_SUPABASE_KEY=${EFFECTIVE_SUPABASE_KEY:+set (length: ${#EFFECTIVE_SUPABASE_KEY})}"  # Don't print the actual key

# Create a temp directory and run a Node.js script to test Supabase credentials
TEMP_DIR=$(mktemp -d)
TEST_SCRIPT="${TEMP_DIR}/test-supabase.js"

cat > "$TEST_SCRIPT" << 'EOL'
// Simple script to test Supabase credentials
const env = process.env;

console.log('DEBUG inside Node script:');
console.log(`  SUPABASE_URL = ${env.SUPABASE_URL || 'not set'}`);
console.log(`  CLI_SUPABASE_URL = ${env.CLI_SUPABASE_URL || 'not set'}`);
console.log(`  VITE_SUPABASE_URL = ${env.VITE_SUPABASE_URL || 'not set'}`);
console.log(`  SUPABASE_KEY is ${env.SUPABASE_KEY ? 'set' : 'not set'}`);
console.log(`  CLI_SUPABASE_KEY is ${env.CLI_SUPABASE_KEY ? 'set' : 'not set'}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY is ${env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'not set'}`);
console.log(`  VITE_SUPABASE_SERVICE_ROLE_KEY is ${env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'not set'}`);

// Try to load Supabase client and test connection if we have credentials
try {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = env.SUPABASE_URL || env.CLI_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_KEY || env.CLI_SUPABASE_KEY || 
                     env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  
  console.log(`  Using supabaseUrl = ${supabaseUrl || 'not set'}`);
  console.log(`  Using supabaseKey is ${supabaseKey ? 'set' : 'not set'}`);
  
  if (supabaseUrl && supabaseKey) {
    console.log('  Attempting to connect to Supabase...');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Simple query to test connection
    supabase
      .from('scripts')
      .select('count', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) {
          console.error('  Connection test failed:', error.message);
        } else {
          console.log(`  Connection successful! Found ${count} scripts in database.`);
        }
      })
      .catch(err => {
        console.error('  Connection test error:', err.message);
      });
  } else {
    console.log('  Cannot test Supabase connection - missing URL or key');
  }
} catch (err) {
  console.error('  Error loading @supabase/supabase-js:', err.message);
  console.log('  Installing @supabase/supabase-js...');
  try {
    require('child_process').execSync('npm install --no-save @supabase/supabase-js', {stdio: 'inherit'});
    console.log('  Installed @supabase/supabase-js, please run this script again.');
  } catch (installErr) {
    console.error('  Failed to install @supabase/supabase-js:', installErr.message);
  }
}
EOL

echo "Running Node.js test script..."
SUPABASE_URL="${EFFECTIVE_SUPABASE_URL}" \
SUPABASE_KEY="${EFFECTIVE_SUPABASE_KEY}" \
CLI_SUPABASE_URL="${CLI_SUPABASE_URL}" \
CLI_SUPABASE_KEY="${CLI_SUPABASE_KEY}" \
VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
VITE_SUPABASE_SERVICE_ROLE_KEY="${VITE_SUPABASE_SERVICE_ROLE_KEY}" \
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
node "${TEST_SCRIPT}"

echo "Test complete. Cleaning up..."
rm -rf "${TEMP_DIR}"

echo ""
echo "===== SOLUTION RECOMMENDATIONS ====="
echo "1. Make sure one of these environment variables pairs is set:"
echo "   - SUPABASE_URL + SUPABASE_KEY"
echo "   - CLI_SUPABASE_URL + CLI_SUPABASE_KEY"
echo "   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
echo "   - VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "2. You can set environment variables in one of these ways:"
echo "   - Export them before running the script: export SUPABASE_URL=your_url"
echo "   - Set them in your .env.local file and source the file"
echo "   - Modify the script to use a fixed URL and key"
echo ""
echo "3. To fix the generate-summary command in script-pipeline-main.sh, use this pattern:"
echo "   SUPABASE_URL=your_url SUPABASE_KEY=your_key ./scripts/cli-pipeline/script-pipeline-main.sh generate-summary"