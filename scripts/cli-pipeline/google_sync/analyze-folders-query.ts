#!/usr/bin/env ts-node
/**
 * Analyze folders with document types by path depth 
 * Simple script to explain the difference between SQL query results
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
const envFiles = ['.env', '.env.development', '.env.local'];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment variables from ${filePath}`);
    dotenv.config({ path: filePath });
  }
}

async function analyzeFolders() {
  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Query 1: Count folders with document types (similar to the SQL query mentioned)
  try {
    console.log("\n=== Query 1: Count all folders with document types ===");
    
    const query1 = `
      SELECT dt.document_type, COUNT(*) as count
      FROM sources_google sg
      JOIN document_types dt ON sg.document_type_id = dt.id
      WHERE sg.document_type_id IS NOT NULL AND sg.is_deleted = FALSE
        AND sg.mime_type = 'application/vnd.google-apps.folder'
      GROUP BY dt.document_type
      ORDER BY count DESC
    `;
    
    const { data: results1, error: error1 } = await supabase.rpc('run_sql', { sql_query: query1 });
    
    if (error1) {
      console.error("Error running query 1:", error1.message);
    } else {
      console.log(results1);
      
      // Calculate total
      let total = 0;
      for (const row of results1 as any[]) {
        total += parseInt(row.count);
      }
      console.log(`\nTotal folders with document types: ${total}`);
    }
    
    // Query 2: Count folders with document types by path_depth
    console.log("\n=== Query 2: Count folders with document types by path_depth ===");
    
    const query2 = `
      SELECT path_depth, COUNT(*) as count
      FROM sources_google sg
      WHERE sg.document_type_id IS NOT NULL AND sg.is_deleted = FALSE
        AND sg.mime_type = 'application/vnd.google-apps.folder'
      GROUP BY path_depth
      ORDER BY path_depth
    `;
    
    const { data: results2, error: error2 } = await supabase.rpc('run_sql', { sql_query: query2 });
    
    if (error2) {
      console.error("Error running query 2:", error2.message);
    } else {
      console.log(results2);
      
      // Calculate total by path_depth
      let totalByDepth = 0;
      let pathDepth0Count = 0;
      
      for (const row of results2 as any[]) {
        totalByDepth += parseInt(row.count);
        if (row.path_depth === 0) {
          pathDepth0Count = parseInt(row.count);
        }
      }
      
      console.log(`\nTotal folders (by path_depth): ${totalByDepth}`);
      console.log(`Folders with path_depth=0: ${pathDepth0Count}`);
      console.log(`Folders with path_depth>0: ${totalByDepth - pathDepth0Count}`);
    }
    
    // Query 3: Show examples of folders with path_depth > 0
    console.log("\n=== Query 3: Examples of folders with path_depth > 0 ===");
    
    const query3 = `
      SELECT sg.id, sg.name, sg.path, sg.path_depth, dt.document_type
      FROM sources_google sg
      JOIN document_types dt ON sg.document_type_id = dt.id
      WHERE sg.document_type_id IS NOT NULL AND sg.is_deleted = FALSE
        AND sg.mime_type = 'application/vnd.google-apps.folder'
        AND sg.path_depth > 0
      ORDER BY sg.path_depth, sg.name
      LIMIT 10
    `;
    
    const { data: results3, error: error3 } = await supabase.rpc('run_sql', { sql_query: query3 });
    
    if (error3) {
      console.error("Error running query 3:", error3.message);
    } else {
      console.log(results3);
    }
    
    // Query 4: Count by document_type and path_depth
    console.log("\n=== Query 4: Count by document_type and path_depth ===");
    
    const query4 = `
      SELECT dt.document_type, sg.path_depth, COUNT(*) as count
      FROM sources_google sg
      JOIN document_types dt ON sg.document_type_id = dt.id
      WHERE sg.document_type_id IS NOT NULL AND sg.is_deleted = FALSE
        AND sg.mime_type = 'application/vnd.google-apps.folder'
      GROUP BY dt.document_type, sg.path_depth
      ORDER BY dt.document_type, sg.path_depth
    `;
    
    const { data: results4, error: error4 } = await supabase.rpc('run_sql', { sql_query: query4 });
    
    if (error4) {
      console.error("Error running query 4:", error4.message);
    } else {
      console.log(results4);
    }
    
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

analyzeFolders();