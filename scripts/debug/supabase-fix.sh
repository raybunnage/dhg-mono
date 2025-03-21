#!/bin/bash
# supabase-fix.sh - A comprehensive fix for Supabase credential issues

# Script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "🔧 Supabase Credentials Fix"
echo "============================"
echo "This script will fix Supabase credential issues by:"
echo "1. Ensuring your .env files are properly set up"
echo "2. Creating a portable wrapper script to run commands with correct credentials"
echo "3. Fixing the dependency issues with @supabase/supabase-js"
echo ""

# First, check if there are existing .env files
ENV_LOCAL="${ROOT_DIR}/.env.local"
ENV_DEV="${ROOT_DIR}/.env.development"
ENV_BASE="${ROOT_DIR}/.env"

# Check if any key files exist
if [ ! -f "$ENV_LOCAL" ] && [ ! -f "$ENV_DEV" ] && [ ! -f "$ENV_BASE" ]; then
  echo "⚠️ No .env files found! Creating a basic .env file..."
  touch "$ENV_BASE"
fi

# Check for Supabase credentials in the environment
SUPA_URL="${SUPABASE_URL:-${CLI_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}}"
SUPA_KEY="${SUPABASE_KEY:-${CLI_SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY:-}}}}"

# If we don't have credentials in the environment, check if they exist in .env files
if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  echo "Searching for credentials in .env files..."
  
  # Check each env file for credentials
  for env_file in "$ENV_LOCAL" "$ENV_DEV" "$ENV_BASE"; do
    if [ -f "$env_file" ]; then
      echo "Checking $env_file..."
      
      # Extract URL from file
      URL_IN_FILE=$(grep -E "SUPABASE_URL|CLI_SUPABASE_URL|VITE_SUPABASE_URL" "$env_file" | head -1)
      KEY_IN_FILE=$(grep -E "SUPABASE_KEY|CLI_SUPABASE_KEY|SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY" "$env_file" | head -1)
      
      if [ -n "$URL_IN_FILE" ] && [ -n "$KEY_IN_FILE" ]; then
        echo "✅ Found Supabase credentials in $env_file"
        break
      fi
    fi
  done
fi

# Prompt for credentials if still not found
if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  echo ""
  echo "⚠️ No Supabase credentials found in environment or .env files."
  echo "Please enter your Supabase credentials now:"
  
  # Get URL
  read -p "Enter Supabase URL (https://xxx.supabase.co): " INPUT_URL
  SUPA_URL="${INPUT_URL}"
  
  # Get Key
  read -p "Enter Supabase service role key: " INPUT_KEY
  SUPA_KEY="${INPUT_KEY}"
  
  # Verify input
  if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
    echo "❌ You must provide both a URL and key. Exiting."
    exit 1
  fi
  
  # Ask which file to write to
  echo ""
  echo "Where would you like to store these credentials?"
  echo "1) .env.local (recommended for development, not committed to git)"
  echo "2) .env.development (shared development settings)"
  echo "3) .env (base settings)"
  echo "4) Don't save, just use for this session"
  
  read -p "Enter choice [1-4]: " FILE_CHOICE
  
  # Write to selected file
  case "$FILE_CHOICE" in
    1)
      TARGET_FILE="$ENV_LOCAL"
      ;;
    2)
      TARGET_FILE="$ENV_DEV"
      ;;
    3)
      TARGET_FILE="$ENV_BASE"
      ;;
    4)
      TARGET_FILE=""
      ;;
    *)
      echo "Invalid choice. Defaulting to .env.local"
      TARGET_FILE="$ENV_LOCAL"
      ;;
  esac
  
  if [ -n "$TARGET_FILE" ]; then
    # Make sure the file exists
    touch "$TARGET_FILE"
    
    # Remove any existing Supabase entries
    sed -i.bak -e '/SUPABASE_URL/d' -e '/SUPABASE_KEY/d' -e '/SUPABASE_SERVICE_ROLE_KEY/d' -e '/CLI_SUPABASE/d' -e '/VITE_SUPABASE/d' "$TARGET_FILE"
    
    # Add new entries with all variants
    echo "" >> "$TARGET_FILE"
    echo "# Supabase credentials" >> "$TARGET_FILE"
    echo "SUPABASE_URL=\"$SUPA_URL\"" >> "$TARGET_FILE"
    echo "SUPABASE_KEY=\"$SUPA_KEY\"" >> "$TARGET_FILE"
    echo "SUPABASE_SERVICE_ROLE_KEY=\"$SUPA_KEY\"" >> "$TARGET_FILE"
    echo "CLI_SUPABASE_URL=\"$SUPA_URL\"" >> "$TARGET_FILE"
    echo "CLI_SUPABASE_KEY=\"$SUPA_KEY\"" >> "$TARGET_FILE"
    echo "VITE_SUPABASE_URL=\"$SUPA_URL\"" >> "$TARGET_FILE"
    echo "VITE_SUPABASE_SERVICE_ROLE_KEY=\"$SUPA_KEY\"" >> "$TARGET_FILE"
    
    echo "✅ Credentials written to $TARGET_FILE"
    
    # Remove backup file
    rm -f "${TARGET_FILE}.bak"
  else
    echo "Credentials will be used for this session only."
  fi
