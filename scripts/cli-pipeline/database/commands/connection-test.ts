import { Command } from 'commander';
import { databaseService } from '../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import chalk from 'chalk';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as dns from 'dns';

const program = new Command();

// Helper function to check if a URL is reachable
const isUrlReachable = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      // Extract hostname from URL
      const hostname = new URL(url).hostname;
      
      // First check DNS resolution
      dns.lookup(hostname, (err) => {
        if (err) {
          resolve(false);
          return;
        }
        
        // Then try to connect
        const req = https.request(url, { method: 'HEAD' }, (res) => {
          resolve(res.statusCode !== undefined && res.statusCode < 500);
        });
        
        req.on('error', () => {
          resolve(false);
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        
        req.setTimeout(3000);
        req.end();
      });
    } catch (error) {
      resolve(false);
    }
  });
};

program
  .name('connection-test')
  .description('Test connection to Supabase database')
  .option('-d, --detailed', 'Show detailed connection information')
  .option('-n, --network-only', 'Test only network connectivity, not database connection')
  .action(async (options) => {
    try {
      let trackingId;
      try {
        trackingId = await commandTrackingService.startTracking('database', 'connection-test');
      } catch (trackingError) {
        console.log(chalk.yellow('Note: Command tracking is unavailable. This won\'t affect the connection test.'));
      }
      
      console.log(chalk.blue('Testing Supabase database connection...'));
      
      // Check for network connectivity first to diagnose fetch failed errors
      console.log(chalk.cyan('\nChecking network connectivity:'));
      
      // Check general internet connectivity
      const googleReachable = await isUrlReachable('https://www.google.com');
      if (googleReachable) {
        console.log(chalk.green('✓ General internet connectivity: OK (google.com is reachable)'));
      } else {
        console.log(chalk.red('✗ General internet connectivity: FAIL (google.com is not reachable)'));
        console.log(chalk.yellow('  This suggests you may have a network connectivity issue'));
      }
      
      // Check Supabase connectivity
      console.log(chalk.cyan('\nChecking Supabase service availability:'));
      const supabasePublicReachable = await isUrlReachable('https://supabase.io');
      if (supabasePublicReachable) {
        console.log(chalk.green('✓ Supabase public site is reachable'));
      } else {
        console.log(chalk.red('✗ Supabase public site is not reachable'));
        console.log(chalk.yellow('  This suggests Supabase may be experiencing an outage'));
      }
      
      // Check project URL if available
      if (process.env.SUPABASE_URL) {
        const supabaseProjectReachable = await isUrlReachable(process.env.SUPABASE_URL);
        if (supabaseProjectReachable) {
          console.log(chalk.green(`✓ Your Supabase project URL is reachable: ${process.env.SUPABASE_URL.substring(0, 12)}...`));
        } else {
          console.log(chalk.red(`✗ Your Supabase project URL is not reachable: ${process.env.SUPABASE_URL.substring(0, 12)}...`));
          console.log(chalk.yellow('  This suggests an issue with your Supabase project URL or the project is offline'));
        }
      }
      
      // If network-only option is provided, stop here
      if (options.networkOnly) {
        if (trackingId) {
          try {
            await commandTrackingService.completeTracking(trackingId, {
              summary: `Network connectivity test completed`
            });
          } catch (error) {
            // Ignore tracking errors
          }
        }
        return;
      }
      
      // First check the environment variables
      console.log(chalk.cyan('\nChecking environment variables:'));
      
      // Check if .env.development exists
      const projectRoot = path.resolve(__dirname, '../../../../');
      const envPath = path.join(projectRoot, '.env.development');
      
      if (fs.existsSync(envPath)) {
        console.log(chalk.green('✓ .env.development file exists'));
        
        const envContent = fs.readFileSync(envPath, 'utf8');
        const supabaseUrlMatch = envContent.match(/SUPABASE_URL=(.+)/);
        const supabaseKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
        
        if (supabaseUrlMatch) {
          const url = supabaseUrlMatch[1];
          console.log(chalk.green(`✓ SUPABASE_URL is set: ${url.substring(0, 12)}...`));
        } else {
          console.log(chalk.red('✗ SUPABASE_URL is not set in .env.development'));
        }
        
        if (supabaseKeyMatch) {
          const key = supabaseKeyMatch[1];
          console.log(chalk.green(`✓ SUPABASE_SERVICE_ROLE_KEY is set: ${key.substring(0, 8)}...`));
        } else {
          console.log(chalk.red('✗ SUPABASE_SERVICE_ROLE_KEY is not set in .env.development'));
        }
      } else {
        console.log(chalk.red('✗ .env.development file not found'));
      }
      
      // Verify environment variables loaded in process.env
      if (process.env.SUPABASE_URL) {
        console.log(chalk.green(`✓ process.env.SUPABASE_URL is loaded: ${process.env.SUPABASE_URL.substring(0, 12)}...`));
      } else {
        console.log(chalk.red('✗ process.env.SUPABASE_URL is not loaded'));
      }
      
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log(chalk.green(`✓ process.env.SUPABASE_SERVICE_ROLE_KEY is loaded: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 8)}...`));
      } else {
        console.log(chalk.red('✗ process.env.SUPABASE_SERVICE_ROLE_KEY is not loaded'));
      }
      
      // Now test the database connection
      console.log(chalk.cyan('\nTesting database connection:'));
      
      try {
        const connectionTest = await SupabaseClientService.getInstance().testConnection();
        
        if (connectionTest.success) {
          console.log(chalk.green(`✓ Database connection successful`));
          
          // Show additional details if requested
          if (options.detailed) {
            const supabase = SupabaseClientService.getInstance().getClient();
            
            // Test a simple query
            console.log('');
            console.log(chalk.cyan('Running test query on document_types table:'));
            const { data, error } = await supabase
              .from('document_types')
              .select('id, document_type')
              .limit(3);
              
            if (error) {
              console.log(chalk.red(`✗ Query failed: ${error.message}`));
            } else {
              console.log(chalk.green(`✓ Query successful. Retrieved ${data.length} records:`));
              data.forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.document_type} (ID: ${item.id})`);
              });
            }
            
            // Get number of tables
            console.log('');
            console.log(chalk.cyan('Checking database tables:'));
            const tables = await databaseService.getTablesWithRecordCounts();
            
            console.log(chalk.green(`✓ Database has ${tables.length} tables`));
            console.log(chalk.green(`✓ Tables with records: ${tables.filter(t => t.count > 0).length}`));
            console.log(chalk.green(`✓ Empty tables: ${tables.filter(t => t.count === 0).length}`));
          }
        } else {
          console.log(chalk.red(`✗ Database connection failed`));
          
          if (connectionTest.error) {
            console.log('');
            console.log(chalk.cyan('Error details:'));
            console.log(chalk.red(connectionTest.error));
          }
          
          console.log('');
          console.log(chalk.cyan('Troubleshooting tips:'));
          console.log('1. Check that the .env.development file exists in the project root');
          console.log('2. Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set correctly');
          console.log('3. Ensure you have internet connectivity');
          console.log('4. Confirm that the Supabase service is running and accessible');
        }
      } catch (dbError) {
        console.log(chalk.red(`✗ Error testing database connection: ${dbError instanceof Error ? dbError.message : String(dbError)}`));
      }
      
      // Complete command tracking
      if (trackingId) {
        try {
          await commandTrackingService.completeTracking(trackingId, {
            summary: `Database connection test completed`
          });
        } catch (error) {
          // Ignore tracking errors
        }
      }
    } catch (error) {
      console.error(chalk.red('Error testing connection:'), error);
      process.exit(1);
    }
  });

export default program;