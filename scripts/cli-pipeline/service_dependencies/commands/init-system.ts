/**
 * Initialize Service Dependency Mapping System
 * 
 * This command sets up the service dependency mapping system by:
 * 1. Verifying database tables exist
 * 2. Running initial scans to populate registries
 * 3. Performing initial dependency analysis
 * 4. Creating a comprehensive system overview
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

interface InitOptions {
  dryRun?: boolean;
  verbose?: boolean;
  skipAnalysis?: boolean;
}

class ServiceDependencyInitializer {
  private supabase = SupabaseClientService.getInstance().getClient();

  async initializeSystem(options: InitOptions = {}): Promise<void> {
    const { dryRun = false, verbose = false, skipAnalysis = false } = options;

    console.log('🚀 Initializing Service Dependency Mapping System');
    console.log('================================================');
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }
    
    console.log('');

    let analysisRunId: string | null = null;

    try {
      // Step 1: Verify database schema
      await this.verifyDatabaseSchema(verbose);
      
      // Step 2: Check system prerequisites
      await this.checkPrerequisites(verbose);
      
      // Step 3: Create initial analysis run record
      analysisRunId = await this.createAnalysisRun(dryRun);
      
      // Step 4: Show initialization plan
      await this.showInitializationPlan();
      
      // Step 5: Update analysis run as completed
      if (!dryRun && analysisRunId) {
        await this.completeAnalysisRun(analysisRunId);
      }
      
      console.log('');
      console.log('✅ Service dependency mapping system initialized successfully!');
      console.log('');
      console.log('📋 Next steps:');
      console.log('  1. Run: service-dependencies-cli.sh scan-services');
      console.log('  2. Run: service-dependencies-cli.sh scan-apps');
      console.log('  3. Run: service-dependencies-cli.sh scan-pipelines');
      console.log('  4. Run: service-dependencies-cli.sh scan-commands');
      console.log('  5. Run: service-dependencies-cli.sh analyze-dependencies --target all');
      console.log('');
      
    } catch (error) {
      Logger.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      
      if (analysisRunId) {
        await this.failAnalysisRun(analysisRunId, error instanceof Error ? error.message : String(error));
      }
      
      process.exit(1);
    }
  }

  private async verifyDatabaseSchema(verbose: boolean): Promise<void> {
    console.log('🗃️ Verifying database schema...');
    
    const requiredTables = [
      'services_registry',
      'apps_registry', 
      'cli_pipelines_registry',
      'cli_commands_registry',
      'app_service_dependencies',
      'pipeline_service_dependencies',
      'command_service_dependencies',
      'service_exports',
      'dependency_analysis_runs'
    ];

    const existingTables: string[] = [];
    const missingTables: string[] = [];

    // Check each table individually
    for (const tableName of requiredTables) {
      try {
        const { error } = await this.supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (error && error.code === '42P01') {
          // Table does not exist
          missingTables.push(tableName);
        } else if (!error) {
          existingTables.push(tableName);
        } else {
          // Some other error - table might exist but have permission issues
          if (verbose) {
            console.log(`   ⚠️ Warning checking ${tableName}: ${error.message}`);
          }
          existingTables.push(tableName);
        }
      } catch (err) {
        missingTables.push(tableName);
      }
    }

    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}. Please run the database migration first.`);
    }

    console.log(`   ✅ All ${requiredTables.length} required tables exist`);
    
    if (verbose) {
      console.log('   📋 Tables verified:');
      existingTables.forEach(table => {
        console.log(`     - ${table}`);
      });
    }
  }

  private async checkPrerequisites(verbose: boolean): Promise<void> {
    console.log('🔧 Checking system prerequisites...');
    
    const fs = await import('fs');
    const path = await import('path');
    
    const projectRoot = process.cwd();
    const requiredPaths = [
      'packages/shared/services',
      'apps',
      'scripts/cli-pipeline',
      'tsconfig.node.json'
    ];

    for (const reqPath of requiredPaths) {
      const fullPath = path.join(projectRoot, reqPath);
      const exists = fs.existsSync(fullPath);
      
      if (!exists) {
        throw new Error(`Required path does not exist: ${reqPath}`);
      }
      
      if (verbose) {
        console.log(`   ✅ ${reqPath}`);
      }
    }

    console.log(`   ✅ All ${requiredPaths.length} required paths exist`);
  }

  private async createAnalysisRun(dryRun: boolean): Promise<string | null> {
    if (dryRun) return null;

    console.log('📊 Creating analysis run record...');
    
    const { data, error } = await this.supabase
      .from('dependency_analysis_runs')
      .insert({
        run_type: 'initialization',
        target_type: 'all',
        status: 'running',
        notes: 'System initialization and setup'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create analysis run: ${error.message}`);
    }

    console.log(`   ✅ Analysis run created with ID: ${data.id}`);
    return data.id;
  }

  private async showInitializationPlan(): Promise<void> {
    console.log('📋 Initialization Plan:');
    console.log('');
    
    const steps = [
      {
        command: 'scan-services',
        description: 'Discover and register all shared services',
        estimated: '~2-5 minutes'
      },
      {
        command: 'scan-apps', 
        description: 'Register all applications in the monorepo',
        estimated: '~1-2 minutes'
      },
      {
        command: 'scan-pipelines',
        description: 'Register all CLI pipelines',
        estimated: '~1 minute'
      },
      {
        command: 'scan-commands',
        description: 'Register individual CLI commands',
        estimated: '~2-3 minutes'
      },
      {
        command: 'analyze-dependencies',
        description: 'Analyze service usage relationships',
        estimated: '~5-10 minutes'
      }
    ];

    steps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step.command}`);
      console.log(`      ${step.description}`);
      console.log(`      Estimated time: ${step.estimated}`);
      console.log('');
    });

    console.log('   Total estimated time: ~12-25 minutes');
    console.log('');
    console.log('💡 You can run these commands individually or use the following sequence:');
    console.log('');
    steps.forEach(step => {
      console.log(`   service-dependencies-cli.sh ${step.command}`);
    });
  }

  private async completeAnalysisRun(analysisRunId: string): Promise<void> {
    const { error } = await this.supabase
      .from('dependency_analysis_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: 'System initialization completed successfully'
      })
      .eq('id', analysisRunId);

    if (error) {
      Logger.error(`Failed to update analysis run: ${error.message}`);
    }
  }

  private async failAnalysisRun(analysisRunId: string, errorMessage: string): Promise<void> {
    const { error } = await this.supabase
      .from('dependency_analysis_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: `Initialization failed: ${errorMessage}`
      })
      .eq('id', analysisRunId);

    if (error) {
      Logger.error(`Failed to update analysis run: ${error.message}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options: InitOptions = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipAnalysis: args.includes('--skip-analysis')
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Initialize Service Dependency Mapping System');
    console.log('');
    console.log('Usage: init-system [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run         Preview mode without making changes');
    console.log('  --verbose, -v     Show detailed output');
    console.log('  --skip-analysis   Skip initial dependency analysis');
    console.log('  --help, -h        Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  init-system');
    console.log('  init-system --dry-run --verbose');
    console.log('  init-system --skip-analysis');
    return;
  }

  const initializer = new ServiceDependencyInitializer();
  await initializer.initializeSystem(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}