fi

# Create a universal supabase wrapper script
WRAPPER_SCRIPT="${ROOT_DIR}/scripts/run-with-supabase.sh"

cat > "$WRAPPER_SCRIPT" << 'EOL'
#!/bin/bash
# run-with-supabase.sh - Universal wrapper for running commands with Supabase credentials
# Usage: ./scripts/run-with-supabase.sh your-command-here [args...]

# Get script dir and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Try to load credentials from environment
SUPA_URL="${SUPABASE_URL:-${CLI_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}}"
SUPA_KEY="${SUPABASE_KEY:-${CLI_SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY:-}}}}"

# Check if we need to load from .env files
if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  # Try each .env file in order of precedence
  for env_file in ".env.local" ".env.development" ".env"; do
    FULL_PATH="${ROOT_DIR}/${env_file}"
    if [ -f "$FULL_PATH" ]; then
      echo "Loading variables from ${env_file}..."
      # shellcheck disable=SC1090
      source "$FULL_PATH"
      
      # Refresh variables
      SUPA_URL="${SUPABASE_URL:-${CLI_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}}"
      SUPA_KEY="${SUPABASE_KEY:-${CLI_SUPABASE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-${VITE_SUPABASE_SERVICE_ROLE_KEY:-}}}}"
      
      # Break if we found what we need
      if [ -n "$SUPA_URL" ] && [ -n "$SUPA_KEY" ]; then
        break
      fi
    fi
  done
fi

# Verify we have credentials
if [ -z "$SUPA_URL" ] || [ -z "$SUPA_KEY" ]; then
  echo "❌ ERROR: Supabase credentials not found!"
  echo "Please run ./scripts/debug/supabase-fix.sh to set up your credentials."
  exit 1
fi

echo "→ Using Supabase URL: ${SUPA_URL}"
echo "→ Using Supabase key (${#SUPA_KEY} chars)"

