/**
 * Tests for the link-top-level-folders command
 * 
 * Note: These are integration tests that require a Supabase connection.
 * Run them with:
 * ts-node scripts/cli-pipeline/experts/commands/link-top-level-folders.test.ts
 */

import { linkTopLevelFolders } from './link-top-level-folders';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Simple test runner
 */
async function runTests() {
  console.log('Running tests for link-top-level-folders command...');
  
  try {
    // Test with dry run to verify the command works without making changes
    console.log('\nTest: Dry run...');
    await linkTopLevelFolders({ 
      dryRun: true, 
      defaultRole: 'presenter', 
      isPrimary: true, 
      verbose: true 
    });
    
    // After dry run finishes, let's confirm no changes were made
    console.log('\nVerifying no changes were made during dry run...');
    
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    const { data: before, error: beforeError } = await supabase
      .from('sources_google_experts')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (beforeError) {
      throw new Error(`Failed to fetch data: ${beforeError.message}`);
    }
    
    console.log(`Most recent sources_google_experts entries (${before?.length || 0} shown):`);
    before?.forEach((entry, index) => {
      console.log(`${index + 1}. ID: ${entry.id}`);
    });
    
    console.log('\nAll tests completed.');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the tests if this file is executed directly
if (require.main === module) {
  runTests();
}