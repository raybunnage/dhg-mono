#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function verifyEmailAddressIdField() {
  console.log('🔍 Verifying email_address_id field...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Check if the column exists by querying the table structure
    console.log('📊 Checking table structure...');
    const { data: columns, error: columnsError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'email_messages' 
        AND column_name = 'email_address_id';
      `
    });
    
    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError);
      return;
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ email_address_id column exists:');
      console.table(columns);
    } else {
      console.log('❌ email_address_id column not found');
      return;
    }
    
    // Try to populate the data using a direct SQL UPDATE
    console.log('🔄 Populating email_address_id using direct update...');
    const { data: updateResult, error: updateError } = await supabase.rpc('execute_sql', {
      sql_query: `
        WITH updated_rows AS (
          UPDATE email_messages 
          SET email_address_id = ea.id
          FROM email_addresses ea 
          WHERE email_messages.sender = ea.email 
          AND email_messages.email_address_id IS NULL
          RETURNING email_messages.id
        )
        SELECT COUNT(*) as updated_count FROM updated_rows;
      `
    });
    
    if (updateError) {
      console.error('❌ Error updating records:', updateError);
      return;
    }
    
    console.log(`✅ Updated ${updateResult?.[0]?.updated_count || 0} email messages with email_address_id`);
    
    // Verify the results
    console.log('🔍 Verifying results...');
    const { data: verificationData, error: verificationError } = await supabase
      .from('email_messages')
      .select('id, sender, email_address_id')
      .not('email_address_id', 'is', null)
      .limit(5);
    
    if (verificationError) {
      console.error('❌ Error verifying results:', verificationError);
      return;
    }
    
    if (verificationData && verificationData.length > 0) {
      console.log('✅ Sample records with email_address_id populated:');
      console.table(verificationData);
    } else {
      console.log('⚠️ No records found with email_address_id populated');
    }
    
    // Get total counts
    const { count: totalMessages, error: countError1 } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalWithIds, error: countError2 } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .not('email_address_id', 'is', null);
    
    if (!countError1 && !countError2 && totalMessages !== null) {
      console.log(`📊 Total email messages: ${totalMessages}`);
      console.log(`📊 Email messages with email_address_id: ${totalWithIds || 0}`);
      console.log(`📊 Percentage populated: ${totalMessages > 0 ? ((totalWithIds || 0) / totalMessages * 100).toFixed(1) : 0}%`);
    }
    
    console.log('🎉 Verification completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

if (require.main === module) {
  verifyEmailAddressIdField().catch(console.error);
}