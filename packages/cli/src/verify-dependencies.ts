#!/usr/bin/env node
import { getSupabaseClient } from './services/supabase-client';
import { PromptQueryService } from './services/prompt-query-service';
import { Logger } from './utils/logger';

// Check that database connection works
async function verifySupabaseConnection(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('scripts').select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      Logger.error('Supabase connection error:', error);
      return false;
    }
    
    Logger.info('Supabase connection successful');
    return true;
  } catch (error) {
    Logger.error('Error verifying Supabase connection:', error);
    return false;
  }
}

// Verify that the script analysis prompt exists
async function verifyScriptAnalysisPrompt(): Promise<boolean> {
  try {
    const promptService = new PromptQueryService({});
    const prompt = await promptService.getPromptByName('script-analysis-prompt');
    
    if (!prompt) {
      Logger.error('Error: script-analysis-prompt not found in the database');
      return false;
    }
    
    Logger.info('Script analysis prompt found:', prompt.name);
    return true;
  } catch (error) {
    Logger.error('Error verifying script analysis prompt:', error);
    return false;
  }
}

// Run all verifications
async function runVerifications(): Promise<boolean> {
  Logger.info('Verifying dependencies...');
  
  const checks = [
    { name: 'Supabase Connection', check: verifySupabaseConnection },
    { name: 'Script Analysis Prompt', check: verifyScriptAnalysisPrompt }
  ];
  
  let allPassed = true;
  
  for (const { name, check } of checks) {
    Logger.info(`\nVerifying ${name}...`);
    const passed = await check();
    
    if (!passed) {
      allPassed = false;
      Logger.error(`✖ ${name} verification failed`);
    } else {
      Logger.info(`✓ ${name} verification passed`);
    }
  }
  
  if (!allPassed) {
    Logger.error('\n❌ Some verifications failed. Please fix the issues before continuing.');
  } else {
    Logger.info('\n✅ All verifications passed!');
  }
  
  return allPassed;
}

runVerifications().then(passed => {
  if (!passed) {
    process.exit(1);
  }
});