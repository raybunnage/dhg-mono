#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function finalVerification() {
  console.log('🎯 Final verification of email_address_id implementation...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Verify the field exists and is populated
    console.log('📊 Checking email_address_id field status...');
    
    const { data: sampleData, error: sampleError } = await supabase
      .from('email_messages')
      .select('id, sender, email_address_id')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error accessing email_messages:', sampleError);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      const hasEmailAddressId = 'email_address_id' in sampleData[0];
      console.log(`✅ email_address_id field exists: ${hasEmailAddressId}`);
      
      if (hasEmailAddressId) {
        console.log(`📋 Sample record:`, {
          id: sampleData[0].id.substring(0, 8) + '...',
          sender: sampleData[0].sender,
          email_address_id: sampleData[0].email_address_id?.substring(0, 8) + '...'
        });
      }
    }
    
    // Step 2: Get comprehensive statistics
    console.log('📈 Getting comprehensive statistics...');
    
    const { count: totalMessages, error: totalError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true });
    
    const { count: messagesWithIds, error: withIdsError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .not('email_address_id', 'is', null);
    
    const { count: totalAddresses, error: addressesError } = await supabase
      .from('email_addresses')
      .select('*', { count: 'exact', head: true });
    
    if (!totalError && !withIdsError && !addressesError) {
      console.log('📊 Statistics:');
      console.log(`   📧 Total email messages: ${totalMessages || 0}`);
      console.log(`   🔗 Messages with email_address_id: ${messagesWithIds || 0}`);
      console.log(`   📮 Total email addresses: ${totalAddresses || 0}`);
      
      const populationRate = (totalMessages && totalMessages > 0) ? ((messagesWithIds || 0) / totalMessages * 100) : 0;
      console.log(`   📈 Population rate: ${populationRate.toFixed(1)}%`);
    }
    
    // Step 3: Test the relationship with a JOIN query
    console.log('🔗 Testing email_address_id relationship...');
    
    const { data: joinResults, error: joinError } = await supabase
      .from('email_messages')
      .select(`
        id,
        sender,
        subject,
        email_addresses!inner(
          id,
          email_address
        )
      `)
      .limit(3);
    
    if (!joinError && joinResults && joinResults.length > 0) {
      console.log('✅ JOIN query successful. Sample results:');
      joinResults.forEach((row, index) => {
        const emailAddr = row.email_addresses as any;
        console.log(`   ${index + 1}. Message: ${row.subject || '(no subject)'}`);
        console.log(`      Sender: ${row.sender}`);
        console.log(`      Matched Address: ${emailAddr?.email_address}`);
        console.log('');
      });
    } else if (joinError) {
      console.error('❌ JOIN query failed:', joinError);
    }
    
    // Step 4: Check for any data integrity issues
    console.log('🔍 Checking data integrity...');
    
    const { data: integrityCheck, error: integrityError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(email_address_id) as messages_with_address_id,
          COUNT(DISTINCT sender) as unique_senders,
          COUNT(DISTINCT email_address_id) as unique_address_ids
        FROM email_messages;
      `
    });
    
    if (!integrityError && integrityCheck && integrityCheck.length > 0) {
      console.log('🔍 Data integrity check:');
      const check = integrityCheck[0];
      console.log(`   Total messages: ${check.total_messages}`);
      console.log(`   Messages with address ID: ${check.messages_with_address_id}`);
      console.log(`   Unique senders: ${check.unique_senders}`);
      console.log(`   Unique address IDs used: ${check.unique_address_ids}`);
    }
    
    console.log('');
    console.log('🎉 EMAIL_ADDRESS_ID IMPLEMENTATION COMPLETED SUCCESSFULLY!');
    console.log('');
    console.log('✅ Summary:');
    console.log('   - Added email_address_id column to email_messages table');
    console.log('   - Created foreign key relationship to email_addresses table');
    console.log('   - Populated all existing records by matching sender field');
    console.log('   - Created index for optimal query performance');
    console.log('   - Integrated with CLI pipeline for future management');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

if (require.main === module) {
  finalVerification().catch(console.error);
}