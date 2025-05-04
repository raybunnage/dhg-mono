/**
 * Simple Connection Test - A simplified version that doesn't use commander.js
 * This is a fallback version for when the normal command doesn't display output
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as dns from 'dns';

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

// Immediately self-executing async function
(async () => {
  try {
    console.log("=== Database Connection Test ===");
    
    // Check for network connectivity first
    console.log("\nChecking network connectivity:");
    
    // Check general internet connectivity
    const googleReachable = await isUrlReachable('https://www.google.com');
    if (googleReachable) {
      console.log('✅ General internet connectivity: OK (google.com is reachable)');
    } else {
      console.log('❌ General internet connectivity: FAIL (google.com is not reachable)');
      console.log('   This suggests you may have a network connectivity issue');
    }
    
    // Check Supabase connectivity
    const supabasePublicReachable = await isUrlReachable('https://supabase.io');
    if (supabasePublicReachable) {
      console.log('✅ Supabase public site is reachable');
    } else {
      console.log('❌ Supabase public site is not reachable');
      console.log('   This suggests Supabase may be experiencing an outage');
    }
    
    // Check project URL if available
    if (process.env.SUPABASE_URL) {
      const supabaseProjectReachable = await isUrlReachable(process.env.SUPABASE_URL);
      if (supabaseProjectReachable) {
        console.log(`✅ Your Supabase project URL is reachable: ${process.env.SUPABASE_URL.substring(0, 12)}...`);
      } else {
        console.log(`❌ Your Supabase project URL is not reachable: ${process.env.SUPABASE_URL.substring(0, 12)}...`);
        console.log('   This suggests an issue with your Supabase project URL or the project is offline');
      }
    }
    
    // Check environment variables
    console.log("\nChecking environment variables:");
    
    // Check if .env.development exists
    const projectRoot = path.resolve(__dirname, '../../../../');
    const envPath = path.join(projectRoot, '.env.development');
    
    if (fs.existsSync(envPath)) {
      console.log('✅ .env.development file exists');
      
      const envContent = fs.readFileSync(envPath, 'utf8');
      const supabaseUrlMatch = envContent.match(/SUPABASE_URL=(.+)/);
      const supabaseKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
      
      if (supabaseUrlMatch) {
        const url = supabaseUrlMatch[1];
        console.log(`✅ SUPABASE_URL is set: ${url.substring(0, 12)}...`);
      } else {
        console.log('❌ SUPABASE_URL is not set in .env.development');
      }
      
      if (supabaseKeyMatch) {
        const key = supabaseKeyMatch[1];
        console.log(`✅ SUPABASE_SERVICE_ROLE_KEY is set: ${key.substring(0, 8)}...`);
      } else {
        console.log('❌ SUPABASE_SERVICE_ROLE_KEY is not set in .env.development');
      }
    } else {
      console.log('❌ .env.development file not found');
    }
    
    // Verify environment variables loaded in process.env
    if (process.env.SUPABASE_URL) {
      console.log(`✅ process.env.SUPABASE_URL is loaded: ${process.env.SUPABASE_URL.substring(0, 12)}...`);
    } else {
      console.log('❌ process.env.SUPABASE_URL is not loaded');
    }
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log(`✅ process.env.SUPABASE_SERVICE_ROLE_KEY is loaded: ${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 8)}...`);
    } else {
      console.log('❌ process.env.SUPABASE_SERVICE_ROLE_KEY is not loaded');
    }
    
    // Test the database connection
    console.log("\nTesting database connection:");
    
    try {
      const connectionTest = await SupabaseClientService.getInstance().testConnection();
      
      if (connectionTest.success) {
        console.log(`✅ Database connection successful`);
        
        // Test a simple query
        const supabase = SupabaseClientService.getInstance().getClient();
        
        console.log('\nRunning test query on document_types table:');
        const { data, error } = await supabase
          .from('document_types')
          .select('id, document_type')
          .limit(3);
          
        if (error) {
          console.log(`❌ Query failed: ${error.message}`);
        } else {
          console.log(`✅ Query successful. Retrieved ${data.length} records:`);
          data.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.document_type} (ID: ${item.id})`);
          });
        }
      } else {
        console.log(`❌ Database connection failed`);
        
        if (connectionTest.error) {
          console.log('\nError details:');
          console.log(connectionTest.error);
        }
        
        console.log('\nTroubleshooting tips:');
        console.log('1. Check that the .env.development file exists in the project root');
        console.log('2. Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set correctly');
        console.log('3. Ensure you have internet connectivity');
        console.log('4. Confirm that the Supabase service is running and accessible');
      }
    } catch (dbError) {
      console.log(`❌ Error testing database connection: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }
    
  } catch (error) {
    console.error("ERROR:", error);
    process.exit(1);
  }
})();