#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function testConnection() {
  console.log('Testing Gmail pipeline database connection...\n');

  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Test connection by checking email tables
    const tables = [
      'email_important_addresses',
      'email_messages', 
      'email_processed_contents',
      'email_extracted_urls',
      'email_extracted_concepts',
      'email_attachments',
      'email_attachment_pdfs',
      'email_sync_state'
    ];

    console.log('Checking email tables:');
    console.log('=' .repeat(50));
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ERROR - ${error.message}`);
      } else {
        console.log(`✅ ${table}: OK (${count || 0} records)`);
      }
    }

    // Test important addresses specifically
    console.log('\n' + '=' .repeat(50));
    console.log('Important email addresses:');
    const { data: addresses, error: addrError } = await supabase
      .from('email_important_addresses')
      .select('email_address, importance_level')
      .order('email_address');

    if (addrError) {
      console.log('❌ Could not fetch addresses:', addrError.message);
    } else if (!addresses || addresses.length === 0) {
      console.log('⚠️  No important addresses configured');
      console.log('   Add some with: gmail-cli.sh manage-addresses add "email@example.com"');
    } else {
      addresses.forEach((addr: any) => {
        console.log(`   - ${addr.email_address} (importance: ${addr.importance_level || 1})`);
      });
    }

    // Check sync state
    console.log('\n' + '=' .repeat(50));
    console.log('Sync state:');
    const { data: syncState, error: syncError } = await supabase
      .from('email_sync_state')
      .select('*')
      .order('last_sync_time', { ascending: false })
      .limit(1)
      .single();

    if (syncError || !syncState) {
      console.log('⚠️  No sync history found - this appears to be a fresh setup');
    } else {
      console.log(`Last sync: ${syncState.last_sync_time || 'Never'}`);
      console.log(`Messages synced: ${syncState.total_messages_synced || 0}`);
      console.log(`Last page token: ${syncState.last_page_token ? 'Saved' : 'None'}`);
    }

    console.log('\n✅ Database connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    process.exit(1);
  }
}

// Run the test
testConnection().catch(console.error);