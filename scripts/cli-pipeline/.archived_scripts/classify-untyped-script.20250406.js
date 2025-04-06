#!/usr/bin/env node
/**
 * Script to classify a single untyped script using the ScriptManagementService
 * This directly reuses the CLI services already implemented
 * 
 * This is a pure JavaScript version to avoid TypeScript transpilation issues
 */

// Set debug log level to see more details
process.env.CLI_LOG_LEVEL = process.env.CLI_LOG_LEVEL || 'debug';

// Ensure both ANTHROPIC_API_KEY and CLAUDE_API_KEY are set correctly
// This handles cases where one is set but not the other
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  console.log('Setting ANTHROPIC_API_KEY from CLAUDE_API_KEY for config compatibility');
  process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
} else if (process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
  console.log('Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY for API compatibility');
  process.env.CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
}

// Let's ensure the services know which environment we're in
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Get absolute paths for more reliable imports
const path = require('path');
const ROOT_DIR = path.resolve(__dirname, '../..');

// Use absolute require paths for greater reliability
const { ScriptManagementService } = require(path.join(ROOT_DIR, 'packages/cli/src/services/script-management-service'));
const { Logger } = require(path.join(ROOT_DIR, 'packages/cli/src/utils/logger'));
const config = require(path.join(ROOT_DIR, 'packages/cli/src/utils/config'));

// Track success/failure
let exitCode = 0;

// Show detected configuration for quick debug
console.log(`✨ Running in ${process.env.NODE_ENV} environment`);
console.log(`✨ Anthropic API Key: ${config.anthropicApiKey ? '✅ Available from config' : '❌ Missing from config'}`);
console.log(`✨ Supabase URL: ${config.supabaseUrl ? '✅ Available from config' : '❌ Missing from config'}`);

/**
 * Process a single untyped script from the database
 */
async function classifyNextUntypedScript() {
  try {
    // Initialize the ScriptManagementService (reusing existing service)
    const scriptService = new ScriptManagementService();
    
    console.log('🔍 Looking for one untyped script to classify...');
    
    // Get one untyped script from the database
    const scripts = await scriptService.getUntypedScripts(1);
    
    if (!scripts || scripts.length === 0) {
      console.log('❌ No untyped scripts found.');
      return false;
    }
    
    const script = scripts[0];
    console.log(`✅ Found untyped script: ${script.file_path}`);
    
    // Classify the script using existing service
    console.log(`🧠 Classifying script: ${script.file_path}`);
    const classification = await scriptService.classifyScript(script.file_path);
    
    if (!classification) {
      console.log(`❌ Failed to classify script: ${script.file_path}`);
      exitCode = 1;
      return false;
    }
    
    console.log('✅ Classification successful. Results:');
    console.log(JSON.stringify(classification, null, 2));
    
    // Update the database with the classification
    console.log(`💾 Updating script in database with classification...`);
    const updateResult = await scriptService.updateScriptWithClassification(
      script.id,
      classification
    );
    
    if (updateResult) {
      console.log(`✅ Successfully updated script in database: ${script.file_path}`);
      return true;
    } else {
      console.log(`❌ Failed to update script in database: ${script.file_path}`);
      exitCode = 1;
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error classifying script: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(error);
    exitCode = 1;
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting single untyped script classification...');
    
    // Quick validation of required credentials
    if (!config.anthropicApiKey) {
      console.error('❌ Missing Anthropic API key in config');
      console.error('The .env.development file should contain ANTHROPIC_API_KEY');
      process.exit(1);
    }
    
    if (!config.supabaseUrl || !config.supabaseKey) {
      console.error('❌ Missing Supabase credentials in config');
      console.error('The .env.development file should contain SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }
    
    // Execute the script classification using the ScriptManagementService
    console.log('✨ Environment loaded correctly, classifying script...');
    const success = await classifyNextUntypedScript();
    
    if (success) {
      console.log('✅ Script classification completed successfully');
    } else {
      console.log('⚠️ Script classification completed with issues');
    }
    
    process.exit(exitCode);
  } catch (err) {
    console.error('❌ Fatal error:', err);
    console.error(err);
    process.exit(1);
  }
}

// Run the main function
main();