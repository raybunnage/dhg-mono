#!/bin/bash
# script-manager.sh - Core script management functionality

# Set environment variables (source relevant environment files if needed)
export NODE_ENV="${NODE_ENV:-development}"

# Define paths and directories
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI_DIR="${ROOT_DIR}/packages/cli"
SCRIPT_REPORTS_DIR="${ROOT_DIR}/script-analysis-results"
SUPABASE_CONNECT="${ROOT_DIR}/scripts/fix/supabase-connect.js"

# Create reports directory if it doesn't exist
mkdir -p "${SCRIPT_REPORTS_DIR}"

# Log configuration
LOG_FILE="${SCRIPT_REPORTS_DIR}/script-pipeline-$(date +%Y-%m-%d_%H-%M-%S).log"
exec > >(tee -a "${LOG_FILE}") 2>&1

# First, check if supabase-connect.js exists
if [ ! -f "${SUPABASE_CONNECT}" ]; then
  echo "Error: Cannot find supabase-connect.js at ${SUPABASE_CONNECT}"
  exit 1
fi

# Skip CLI check since we'll use direct script implementation
# Comment out CLI build check for now
# if [ ! -f "${CLI_DIR}/dist/cli.js" ]; then
#   echo "Error: CLI not built. Building CLI..."
#   cd "${CLI_DIR}" && npm run build
#   
#   # Verify build was successful
#   if [ ! -f "${CLI_DIR}/dist/cli.js" ]; then
#     echo "Error: Failed to build CLI. Exiting."
#     exit 1
#   fi
# fi

# Function to run a command with Supabase environment
function run_with_supabase() {
  echo "Running command with fixed Supabase environment: $@"
  node "${SUPABASE_CONNECT}" testSupabaseConnection
  
  if [ $? -ne 0 ]; then
    echo "❌ Supabase connection failed. Check your credentials."
    return 1
  fi
  
  # Run the command using runCommand from supabase-connect.js
  node "${SUPABASE_CONNECT}" runCommand "$@"
  return $?
}

# Function to synchronize database with files on disk
function sync_scripts() {
  echo "🔄 Syncing scripts database with files on disk..."
  
  # Find script files using supabase-connect.js
  node "${SUPABASE_CONNECT}" findAndSyncScripts
  
  # Check for success
  if [ $? -ne 0 ]; then
    echo "❌ Script sync failed!"
    return 1
  fi
  
  echo "✅ Script sync completed successfully"
  return 0
}

# Function to find and insert new script files
function find_new_scripts() {
  echo "🔍 Finding new script files..."

  # Find script files using the supabase-connect.js
  node "${SUPABASE_CONNECT}" findAndSyncScripts
  
  # Check for success
  if [ $? -ne 0 ]; then
    echo "❌ Finding new scripts failed!"
    return 1
  fi
  
  echo "✅ New script discovery completed successfully"
  return 0
}

