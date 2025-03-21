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
  const { limit = 50, outputPath } = options;
  
  console.log(`Generating summary for ${limit === -1 ? 'all' : limit} scripts`);
  console.log(`Output path: ${outputPath}`);
  
  try {
    // Initialize Supabase client
    const supabase = initializeSupabase();
    
    // Create a fallback report in case we can't get data from Supabase
    let report = `# Script Analysis Summary Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    
    try {
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
          created_at,
          updated_at,
          last_modified_at,
          ai_assessment,
          assessment_quality_score
        `);
      
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
        report += `No scripts found in database.\n`;
      } else {
        console.log(`Found ${scripts.length} scripts to process`);
        
        // Try to get script types for name lookup
        let scriptTypeMap = new Map();
        try {
          const { data: scriptTypes } = await supabase
            .from('script_types')
            .select('id, name, description');
          
          // Create a map of script types for easier access
          if (scriptTypes) {
            scriptTypes.forEach(type => {
              scriptTypeMap.set(type.id, type);
            });
          }
        } catch (typeError) {
          console.warn("Warning: Couldn't fetch script types:", typeError.message);
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
          try {
            // Categorize the script
            const category = categorizeScript(script);
            categorizedScripts[category].push(script);
            
            // Increment script type counter
            if (script.script_type_id) {
              scriptTypeCounts[script.script_type_id] = (scriptTypeCounts[script.script_type_id] || 0) + 1;
            }
          } catch (e) {
            console.warn(`Warning: Error processing script ${script.id || 'unknown'}:`, e.message);
          }
        });
        
        // Update the report with real data
        report = `# Script Analysis Summary Report\n\n`;
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `Total Scripts: ${scripts.length}\n\n`;
        
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
      }
    } catch (fetchError) {
      console.error("Error fetching scripts:", fetchError.message);
      report += `Error fetching scripts: ${fetchError.message}\n\n`;
      report += `## Manual Script Analysis\n\n`;
      report += `Unable to analyze scripts from database. Please check Supabase connection.\n`;
    }
    
    // Path to write the report - ensure we have a valid path
    const finalOutputPath = outputPath || path.join(process.cwd(), `script-summary-${new Date().toISOString().slice(0, 10)}.md`);
    
    // Extra debug information about the path
    console.log(`Writing report to: ${finalOutputPath}`);
    console.log(`Directory: ${path.dirname(finalOutputPath)}`);
    
    // Make sure the directory exists
    const dir = path.dirname(finalOutputPath);
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the report with better error handling
    try {
      fs.writeFileSync(finalOutputPath, report);
      console.log(`Summary report generated: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (writeError) {
      console.error(`Error writing report to ${finalOutputPath}:`, writeError.message);
      
      // Try writing to the current directory as a fallback
      const fallbackPath = path.join(process.cwd(), `script-summary-${new Date().toISOString().slice(0, 10)}.md`);
      console.log(`Trying fallback path: ${fallbackPath}`);
      
      try {
        fs.writeFileSync(fallbackPath, report);
        console.log(`Summary report generated at fallback location: ${fallbackPath}`);
        return fallbackPath;
      } catch (fallbackError) {
        console.error("Error writing to fallback path:", fallbackError.message);
        return null;
      }
    }
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
