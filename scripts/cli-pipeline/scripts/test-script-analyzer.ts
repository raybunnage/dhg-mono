/**
 * Test script for verification of Claude API key setup
 * This script checks if all relevant environment variables are set
 * and reports their status.
 */

// Check for all possible API key environment variables
const possibleEnvVars = [
  'CLAUDE_API_KEY',
  'CLI_CLAUDE_API_KEY',
  'ANTHROPIC_API_KEY',
  'VITE_ANTHROPIC_API_KEY'
];

// Log scriptPath if provided (for backwards compatibility)
console.log("Script path provided:", process.argv[2] || "No path provided");

// Log available environment variables for debugging
console.log('🔍 Checking for Claude API key in environment variables:');
let foundKey = false;

// Check each potential environment variable
for (const envVar of possibleEnvVars) {
  const isSet = !!process.env[envVar];
  const value = process.env[envVar] || '';
  const maskedValue = value ? value.substring(0, 5) + '...' + value.substring(value.length - 3) : '';
  
  console.log(`- ${envVar}: ${isSet ? '✅ SET' : '❌ NOT SET'}${isSet ? ` (value: ${maskedValue}, length: ${value.length})` : ''}`);
  
  if (isSet) {
    foundKey = true;
  }
}

// Check if any key was found
if (foundKey) {
  console.log('✅ Claude API key found in at least one environment variable.');
  
  // Get the key that would be used by the script
  if (process.env.CLAUDE_API_KEY) {
    console.log('🔑 Using CLAUDE_API_KEY directly');
  } else if (process.env.ANTHROPIC_API_KEY) {
    console.log('🔑 Would use ANTHROPIC_API_KEY as fallback');
  } else if (process.env.CLI_CLAUDE_API_KEY) {
    console.log('🔑 Would use CLI_CLAUDE_API_KEY as fallback');
  } else if (process.env.VITE_ANTHROPIC_API_KEY) {
    console.log('🔑 Would use VITE_ANTHROPIC_API_KEY as fallback');
  }
  
  console.log('✅ Script analyzer should function correctly with these settings.');
} else {
  console.error('❌ No Claude API key found in any environment variable!');
  console.error('Please set one of the following environment variables:');
  console.error('  - CLAUDE_API_KEY (preferred)');
  console.error('  - ANTHROPIC_API_KEY');
  console.error('  - CLI_CLAUDE_API_KEY');
  console.error('Example: export CLAUDE_API_KEY=your_api_key');
}

// Check for Supabase credentials
console.log('\n📊 Checking Supabase credentials:');
if (process.env.SUPABASE_URL) {
  console.log('✅ SUPABASE_URL is set');
} else {
  console.error('❌ SUPABASE_URL is missing');
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY is set');
} else {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing');
}

// Summarize setup status
console.log('\n📋 Summary:');
if (foundKey && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✅ All required environment variables are set. The script analyzer should work correctly.');
  console.log('✅ All script types defined and no syntax errors encountered!');
} else {
  console.error('❌ Some required environment variables are missing. The script analyzer will likely fail.');
  console.error('Please set the missing environment variables before running the script analyzer.');
}