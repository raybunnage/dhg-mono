// Script to check and complete status_recommendation field migration

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
    
    runFullMigration(client);
  } else {
    console.error('CLI client not found at:', cliPath);
    process.exit(1);
  }
} catch (err) {
  console.error('Error initializing:', err);
  process.exit(1);
}

async function checkMigration(client) {
  console.log('Checking status_recommendation migration status...\n');
  
  try {
    // Get total records count
    const { count: totalCount, error: totalError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
      
    if (totalError) {
      console.error('Error getting total count:', totalError.message);
      return { totalCount: 0, needsMigration: true };
    }
    
    // 1. Check records with status in metadata but not in field
    const { count: metadataCount, error: metadataError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('metadata->status_recommendation', 'is', null)
      .is('status_recommendation', null);
      
    if (metadataError) {
      console.error('Error checking metadata records:', metadataError.message);
    } else {
      console.log(`Records with status in metadata but NULL in field: ${metadataCount}`);
    }
    
    // 2. Check records with status in ai_assessment but not in field
    const { count: aiCount, error: aiError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('metadata->ai_assessment->status_recommendation', 'is', null)
      .is('status_recommendation', null);
      
    if (aiError) {
      console.error('Error checking ai_assessment records:', aiError.message);
    } else {
      console.log(`Records with status in ai_assessment but NULL in field: ${aiCount}`);
    }
    
    // 3. Check records with status in processed_content.assessment but not in field
    const { count: pcaCount, error: pcaError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('metadata->processed_content->assessment->status_recommendation', 'is', null)
      .is('status_recommendation', null);
      
    if (pcaError) {
      console.error('Error checking processed_content.assessment records:', pcaError.message);
    } else {
      console.log(`Records with status in processed_content.assessment but NULL in field: ${pcaCount}`);
    }
    
    // 4. Check records with status in processed_content but not in field
    const { count: pcCount, error: pcError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('metadata->processed_content->status_recommendation', 'is', null)
      .is('status_recommendation', null);
      
    if (pcError) {
      console.error('Error checking processed_content records:', pcError.message);
    } else {
      console.log(`Records with status in processed_content but NULL in field: ${pcCount}`);
    }
    
    // 5. Check total records with status_recommendation field filled
    const { count: filledCount, error: filledError } = await client
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .not('status_recommendation', 'is', null);
      
    if (filledError) {
      console.error('Error checking filled records:', filledError.message);
    } else {
      console.log(`\nRecords with status_recommendation field populated: ${filledCount}`);
      console.log(`Percentage of records with status: ${Math.round((filledCount / totalCount) * 100)}%`);
    }
    
    // Get missing count - records that could be migrated but aren't
    const totalMissing = metadataCount + aiCount + pcaCount + pcCount;
    console.log(`Records still needing migration: ${totalMissing}`);
    
    return {
      totalCount,
      filledCount: filledCount || 0,
      needsMigration: totalMissing > 0,
      metadataCount: metadataCount || 0,
      aiCount: aiCount || 0,
      pcaCount: pcaCount || 0,
      pcCount: pcCount || 0
    };
  } catch (error) {
    console.error('Error in check migration:', error);
    return { needsMigration: true };
  }
}

async function runMigrationQueries(client) {
  console.log('\nRunning migration queries...');
  
  try {
    // 1. Direct metadata migration
    console.log('Migrating from direct metadata...');
    const { data: directResult, error: directError } = await client.rpc('execute_sql', {
      sql: `
      UPDATE documentation_files 
      SET status_recommendation = metadata->>'status_recommendation'
      WHERE metadata->>'status_recommendation' IS NOT NULL
      AND status_recommendation IS NULL;
      
      SELECT COUNT(*) as count FROM documentation_files 
      WHERE status_recommendation IS NOT NULL;
      `
    });
    
    if (directError) {
      console.error('Error in direct metadata migration:', directError.message);
    } else if (directResult && directResult.length > 0) {
      console.log(`After direct metadata migration: ${directResult[0].count} records have status`);
    }
    
    // 2. AI assessment migration
    console.log('Migrating from ai_assessment...');
    const { data: aiResult, error: aiError } = await client.rpc('execute_sql', {
      sql: `
      UPDATE documentation_files 
      SET status_recommendation = metadata->'ai_assessment'->>'status_recommendation'
      WHERE metadata->'ai_assessment'->>'status_recommendation' IS NOT NULL
      AND status_recommendation IS NULL;
      
      SELECT COUNT(*) as count FROM documentation_files 
      WHERE status_recommendation IS NOT NULL;
      `
    });
    
    if (aiError) {
      console.error('Error in ai_assessment migration:', aiError.message);
    } else if (aiResult && aiResult.length > 0) {
      console.log(`After ai_assessment migration: ${aiResult[0].count} records have status`);
    }
    
    // 3. Processed content assessment migration
    console.log('Migrating from processed_content.assessment...');
    const { data: pcaResult, error: pcaError } = await client.rpc('execute_sql', {
      sql: `
      UPDATE documentation_files 
      SET status_recommendation = metadata->'processed_content'->'assessment'->>'status_recommendation'
      WHERE metadata->'processed_content'->'assessment'->>'status_recommendation' IS NOT NULL
      AND status_recommendation IS NULL;
      
      SELECT COUNT(*) as count FROM documentation_files 
      WHERE status_recommendation IS NOT NULL;
      `
    });
    
    if (pcaError) {
      console.error('Error in processed_content.assessment migration:', pcaError.message);
    } else if (pcaResult && pcaResult.length > 0) {
      console.log(`After processed_content.assessment migration: ${pcaResult[0].count} records have status`);
    }
    
    // 4. Processed content direct migration
    console.log('Migrating from processed_content direct...');
    const { data: pcResult, error: pcError } = await client.rpc('execute_sql', {
      sql: `
      UPDATE documentation_files 
      SET status_recommendation = metadata->'processed_content'->>'status_recommendation'
      WHERE metadata->'processed_content'->>'status_recommendation' IS NOT NULL
      AND status_recommendation IS NULL;
      
      SELECT COUNT(*) as count FROM documentation_files 
      WHERE status_recommendation IS NOT NULL;
      `
    });
    
    if (pcError) {
      console.error('Error in processed_content migration:', pcError.message);
    } else if (pcResult && pcResult.length > 0) {
      console.log(`After processed_content migration: ${pcResult[0].count} records have status`);
    }
    
    // 5. Standardize case
    console.log('Standardizing case to uppercase...');
    const { error: caseError } = await client.rpc('execute_sql', {
      sql: `
      UPDATE documentation_files 
      SET status_recommendation = UPPER(status_recommendation)
      WHERE status_recommendation IS NOT NULL;
      `
    });
    
    if (caseError) {
      console.error('Error standardizing case:', caseError.message);
    } else {
      console.log('Case standardization complete');
    }
    
    // 6. Set default for old records
    console.log('Setting default REVIEW for old records...');
    const { data: defaultResult, error: defaultError } = await client.rpc('execute_sql', {
      sql: `
      UPDATE documentation_files
      SET status_recommendation = 'REVIEW'
      WHERE status_recommendation IS NULL
      AND created_at < NOW() - INTERVAL '90 days';
      
      SELECT COUNT(*) as count FROM documentation_files 
      WHERE status_recommendation IS NOT NULL;
      `
    });
    
    if (defaultError) {
      console.error('Error setting defaults for old records:', defaultError.message);
    } else if (defaultResult && defaultResult.length > 0) {
      console.log(`After setting defaults: ${defaultResult[0].count} records have status`);
    }
    
    return true;
  } catch (error) {
    console.error('Error in runMigrationQueries:', error);
    return false;
  }
}

async function getStatusDistribution(client) {
  try {
    const { data, error } = await client.rpc('execute_sql', {
      sql: `
      SELECT 
        status_recommendation, 
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM documentation_files WHERE status_recommendation IS NOT NULL), 2) as percentage
      FROM documentation_files
      WHERE status_recommendation IS NOT NULL
      GROUP BY status_recommendation
      ORDER BY count DESC
      `
    });
    
    if (error) {
      console.error('Error getting status distribution:', error.message);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getStatusDistribution:', error);
    return [];
  }
}

async function runFullMigration(client) {
  try {
    // Step 1: Check migration status
    const migrationStatus = await checkMigration(client);
    
    // Step 2: Run migration if needed
    if (migrationStatus.needsMigration) {
      console.log('\nMigration needed. Running full migration...');
      await runMigrationQueries(client);
      
      // Verify the migration was successful
      const verificationStatus = await checkMigration(client);
      
      if (verificationStatus.needsMigration) {
        console.log('\n⚠️ Some records still need migration. Please check the data.\n');
      } else {
        console.log('\n✅ Migration completed successfully!\n');
      }
    } else {
      console.log('\n✅ Migration already complete. No further action needed.\n');
    }
    
    // Step 3: Get status distribution
    const distribution = await getStatusDistribution(client);
    
    if (distribution.length > 0) {
      console.log('\nStatus Distribution:');
      console.log('---------------------');
      distribution.forEach(row => {
        console.log(`${row.status_recommendation}: ${row.count} (${row.percentage}%)`);
      });
    }
    
    // Step 4: Sample records to verify
    console.log('\nFetching sample records to verify migration:');
    const { data: samples, error: sampleError } = await client
      .from('documentation_files')
      .select('id, title, status_recommendation')
      .not('status_recommendation', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (sampleError) {
      console.error('Error fetching samples:', sampleError.message);
    } else if (samples && samples.length > 0) {
      console.log('Sample records with status_recommendation:');
      samples.forEach((record, i) => {
        console.log(`${i+1}. ${record.title}: ${record.status_recommendation}`);
      });
    }
    
    console.log('\nMigration process complete.');
  } catch (error) {
    console.error('Error in runFullMigration:', error);
  }
}
