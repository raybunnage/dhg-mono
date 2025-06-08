#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkEmailTables() {
  console.log('🔍 Checking email-related tables...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Check if email_messages table exists
    console.log('📊 Checking email_messages table structure...');
    const { data: emailMessagesColumns, error: emailError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'email_messages'
        ORDER BY ordinal_position;
      `
    });
    
    if (emailError) {
      console.error('❌ Error checking email_messages:', emailError);
      return;
    }
    
    if (emailMessagesColumns && emailMessagesColumns.length > 0) {
      console.log('✅ email_messages table structure:');
      console.table(emailMessagesColumns);
    } else {
      console.log('❌ email_messages table not found');
    }
    
    // Check if email_addresses table exists
    console.log('📊 Checking email_addresses table structure...');
    const { data: emailAddressesColumns, error: addressError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'email_addresses'
        ORDER BY ordinal_position;
      `
    });
    
    if (addressError) {
      console.error('❌ Error checking email_addresses:', addressError);
      return;
    }
    
    if (emailAddressesColumns && emailAddressesColumns.length > 0) {
      console.log('✅ email_addresses table structure:');
      console.table(emailAddressesColumns);
    } else {
      console.log('❌ email_addresses table not found');
    }
    
    // Check record counts
    console.log('📊 Checking record counts...');
    
    const { count: emailMessagesCount, error: messagesCountError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true });
    
    const { count: emailAddressesCount, error: addressesCountError } = await supabase
      .from('email_addresses')
      .select('*', { count: 'exact', head: true });
    
    if (!messagesCountError) {
      console.log(`📧 Email messages count: ${emailMessagesCount || 0}`);
    }
    
    if (!addressesCountError) {
      console.log(`📮 Email addresses count: ${emailAddressesCount || 0}`);
    }
    
    // Show sample data
    if (emailMessagesCount && emailMessagesCount > 0) {
      console.log('📧 Sample email messages:');
      const { data: sampleMessages, error: sampleError } = await supabase
        .from('email_messages')
        .select('id, sender, subject')
        .limit(3);
      
      if (!sampleError && sampleMessages) {
        console.table(sampleMessages);
      }
    }
    
    if (emailAddressesCount && emailAddressesCount > 0) {
      console.log('📮 Sample email addresses:');
      const { data: sampleAddresses, error: sampleAddressError } = await supabase
        .from('email_addresses')
        .select('id, email, name')
        .limit(3);
      
      if (!sampleAddressError && sampleAddresses) {
        console.table(sampleAddresses);
      }
    }
    
    console.log('🎉 Check completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

if (require.main === module) {
  checkEmailTables().catch(console.error);
}