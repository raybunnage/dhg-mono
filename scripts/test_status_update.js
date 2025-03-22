// Test updating status_recommendation in a few records

const path = require('path');
const fs = require('fs');

// Try to load CLI client service
try {
  const cliPath = path.join(process.cwd(), 'packages/cli/dist/services/supabase-client.js');
  if (fs.existsSync(cliPath)) {
    console.log('Using CLI Supabase client...');
    const { SupabaseClientService } = require(cliPath);
    const clientService = new SupabaseClientService();
    const client = clientService.getClient();
    
    if (!client) {
      console.error('Failed to initialize client');
      process.exit(1);
    }
    
    testStatusUpdate(client);
  } else {
    console.error('CLI client not found at:', cliPath);
    process.exit(1);
  }
} catch (err) {
  console.error('Error initializing:', err);
  process.exit(1);
}

async function testStatusUpdate(client) {
  try {
    // Count records with status_recommendation before update
    const { count: beforeCount, error: beforeError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('status_recommendation', 'is', null);
      
    if (beforeError) {
      console.error('Error checking status count:', beforeError.message);
    } else {
      console.log(`Before update - Records with status_recommendation: ${beforeCount}`);
    }
    
    // Get a few sample records to update
    const { data: samples, error: sampleError } = await client
      .from('documentation_files')
      .select('id, title')
      .is('status_recommendation', null)
      .limit(5);
      
    if (sampleError) {
      console.error('Error fetching samples:', sampleError.message);
      return;
    }
    
    if (!samples || samples.length === 0) {
      console.log('No records found to update');
      return;
    }
    
    console.log(`Found ${samples.length} records to update:`);
    samples.forEach(record => {
      console.log(`- ID: ${record.id}, Title: ${record.title}`);
    });
    
    // Define test status values
    const statusOptions = ['REVIEW', 'KEEP', 'UPDATE', 'ARCHIVE'];
    
    // Update the records with random status values
    console.log('\nUpdating records...');
    for (let i = 0; i < samples.length; i++) {
      const record = samples[i];
      const status = statusOptions[i % statusOptions.length];
      
      const { data, error } = await client
        .from('documentation_files')
        .update({ status_recommendation: status })
        .eq('id', record.id);
        
      if (error) {
        console.error(`Error updating record ${record.id}:`, error.message);
      } else {
        console.log(`Updated record ${record.id} with status: ${status}`);
      }
    }
    
    // Count records with status_recommendation after update
    const { count: afterCount, error: afterError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('status_recommendation', 'is', null);
      
    if (afterError) {
      console.error('Error checking status count:', afterError.message);
    } else {
      console.log(`\nAfter update - Records with status_recommendation: ${afterCount}`);
      console.log(`Updated ${afterCount - beforeCount} records`);
    }
    
    // Verify the updates by fetching the records
    const { data: updated, error: updateError } = await client
      .from('documentation_files')
      .select('id, title, status_recommendation')
      .not('status_recommendation', 'is', null);
      
    if (updateError) {
      console.error('Error fetching updated records:', updateError.message);
    } else if (updated && updated.length > 0) {
      console.log('\nUpdated records:');
      updated.forEach(record => {
        console.log(`- ID: ${record.id}, Title: ${record.title}, Status: ${record.status_recommendation}`);
      });
    }
  } catch (error) {
    console.error('Error in testStatusUpdate:', error);
  }
}