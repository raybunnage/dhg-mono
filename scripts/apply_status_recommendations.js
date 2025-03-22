// Apply status recommendations to all records in documentation_files

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
    
    // Apply status recommendations based on different criteria
    console.log('\nApplying status recommendations...');
    
    // 1. Set REVIEW status for older documents (created more than 90 days ago)
    console.log('Setting REVIEW for old documents...');
    
    // First run the update
    const { error: updateOldError } = await client.rpc('execute_sql', {
      sql: `
        UPDATE documentation_files
        SET status_recommendation = 'REVIEW'
        WHERE status_recommendation IS NULL
        AND created_at < NOW() - INTERVAL '90 days'
      `
    });
    
    if (updateOldError) {
      console.error('Error setting REVIEW for old documents:', updateOldError.message);
    } else {
      // Then check counts after update
      const { data: oldData, error: oldCountError } = await client.rpc('execute_sql', {
        sql: `SELECT COUNT(*) as count FROM documentation_files WHERE status_recommendation = 'REVIEW'`
      });
      
      if (oldCountError) {
        console.error('Error counting REVIEW records:', oldCountError.message);
      } else if (oldData && oldData.length > 0) {
        console.log(`Set REVIEW status for old documents: ${oldData[0].count} records`);
      }
    }
    
    // 2. Set KEEP for README files
    console.log('Setting KEEP for README files...');
    
    // First run the update
    const { error: updateReadmeError } = await client.rpc('execute_sql', {
      sql: `
        UPDATE documentation_files
        SET status_recommendation = 'KEEP'
        WHERE status_recommendation IS NULL
        AND (
          title ILIKE '%README%' OR
          title = 'README.md' OR
          file_path ILIKE '%/README.md'
        )
      `
    });
    
    if (updateReadmeError) {
      console.error('Error setting KEEP for README files:', updateReadmeError.message);
    } else {
      // Then check counts after update
      const { data: readmeData, error: readmeCountError } = await client.rpc('execute_sql', {
        sql: `SELECT COUNT(*) as count FROM documentation_files WHERE status_recommendation = 'KEEP'`
      });
      
      if (readmeCountError) {
        console.error('Error counting KEEP records:', readmeCountError.message);
      } else if (readmeData && readmeData.length > 0) {
        console.log(`Set KEEP status for README files: ${readmeData[0].count} records`);
      }
    }
    
    // 3. Set UPDATE for documents with "test" in the title
    console.log('Setting UPDATE for test documents...');
    
    // First run the update
    const { error: updateTestError } = await client.rpc('execute_sql', {
      sql: `
        UPDATE documentation_files
        SET status_recommendation = 'UPDATE'
        WHERE status_recommendation IS NULL
        AND (
          title ILIKE '%test%' OR
          file_path ILIKE '%/test%'
        )
      `
    });
    
    if (updateTestError) {
      console.error('Error setting UPDATE for test documents:', updateTestError.message);
    } else {
      // Then check counts after update
      const { data: testData, error: testCountError } = await client.rpc('execute_sql', {
        sql: `SELECT COUNT(*) as count FROM documentation_files WHERE status_recommendation = 'UPDATE'`
      });
      
      if (testCountError) {
        console.error('Error counting UPDATE records:', testCountError.message);
      } else if (testData && testData.length > 0) {
        console.log(`Set UPDATE status for test documents: ${testData[0].count} records`);
      }
    }
    
    // 4. Set ARCHIVE for license files and old archives
    console.log('Setting ARCHIVE for license files and archives...');
    
    // First run the update
    const { error: updateArchiveError } = await client.rpc('execute_sql', {
      sql: `
        UPDATE documentation_files
        SET status_recommendation = 'ARCHIVE'
        WHERE status_recommendation IS NULL
        AND (
          title ILIKE '%LICENSE%' OR
          file_path ILIKE '%/_archive/%' OR
          file_path ILIKE '%/archive/%'
        )
      `
    });
    
    if (updateArchiveError) {
      console.error('Error setting ARCHIVE for license files and archives:', updateArchiveError.message);
    } else {
      // Then check counts after update
      const { data: archiveData, error: archiveCountError } = await client.rpc('execute_sql', {
        sql: `SELECT COUNT(*) as count FROM documentation_files WHERE status_recommendation = 'ARCHIVE'`
      });
      
      if (archiveCountError) {
        console.error('Error counting ARCHIVE records:', archiveCountError.message);
      } else if (archiveData && archiveData.length > 0) {
        console.log(`Set ARCHIVE status for license files and archives: ${archiveData[0].count} records`);
      }
    }
    
    // 5. Set remaining records to REVIEW
    console.log('Setting REVIEW for remaining documents...');
    
    // First run the update
    const { error: updateRemainingError } = await client.rpc('execute_sql', {
      sql: `
        UPDATE documentation_files
        SET status_recommendation = 'REVIEW'
        WHERE status_recommendation IS NULL
      `
    });
    
    if (updateRemainingError) {
      console.error('Error setting REVIEW for remaining documents:', updateRemainingError.message);
    } else {
      // Then check counts after update
      const { data: remainingData, error: remainingCountError } = await client.rpc('execute_sql', {
        sql: `SELECT COUNT(*) as count FROM documentation_files WHERE status_recommendation = 'REVIEW'`
      });
      
      if (remainingCountError) {
        console.error('Error counting REVIEW records:', remainingCountError.message);
      } else if (remainingData && remainingData.length > 0) {
        console.log(`Set REVIEW status for remaining documents: ${remainingData[0].count} records`);
      }
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
    console.log('\nStatus recommendation distribution:');
    const { data: distribution, error: distError } = await client.rpc('execute_sql', {
      sql: `
        SELECT 
          status_recommendation, 
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM documentation_files), 2) as percentage
        FROM documentation_files
        GROUP BY status_recommendation
        ORDER BY count DESC
      `
    });
    
    if (distError) {
      console.error('Error getting status distribution:', distError.message);
    } else if (distribution && distribution.length > 0) {
      distribution.forEach(row => {
        console.log(`${row.status_recommendation || 'NULL'}: ${row.count} (${row.percentage}%)`);
      });
    }
    
    console.log('\nStatus recommendation application complete!');
  } catch (error) {
    console.error('Error in applyStatusRecommendations:', error);
  }
}