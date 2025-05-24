#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function verifyEmailAllowlistMigration() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Verifying Email Allowlist Authentication Migration...\n');

  // Test 1: Check if is_email_allowed function exists and works
  console.log('1. Testing is_email_allowed function:');
  try {
    // Test with a non-allowed email
    const { data: notAllowed, error: error1 } = await supabase
      .rpc('is_email_allowed', { email_input: 'test@example.com' });
    
    if (error1) {
      console.error('   ❌ Error calling is_email_allowed:', error1.message);
    } else {
      console.log(`   ✅ is_email_allowed('test@example.com') returned: ${notAllowed}`);
      if (notAllowed === false) {
        console.log('   ✅ Function correctly returns false for non-allowed email');
      }
    }

    // Test with an allowed email (if any exist)
    const { data: allowedEmails, error: listError } = await supabase
      .from('allowed_emails')
      .select('email')
      .limit(1);
    
    if (!listError && allowedEmails && allowedEmails.length > 0) {
      const testEmail = allowedEmails[0].email;
      const { data: isAllowed, error: error2 } = await supabase
        .rpc('is_email_allowed', { email_input: testEmail });
      
      if (!error2) {
        console.log(`   ✅ is_email_allowed('${testEmail}') returned: ${isAllowed}`);
        if (isAllowed === true) {
          console.log('   ✅ Function correctly returns true for allowed email');
        }
      }
    }
  } catch (error) {
    console.error('   ❌ Failed to test is_email_allowed function:', error);
  }

  // Test 2: Check if allowed_emails table exists
  console.log('\n2. Checking allowed_emails table:');
  try {
    const { data, error, count } = await supabase
      .from('allowed_emails')
      .select('*', { count: 'exact', head: false })
      .limit(5);
    
    if (error) {
      console.error('   ❌ Error accessing allowed_emails table:', error.message);
    } else {
      console.log(`   ✅ allowed_emails table exists with ${count || 0} entries`);
      if (data && data.length > 0) {
        console.log('   Sample entries:');
        data.forEach(entry => {
          console.log(`     - ${entry.email} (active: ${entry.is_active})`);
        });
      }
    }
  } catch (error) {
    console.error('   ❌ Failed to check allowed_emails table:', error);
  }

  // Test 3: Check user_profiles table for professional columns
  console.log('\n3. Checking user_profiles table for professional columns:');
  try {
    // Get table schema information
    const { data: columns, error } = await supabase
      .rpc('table_inspector', { target_table: 'user_profiles' });
    
    if (error) {
      // If table_inspector doesn't exist, try a different approach
      const { data: sampleData, error: sampleError } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        console.error('   ❌ Error accessing user_profiles table:', sampleError.message);
      } else {
        console.log('   ✅ user_profiles table exists');
        if (sampleData && sampleData.length > 0) {
          const professionalColumns = [
            'profession',
            'organization',
            'role',
            'bio',
            'location',
            'website'
          ];
          
          const sampleKeys = Object.keys(sampleData[0]);
          console.log('   Checking for professional columns:');
          
          professionalColumns.forEach(col => {
            if (sampleKeys.includes(col)) {
              console.log(`     ✅ ${col} column exists`);
            } else {
              console.log(`     ❌ ${col} column NOT found`);
            }
          });
        }
      }
    } else {
      console.log('   ✅ Retrieved table schema using table_inspector');
      const professionalColumns = ['profession', 'organization', 'role', 'bio', 'location', 'website'];
      
      if (columns && Array.isArray(columns)) {
        professionalColumns.forEach(colName => {
          const column = columns.find((c: any) => c.column_name === colName);
          if (column) {
            console.log(`     ✅ ${colName} column exists (type: ${column.data_type})`);
          } else {
            console.log(`     ❌ ${colName} column NOT found`);
          }
        });
      }
    }
  } catch (error) {
    console.error('   ❌ Failed to check user_profiles columns:', error);
  }

  // Test 4: Check if add_allowed_email function exists
  console.log('\n4. Testing add_allowed_email function:');
  try {
    // Try to call with a test email (we'll roll back)
    const testEmail = `test-${Date.now()}@example.com`;
    const { data, error } = await supabase
      .rpc('add_allowed_email', { 
        email: testEmail,
        added_by: 'migration-test',
        note: 'Testing migration - will be removed'
      });
    
    if (error) {
      console.error('   ❌ Error calling add_allowed_email:', error.message);
    } else {
      console.log('   ✅ add_allowed_email function exists and executed successfully');
      
      // Clean up test email
      const { error: deleteError } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('email', testEmail);
      
      if (!deleteError) {
        console.log('   ✅ Test email cleaned up successfully');
      }
    }
  } catch (error) {
    console.error('   ❌ Failed to test add_allowed_email function:', error);
  }

  console.log('\n✅ Migration verification complete!');
}

// Run the verification
verifyEmailAllowlistMigration().catch(console.error);