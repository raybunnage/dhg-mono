/**
 * Simple test script to verify shared services are working
 */
import { Logger } from '../../packages/shared/utils/logger';
import config from '../../packages/shared/utils/config';
import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance();

async function testSharedServices() {
  // Test logger
  Logger.info('Testing shared services...');
  
  // Test config loading
  Logger.info(`Loaded config: NODE_ENV=${config.nodeEnv}`);
  Logger.info(`Supabase URL present: ${!!config.supabaseUrl}`);
  Logger.info(`Claude API key present: ${!!config.claudeApiKey}`);
  
  // Test Supabase connection
  try {
    const connection = await supabase.testConnection();
    if (connection.success) {
      Logger.info('✅ Successfully connected to Supabase');
    } else {
      Logger.error('❌ Failed to connect to Supabase', connection.error);
    }
  } catch (error) {
    Logger.error('Error testing Supabase connection:', error);
  }
  
  Logger.info('Test complete');
}

// Run the test
testSharedServices()
  .then(() => {
    Logger.info('Test finished successfully');
  })
  .catch(error => {
    Logger.error('Test failed with error:', error);
  });