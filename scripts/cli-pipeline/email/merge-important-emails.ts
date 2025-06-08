#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function mergeImportantEmails() {
  console.log('🔄 Merging import_important_email_addresses data with email_addresses...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Step 1: Add legacy_id column
    console.log('📝 Adding legacy_id column to email_addresses...');
    const { error: addColumnError } = await supabase.rpc('execute_sql', {
      sql_query: `
        ALTER TABLE email_addresses 
        ADD COLUMN IF NOT EXISTS legacy_id INTEGER;
      `
    });
    
    if (addColumnError) {
      console.error('❌ Error adding legacy_id column:', addColumnError);
      return;
    }
    
    // Step 2: Create index
    console.log('📊 Creating index for legacy_id...');
    const { error: indexError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE INDEX IF NOT EXISTS idx_email_addresses_legacy_id 
        ON email_addresses(legacy_id);
      `
    });
    
    if (indexError) {
      console.error('❌ Error creating index:', indexError);
      return;
    }
    
    // Step 3: Check current state before merge
    console.log('📊 Checking current state before merge...');
    
    const { count: totalEmails, error: totalError } = await supabase
      .from('email_addresses')
      .select('*', { count: 'exact', head: true });
    
    const { count: currentImportant, error: currentError } = await supabase
      .from('email_addresses')
      .select('*', { count: 'exact', head: true })
      .eq('is_important', true);
    
    if (!totalError && !currentError) {
      console.log(`📧 Total email addresses: ${totalEmails || 0}`);
      console.log(`⭐ Currently marked as important: ${currentImportant || 0}`);
    }
    
    // Step 4: Execute the merge
    console.log('🔄 Executing merge operation...');
    const { error: mergeError } = await supabase.rpc('execute_sql', {
      sql_query: `
        UPDATE email_addresses 
        SET 
          legacy_id = iea.important_email_address_id,
          is_important = COALESCE(iea.is_important, false)
        FROM import_important_email_addresses iea 
        WHERE email_addresses.email_address = iea.email_address;
      `
    });
    
    if (mergeError) {
      console.error('❌ Error executing merge:', mergeError);
      return;
    }
    
    console.log('✅ Merge operation completed');
    
    // Step 5: Verify results
    console.log('🔍 Verifying merge results...');
    
    const { count: afterImportant, error: afterError } = await supabase
      .from('email_addresses')
      .select('*', { count: 'exact', head: true })
      .eq('is_important', true);
    
    const { count: withLegacyId, error: legacyError } = await supabase
      .from('email_addresses')
      .select('*', { count: 'exact', head: true })
      .not('legacy_id', 'is', null);
    
    if (!afterError && !legacyError) {
      console.log(`⭐ Email addresses marked as important after merge: ${afterImportant || 0}`);
      console.log(`🏷️ Email addresses with legacy_id populated: ${withLegacyId || 0}`);
      
      const newlyImportant = (afterImportant || 0) - (currentImportant || 0);
      console.log(`📈 Newly marked as important: ${newlyImportant}`);
    }
    
    // Step 6: Show sample merged records
    console.log('📋 Sample merged records:');
    const { data: sampleResults, error: sampleError } = await supabase
      .from('email_addresses')
      .select('id, email_address, is_important, legacy_id')
      .not('legacy_id', 'is', null)
      .limit(10);
    
    if (!sampleError && sampleResults && sampleResults.length > 0) {
      console.table(sampleResults.map(row => ({
        id: row.id.substring(0, 8) + '...',
        email_address: row.email_address,
        is_important: row.is_important,
        legacy_id: row.legacy_id
      })));
    }
    
    // Step 7: Show important emails specifically
    console.log('⭐ Important email addresses:');
    const { data: importantResults, error: importantResultsError } = await supabase
      .from('email_addresses')
      .select('email_address, legacy_id')
      .eq('is_important', true)
      .not('legacy_id', 'is', null)
      .limit(15);
    
    if (!importantResultsError && importantResults && importantResults.length > 0) {
      console.table(importantResults);
    }
    
    // Step 8: Check for unmatched import records
    console.log('🔍 Checking for unmatched import records...');
    const { data: unmatchedData, error: unmatchedError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT iea.important_email_address_id, iea.email_address, iea.is_important
        FROM import_important_email_addresses iea
        LEFT JOIN email_addresses ea ON ea.email_address = iea.email_address
        WHERE ea.id IS NULL
        ORDER BY iea.is_important DESC NULLS LAST, iea.important_email_address_id
        LIMIT 10;
      `
    });
    
    if (!unmatchedError && unmatchedData && unmatchedData.length > 0) {
      console.log('⚠️ Unmatched import records (not found in email_addresses):');
      console.table(unmatchedData);
    } else {
      console.log('✅ All import records have been matched!');
    }
    
    // Step 9: Add documentation comment
    console.log('📝 Adding column documentation...');
    const { error: commentError } = await supabase.rpc('execute_sql', {
      sql_query: `
        COMMENT ON COLUMN email_addresses.legacy_id IS 'Legacy ID from import_important_email_addresses.important_email_address_id for data traceability';
      `
    });
    
    if (commentError) {
      console.error('❌ Error adding comment:', commentError);
    }
    
    console.log('🎉 Important email addresses merge completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

if (require.main === module) {
  mergeImportantEmails().catch(console.error);
}