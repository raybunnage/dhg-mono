#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function populateEmailAddressId() {
  console.log('🔄 Populating email_address_id in email_messages...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Check current state
    console.log('📊 Checking current state...');
    
    const { count: totalMessages, error: totalError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true });
    
    const { count: messagesWithIds, error: withIdsError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .not('email_address_id', 'is', null);
    
    if (!totalError) {
      console.log(`📧 Total email messages: ${totalMessages || 0}`);
    }
    
    if (!withIdsError) {
      console.log(`🔗 Messages with email_address_id: ${messagesWithIds || 0}`);
    }
    
    // Step 2: Check the email_addresses table structure
    console.log('📮 Checking email_addresses table...');
    const { data: sampleAddress, error: addressError } = await supabase
      .from('email_addresses')
      .select('*')
      .limit(1);
    
    if (addressError) {
      console.error('❌ Error accessing email_addresses:', addressError);
      return;
    }
    
    if (sampleAddress && sampleAddress.length > 0) {
      console.log('✅ email_addresses columns:');
      console.log(Object.keys(sampleAddress[0]));
    }
    
    // Step 3: Use a JOIN-based UPDATE approach
    console.log('🔄 Updating email_messages with email_address_id...');
    
    const updateSQL = `
      UPDATE email_messages 
      SET email_address_id = email_addresses.id
      FROM email_addresses 
      WHERE email_addresses.email_address = email_messages.sender
      AND email_messages.email_address_id IS NULL;
    `;
    
    const { error: updateError } = await supabase.rpc('execute_sql', {
      sql_query: updateSQL
    });
    
    if (updateError) {
      console.error('❌ Error updating records:', updateError);
      return;
    }
    
    console.log('✅ Update completed');
    
    // Step 4: Check results
    console.log('🔍 Checking results...');
    
    const { count: updatedMessagesWithIds, error: updatedWithIdsError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .not('email_address_id', 'is', null);
    
    if (!updatedWithIdsError) {
      console.log(`🔗 Messages with email_address_id after update: ${updatedMessagesWithIds || 0}`);
      const newlyUpdated = (updatedMessagesWithIds || 0) - (messagesWithIds || 0);
      console.log(`📈 Newly updated messages: ${newlyUpdated}`);
    }
    
    // Step 5: Show sample results
    console.log('📋 Sample populated records:');
    const { data: sampleResults, error: sampleError } = await supabase
      .from('email_messages')
      .select(`
        id, 
        sender, 
        email_address_id,
        email_addresses!inner(id, email_address)
      `)
      .not('email_address_id', 'is', null)
      .limit(5);
    
    if (!sampleError && sampleResults && sampleResults.length > 0) {
      console.table(sampleResults.map(row => ({
        message_id: row.id.substring(0, 8) + '...',
        sender: row.sender,
        email_address_id: row.email_address_id?.substring(0, 8) + '...',
        matched_email: (row.email_addresses as any)?.email_address
      })));
    }
    
    // Step 6: Show unmatched senders
    console.log('🔍 Checking for unmatched senders...');
    const { data: unmatchedSenders, error: unmatchedError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT DISTINCT em.sender, COUNT(*) as message_count
        FROM email_messages em
        LEFT JOIN email_addresses ea ON ea.email_address = em.sender
        WHERE em.email_address_id IS NULL
        AND ea.id IS NULL
        GROUP BY em.sender
        ORDER BY message_count DESC
        LIMIT 10;
      `
    });
    
    if (!unmatchedError && unmatchedSenders && unmatchedSenders.length > 0) {
      console.log('⚠️ Top unmatched senders:');
      console.table(unmatchedSenders);
    } else {
      console.log('✅ All senders have been matched!');
    }
    
    console.log('🎉 Population process completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

if (require.main === module) {
  populateEmailAddressId().catch(console.error);
}