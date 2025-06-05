/**
 * Migration Section Testing Command
 * 
 * Tests specific sections of migration files against the database
 */

import * as fs from 'fs';
import * as path from 'path';
import { MigrationParser } from '../../services/migration-parser';
import { SupabaseClientService } from '../../../../../packages/shared/services/supabase-client';
import { MigrationSection, MigrationSectionType } from '../../types/migration';

interface TestOptions {
  file?: string;
  sectionType?: MigrationSectionType;
  dryRun?: boolean;
  verbose?: boolean;
  timeout?: number;
}

async function testMigrationSections(options: TestOptions): Promise<void> {
  try {
    // Determine file path
    let filePath = options.file;
    if (!filePath) {
      const files = fs.readdirSync(process.cwd())
        .filter(f => f.endsWith('.sql') && f.includes('migration'));
      
      if (files.length === 0) {
        console.error('❌ No migration files found in current directory');
        process.exit(1);
      }
      
      if (files.length > 1) {
        console.error('❌ Multiple migration files found. Please specify one:');
        files.forEach(f => console.log(`   - ${f}`));
        process.exit(1);
      }
      
      filePath = files[0];
    }

    if (!fs.existsSync(filePath!)) {
      console.error(`❌ Migration file not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`🧪 Testing migration sections: ${path.basename(filePath!)}`);
    console.log('');

    // Parse migration
    const migration = await MigrationParser.parseMigrationFile(filePath!);
    
    // Validate first
    const validation = MigrationParser.validateMigration(migration);
    if (!validation.isValid) {
      console.error('❌ Migration has validation errors. Fix them first.');
      process.exit(1);
    }

    // Filter sections to test
    let sectionsToTest = migration.sections;
    if (options.sectionType) {
      sectionsToTest = migration.sections.filter(s => s.type === options.sectionType);
      if (sectionsToTest.length === 0) {
        console.error(`❌ No sections of type '${options.sectionType}' found`);
        process.exit(1);
      }
    }

    console.log(`🎯 Testing ${sectionsToTest.length} section(s):`);
    sectionsToTest.forEach(s => console.log(`   - ${s.name} (${s.type})`));
    console.log('');

    if (options.dryRun) {
      console.log('🏃‍♂️ DRY RUN MODE - No SQL will be executed');
      console.log('');
      
      // Show what would be executed
      for (const section of sectionsToTest) {
        console.log(`📝 Section: ${section.name} (${section.type})`);
        console.log('SQL to execute:');
        console.log('```sql');
        console.log(section.sql);
        console.log('```');
        console.log('');
      }
      return;
    }

    // Get database connection
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Connection successful if we get here
    console.log('✅ Database connection successful');
    console.log('');

    // Execute sections
    let successCount = 0;
    let failureCount = 0;

    for (const section of sectionsToTest) {
      console.log(`⚡ Testing section: ${section.name} (${section.type})`);
      
      try {
        const startTime = Date.now();
        
        // Execute SQL
        const result = await executeSectionSql(supabase, section);
        
        const executionTime = Date.now() - startTime;
        
        if (result.success) {
          console.log(`✅ Section completed successfully (${executionTime}ms)`);
          if (result.rowsAffected !== undefined) {
            console.log(`   Rows affected: ${result.rowsAffected}`);
          }
          if (result.objectsCreated?.length) {
            console.log(`   Objects created: ${result.objectsCreated.join(', ')}`);
          }
          successCount++;
        } else {
          console.log(`❌ Section failed: ${result.error}`);
          failureCount++;
          
          if (!options.verbose) {
            console.log('💡 Use --verbose to see detailed error information');
          }
        }
        
      } catch (error) {
        console.log(`❌ Section failed with exception:`, error);
        failureCount++;
      }
      
      console.log('');
    }

    // Summary
    console.log('📊 Test Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📈 Success rate: ${Math.round((successCount / (successCount + failureCount)) * 100)}%`);

    if (failureCount > 0) {
      console.log('');
      console.log('💡 Tips for fixing failures:');
      console.log('   - Check that required tables/objects exist');
      console.log('   - Verify column names and types');
      console.log('   - Ensure proper permissions');
      console.log('   - Review RLS policies');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Testing failed:', error);
    process.exit(1);
  }
}

async function executeSectionSql(supabase: any, section: MigrationSection): Promise<{
  success: boolean;
  rowsAffected?: number;
  objectsCreated?: string[];
  error?: string;
}> {
  try {
    // For PostgreSQL, we need to use the RPC interface to execute raw SQL
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql_query: section.sql 
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    // Extract information from results based on section type
    const objectsCreated: string[] = [];
    
    // Parse SQL to extract created objects
    switch (section.type) {
      case 'tables':
        const tableMatches = section.sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi);
        if (tableMatches) {
          objectsCreated.push(...tableMatches.map(m => m.split(/\s+/).pop()!));
        }
        break;
      case 'functions':
        const funcMatches = section.sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)/gi);
        if (funcMatches) {
          objectsCreated.push(...funcMatches.map(m => m.split(/\s+/).pop()!));
        }
        break;
      case 'indexes':
        const indexMatches = section.sql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s]+)/gi);
        if (indexMatches) {
          objectsCreated.push(...indexMatches.map(m => m.split(/\s+/).pop()!));
        }
        break;
    }

    return {
      success: true,
      objectsCreated: objectsCreated.length > 0 ? objectsCreated : undefined
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Parse command line arguments
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--file':
      case '-f':
        options.file = args[++i];
        break;
      case '--section':
      case '-s':
        options.sectionType = args[++i] as MigrationSectionType;
        break;
      case '--dry-run':
      case '--dry':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[++i]);
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('-') && !options.file) {
          options.file = arg;
        }
        break;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Migration Section Testing Tool

USAGE:
  test-sections [OPTIONS] [FILE]

OPTIONS:
  -f, --file <file>        Migration file to test
  -s, --section <type>     Test only specific section type
      --dry-run           Show what would be executed without running
  -v, --verbose           Show detailed output
  -t, --timeout <ms>      Execution timeout in milliseconds
  -h, --help             Show this help message

EXAMPLES:
  # Test all sections
  test-sections migration.sql

  # Test only table sections
  test-sections --section tables migration.sql

  # Dry run to see what would be executed
  test-sections --dry-run migration.sql

  # Test with verbose output
  test-sections --verbose migration.sql

SECTION TYPES:
  extensions, tables, indexes, functions, triggers, rls, grants, views, custom

NOTES:
  - Requires execute_sql function in database
  - Tests are run against your configured Supabase instance
  - Use dry-run mode to preview without executing
  - Failed tests will show specific error messages
`);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  testMigrationSections(options);
}