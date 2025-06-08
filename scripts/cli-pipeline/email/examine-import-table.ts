#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function examineImportTable() {
  console.log('🔍 Examining import_important_email_addresses table...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Check if the table exists and get sample data
    const { data: sampleData, error: sampleError } = await supabase
      .from('import_important_email_addresses')
      .select('*')
      .limit(5);
    
    if (sampleError) {
      console.error('❌ Error accessing import_important_email_addresses:', sampleError);
      return;
    }
    
    if (sampleData && sampleData.length > 0) {
      console.log('✅ import_important_email_addresses table found');
      console.log('📋 Table columns:');
      console.log(Object.keys(sampleData[0]));
      
      console.log('📊 Sample data:');
      console.table(sampleData);
    } else {
      console.log('⚠️ import_important_email_addresses table exists but has no data');
    }
    
    // Get record count
    const { count: totalCount, error: countError } = await supabase
      .from('import_important_email_addresses')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`📊 Total records in import_important_email_addresses: ${totalCount || 0}`);
    }
    
    // Check for records with is_important = true
    const { count: importantCount, error: importantError } = await supabase
      .from('import_important_email_addresses')
      .select('*', { count: 'exact', head: true })
      .eq('is_important', true);
    
    if (!importantError) {
      console.log(`⭐ Records with is_important = true: ${importantCount || 0}`);
    }
    
    // Check the email_addresses table for comparison
    console.log('📮 Checking email_addresses table for comparison...');
    
    const { data: emailAddrSample, error: emailAddrError } = await supabase
      .from('email_addresses')
      .select('*')
      .limit(3);
    
    if (!emailAddrError && emailAddrSample && emailAddrSample.length > 0) {
      console.log('📋 email_addresses table columns:');
      console.log(Object.keys(emailAddrSample[0]));
      
      // Check if legacy_id or is_important fields already exist
      const hasLegacyId = 'legacy_id' in emailAddrSample[0];
      const hasIsImportant = 'is_important' in emailAddrSample[0];
      
      console.log(`🔍 legacy_id field exists: ${hasLegacyId}`);
      console.log(`🔍 is_important field exists: ${hasIsImportant}`);
    }
    
    // Check for email overlap between tables
    console.log('🔗 Checking email overlap between tables...');
    
    const { data: overlapData, error: overlapError } = await supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          COUNT(DISTINCT iea.email_address) as import_emails,
          COUNT(DISTINCT ea.email_address) as existing_emails,
          COUNT(DISTINCT CASE WHEN ea.email_address IS NOT NULL THEN iea.email_address END) as matching_emails
        FROM import_important_email_addresses iea
        LEFT JOIN email_addresses ea ON ea.email_address = iea.email_address;
      `
    });
    
    if (!overlapError && overlapData && overlapData.length > 0) {
      console.log('📊 Email overlap analysis:');
      console.table(overlapData);
    }
    
    console.log('🎉 Table examination completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

if (require.main === module) {
  examineImportTable().catch(console.error);
}