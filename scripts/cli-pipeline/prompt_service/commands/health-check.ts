import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { promptManagementService } from '../../../../packages/shared/services/prompt-service/prompt-management-service';
import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';
import { ClaudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import * as fs from 'fs';
import * as path from 'path';

interface HealthCheckOptions {
  skipDatabase?: boolean;
  skipPrompts?: boolean;
  skipClaude?: boolean;
  verbose?: boolean;
}

/**
 * Performs health checks on the prompt service infrastructure
 */
export async function healthCheckCommand(options: HealthCheckOptions = {}): Promise<void> {
  await trackCommandExecution('prompt_service', 'health-check', async () => {
    try {
      const results = {
        database: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
        promptService: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
        claude: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
        promptRepository: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
      };
      
      console.log('🏥 Running prompt-service health checks...');
      
      // Check database connection
      if (!options.skipDatabase) {
        console.log('\n🔍 Checking Supabase database connection...');
        try {
          // Use the testConnection method instead of a simple query
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
            // Show the full error details instead of just the message
            console.error(error);
            // Check if there's additional error information
            if (error instanceof Error && (error as any).cause) {
              console.error('Root cause:');
              console.error((error as any).cause);
            }
            
            // Additional diagnostic information
            console.error('\nDiagnostic information:');
            console.error(`Current working directory: ${process.cwd()}`);
            console.error(`Environment: ${process.env.NODE_ENV || 'not set'}`);
            
            // Check if env file exists
            const envPath = path.join(process.cwd(), '.env.development');
            console.error(`Env file (.env.development) exists: ${fs.existsSync(envPath)}`);
          }
        }
      } else {
        console.log('⏩ Skipping database check');
      }
      
      // Check prompt service
      if (!options.skipPrompts) {
        console.log('\n🔍 Checking prompt service...');
        try {
          const prompts = await promptManagementService.getDatabasePrompts();
          
          results.promptService = { 
            status: 'success', 
            message: `Found ${prompts.length} prompts in the database` 
          };
          
          console.log(`✅ Prompt service working. Found ${prompts.length} prompts.`);
          
          // Check prompt files repository
          console.log('\n🔍 Checking prompt repository...');
          const promptsDir = path.join(process.cwd(), 'prompts');
          
          if (fs.existsSync(promptsDir)) {
            const promptFiles = fs.readdirSync(promptsDir).filter(file => file.endsWith('.md'));
            
            results.promptRepository = { 
              status: 'success', 
              message: `Found ${promptFiles.length} prompt files in the repository` 
            };
            
            console.log(`✅ Prompt repository exists with ${promptFiles.length} prompt files.`);
            
            if (options.verbose) {
              console.log('Prompt files:');
              promptFiles.forEach(file => console.log(`  - ${file}`));
            }
          } else {
            results.promptRepository = { 
              status: 'failure', 
              message: `Prompt repository directory not found at ${promptsDir}` 
            };
            
            console.warn('⚠️ Prompt repository directory not found. Creating directory...');
            fs.mkdirSync(promptsDir, { recursive: true });
            console.log(`✅ Created prompt repository directory at ${promptsDir}`);
          }
        } catch (error) {
          results.promptService = { 
            status: 'failure', 
            message: `Prompt service check failed: ${error instanceof Error ? error.message : String(error)}` 
          };
          
          console.error('❌ Prompt service check failed');
          if (options.verbose) {
            console.error(results.promptService.message);
          }
        }
      } else {
        console.log('⏩ Skipping prompt service check');
      }
      
      // Check claude service
      if (!options.skipClaude) {
        console.log('\n🔍 Checking Claude service...');
        try {
          const claude = ClaudeService.getInstance();
          
          if (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY) {
            // Only attempt to call Claude if we have API key
            console.log('  API key found, testing Claude API connection...');
            
            try {
              // Very short test prompt with minimal token usage
              const response = await claude.sendPrompt('Say "healthy" if you can read this.', {
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
                console.error(results.claude.message);
              }
            }
          } else {
            results.claude = { 
              status: 'unknown', 
              message: 'Claude API key not found in environment variables' 
            };
            
            console.warn('⚠️ Claude API key not found in environment variables');
          }
        } catch (error) {
          results.claude = { 
            status: 'failure', 
            message: `Claude service initialization failed: ${error instanceof Error ? error.message : String(error)}` 
          };
          
          console.error('❌ Claude service initialization failed');
          if (options.verbose) {
            console.error(results.claude.message);
          }
        }
      } else {
        console.log('⏩ Skipping Claude service check');
      }
      
      // Summary
      console.log('\n📊 Health Check Summary:');
      console.log('====================');
      console.log(`Database: ${results.database.status === 'success' ? '✅ Healthy' : results.database.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      console.log(`Prompt Service: ${results.promptService.status === 'success' ? '✅ Healthy' : results.promptService.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      console.log(`Prompt Repository: ${results.promptRepository.status === 'success' ? '✅ Healthy' : results.promptRepository.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
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
        ? 'All systems healthy' 
        : result.anyFailure 
          ? 'One or more systems are unhealthy' 
          : 'Health status unknown for some systems'
    })
  });
}