#!/bin/bash
# generate-summary-fixed.sh - A fixed script to generate script summary reports

# Script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Make sure the reports directories exist - using both possible locations
mkdir -p "${ROOT_DIR}/docs/script-reports"
mkdir -p "${ROOT_DIR}/reports/script-reports"

# Set output file - try the reports directory first, fallback to docs
if [ -d "${ROOT_DIR}/reports" ]; then
  OUTPUT_FILE="${ROOT_DIR}/reports/script-reports/script-summary-$(date +%Y-%m-%d).md"
else
  OUTPUT_FILE="${ROOT_DIR}/docs/script-reports/script-summary-$(date +%Y-%m-%d).md"
fi

# Display intro
echo "📊 Generating script summary report..."
echo "Output will be saved to: ${OUTPUT_FILE}"

# Make sure we have the Supabase dependency
"${ROOT_DIR}/scripts/verify-supabase-deps.js"

# Use our fixed script service through the run-with-supabase wrapper
"${ROOT_DIR}/scripts/run-with-supabase.sh" node "${SCRIPT_DIR}/fixed-script-management-service.js"

# Define variable for script service path
FIXED_SERVICE="${SCRIPT_DIR}/fixed-script-management-service.js"

# Use the proper fixed implementation
OUTPUT_PATH="${OUTPUT_FILE}" "${ROOT_DIR}/scripts/run-with-supabase.sh" node - << EOL
// Simple script to generate a summary report
const scriptService = require('${FIXED_SERVICE}');

async function main() {
  try {
    console.log('Generating summary report...');
    console.log('Output path:', process.env.OUTPUT_PATH);
    
    const result = await scriptService.generateSummary({
      limit: 50,
      outputPath: process.env.OUTPUT_PATH
    });
    
    if (result) {
      console.log(\`✅ Report generated successfully: \${result}\`);
    } else {
      console.error('❌ Failed to generate report');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error during report generation:', err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Uncaught error:', err);
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
