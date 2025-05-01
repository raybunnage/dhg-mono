import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from './packages/shared/services/supabase-client';
import { claudeService } from './packages/shared/services/claude-service/claude-service';

const DOCUMENT_ID = '7487db13-5979-430d-a4f4-d7b31c3d98f6';

async function run() {
  try {
    console.log('Starting test script');
    console.log('Current directory:', process.cwd());
    
    // Test file writing
    const testFilePath = path.join(process.cwd(), 'test-file-output.txt');
    console.log(`Writing test file to: ${testFilePath}`);
    
    try {
      fs.writeFileSync(testFilePath, 'Test content');
      console.log('Successfully wrote test file');
    } catch (writeError) {
      console.error('Error writing test file:', writeError);
    }
    
    // Test Supabase connection
    console.log('Testing Supabase connection...');
    
    try {
      const supabase = SupabaseClientService.getInstance().getClient();
      const { data, error } = await supabase
        .from('expert_documents')
        .select('id, title')
        .eq('id', DOCUMENT_ID)
        .single();
        
      if (error) {
        console.error('Supabase query error:', error);
      } else {
        console.log('Supabase query successful:', data);
      }
    } catch (supabaseError) {
      console.error('Supabase connection error:', supabaseError);
    }
    
    // Test Claude service
    console.log('Testing Claude service...');
    
    try {
      const response = await claudeService.sendPrompt('Say "Hello, world!"');
      console.log('Claude response:', response);
      
      // Write response to file
      const claudeOutputPath = path.join(process.cwd(), 'claude-output.txt');
      console.log(`Writing Claude output to: ${claudeOutputPath}`);
      fs.writeFileSync(claudeOutputPath, response);
      console.log('Successfully wrote Claude output');
    } catch (claudeError) {
      console.error('Claude service error:', claudeError);
    }
    
    console.log('Test script completed');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the test
run();