# If no command was specified, just export the variables
if [ $# -eq 0 ]; then
  echo "No command specified. Run 'source $0' to export variables in current shell."
  echo "Or run '$0 your-command' to execute a command with the variables set."
  
  # Export variables so they're available in current shell if sourced
  export SUPABASE_URL="${SUPA_URL}"
  export SUPABASE_KEY="${SUPA_KEY}"
  export SUPABASE_SERVICE_ROLE_KEY="${SUPA_KEY}"
  export CLI_SUPABASE_URL="${SUPA_URL}"
  export CLI_SUPABASE_KEY="${SUPA_KEY}"
  export VITE_SUPABASE_URL="${SUPA_URL}"
  export VITE_SUPABASE_SERVICE_ROLE_KEY="${SUPA_KEY}"
else
  # Run the specified command with all Supabase variables set
  SUPABASE_URL="${SUPA_URL}" \
  SUPABASE_KEY="${SUPA_KEY}" \
  SUPABASE_SERVICE_ROLE_KEY="${SUPA_KEY}" \
  CLI_SUPABASE_URL="${SUPA_URL}" \
  CLI_SUPABASE_KEY="${SUPA_KEY}" \
  VITE_SUPABASE_URL="${SUPA_URL}" \
  VITE_SUPABASE_SERVICE_ROLE_KEY="${SUPA_KEY}" \
  "$@"
fi
EOL

# Make it executable
chmod +x "$WRAPPER_SCRIPT"
echo "✅ Created universal wrapper script: $WRAPPER_SCRIPT"

# Create a dependency checker script
DEP_CHECKER="${ROOT_DIR}/scripts/verify-supabase-deps.js"

cat > "$DEP_CHECKER" << 'EOL'
#!/usr/bin/env node
/**
 * verify-supabase-deps.js - Ensures Supabase dependencies are available
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check if Supabase is installed
let hasSupabase = false;
try {
  require.resolve('@supabase/supabase-js');
  hasSupabase = true;
  console.log('✅ @supabase/supabase-js is already installed');
} catch (e) {
  console.log('⚠️ @supabase/supabase-js is not installed');
}

// Install it if needed
if (!hasSupabase) {
  console.log('Installing @supabase/supabase-js...');
  try {
    execSync('npm install --no-save @supabase/supabase-js', { stdio: 'inherit' });
    console.log('✅ Successfully installed @supabase/supabase-js');
  } catch (err) {
    console.error('❌ Failed to install @supabase/supabase-js:', err.message);
    process.exit(1);
  }
}

// Now run a simple connection test if URL and key are available
const url = process.env.SUPABASE_URL || 
            process.env.CLI_SUPABASE_URL || 
            process.env.VITE_SUPABASE_URL;

const key = process.env.SUPABASE_KEY || 
            process.env.CLI_SUPABASE_KEY || 
            process.env.SUPABASE_SERVICE_ROLE_KEY || 
            process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log('⚠️ Supabase credentials not found in environment variables');
  console.log('Run source ./scripts/run-with-supabase.sh to set them');
  process.exit(0);
}

console.log(`Testing connection to Supabase at ${url}`);
console.log(`Using key with length: ${key.length} characters`);

// Try a simple connection test
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

// Simple connection test
(async () => {
  try {
    const { data, error, status } = await supabase
      .from('scripts')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      console.log('Status:', status);
      process.exit(1);
    }
    
    console.log('✅ Connection successful! Ready to use Supabase.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error during connection test:', err.message);
    process.exit(1);
  }
})();
EOL

# Make it executable
chmod +x "$DEP_CHECKER"
echo "✅ Created dependency checker: $DEP_CHECKER"

# Create a fixed version of script-management-service.ts that properly handles path resolution
FIXED_SERVICE="${ROOT_DIR}/scripts/debug/fixed-script-management-service.js"

cat > "$FIXED_SERVICE" << 'EOL'
// Fixed version of script-management-service that properly handles Supabase credentials
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from multiple possible sources
function getSupabaseCredentials() {
  // Try all possible environment variable names
  const url = process.env.SUPABASE_URL || 
             process.env.CLI_SUPABASE_URL || 
             process.env.VITE_SUPABASE_URL;
             
  const key = process.env.SUPABASE_KEY || 
             process.env.CLI_SUPABASE_KEY || 
             process.env.SUPABASE_SERVICE_ROLE_KEY || 
             process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
             
  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY environment variables.'
    );
  }
  
  return { url, key };
}

// Initialize Supabase client
function initializeSupabase() {
  try {
    const { url, key } = getSupabaseCredentials();
    console.log(`Initializing Supabase client with URL: ${url}`);
    console.log(`Key length: ${key.length} characters`);
    return createClient(url, key);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error.message);
    throw error;
  }
}

// Generate a summary report of scripts
async function generateSummary(options = {}) {
  const { limit = 50, includeDeleted = false, outputPath } = options;
  
  console.log(`Generating summary for ${limit === -1 ? 'all' : limit} scripts (include deleted: ${includeDeleted})`);
  
  try {
    // Initialize Supabase client
    const supabase = initializeSupabase();
    
    // Fetch scripts from the database with full details
    let query = supabase
      .from('scripts')
      .select(`
        id, 
        file_path, 
        title, 
        language, 
        summary,
        ai_generated_tags,
        manual_tags,
        script_type_id,
        document_type_id,
        is_deleted,
        created_at,
        updated_at,
        last_modified_at,
        ai_assessment,
        assessment_quality_score
      `);
    
    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }
    
    if (limit !== -1) {
      query = query.limit(limit);
    }
    
    query = query.order('updated_at', { ascending: false });
    
    const { data: scripts, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Verify we have scripts to process
    if (!scripts || scripts.length === 0) {
      console.log("No scripts found for summary report");
      return null;
    }
    
    console.log(`Found ${scripts.length} scripts to process`);
    
    // Get script types for name lookup
    const { data: scriptTypes } = await supabase
      .from('script_types')
      .select('id, name, description');
    
    // Create a map of script types for easier access
    const scriptTypeMap = new Map();
    if (scriptTypes) {
      scriptTypes.forEach(type => {
        scriptTypeMap.set(type.id, type);
      });
    }
    
    // Categorize scripts
    const categorizedScripts = {
      'AI': [],
      'Integration': [],
      'Operations': [],
      'Development': []
    };
    
    // Count used script types
    const scriptTypeCounts = {};
    
    // Process each script
    scripts.forEach(script => {
      // Categorize the script
      const category = categorizeScript(script);
      categorizedScripts[category].push(script);
      
      // Increment script type counter
      if (script.script_type_id) {
        scriptTypeCounts[script.script_type_id] = (scriptTypeCounts[script.script_type_id] || 0) + 1;
      }
    });
    
    // Generate the report
    let report = `# Script Analysis Summary Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Scripts: ${scripts.length}\n`;
    report += `Includes Deleted: ${includeDeleted}\n\n`;
    
    // Summary statistics
    report += `## Summary Statistics\n\n`;
    report += `| Category | Count | Percentage |\n`;
    report += `| --- | --- | --- |\n`;
    
    const totalScripts = scripts.length;
    for (const [category, categoryScripts] of Object.entries(categorizedScripts)) {
      const percentage = ((categoryScripts.length / totalScripts) * 100).toFixed(1);
      report += `| ${category} | ${categoryScripts.length} | ${percentage}% |\n`;
    }
    
    report += `\n`;
    
    // Show script types distribution if we have any
    if (Object.keys(scriptTypeCounts).length > 0) {
      report += `### Script Type Distribution\n\n`;
      report += `| Script Type | Count |\n`;
      report += `| --- | --- |\n`;
      
      for (const [typeId, count] of Object.entries(scriptTypeCounts)) {
        const typeName = scriptTypeMap.get(typeId)?.name || 'Unknown';
        report += `| ${typeName} | ${count} |\n`;
      }
      
      report += `\n`;
    }
    
    // Path to write the report
    const finalOutputPath = outputPath || path.join(process.cwd(), `script-summary-${new Date().toISOString().slice(0, 10)}.md`);
    
    // Make sure the directory exists
    const dir = path.dirname(finalOutputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the report
    fs.writeFileSync(finalOutputPath, report);
    console.log(`Summary report generated: ${finalOutputPath}`);
    return finalOutputPath;
  } catch (error) {
    console.error("Error generating script summary:", error);
    return null;
  }
}

// Helper function: Categorize a script into one of predefined categories
function categorizeScript(script) {
  // Default to 'Development' if no category is found
  let category = 'Development';
  
  const tags = script.ai_generated_tags || [];
  const summary = script.summary || {};
  const title = script.title || '';
  const filePath = script.file_path || '';
  
  // Check for AI related scripts
  if (
    tags.some(tag => /ai|claude|openai|gpt|llm|ml|model|prompt/i.test(tag)) ||
    filePath.includes('prompts') ||
    (summary && summary.description && 
     /ai|claude|openai|gpt|llm|ml|model|prompt/i.test(summary.description))
  ) {
    category = 'AI';
  }
  // Check for Integration related scripts
  else if (
    tags.some(tag => /api|integration|connect|external|supabase|database|google/i.test(tag)) ||
    filePath.includes('integration') ||
    (summary && summary.description && 
     /api|integration|connect|external|supabase|database|google/i.test(summary.description))
  ) {
    category = 'Integration';
  }
  // Check for Operations related scripts
  else if (
    tags.some(tag => /deploy|build|ci|cd|pipeline|release|backup|setup|config/i.test(tag)) ||
    filePath.includes('deploy') || filePath.includes('setup') || filePath.includes('config') ||
    (summary && summary.description && 
     /deploy|build|ci|cd|pipeline|release|backup|setup|config/i.test(summary.description))
  ) {
    category = 'Operations';
  }
  
  return category;
}

// Export the functions
module.exports = {
  generateSummary,
  initializeSupabase,
  getSupabaseCredentials
};

// If run directly, execute simple connection test
if (require.main === module) {
  (async () => {
    try {
      const supabase = initializeSupabase();
      const { data, error } = await supabase
        .from('scripts')
        .select('count', { count: 'exact', head: true });
        
      if (error) {
        console.error('Connection test failed:', error);
        process.exit(1);
      }
      
      console.log('Connection test successful!');
      console.log('Database contains scripts.');
      process.exit(0);
    } catch (err) {
      console.error('Error during connection test:', err);
      process.exit(1);
    }
  })();
}
EOL

# Make the fixed service executable
chmod +x "$FIXED_SERVICE"
echo "✅ Created fixed script management service: $FIXED_SERVICE"

# Create a simple fixed version of the generate-summary command
FIXED_SUMMARY="${ROOT_DIR}/scripts/debug/generate-summary-fixed.sh"

cat > "$FIXED_SUMMARY" << 'EOL'
#!/bin/bash
# generate-summary-fixed.sh - A fixed script to generate script summary reports

# Script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_FILE="${ROOT_DIR}/docs/script-reports/script-summary-$(date +%Y-%m-%d).md"

# Create output directory if it doesn't exist
mkdir -p "${ROOT_DIR}/docs/script-reports"

# Display intro
echo "📊 Generating script summary report..."

# Make sure we have the Supabase dependency
"${ROOT_DIR}/scripts/verify-supabase-deps.js"

# Use our fixed script service through the run-with-supabase wrapper
"${ROOT_DIR}/scripts/run-with-supabase.sh" node "${SCRIPT_DIR}/fixed-script-management-service.js"

# Use the proper fixed implementation
OUTPUT_PATH="${OUTPUT_FILE}" "${ROOT_DIR}/scripts/run-with-supabase.sh" node - << EOL
// Simple script to generate a summary report
const scriptService = require('${FIXED_SERVICE}');

async function main() {
  const result = await scriptService.generateSummary({
    limit: 50,
    includeDeleted: false,
    outputPath: process.env.OUTPUT_PATH
  });
  
  if (result) {
    console.log(\`✅ Report generated successfully: \${result}\`);
  } else {
    console.error('❌ Failed to generate report');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
EOL

# Check if the report was generated successfully
if [ -f "${OUTPUT_FILE}" ]; then
  echo "✅ Summary report generation completed successfully"
  echo "Report saved to: ${OUTPUT_FILE}"
else
  echo "❌ Failed to generate summary report"
  exit 1
fi
EOL

# Make the fixed summary script executable
chmod +x "$FIXED_SUMMARY"
echo "✅ Created fixed summary generator: $FIXED_SUMMARY"

# Run a connection test to verify everything is working
echo ""
echo "🔍 Testing Supabase connection..."
"$WRAPPER_SCRIPT" node "$DEP_CHECKER"

if [ $? -eq 0 ]; then
  echo ""
  echo "🎉 Supabase environment fix completed successfully!"
  echo ""
  echo "Usage instructions:"
  echo "-----------------"
  echo "1. To run ANY command with Supabase credentials:"
  echo "   ./scripts/run-with-supabase.sh your-command-here"
  echo ""
  echo "2. To generate a script summary report:"
  echo "   ./scripts/debug/generate-summary-fixed.sh"
  echo ""
  echo "3. To set Supabase credentials in your current shell:"
  echo "   source ./scripts/run-with-supabase.sh"
  echo ""
  echo "4. To add credentials to a new shell script, include this at the top:"
  echo "   source \"\$(dirname \"\$0\")/../run-with-supabase.sh\""
else
  echo ""
  echo "⚠️ There was an issue with the Supabase connection."
  echo "Please double-check your credentials and try again."
fi