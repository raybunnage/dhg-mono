import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';
import { classifyService } from '../../../../packages/shared/services/classify-service';

interface HealthCheckOptions {
  verbose?: boolean;
}

/**
 * Performs health checks on the classify CLI pipeline infrastructure
 */
export async function healthCheckCommand(options: HealthCheckOptions = {}): Promise<void> {
  await trackCommandExecution('classify', 'health-check', async () => {
    try {
      const results = {
        database: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
        classifyService: { status: 'unknown' as 'success' | 'failure' | 'unknown', message: '' },
      };
      
      console.log('🏥 Running classify pipeline health checks...');
      
      // Check database connection
      console.log('\n🔍 Checking Supabase database connection...');
      try {
        // Use the testConnection method from SupabaseClientService
        const connectionTest = await SupabaseClientService.getInstance().testConnection();
        
        if (connectionTest.success) {
          results.database = { 
            status: 'success', 
            message: `Connected to database successfully.` 
          };
          
          console.log('✅ Database connection successful');
        } else {
          // Store the details for verbose output
          const errorDetails = connectionTest.details || {};
          const errorMessage = connectionTest.error || 'Unknown database connection error';
          throw new Error(errorMessage);
        }
      } catch (error) {
        results.database = { 
          status: 'failure', 
          message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`
        };
        
        console.error('❌ Database connection failed');
        if (options.verbose) {
          console.error('Error details:');
          console.error(error);
        }
      }
      
      // Check classify service connection to subject_classifications table
      console.log('\n🔍 Checking classify service and subject_classifications table...');
      try {
        const serviceTest = await classifyService.testConnection();
        
        if (serviceTest.success) {
          results.classifyService = { 
            status: 'success', 
            message: `Connected to subject_classifications table successfully.` 
          };
          
          console.log('✅ Classify service connection successful');
          
          // Additional check to see if we can list classifications
          try {
            const classifications = await classifyService.getAllClassifications();
            console.log(`   ✅ Retrieved ${classifications.length} classifications`);
          } catch (listError) {
            console.warn(`   ⚠️ Warning: Could not list classifications: ${listError instanceof Error ? listError.message : String(listError)}`);
          }
          
        } else {
          throw new Error(serviceTest.error || 'Unknown classify service error');
        }
      } catch (error) {
        results.classifyService = { 
          status: 'failure', 
          message: `Classify service check failed: ${error instanceof Error ? error.message : String(error)}`
        };
        
        console.error('❌ Classify service check failed');
        console.error('   This could be due to:');
        console.error('   - The subject_classifications table does not exist yet');
        console.error('   - Insufficient permissions to access the table');
        console.error('   - A configuration issue with the classify service');
        
        if (options.verbose) {
          console.error('\nError details:');
          console.error(error);
        }
      }
      
      // Summary
      console.log('\n📊 Health Check Summary:');
      console.log('====================');
      console.log(`Database: ${results.database.status === 'success' ? '✅ Healthy' : results.database.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      console.log(`Classify Service: ${results.classifyService.status === 'success' ? '✅ Healthy' : results.classifyService.status === 'failure' ? '❌ Unhealthy' : '⚠️ Unknown'}`);
      
      // Overall status
      const allHealthy = Object.values(results).every(r => r.status === 'success');
      const anyFailure = Object.values(results).some(r => r.status === 'failure');
      
      console.log('\n📋 Overall Status:');
      if (allHealthy) {
        console.log('✅ All systems healthy');
      } else if (anyFailure) {
        console.log('❌ One or more systems are unhealthy');
        
        if (results.classifyService.status === 'failure' && results.database.status === 'success') {
          console.log('\n💡 Suggestion: The subject_classifications table may not exist yet.');
          console.log('   You might need to create it with a SQL migration like:');
          console.log('\n   CREATE TABLE IF NOT EXISTS public.subject_classifications (');
          console.log('     id UUID DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,');
          console.log('     name TEXT NOT NULL,');
          console.log('     description TEXT,');
          console.log('     parent_id UUID REFERENCES public.subject_classifications(id),');
          console.log('     category TEXT,');
          console.log('     created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),');
          console.log('     updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),');
          console.log('     is_active BOOLEAN DEFAULT true');
          console.log('   );');
        }
      } else {
        console.log('⚠️ Health status unknown for some systems');
      }
      
      // Return results for tracking
      return {
        results,
        allHealthy,
        anyFailure
      };
      
    } catch (error) {
      console.error(`Error performing health check: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }, {
    getResultSummary: (result) => ({
      recordsAffected: 0,
      affectedEntity: 'health-check',
      summary: result.allHealthy 
        ? 'All classify systems healthy' 
        : result.anyFailure 
          ? 'One or more classify systems are unhealthy' 
          : 'Health status unknown for some classify systems'
    })
  });
}