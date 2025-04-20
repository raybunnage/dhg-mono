import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import * as fs from 'fs';
import * as path from 'path';

interface HealthCheckOptions {
  skipDatabase?: boolean;
  skipPresentations?: boolean;
  skipClaude?: boolean;
  verbose?: boolean;
}

/**
 * Performs health checks on the presentations pipeline infrastructure
 */
export async function healthCheckCommand(options: HealthCheckOptions = {}): Promise<void> {
  await trackCommandExecution('presentations', 'health-check', async () => {
    try {
      const results = {
        database: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
        presentations: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
        claude: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
      };
      
      console.log('🏥 Running presentations pipeline health checks...');
      
      // Check database connection
      if (!options.skipDatabase) {
        console.log('\n🔍 Checking Supabase database connection...');
        try {
          // Use the testConnection method from SupabaseClientService
          const connectionTest = await SupabaseClientService.getInstance().testConnection();
          
          if (connectionTest.success) {
            results.database = { 
              status: 'success', 
              message: `Connected to database successfully.` 
            };
            
            console.log('✅ Database connection successful');
          } else {
            // Store the details for verbose output
            const errorDetails = connectionTest.details || {};
            const errorMessage = connectionTest.error || 'Unknown database connection error';
            throw new Error(errorMessage);
          }
        } catch (error) {
          results.database = { 
            status: 'failure', 
            message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`
          };
          
          console.error('❌ Database connection failed');
          if (options.verbose) {
            console.error('Error details:');
            console.error(error);
          }
        }
      } else {
        console.log('⏩ Skipping database check');
      }
      
      // Check presentations table
      if (!options.skipPresentations) {
        console.log('\n🔍 Checking presentations table...');
        try {
          const supabase = SupabaseClientService.getInstance().getClient();
          
          // Check if presentations table exists by querying it
          const { data: presentations, error } = await supabase
            .from('presentations')
            .select('count(*)', { count: 'exact', head: true });
          
          if (error) {
            throw new Error(`Error querying presentations table: ${error.message}`);
          }
          
          // Check for expert_documents table as well
          const { data: expertDocs, error: expertDocsError } = await supabase
            .from('expert_documents')
            .select('count(*)', { count: 'exact', head: true });
          
          if (expertDocsError) {
            console.warn(`⚠️ Could not verify expert_documents table: ${expertDocsError.message}`);
          }
          
          results.presentations = { 
            status: 'success', 
            message: `Presentations table accessible, expert_documents table ${expertDocsError ? 'not accessible' : 'accessible'}.`
          };
          
          console.log('✅ Presentations table accessible');
          
          // Check join tables
          const { data: presentationAssets, error: assetsError } = await supabase
            .from('presentation_assets')
            .select('count(*)', { count: 'exact', head: true });
          
          if (assetsError) {
            console.warn(`⚠️ Could not verify presentation_assets table: ${assetsError.message}`);
          } else {
            console.log('   ✅ Presentation assets table accessible');
          }
          
        } catch (error) {
          results.presentations = { 
            status: 'failure', 
            message: `Presentations table check failed: ${error instanceof Error ? error.message : String(error)}`
          };
          
          console.error('❌ Presentations table check failed');
          if (options.verbose) {
            console.error('Error details:');
            console.error(error);
          }
        }
      } else {
        console.log('⏩ Skipping presentations table check');
      }
      
      // Check Claude service
      if (!options.skipClaude) {
        console.log('\n🔍 Checking Claude service...');
        try {
          // Check if Claude API key is configured
          const apiKeyConfigured = claudeService.validateApiKey();
          
          if (apiKeyConfigured) {
            console.log('✅ Claude API key found in environment');
            
            // Only perform a minimal test call if API key is configured
            try {
              // Very short test prompt with minimal token usage
              const response = await claudeService.sendPrompt('Say "presentations healthy" if you can read this.', {
                maxTokens: 10
              });
              
              results.claude = { 
                status: 'success', 
                message: `Claude API connection successful. Response: "${response}"` 
              };
              
              console.log('✅ Claude API connection successful');
            } catch (apiError) {
              results.claude = { 
                status: 'failure', 
                message: `Claude API connection failed: ${apiError instanceof Error ? apiError.message : String(apiError)}` 
              };
              
              console.error('❌ Claude API connection failed');
              if (options.verbose) {
                console.error('Error details:');
                console.error(apiError);
              }
            }
          } else {
            results.claude = { 
              status: 'unknown', 
              message: 'Claude API key not found in environment variables' 
            };
            
            console.warn('⚠️ Claude API key not found in environment variables');
            console.warn('   Summary generation functionality will not be available');
          }
        } catch (error) {
          results.claude = { 
            status: 'failure', 
            message: `Claude service check failed: ${error instanceof Error ? error.message : String(error)}` 
          };
          
          console.error('❌ Claude service check failed');
          if (options.verbose) {
            console.error('Error details:');
            console.error(error);
          }
        }
      } else {
        console.log('⏩ Skipping Claude service check');
      }
      
      // Summary
      console.log('\n📊 Health Check Summary:');
      console.log('====================');
      console.log(`Database: ${results.database.status === 'success' ? '✅ Healthy' : results.database.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      console.log(`Presentations: ${results.presentations.status === 'success' ? '✅ Healthy' : results.presentations.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      console.log(`Claude Service: ${results.claude.status === 'success' ? '✅ Healthy' : results.claude.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      
      // Overall status
      const allHealthy = Object.values(results).every(r => r.status === 'success');
      const anyFailure = Object.values(results).some(r => r.status === 'failure');
      
      console.log('\n📋 Overall Status:');
      if (allHealthy) {
        console.log('✅ All systems healthy');
      } else if (anyFailure) {
        console.log('❌ One or more systems are unhealthy');
      } else {
        console.log('⚠️ Health status unknown for some systems');
      }
      
      // Return results for tracking
      return {
        results,
        allHealthy,
        anyFailure
      };
      
    } catch (error) {
      console.error(`Error performing health check: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, {
    getResultSummary: (result) => ({
      recordsAffected: 0,
      affectedEntity: 'health-check',
      summary: result.allHealthy 
        ? 'All presentations systems healthy' 
        : result.anyFailure 
          ? 'One or more presentations systems are unhealthy' 
          : 'Health status unknown for some presentations systems'
    })
  });
}