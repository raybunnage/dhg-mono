import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';
import { claudeService } from '@shared/services/claude-service';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface HealthCheckOptions {
  skipDatabase?: boolean;
  skipPresentations?: boolean;
  skipClaude?: boolean;
  skipCommandVerification?: boolean;
  verbose?: boolean;
}

interface HealthCheckStatusResult {
  status: 'success' | 'failure' | 'unknown';
  message: string;
}

interface HealthCheckResults {
  database: HealthCheckStatusResult;
  presentations: HealthCheckStatusResult;
  claude: HealthCheckStatusResult;
  commands: HealthCheckStatusResult;
}

interface HealthCheckReturnValue {
  results: HealthCheckResults;
  allHealthy: boolean;
  anyFailure: boolean;
}

/**
 * Performs health checks on the presentations pipeline infrastructure
 */
export async function healthCheckCommand(options: HealthCheckOptions = {}): Promise<void> {
  await trackCommandExecution('presentations', 'health-check', async () => {
    try {
      const results: HealthCheckResults = {
        database: { status: 'unknown', message: '' },
        presentations: { status: 'unknown', message: '' },
        claude: { status: 'unknown', message: '' },
        commands: { status: 'unknown', message: '' },
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
          let error;
          let presentationCount = 0;
          try {
            const response = await supabase
              .from('media_presentations')
              .select('*', { count: 'exact', head: true });
            
            if (response.error) {
              error = response.error;
            } else {
              presentationCount = response.count || 0;
              console.log(`   ✅ Presentations table has approximately ${presentationCount} records`);
            }
          } catch (e) {
            error = e;
          }
          
          if (error) {
            throw new Error(`Error querying presentations table: ${error instanceof Error ? error.message : String(error)}`);
          }
          
          // Check for expert_documents table as well
          let expertDocsError;
          try {
            const response = await supabase
              .from('google_expert_documents')
              .select('*', { count: 'exact', head: true });
              
            if (response.error) {
              expertDocsError = response.error;
              console.warn(`⚠️ Could not verify expert_documents table: ${response.error.message}`);
            } else {
              console.log(`   ✅ Expert documents table has approximately ${response.count || 0} records`);
            }
          } catch (e) {
            expertDocsError = e;
            console.warn(`⚠️ Could not verify expert_documents table: ${e instanceof Error ? e.message : String(e)}`);
          }
          
          // Check join tables
          let assetsError;
          try {
            const response = await supabase
              .from('media_presentation_assets')
              .select('*', { count: 'exact', head: true });
              
            if (response.error) {
              assetsError = response.error;
              console.warn(`⚠️ Could not verify presentation_assets table: ${response.error.message}`);
            } else {
              console.log(`   ✅ Presentation assets table has approximately ${response.count || 0} records`);
            }
          } catch (e) {
            assetsError = e;
            console.warn(`⚠️ Could not verify presentation_assets table: ${e instanceof Error ? e.message : String(e)}`);
          }
          
          results.presentations = { 
            status: 'success', 
            message: `Presentations table accessible, expert_documents table ${expertDocsError ? 'not accessible' : 'accessible'}, presentation_assets table ${assetsError ? 'not accessible' : 'accessible'}.`
          };
          
          console.log('✅ Presentations table accessible');
          
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
      
      // Check CLI commands
      if (!options.skipCommandVerification) {
        console.log('\n🔍 Checking CLI command registration...');
        try {
          // List of expected commands that should be registered
          const expectedCommands = [
            'review-presentations',
            'generate-summary',
            'generate-expert-bio',
            'check-professional-docs',
            'create-missing-assets',
            'export-status',
            'repair-presentations',
            'create-from-expert-docs',
            'create-presentations-from-mp4',
            'scan-for-ai-summaries',
            'show-missing-content',
            'show-ai-summary-status',
            'presentation-asset-bio',
            'add-specific-files',
            'update-root-drive-id',
            'health-check'
          ];
          
          // Get the script directory
          const scriptDir = path.dirname(__dirname);
          const cliScriptPath = path.join(scriptDir, 'presentations-cli.sh');
          
          // Check if the CLI script exists
          if (!fs.existsSync(cliScriptPath)) {
            throw new Error(`CLI script not found at ${cliScriptPath}`);
          }
          
          // Check if all expected commands are registered in the CLI script
          const scriptContent = fs.readFileSync(cliScriptPath, 'utf8');
          const missingInScript: string[] = [];
          
          for (const command of expectedCommands) {
            // Check for direct handling of command in the shell script
            if (!scriptContent.includes(`if [[ "$1" == "${command}"`)) {
              // Some commands might be caught by the default handler
              if (!scriptContent.includes(`track_command "$COMMAND"`)) {
                missingInScript.push(command);
              }
            }
          }
          
          // Check index.ts for command registration
          const indexPath = path.join(scriptDir, 'index.ts');
          const indexContent = fs.readFileSync(indexPath, 'utf8');
          const missingInIndex: string[] = [];
          
          for (const command of expectedCommands) {
            // Look for command registration patterns in index.ts
            const patternA = `.command('${command}')`;
            const patternB = `= require('./commands/${command}')`;
            
            if (!indexContent.includes(patternA) && !indexContent.includes(patternB)) {
              missingInIndex.push(command);
            }
          }
          
          // Check command help output
          let helpOutput = '';
          try {
            helpOutput = execSync(`${cliScriptPath} --help`, { 
              encoding: 'utf8', 
              stdio: ['pipe', 'pipe', 'pipe'] 
            });
          } catch (helpError) {
            console.warn(`⚠️ Could not check help output: ${helpError instanceof Error ? helpError.message : String(helpError)}`);
          }
          
          const missingInHelp: string[] = [];
          for (const command of expectedCommands) {
            if (!helpOutput.includes(command)) {
              missingInHelp.push(command);
            }
          }
          
          if (missingInScript.length === 0 && missingInIndex.length === 0 && missingInHelp.length === 0) {
            results.commands = {
              status: 'success',
              message: 'All expected commands are properly registered in shell script and index.ts'
            };
            console.log('✅ All expected commands are properly registered');
          } else {
            let message = '';
            if (missingInScript.length > 0) {
              message += `Commands missing in shell script: ${missingInScript.join(', ')}. `;
              console.warn(`⚠️ Commands missing in shell script: ${missingInScript.join(', ')}`);
            }
            if (missingInIndex.length > 0) {
              message += `Commands missing in index.ts: ${missingInIndex.join(', ')}. `;
              console.warn(`⚠️ Commands missing in index.ts: ${missingInIndex.join(', ')}`);
            }
            if (missingInHelp.length > 0) {
              message += `Commands missing in help output: ${missingInHelp.join(', ')}. `;
              console.warn(`⚠️ Commands missing in help output: ${missingInHelp.join(', ')}`);
            }
            
            results.commands = {
              status: missingInScript.length > 0 || missingInIndex.length > 0 ? 'failure' : 'unknown',
              message
            };
          }
          
          // Check tracking setup for each command
          if (options.verbose) {
            const commandsWithoutTracking: string[] = [];
            
            for (const command of expectedCommands) {
              // Better pattern search for tracking
              const pattern1 = `track_command "${command}"`;
              const pattern2 = `if [[ "$1" == "${command}" ]]`;
              
              if (!scriptContent.includes(pattern1) || (!scriptContent.includes(pattern2) && !pattern1.includes('health-check'))) {
                commandsWithoutTracking.push(command);
              }
            }
            
            if (commandsWithoutTracking.length > 0) {
              console.warn(`⚠️ Commands without clear tracking: ${commandsWithoutTracking.join(', ')}`);
            } else {
              console.log('   ✅ Command tracking appears to be set up for all commands');
            }
          }
          
        } catch (error) {
          results.commands = {
            status: 'failure',
            message: `Command verification failed: ${error instanceof Error ? error.message : String(error)}`
          };
          
          console.error('❌ Command verification failed');
          if (options.verbose) {
            console.error('Error details:');
            console.error(error);
          }
        }
      } else {
        console.log('⏩ Skipping command verification');
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
      console.log(`CLI Commands: ${results.commands.status === 'success' ? '✅ Healthy' : results.commands.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
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
      const returnValue: HealthCheckReturnValue = {
        results,
        allHealthy,
        anyFailure
      };
      
      return returnValue;
      
    } catch (error) {
      console.error(`Error performing health check: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, {
    getResultSummary: (result: HealthCheckReturnValue) => ({
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

// healthCheckCommand is already exported above