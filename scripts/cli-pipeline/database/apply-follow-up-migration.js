#!/usr/bin/env node
require('dotenv').config({ path: '.env.development' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  console.log('🚀 Follow-up Task Tracking Migration');
  console.log('=====================================\n');

  // Create Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test connection
  console.log('🔗 Testing connection to Supabase...');
  const { error: testError } = await supabase.from('dev_tasks').select('count').limit(1);
  
  if (testError) {
    console.error('❌ Failed to connect to Supabase:', testError.message);
    process.exit(1);
  }
  
  console.log('✅ Connected successfully\n');

  // Check if migration already applied
  console.log('🔍 Checking if migration was already applied...');
  const { data: existingTable, error: checkError } = await supabase
    .from('dev_follow_up_tasks')
    .select('count')
    .limit(1);
    
  if (!checkError) {
    console.log('✅ Migration appears to be already applied!');
    console.log('   Table dev_follow_up_tasks already exists\n');
    
    // Test functions
    console.log('🧪 Testing functions...');
    const { error: funcError } = await supabase.rpc('get_follow_ups', { 
      p_task_id: '00000000-0000-0000-0000-000000000000' 
    });
    
    if (!funcError) {
      console.log('✅ Functions are working correctly');
      console.log('\n🎉 Follow-up tracking system is ready to use!');
      return;
    } else {
      console.log('⚠️  Functions may need to be recreated');
    }
  }

  // Read migration file
  const migrationPath = path.join(__dirname, '../../../supabase/migrations/20250611_add_follow_up_tracking.sql');
  console.log('📖 Reading migration file...');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found at:', migrationPath);
    process.exit(1);
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('✅ Migration file loaded\n');

  // Parse migration into individual statements
  console.log('🔨 Parsing migration statements...');
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 10)
    .map(s => s + ';');
    
  console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

  // Since direct SQL execution isn't available, provide manual instructions
  console.log('⚠️  MANUAL MIGRATION REQUIRED');
  console.log('================================\n');
  
  console.log('The Supabase JavaScript client does not support direct SQL execution.');
  console.log('Please follow these steps to apply the migration:\n');
  
  console.log('1. Copy the migration file contents:');
  console.log('   📄 ' + migrationPath);
  console.log('');
  
  console.log('2. Go to your Supabase Dashboard:');
  console.log('   🔗 https://supabase.com/dashboard/project/' + process.env.SUPABASE_PROJECT_ID);
  console.log('');
  
  console.log('3. Navigate to the SQL Editor tab');
  console.log('');
  
  console.log('4. Paste the entire migration and click "Run"');
  console.log('');
  
  console.log('5. Verify the migration by checking for:');
  console.log('   - Table: dev_follow_up_tasks');
  console.log('   - View: dev_tasks_with_follow_ups_view');
  console.log('   - View: ai_work_summaries_with_follow_ups_view');
  console.log('   - Function: create_follow_up_task_relationship');
  console.log('   - Function: get_follow_ups');
  console.log('');
  
  // Alternative: Try using psql if available
  console.log('🔧 Alternative Method: Using psql (if installed)');
  console.log('================================================\n');
  
  const dbUrl = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${process.env.SUPABASE_PROJECT_ID}.supabase.co:5432/postgres`;
  console.log('Run this command in your terminal:');
  console.log(`psql "${dbUrl}" -f "${migrationPath}"`);
  console.log('');
  
  // Show first few lines of migration for verification
  console.log('📋 Migration Preview:');
  console.log('====================');
  const preview = migrationSQL.split('\n').slice(0, 10).join('\n');
  console.log(preview);
  console.log('... (truncated)\n');
  
  // Save connection string for easy access
  const connInfoPath = path.join(__dirname, 'connection-info.txt');
  fs.writeFileSync(connInfoPath, `Database URL: ${dbUrl}\n\nProject ID: ${process.env.SUPABASE_PROJECT_ID}\n`);
  console.log('💾 Connection info saved to:', connInfoPath);
}

// Run the migration
applyMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});