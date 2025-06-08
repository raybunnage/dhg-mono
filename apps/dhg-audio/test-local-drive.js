#!/usr/bin/env node

// Quick test script to check if local Google Drive is accessible
const fs = require('fs');
const path = require('path');
const os = require('os');
const glob = require('glob');

console.log('🔍 Checking for local Google Drive installation...\n');

const GOOGLE_DRIVE_PATHS = [
  // macOS paths
  path.join(os.homedir(), 'Google Drive'),
  path.join(os.homedir(), 'Library/CloudStorage/GoogleDrive-*'),
  path.join(os.homedir(), 'My Drive'),
  // Windows paths
  path.join(os.homedir(), 'Google Drive'),
  path.join('G:', 'My Drive'),
  // Linux paths
  path.join(os.homedir(), 'GoogleDrive'),
];

let found = false;

// Check each possible path
for (const basePath of GOOGLE_DRIVE_PATHS) {
  if (basePath.includes('*')) {
    // Handle glob patterns
    const matches = glob.sync(basePath);
    if (matches.length > 0) {
      console.log(`✅ Found Google Drive at: ${matches[0]}`);
      
      // Check if we can read the directory
      try {
        const files = fs.readdirSync(matches[0]);
        console.log(`   Contains ${files.length} items`);
        console.log(`   Sample items: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
        found = true;
        break;
      } catch (error) {
        console.log(`   ⚠️  Cannot read directory: ${error.message}`);
      }
    }
  } else if (fs.existsSync(basePath)) {
    console.log(`✅ Found Google Drive at: ${basePath}`);
    
    // Check if we can read the directory
    try {
      const files = fs.readdirSync(basePath);
      console.log(`   Contains ${files.length} items`);
      console.log(`   Sample items: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
      found = true;
      break;
    } catch (error) {
      console.log(`   ⚠️  Cannot read directory: ${error.message}`);
    }
  }
}

// Check environment variable
if (!found && process.env.GOOGLE_DRIVE_PATH) {
  const envPath = process.env.GOOGLE_DRIVE_PATH;
  if (fs.existsSync(envPath)) {
    console.log(`✅ Found Google Drive from GOOGLE_DRIVE_PATH env: ${envPath}`);
    found = true;
  } else {
    console.log(`❌ GOOGLE_DRIVE_PATH set but directory not found: ${envPath}`);
  }
}

if (!found) {
  console.log('❌ Google Drive local folder not found!\n');
  console.log('To use local file serving, you need to:');
  console.log('1. Install Google Drive for Desktop: https://www.google.com/drive/download/');
  console.log('2. Sign in and let it sync your files');
  console.log('3. Or set GOOGLE_DRIVE_PATH environment variable to your Google Drive folder\n');
} else {
  console.log('\n✨ Google Drive is properly configured for local file serving!');
  console.log('The enhanced audio server will be able to serve files directly from disk.');
}

// Check for Supabase configuration
console.log('\n🔍 Checking Supabase configuration...\n');

const dotenv = require('dotenv');
const envPath = fs.existsSync(path.join(__dirname, '../../.env.development')) 
  ? path.join(__dirname, '../../.env.development')
  : path.join(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (supabaseUrl && supabaseKey) {
    console.log(`✅ Supabase credentials found in ${path.basename(envPath)}`);
    console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
    console.log(`   Key: ${supabaseKey.substring(0, 20)}...`);
  } else {
    console.log(`⚠️  Supabase credentials not found in ${path.basename(envPath)}`);
    console.log('   The server will work but cannot look up file paths from the database');
  }
} else {
  console.log('⚠️  No .env file found');
  console.log('   Create .env.development with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

console.log('\n📝 Summary:');
console.log(`   Platform: ${os.platform()}`);
console.log(`   Home directory: ${os.homedir()}`);
console.log(`   Google Drive: ${found ? '✅ Found' : '❌ Not found'}`);
console.log(`   Supabase: ${(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) ? '✅ Configured' : '⚠️  Not configured'}`);
console.log('\nRun "pnpm server:enhanced" to start the enhanced audio server.');