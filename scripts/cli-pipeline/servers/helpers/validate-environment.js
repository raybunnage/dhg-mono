#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Validates that required environment variables are loaded
 * for server startup, especially Supabase service role key
 */
function validateServerEnvironment() {
  const projectRoot = path.join(__dirname, '../../../..');
  const envPath = path.join(projectRoot, '.env.development');
  
  // Check if .env.development exists
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env.development file not found');
    console.error(`   Expected at: ${envPath}`);
    process.exit(1);
  }
  
  // Load environment manually if not already loaded
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('📋 Loading environment from .env.development...');
    require('dotenv').config({ path: envPath });
  }
  
  // Check critical environment variables
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\n💡 Please ensure these are set in .env.development');
    process.exit(1);
  }
  
  // Validate service role key format by decoding JWT
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64').toString());
    if (payload.role !== 'service_role') {
      console.warn('⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY is not a service role key');
      console.warn(`   Found role: ${payload.role}, expected: service_role`);
    }
  } catch (e) {
    console.warn('⚠️  Warning: Could not validate JWT format of service role key');
  }
  
  console.log('✅ Environment validated successfully');
  console.log(`   - Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`   - Service Role Key: ${serviceKey.substring(0, 20)}...`);
  
  return true;
}

// Export for use in other scripts
module.exports = { validateServerEnvironment };

// Run if called directly
if (require.main === module) {
  validateServerEnvironment();
}