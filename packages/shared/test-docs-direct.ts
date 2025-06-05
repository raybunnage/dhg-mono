#!/usr/bin/env ts-node
/**
 * Direct Supabase Query for Documents Needing Classification
 * 
 * This script directly queries Supabase for documents needing classification
 * without using any libraries or services.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

async function findDocumentsNeedingClassification() {
  console.log('=== Finding Documents Needing Classification ===');
  
  // Load environment variables directly from .env.development
  const envPath = path.resolve(process.cwd(), '.env.development');
  console.log(`Loading environment directly from: ${envPath}`);
  
  // Read the file contents directly
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('Environment file loaded successfully');
  
  // Parse the .env file manually
  const envVars: Record<string, string> = {};
  envContent.split('\n').forEach(line => {
    if (line.trim().startsWith('#') || !line.trim()) return;
    
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      envVars[key.trim()] = value.trim();
    }
  });
  
  // Get Supabase URL and keys
  const supabaseUrl = envVars['SUPABASE_URL'];
  const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];
  
  // Print info
  console.log(`Using Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'missing'}`);
  console.log(`Using SERVICE Key: ${supabaseServiceKey ? 
    `${supabaseServiceKey.substring(0, 5)}...${supabaseServiceKey.substring(supabaseServiceKey.length - 5)}` : 
    'missing'}`);
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or key');
    return;
  }
  
  try {
    // Query for documents needing classification
    const url = `${supabaseUrl}/rest/v1/sources_google?select=id,name,mime_type,path,drive_id&is_deleted=eq.false&document_type_id=is.null&or=(mime_type.eq.application/vnd.openxmlformats-officedocument.wordprocessingml.document,mime_type.eq.text/plain)&limit=5`;
    console.log(`\nQuerying for documents needing classification:\n${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json() as any[];
      console.log(`\n✅ Found ${data.length} documents needing classification:`);
      
      // Print document info
      data.forEach((doc: any, index: number) => {
        console.log(`\nDocument ${index + 1}:`);
        console.log(`ID: ${doc.id}`);
        console.log(`Name: ${doc.name}`);
        console.log(`MIME Type: ${doc.mime_type}`);
        console.log(`Path: ${doc.path}`);
        console.log(`Drive ID: ${doc.drive_id}`);
      });
      
      // Create output directory
      const outputDir = path.resolve(process.cwd(), 'document-analysis-results');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Save results to file
      const outputPath = path.join(outputDir, 'documents-needing-classification.json');
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`\nResults saved to: ${outputPath}`);
    } else {
      console.error('❌ Request failed');
      try {
        const errorText = await response.text();
        console.error('Error details:', errorText);
      } catch (e) {
        console.error('Could not read error details');
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Run the script
findDocumentsNeedingClassification().catch(console.error);