#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function addEmailAddressIdField() {
  console.log('🚀 Adding email_address_id field to email_messages table...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Add the column
    console.log('📝 Adding email_address_id column...');
    const { error: addColumnError } = await supabase.rpc('execute_sql', {
      sql_query: `
        ALTER TABLE email_messages 
        ADD COLUMN IF NOT EXISTS email_address_id UUID REFERENCES email_addresses(id);
      `
    });
    
    if (addColumnError) {
      console.error('❌ Error adding column:', addColumnError);
      return;
    }
    
    // Step 2: Create index
    console.log('📊 Creating index for email_address_id...');
    const { error: indexError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE INDEX IF NOT EXISTS idx_email_messages_email_address_id 
        ON email_messages(email_address_id);
      `
    });
    
    if (indexError) {
      console.error('❌ Error creating index:', indexError);
      return;
    }
    
    // Step 3: Create and execute function to populate existing records
    console.log('🔄 Creating function to populate email_address_id...');
    const { error: functionError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION populate_email_address_ids()
        RETURNS INTEGER AS $$
        DECLARE
            updated_count INTEGER := 0;
        BEGIN
            -- Update email_messages with email_address_id where sender matches email in email_addresses
            UPDATE email_messages 
            SET email_address_id = ea.id
            FROM email_addresses ea 
            WHERE email_messages.sender = ea.email 
            AND email_messages.email_address_id IS NULL;
            
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            
            RAISE NOTICE 'Updated % email messages with email_address_id', updated_count;
            RETURN updated_count;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (functionError) {
      console.error('❌ Error creating function:', functionError);
      return;
    }
    
    // Step 4: Execute the population function
    console.log('🔄 Populating email_address_id for existing records...');
    const { data: populateResult, error: populateError } = await supabase.rpc('populate_email_address_ids');
    
    if (populateError) {
      console.error('❌ Error populating records:', populateError);
      return;
    }
    
    console.log(`✅ Successfully updated ${populateResult} email messages with email_address_id`);
    
    // Step 5: Add comment
    console.log('📝 Adding column documentation...');
    const { error: commentError } = await supabase.rpc('execute_sql', {
      sql_query: `
        COMMENT ON COLUMN email_messages.email_address_id IS 'Foreign key reference to email_addresses table based on sender field lookup';
      `
    });
    
    if (commentError) {
      console.error('❌ Error adding comment:', commentError);
      return;
    }
    
    // Step 6: Verify the results
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
    
    console.log('✅ Sample records with email_address_id populated:');
    console.table(verificationData);
    
    // Get total count
    const { count: totalWithIds, error: countError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .not('email_address_id', 'is', null);
    
    if (!countError) {
      console.log(`📊 Total email messages with email_address_id: ${totalWithIds}`);
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

if (require.main === module) {
  addEmailAddressIdField().catch(console.error);
}