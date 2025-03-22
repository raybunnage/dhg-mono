// Apply status recommendations to all records in documentation_files using Supabase client directly

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
    
    applyStatusRecommendations(client);
  } else {
    console.error('CLI client not found at:', cliPath);
    process.exit(1);
  }
} catch (err) {
  console.error('Error initializing:', err);
  process.exit(1);
}

async function applyStatusRecommendations(client) {
  try {
    console.log('Applying status recommendations to all records...');
    
    // Count total records
    const { count: totalCount, error: countError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('Error checking total records:', countError.message);
      return;
    }
    
    console.log(`Total records: ${totalCount}`);
    
    // Count records already with status_recommendation
    const { count: existingCount, error: existingError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('status_recommendation', 'is', null);
      
    if (existingError) {
      console.error('Error checking existing status:', existingError.message);
      return;
    }
    
    console.log(`Records already with status_recommendation: ${existingCount}`);
    console.log(`Records needing status_recommendation: ${totalCount - existingCount}`);
    
    // Apply status recommendations based on different criteria
    console.log('\nApplying status recommendations...');
    
    // 1. Set REVIEW status for older documents (created more than 90 days ago)
    console.log('Setting REVIEW for old documents...');
    const { data: oldData, error: oldError } = await client
      .from('documentation_files')
      .update({ status_recommendation: 'REVIEW' })
      .is('status_recommendation', null)
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
      
    if (oldError) {
      console.error('Error setting REVIEW for old documents:', oldError.message);
    } else {
      console.log(`Set REVIEW status for old documents: ${oldData?.length || 0} records updated`);
    }
    
    // 2. Set KEEP for README files
    console.log('Setting KEEP for README files...');
    const { data: readmeData, error: readmeError } = await client
      .from('documentation_files')
      .update({ status_recommendation: 'KEEP' })
      .is('status_recommendation', null)
      .or('title.ilike.%README%,title.eq.README.md,file_path.ilike.%/README.md%');
      
    if (readmeError) {
      console.error('Error setting KEEP for README files:', readmeError.message);
    } else {
      console.log(`Set KEEP status for README files: ${readmeData?.length || 0} records updated`);
    }
    
    // 3. Set UPDATE for documents with "test" in the title
    console.log('Setting UPDATE for test documents...');
    const { data: testData, error: testError } = await client
      .from('documentation_files')
      .update({ status_recommendation: 'UPDATE' })
      .is('status_recommendation', null)
      .or('title.ilike.%test%,file_path.ilike.%/test%');
      
    if (testError) {
      console.error('Error setting UPDATE for test documents:', testError.message);
    } else {
      console.log(`Set UPDATE status for test documents: ${testData?.length || 0} records updated`);
    }
    
    // 4. Set ARCHIVE for license files and old archives
    console.log('Setting ARCHIVE for license files and archives...');
    const { data: archiveData, error: archiveError } = await client
      .from('documentation_files')
      .update({ status_recommendation: 'ARCHIVE' })
      .is('status_recommendation', null)
      .or('title.ilike.%LICENSE%,file_path.ilike.%/_archive/%,file_path.ilike.%/archive/%');
      
    if (archiveError) {
      console.error('Error setting ARCHIVE for license files and archives:', archiveError.message);
    } else {
      console.log(`Set ARCHIVE status for license files and archives: ${archiveData?.length || 0} records updated`);
    }
    
    // 5. Set remaining records to REVIEW
    console.log('Setting REVIEW for remaining documents...');
    const { data: remainingData, error: remainingError } = await client
      .from('documentation_files')
      .update({ status_recommendation: 'REVIEW' })
      .is('status_recommendation', null);
      
    if (remainingError) {
      console.error('Error setting REVIEW for remaining documents:', remainingError.message);
    } else {
      console.log(`Set REVIEW status for remaining documents: ${remainingData?.length || 0} records updated`);
    }
    
    // Get final count of records with status_recommendation
    const { count: finalCount, error: finalError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('status_recommendation', 'is', null);
      
    if (finalError) {
      console.error('Error checking final count:', finalError.message);
    } else {
      console.log(`\nFinal count of records with status_recommendation: ${finalCount} (${Math.round((finalCount / totalCount) * 100)}%)`);
    }
    
    // Get distribution of status values
    const { data: distribution, error: distError } = await client
      .from('documentation_files')
      .select('status_recommendation, count')
      .select('status_recommendation')
      .not('status_recommendation', 'is', null)
      .order('status_recommendation');
      
    if (distError) {
      console.error('Error getting status distribution:', distError.message);
    } else {
      const grouped = {};
      distribution.forEach(item => {
        grouped[item.status_recommendation] = (grouped[item.status_recommendation] || 0) + 1;
      });
      
      console.log('\nStatus recommendation distribution:');
      Object.entries(grouped).forEach(([status, count]) => {
        console.log(`${status}: ${count} (${Math.round((count / finalCount) * 100)}%)`);
      });
      
      // Also show records with NULL
      const { count: nullCount } = await client
        .from('documentation_files')
        .select('*', { count: 'exact', head: true })
        .is('status_recommendation', null);
        
      if (nullCount > 0) {
        console.log(`NULL: ${nullCount} (${Math.round((nullCount / totalCount) * 100)}%)`);
      }
    }
    
    console.log('\nStatus recommendation application complete!');
  } catch (error) {
    console.error('Error in applyStatusRecommendations:', error);
  }
}