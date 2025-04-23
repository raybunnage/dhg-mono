#!/usr/bin/env ts-node
/**
 * Adds the find_duplicate_expert_documents function to the database
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables properly
const envPaths = [
  path.resolve(process.cwd(), '.env.development'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'scripts/cli-pipeline/google_sync/.env')
];

// Try loading from each path
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    dotenv.config({ path: envPath });
  }
}

async function addFindDuplicatesFunction() {
  try {
    console.log("Initializing Supabase client...");
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Read SQL file
    const sqlFilePath = path.resolve(__dirname, 'create-find-duplicates-function.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log(`Creating find_duplicate_expert_documents function...`);
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error(`Error creating function: ${error.message}`);
      
      // If the exec_sql function doesn't exist, we'll need to create it with a direct query
      if (error.message.includes('function exec_sql') || error.message.includes('does not exist')) {
        console.log("The exec_sql function doesn't exist. Creating function directly...");
        
        // Execute the SQL directly
        const { error: directError } = await supabase.rpc('postgres_execute', { query: sqlContent });
        
        if (directError) {
          // If postgres_execute also doesn't exist, fall back to REST API for SQL execution
          if (directError.message.includes('function postgres_execute') || directError.message.includes('does not exist')) {
            console.log("The postgres_execute function doesn't exist either. Attempting direct query via REST API...");
            
            // Create a custom endpoint to execute SQL
            const apiUrl = process.env.SUPABASE_URL + '/rest/v1/rpc/exec_sql';
            const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            
            if (!apiUrl || !apiKey) {
              throw new Error("Missing Supabase URL or service role key");
            }
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({ sql: sqlContent })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`SQL execution failed: ${JSON.stringify(errorData)}`);
            }
            
            console.log("Function created successfully via REST API!");
          } else {
            throw new Error(`Error creating function directly: ${directError.message}`);
          }
        } else {
          console.log("Function created successfully via postgres_execute!");
        }
      } else {
        throw error;
      }
    } else {
      console.log("Function created successfully via exec_sql!");
    }
    
    console.log("✅ find_duplicate_expert_documents function has been added to the database.");
    console.log("You can now run the expert-documents-duplicates.ts script.");
    
  } catch (error) {
    console.error(`Error adding function: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Run the function
addFindDuplicatesFunction();