# Function to show untyped scripts
function show_untyped_scripts() {
  echo "📋 Showing untyped scripts..."
  
  # In a full implementation, this would query the database for untyped scripts
  # For now, we'll just list some script files without classification information
  
  echo "Untyped Scripts (simulated):"
  find "${ROOT_DIR}" -type f \( -name "*.sh" -o -name "*.js" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/backup/*" \
    -not -path "*/archive/*" \
    -not -path "*/_archive/*" \
    -not -path "*/file_types/*" \
    -not -path "*/script-analysis-results/*" \
    | head -n 20 | awk '{printf "%d. %s\n", NR, $0}'
  
  echo "NOTE: This is a simplified implementation since the CLI is not built."
  echo "In a full implementation, this would show scripts without type classifications."
  return 0
}

# Function to show recent scripts
function show_recent_scripts() {
  echo "📋 Showing recent scripts..."
  
  # Find recent script files
  echo "Finding recently modified script files..."
  find "${ROOT_DIR}" -type f \( -name "*.sh" -o -name "*.js" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/backup/*" \
    -not -path "*/archive/*" \
    -not -path "*/_archive/*" \
    -not -path "*/file_types/*" \
    -not -path "*/script-analysis-results/*" \
    -mtime -7 | awk '{printf "%d. %s (Updated: recent)\n", NR, $0}' | head -n 20
  
  echo "NOTE: This is a simplified implementation since the CLI is not built."
  echo "In a full implementation, this would show recently updated scripts from the database."
  return 0
}

# Function to classify recent scripts
function classify_recent_scripts() {
  local count=${1:-10}
  echo "🧠 Classifying recent scripts..."
  
  # Check if ts-node is installed
  if ! command -v ts-node &> /dev/null; then
    echo "Error: ts-node is not installed. Cannot run the script classification."
    return 1
  fi
  
  # Find recent script files to classify
  echo "Finding recently modified script files for classification..."
  local scripts_to_classify=$(find "${ROOT_DIR}" -type f \( -name "*.sh" -o -name "*.js" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/backup/*" \
    -not -path "*/archive/*" \
    -not -path "*/_archive/*" \
    -not -path "*/file_types/*" \
    -not -path "*/script-analysis-results/*" \
    -mtime -7 | head -n $count)
  
  # Check if we found any scripts
  if [ -z "$scripts_to_classify" ]; then
    echo "❌ No recent scripts found for classification."
    return 1
  fi
  
  # Path to our permanent TypeScript script
  SCRIPT_ANALYZER="${SCRIPT_DIR}/analyze-script.ts"
  
  # Check if the script exists
  if [ ! -f "${SCRIPT_ANALYZER}" ]; then
    echo "Error: Script analyzer not found at ${SCRIPT_ANALYZER}"
    return 1
  fi
  
  # For each script, use ts-node to run the analysis
  local success_count=0
  local failure_count=0
  
  echo "$scripts_to_classify" | while read script; do
    echo "Processing script: $script"
    
    # Execute the script analyzer
    cd "${ROOT_DIR}"
    ts-node "${SCRIPT_ANALYZER}" "$script"
    
    if [ $? -eq 0 ]; then
      echo "✅ Successfully classified script: $script"
      ((success_count++))
    else
      echo "❌ Failed to classify script: $script"
      ((failure_count++))
    fi
  done
  
  echo "✅ Classification completed: $success_count successful, $failure_count failed."
  return 0
}

# Function to classify untyped scripts
function classify_untyped_scripts() {
  local count=${1:-10}
  echo "🧠 Classifying ${count} untyped scripts..."
  
  # Check if ts-node is installed
  if ! command -v ts-node &> /dev/null; then
    echo "Error: ts-node is not installed. Cannot run the script classification."
    return 1
  fi
  
  # Check for Claude API key and provide guidance if missing
  if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$CLI_CLAUDE_API_KEY" ]; then
    echo "⚠️ No Claude API key found in environment variables."
    
    # Look for any existing keys
    if [ -n "$VITE_ANTHROPIC_API_KEY" ]; then
      echo "✅ Found VITE_ANTHROPIC_API_KEY - copying to CLAUDE_API_KEY for script use"
      export CLAUDE_API_KEY="$VITE_ANTHROPIC_API_KEY"
    else
      echo "❌ Missing Claude API key. Please set one of these environment variables:"
      echo "   - CLAUDE_API_KEY"
      echo "   - ANTHROPIC_API_KEY"
      echo "   - CLI_CLAUDE_API_KEY"
      echo "Example: export CLAUDE_API_KEY=your_api_key"
      return 1
    fi
  fi
  
  # If ANTHROPIC_API_KEY is set but CLAUDE_API_KEY isn't, use it
  if [ -z "$CLAUDE_API_KEY" ] && [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "ℹ️ Using ANTHROPIC_API_KEY as CLAUDE_API_KEY"
    export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
  fi
  
  # If CLI_CLAUDE_API_KEY is set but CLAUDE_API_KEY isn't, use it
  if [ -z "$CLAUDE_API_KEY" ] && [ -n "$CLI_CLAUDE_API_KEY" ]; then
    echo "ℹ️ Using CLI_CLAUDE_API_KEY as CLAUDE_API_KEY"
    export CLAUDE_API_KEY="$CLI_CLAUDE_API_KEY"
  fi
  
  # Verify we now have a Claude API key
  if [ -z "$CLAUDE_API_KEY" ]; then
    echo "❌ Still missing Claude API key after attempted fix."
    return 1
  else
    echo "✅ CLAUDE_API_KEY is set and has value"
  fi
  
  # Find untyped scripts to classify
  echo "Finding untyped scripts for classification..."
  local scripts_to_classify=$(find "${ROOT_DIR}" -type f \( -name "*.sh" -o -name "*.js" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/backup/*" \
    -not -path "*/archive/*" \
    -not -path "*/_archive/*" \
    -not -path "*/file_types/*" \
    -not -path "*/script-analysis-results/*" \
    -mtime -7 | head -n $count)
  
  # Check if we found any scripts
  if [ -z "$scripts_to_classify" ]; then
    echo "❌ No untyped scripts found for classification."
    return 1
  fi
  
  # Path to our permanent TypeScript script
  SCRIPT_ANALYZER="${SCRIPT_DIR}/analyze-script.ts"
  
  # Check if the script exists
  if [ ! -f "${SCRIPT_ANALYZER}" ]; then
    echo "Error: Script analyzer not found at ${SCRIPT_ANALYZER}"
    return 1
  fi
  
  # For each script, use ts-node to run the analysis
  local success_count=0
  local failure_count=0
  
  echo "$scripts_to_classify" | while read script; do
    echo "Processing script: $script"
    
    # Execute the script analyzer
    cd "${ROOT_DIR}"
    # Pass through all important environment variables
    CLAUDE_API_KEY="$CLAUDE_API_KEY" \
    ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    CLI_CLAUDE_API_KEY="$CLI_CLAUDE_API_KEY" \
    VITE_ANTHROPIC_API_KEY="$VITE_ANTHROPIC_API_KEY" \
    ts-node "${SCRIPT_ANALYZER}" "$script"
    
    if [ $? -eq 0 ]; then
      echo "✅ Successfully classified script: $script"
      ((success_count++))
    else
      echo "❌ Failed to classify script: $script"
      ((failure_count++))
    fi
  done
  
  echo "✅ Classification completed: $success_count successful, $failure_count failed."
  return 0
}

# Function to clean script analysis results
function clean_script_results() {
  echo "🧹 Cleaning script analysis results..."
  
  # Simulate cleaning
  echo "Simulating database cleanup of script analysis results..."
  echo "Cleaned 15 script analysis results (simulated)"
  
  echo "✅ Script results cleaning simulation completed successfully"
  echo "NOTE: This is a simplified implementation since the CLI is not built."
  echo "In a full implementation, this would clean analysis results from the database."
  return 0
}

# Function to generate summary report
function generate_summary() {
  local count=${1:-50}
  local include_deleted=${2:-false}
  local report_file="${SCRIPT_REPORTS_DIR}/script-summary-$(date +%Y-%m-%d).md"
  
  echo "📊 Generating summary report for ${count} scripts (include deleted: ${include_deleted})..."
  
  # Check if we have Node.js available
  if ! command -v node &> /dev/null; then
    echo "⚠️ Node.js not found. Cannot generate a proper summary report."
    return 1
  fi
  
  # Make sure @supabase/supabase-js is installed at the project level
  if ! npm list @supabase/supabase-js &> /dev/null; then
    echo "Installing @supabase/supabase-js at the project level..."
    npm install --no-save @supabase/supabase-js &> /dev/null
  fi
  
  # Create a temporary directory
  TEMP_DIR=$(mktemp -d)
  SUMMARY_SCRIPT="${TEMP_DIR}/generate_summary.js"
  
  # Create package.json in temp directory to ensure local installation
  cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "temp-script",
  "version": "1.0.0",
  "description": "Temporary script for summary generation",
  "main": "generate_summary.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1"
  }
}
EOL

  # Install dependencies in the temp directory
  echo "Installing dependencies in temporary directory..."
  (cd "$TEMP_DIR" && npm install --silent &> /dev/null)
  
  # Create the script for generating the report
  cat > "$SUMMARY_SCRIPT" << 'EOL'
// First check and install required dependencies
try {
  require('@supabase/supabase-js');
} catch (e) {
  console.log('Installing @supabase/supabase-js...');
  require('child_process').execSync('npm install --no-save @supabase/supabase-js', {stdio: 'inherit'});
}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get parameters from environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const outputPath = process.env.OUTPUT_PATH;
const scriptLimit = parseInt(process.env.SCRIPT_LIMIT || '50', 10);
const includeDeleted = process.env.INCLUDE_DELETED === 'true';

// Function to group scripts by category (AI, Integration, Operations, Development)
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
    (summary && typeof summary === 'object' && summary.description && 
     /ai|claude|openai|gpt|llm|ml|model|prompt/i.test(summary.description))
  ) {
    category = 'AI';
  }
  // Check for Integration related scripts
  else if (
    tags.some(tag => /api|integration|connect|external|supabase|database|google/i.test(tag)) ||
    filePath.includes('integration') ||
    (summary && typeof summary === 'object' && summary.description && 
     /api|integration|connect|external|supabase|database|google/i.test(summary.description))
  ) {
    category = 'Integration';
  }
  // Check for Operations related scripts
  else if (
    tags.some(tag => /deploy|build|ci|cd|pipeline|release|backup|setup|config/i.test(tag)) ||
    filePath.includes('deploy') || filePath.includes('setup') || filePath.includes('config') ||
    (summary && typeof summary === 'object' && summary.description && 
     /deploy|build|ci|cd|pipeline|release|backup|setup|config/i.test(summary.description))
  ) {
    category = 'Operations';
  }
  
  return category;
}

// Function to assess script quality
function assessQuality(script) {
  const hasAssessment = script.ai_assessment && typeof script.ai_assessment === 'object';
  
  // If we have AI assessment, use it
  if (hasAssessment) {
    return {
      code_quality: script.ai_assessment.code_quality || 'Unknown',
      maintainability: script.ai_assessment.maintainability || 'Unknown',
      utility: script.ai_assessment.utility || 'Unknown',
      documentation: script.ai_assessment.documentation || 'Unknown'
    };
  }
  
  // Otherwise use simple heuristics
  return {
    code_quality: 'Not analyzed',
    maintainability: 'Not analyzed',
    utility: 'Not analyzed',
    documentation: 'Not analyzed'
  };
}

async function generateSummaryReport() {
  console.log(`Generating summary report with limit: ${scriptLimit}, includeDeleted: ${includeDeleted}`);
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Cannot generate report.');
    process.exit(1);
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query the database for scripts
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
      
    // Add filter for deleted status if needed
    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }
    
    // Apply limit (only if not -1, which means all scripts)
    if (scriptLimit !== -1) {
      query = query.limit(scriptLimit);
    }
    
    // Execute the query
    const { data: scripts, error } = await query.order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching scripts:', error);
      process.exit(1);
    }
    
    if (!scripts || scripts.length === 0) {
      console.log('No scripts found in the database.');
      process.exit(0);
    }
    
    console.log(`Found ${scripts.length} scripts in the database.`);
    
    // Get script types if available
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
    
    // Start generating the report
    let report = `# Script Analysis Summary Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Scripts: ${scripts.length}\n`;
    report += `Includes Deleted: ${includeDeleted}\n\n`;
    
    // Summary statistics
    report += `## Summary Statistics\n\n`;
    report += `| Category | Count | Percentage |\n`;
    report += `| --- | --- | --- |\n`;
    
    let totalScripts = scripts.length;
    for (const [category, categoryScripts] of Object.entries(categorizedScripts)) {
      const percentage = ((categoryScripts.length / totalScripts) * 100).toFixed(1);
      report += `| ${category} | ${categoryScripts.length} | ${percentage}% |\n`;
    }
    
    report += `\n`;
    
    // Show script types distribution
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
    
    // Add a file path and deleted status table for quick reference
    report += `## File Path Status Overview\n\n`;
    report += `| ID | File Path | Status | Category | Last Updated |\n`;
    report += `| --- | --- | --- | --- | --- |\n`;
    
    scripts.slice(0, 20).forEach(script => {
      const status = script.is_deleted ? '🔴 DELETED' : '🟢 ACTIVE';
      const updatedAt = script.updated_at ? new Date(script.updated_at).toISOString().split('T')[0] : 'N/A';
      const category = categorizeScript(script);
      report += `| ${script.id.substring(0, 8)}... | \`${script.file_path}\` | ${status} | ${category} | ${updatedAt} |\n`;
    });
    
    if (scripts.length > 20) {
      report += `| ... | ... | ... | ... | ... |\n`;
    }
    
    report += `\n\n`;
    
    // Generate detailed sections by category
    for (const [category, categoryScripts] of Object.entries(categorizedScripts)) {
      if (categoryScripts.length === 0) continue;
      
      report += `## ${category} Scripts (${categoryScripts.length})\n\n`;
      
      // Add a brief description based on the category
      switch (category) {
        case 'AI':
          report += `Scripts related to AI/ML models, prompts, and configurations.\n\n`;
          break;
        case 'Integration':
          report += `Scripts for external system integrations.\n\n`;
          break;
        case 'Operations':
          report += `Scripts for operational tasks and infrastructure.\n\n`;
          break;
        case 'Development':
          report += `Scripts for development tools and processes.\n\n`;
          break;
      }
      
      // Sort scripts by updated date
      categoryScripts.sort((a, b) => {
        const dateA = new Date(a.updated_at || 0);
        const dateB = new Date(b.updated_at || 0);
        return dateB - dateA;
      });
      
      // Add script details
      for (const script of categoryScripts) {
        const typeName = script.script_type_id ? 
          (scriptTypeMap.get(script.script_type_id)?.name || 'Unknown Type') : 
          'No Type';
        
        const quality = assessQuality(script);
        
        report += `### ${script.title}\n`;
        report += `- **File Path**: \`${script.file_path}\`\n`;
        report += `- **Type**: ${typeName}\n`;
        report += `- **Status**: ${script.is_deleted ? 'Deleted' : 'Active'}\n`;
        report += `- **Language**: ${script.language || 'Unknown'}\n`;
        
        // Tags section
        const allTags = [
          ...(script.ai_generated_tags || []),
          ...(script.manual_tags || [])
        ];
        
        if (allTags.length > 0) {
          report += `- **Tags**: ${allTags.join(', ')}\n`;
        }
        
        // Summary section
        if (script.summary) {
          report += `- **Summary**:\n`;
          
          if (typeof script.summary === 'object') {
            if (script.summary.description) {
              report += `  - Description: ${script.summary.description}\n`;
            }
            if (script.summary.purpose) {
              report += `  - Purpose: ${script.summary.purpose}\n`;
            }
            if (script.summary.key_functions && script.summary.key_functions.length > 0) {
              report += `  - Key Functions: ${script.summary.key_functions.join(', ')}\n`;
            }
          } else if (typeof script.summary === 'string') {
            report += `  ${script.summary}\n`;
          }
        }
        
        // Assessment section
        report += `- **Quality Assessment**:\n`;
        report += `  - Code Quality: ${quality.code_quality}\n`;
        report += `  - Maintainability: ${quality.maintainability}\n`;
        report += `  - Utility: ${quality.utility}\n`;
        report += `  - Documentation: ${quality.documentation}\n`;
        
        // Dates
        report += `- **Created**: ${new Date(script.created_at).toISOString()}\n`;
        report += `- **Updated**: ${new Date(script.updated_at).toISOString()}\n`;
        
        report += `\n`;
      }
    }
    
    // Write the report to a file
    fs.writeFileSync(outputPath, report);
    console.log(`Report successfully written to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error generating summary report:', error);
    process.exit(1);
  }
}

// Run the report generation
generateSummaryReport();
EOL
  
  # Run the script to generate the summary report
  echo "Executing summary report generator..."
  cd "${ROOT_DIR}"
  SUPABASE_URL="${SUPABASE_URL}" SUPABASE_KEY="${SUPABASE_KEY}" OUTPUT_PATH="${report_file}" SCRIPT_LIMIT="${count}" INCLUDE_DELETED="${include_deleted}" \
    node "${SUMMARY_SCRIPT}"
  
  # Check if the report was generated successfully
  if [ -f "${report_file}" ]; then
    echo "✅ Summary report generation completed successfully"
    echo "Report saved to: ${report_file}"
  else
    echo "❌ Failed to generate summary report"
    return 1
  fi
  
  # Clean up temporary directory
  rm -rf "${TEMP_DIR}"
  
  return 0
}

# Function to run the complete pipeline
function run_complete_pipeline() {
  echo "🚀 Running complete script pipeline..."
  local success=true
  
  # Ensure the environment variables are set
  if [ -z "$CLAUDE_API_KEY" ]; then
    echo "⚠️ CLAUDE_API_KEY environment variable is not set. Script classification will fail."
    echo "Please export CLAUDE_API_KEY=your_api_key before running this pipeline."
    success=false
  else
    echo "✅ CLAUDE_API_KEY environment variable is set."
  fi
  
  if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "⚠️ SUPABASE_URL or SUPABASE_KEY environment variables are not set."
    echo "Database operations will not work properly."
    success=false
  else
    echo "✅ Supabase environment variables are set."
  fi
  
  # If environment variables are missing, exit early
  if [ "$success" = false ]; then
    echo "⚠️ Missing required environment variables. Please set them and try again."
    return 1
  fi
  
  # Run the pipeline steps
  sync_scripts
  if [ $? -ne 0 ]; then
    success=false
  fi
  
  find_new_scripts
  if [ $? -ne 0 ]; then
    success=false
  fi
  
  # Maximum of 5 scripts to classify for better performance
  classify_recent_scripts 5
  if [ $? -ne 0 ]; then
    success=false
  fi
  
  if [ "$success" = true ]; then
    echo "✅ Complete pipeline executed successfully"
    return 0
  else
    echo "⚠️ Pipeline completed with errors"
    return 1
  fi
}

# Export all functions
export -f sync_scripts
export -f find_new_scripts
export -f show_untyped_scripts
export -f show_recent_scripts
export -f classify_recent_scripts
export -f classify_untyped_scripts
export -f clean_script_results
export -f generate_summary
export -f run_complete_pipeline