#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function addEmailAddressIdSimple() {
  console.log('🚀 Adding email_address_id field to email_messages (simple approach)...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Check current table structure by selecting from the table
    console.log('📊 Checking current table structure...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('email_messages')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error accessing email_messages:', sampleError);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('✅ Current email_messages columns:');
      console.log(Object.keys(sampleData[0]));
      
      // Check if email_address_id already exists
      if ('email_address_id' in sampleData[0]) {
        console.log('⚠️ email_address_id column already exists');
      } else {
        console.log('📝 email_address_id column needs to be added');
      }
    }
    
    // Step 2: Try to add the column using ALTER TABLE
    console.log('📝 Adding email_address_id column...');
    const addColumnSQL = `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'email_messages' 
          AND column_name = 'email_address_id'
        ) THEN
          ALTER TABLE email_messages 
          ADD COLUMN email_address_id UUID REFERENCES email_addresses(id);
          
          CREATE INDEX IF NOT EXISTS idx_email_messages_email_address_id 
          ON email_messages(email_address_id);
          
          RAISE NOTICE 'Added email_address_id column to email_messages';
        ELSE
          RAISE NOTICE 'email_address_id column already exists';
        END IF;
      END $$;
    `;
    
    const { error: addColumnError } = await supabase.rpc('execute_sql', {
      sql_query: addColumnSQL
    });
    
    if (addColumnError) {
      console.error('❌ Error adding column:', addColumnError);
      return;
    }
    
    console.log('✅ Column addition completed');
    
    // Step 3: Populate the email_address_id field
    console.log('🔄 Populating email_address_id field...');
    const updateSQL = `
      UPDATE email_messages 
      SET email_address_id = (
        SELECT ea.id 
        FROM email_addresses ea 
        WHERE ea.email = email_messages.sender
        LIMIT 1
      )
      WHERE email_address_id IS NULL
      AND EXISTS (
        SELECT 1 FROM email_addresses ea 
        WHERE ea.email = email_messages.sender
      );
    `;
    
    const { error: updateError } = await supabase.rpc('execute_sql', {
      sql_query: updateSQL
    });
    
    if (updateError) {
      console.error('❌ Error updating records:', updateError);
      return;
    }
    
    console.log('✅ Population completed');
    
    // Step 4: Verify results
    console.log('🔍 Verifying results...');
    
    // Check updated table structure
    const { data: updatedSample, error: updatedError } = await supabase
      .from('email_messages')
      .select('*')
      .limit(1);
    
    if (!updatedError && updatedSample && updatedSample.length > 0) {
      console.log('✅ Updated email_messages columns:');
      console.log(Object.keys(updatedSample[0]));
    }
    
    // Count records with email_address_id
    const { count: totalWithIds, error: countError } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true })
      .not('email_address_id', 'is', null);
    
    if (!countError) {
      console.log(`📊 Email messages with email_address_id populated: ${totalWithIds || 0}`);
    }
    
    // Show sample populated records
    const { data: samplePopulated, error: samplePopulatedError } = await supabase
      .from('email_messages')
      .select('id, sender, email_address_id, email_addresses(email)')
      .not('email_address_id', 'is', null)
      .limit(5);
    
    if (!samplePopulatedError && samplePopulated && samplePopulated.length > 0) {
      console.log('✅ Sample populated records:');
      console.table(samplePopulated);
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

if (require.main === module) {
  addEmailAddressIdSimple().catch(console.error);
}