import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';
import * as fs from 'fs';
import * as path from 'path';
// Define a simplified ffmpeg service for health check
const ffmpegService = {
  checkAvailability: async (): Promise<boolean> => {
    try {
      const { execSync } = require('child_process');
      execSync('ffmpeg -version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  },
  getVersion: async (): Promise<string> => {
    try {
      const { execSync } = require('child_process');
      const output = execSync('ffmpeg -version').toString();
      const versionMatch = output.match(/ffmpeg version (\S+)/);
      return versionMatch ? versionMatch[1] : 'Unknown';
    } catch (error) {
      throw new Error('Failed to get FFmpeg version');
    }
  }
};

interface HealthCheckOptions {
  skipDatabase?: boolean;
  skipFileSystem?: boolean;
  skipFfmpeg?: boolean;
  verbose?: boolean;
}

/**
 * Performs health checks on the media processing infrastructure
 */
export async function healthCheckCommand(options: HealthCheckOptions = {}): Promise<void> {
  await trackCommandExecution('media_processing', 'health-check', async () => {
    try {
      const results = {
        database: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
        fileSystem: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
        ffmpeg: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
      };
      
      console.log('🏥 Running media-processing health checks...');
      
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
            
            // Additional verification: Check presentations table
            console.log('   Checking presentations table...');
            const supabase = SupabaseClientService.getInstance().getClient();
            const { data, error } = await supabase
              .from('presentations')
              .select('count(*)', { count: 'exact' });
            
            if (!error) {
              console.log(`   Found ${data ? data.length : 0} records in presentations table`);
            } else {
              console.warn(`   ⚠️ Could not verify presentations table: ${error.message}`);
            }
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
      
      // Check file system access
      if (!options.skipFileSystem) {
        console.log('\n🔍 Checking file system access...');
        try {
          const rootDir = path.resolve(process.cwd());
          const fileTypesDir = path.join(rootDir, 'file_types');
          const mp4Dir = path.join(fileTypesDir, 'mp4');
          const m4aDir = path.join(fileTypesDir, 'm4a');
          const transcriptsDir = path.join(fileTypesDir, 'transcripts');
          
          // Check if directories exist
          const checkDir = (dir: string, createIfNotExists: boolean = false) => {
            try {
              if (fs.existsSync(dir)) {
                return { exists: true, message: `Directory exists: ${dir}` };
              } else if (createIfNotExists) {
                fs.mkdirSync(dir, { recursive: true });
                return { exists: true, message: `Created directory: ${dir}` };
              } else {
                return { exists: false, message: `Directory does not exist: ${dir}` };
              }
            } catch (error) {
              return { 
                exists: false, 
                message: `Error checking directory ${dir}: ${error instanceof Error ? error.message : String(error)}` 
              };
            }
          };
          
          const fileTypesCheck = checkDir(fileTypesDir);
          const mp4Check = checkDir(mp4Dir, !fileTypesCheck.exists);
          const m4aCheck = checkDir(m4aDir, !fileTypesCheck.exists);
          const transcriptsCheck = checkDir(transcriptsDir, !fileTypesCheck.exists);
          
          if (fileTypesCheck.exists && mp4Check.exists && m4aCheck.exists && transcriptsCheck.exists) {
            results.fileSystem = { 
              status: 'success', 
              message: 'All required directories exist or were created successfully.' 
            };
            
            console.log('✅ File system access successful');
            console.log(`   ${fileTypesCheck.message}`);
            console.log(`   ${mp4Check.message}`);
            console.log(`   ${m4aCheck.message}`);
            console.log(`   ${transcriptsCheck.message}`);
            
            // Check write permissions by creating and removing a test file
            const testFilePath = path.join(fileTypesDir, '.health-check-test');
            try {
              fs.writeFileSync(testFilePath, 'test', 'utf8');
              fs.unlinkSync(testFilePath);
              console.log('   ✅ Write permissions verified');
            } catch (error) {
              console.warn(`   ⚠️ Could not verify write permissions: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else {
            const message = [
              fileTypesCheck.exists ? null : fileTypesCheck.message,
              mp4Check.exists ? null : mp4Check.message,
              m4aCheck.exists ? null : m4aCheck.message,
              transcriptsCheck.exists ? null : transcriptsCheck.message,
            ]
              .filter(Boolean)
              .join('; ');
            
            results.fileSystem = { 
              status: 'failure', 
              message: `File system check failed: ${message}` 
            };
            
            console.error('❌ File system access failed');
            console.error(`   Missing required directories: ${message}`);
          }
        } catch (error) {
          results.fileSystem = { 
            status: 'failure', 
            message: `File system check failed: ${error instanceof Error ? error.message : String(error)}` 
          };
          
          console.error('❌ File system check failed');
          if (options.verbose) {
            console.error('Error details:');
            console.error(error);
          }
        }
      } else {
        console.log('⏩ Skipping file system check');
      }
      
      // Check FFmpeg
      if (!options.skipFfmpeg) {
        console.log('\n🔍 Checking FFmpeg availability...');
        try {
          const ffmpegAvailable = await ffmpegService.checkAvailability();
          
          if (ffmpegAvailable) {
            results.ffmpeg = { 
              status: 'success', 
              message: 'FFmpeg is available and working.' 
            };
            
            console.log('✅ FFmpeg is available');
            
            try {
              const version = await ffmpegService.getVersion();
              console.log(`   FFmpeg version: ${version}`);
            } catch (error) {
              console.warn(`   ⚠️ Could not determine FFmpeg version: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else {
            results.ffmpeg = { 
              status: 'failure', 
              message: 'FFmpeg is not available or not working properly.' 
            };
            
            console.error('❌ FFmpeg check failed');
            console.error('   FFmpeg is required for media processing.');
            console.error('   Please ensure FFmpeg is installed and available in the system PATH.');
          }
        } catch (error) {
          results.ffmpeg = { 
            status: 'failure', 
            message: `FFmpeg check failed: ${error instanceof Error ? error.message : String(error)}` 
          };
          
          console.error('❌ FFmpeg check failed');
          if (options.verbose) {
            console.error('Error details:');
            console.error(error);
          }
        }
      } else {
        console.log('⏩ Skipping FFmpeg check');
      }
      
      // Summary
      console.log('\n📊 Health Check Summary:');
      console.log('====================');
      console.log(`Database: ${results.database.status === 'success' ? '✅ Healthy' : results.database.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      console.log(`File System: ${results.fileSystem.status === 'success' ? '✅ Healthy' : results.fileSystem.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      console.log(`FFmpeg: ${results.ffmpeg.status === 'success' ? '✅ Healthy' : results.ffmpeg.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      
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