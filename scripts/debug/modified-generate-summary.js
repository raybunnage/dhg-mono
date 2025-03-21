// Modified version of the generate-summary script with better env variable handling
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Improved environment variable handling with multiple fallbacks
const supabaseUrl = process.env.SUPABASE_URL || 
                   process.env.CLI_SUPABASE_URL || 
                   process.env.VITE_SUPABASE_URL;

const supabaseKey = process.env.SUPABASE_KEY || 
                   process.env.CLI_SUPABASE_KEY || 
                   process.env.SUPABASE_SERVICE_ROLE_KEY || 
                   process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const outputPath = process.env.OUTPUT_PATH;
const scriptLimit = parseInt(process.env.SCRIPT_LIMIT || '50', 10);
const includeDeleted = process.env.INCLUDE_DELETED === 'true';

// Debug: log variables (without showing full keys)
console.log('DEBUG inside Node script:');
console.log(`  SUPABASE_URL = ${process.env.SUPABASE_URL || 'not set'}`);
console.log(`  CLI_SUPABASE_URL = ${process.env.CLI_SUPABASE_URL || 'not set'}`);
console.log(`  VITE_SUPABASE_URL = ${process.env.VITE_SUPABASE_URL || 'not set'}`);
console.log(`  Using URL = ${supabaseUrl || 'not set'}`);
console.log(`  SUPABASE_KEY present: ${process.env.SUPABASE_KEY ? 'YES' : 'NO'}`);
console.log(`  CLI_SUPABASE_KEY present: ${process.env.CLI_SUPABASE_KEY ? 'YES' : 'NO'}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY present: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'YES' : 'NO'}`);
console.log(`  VITE_SUPABASE_SERVICE_ROLE_KEY present: ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'YES' : 'NO'}`);
console.log(`  Using a key: ${supabaseKey ? 'YES' : 'NO'}`);

// Function to group scripts by category
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
    console.log(`Connecting to Supabase at: ${supabaseUrl}`);
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
    console.log('Executing query to scripts table...');
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
    
    // Generate the report...
    // [Rest of the report generation code]
    // ...
    
    // Write a simple report as proof it worked
    let report = `# Script Analysis Summary Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Scripts: ${scripts.length}\n`;
    report += `Includes Deleted: ${includeDeleted}\n\n`;
    
    // Write the file
    fs.writeFileSync(outputPath, report);
    console.log(`Report successfully written to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error generating summary report:', error);
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('\nThis might be a network connectivity issue or an invalid Supabase URL.');
      console.error('Make sure your Supabase URL starts with https:// and is correctly formatted.');
    }
    process.exit(1);
  }
}

// Run the report generation
generateSummaryReport();