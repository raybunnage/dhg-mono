#!/usr/bin/env ts-node
/**
 * Script to run the classify-pdfs-with-service.ts command with proper environment variables
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables from proper locations
const envPaths = [
  path.resolve(process.cwd(), '.env.development'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'scripts/cli-pipeline/google_sync/.env')
];

// Try loading from each path
console.log("Loading environment variables:");
envPaths.forEach(envPath => {
  if (fs.existsSync(envPath)) {
    console.log(`- Found ${envPath}`);
    dotenv.config({ path: envPath });
  } else {
    console.log(`- Not found: ${envPath}`);
  }
});

// Check if we have the required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in one of the .env files");
  process.exit(1);
}

// Set options for the classify-pdfs-with-service command
const limit = process.argv[2] || '10'; // Default to 10 if not provided
const concurrency = process.argv[3] || '3'; // Default to 3 if not provided

console.log(`\nRunning classify-pdfs-with-service with limit=${limit} and concurrency=${concurrency}`);

// Run the classify-pdfs-with-service.ts script
const script = path.resolve(process.cwd(), 'scripts/cli-pipeline/google_sync/classify-pdfs-with-service.ts');
console.log(`Script path: ${script}`);

// Spawn the process with environment variables
const child = spawn('ts-node', [script, '-l', limit, '-c', concurrency], {
  env: process.env,
  stdio: 'inherit' // Share stdin, stdout, and stderr with the parent process
});

// Handle process events
child.on('error', (err) => {
  console.error(`Error spawning process: ${err.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
  process.exit(code || 0);
});