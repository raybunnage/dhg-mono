/**
 * Migration Staged Execution Command
 * 
 * Executes migration in stages with confirmation between sections
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { MigrationParser } from '../../services/migration-parser';
import { SupabaseClientService } from '../../../../../packages/shared/services/supabase-client';
import { MigrationSection, MigrationSectionType, SectionExecutionResult } from '../../types/migration';

interface StagedRunOptions {
  file?: string;
  sectionType?: MigrationSectionType;
  autoConfirm?: boolean;
  skipValidation?: boolean;
  continueOnError?: boolean;
  verbose?: boolean;
  logFile?: string;
}

async function runStagedMigration(options: StagedRunOptions): Promise<void> {
  const startTime = Date.now();
  let logStream: fs.WriteStream | null = null;

  try {
    // Setup logging
    if (options.logFile) {
      logStream = fs.createWriteStream(options.logFile, { flags: 'a' });
      logToFile(logStream, `\n=== Migration Started: ${new Date().toISOString()} ===`);
    }

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

    console.log(`🚀 Starting staged migration: ${path.basename(filePath!)}`);
    console.log('');

    // Parse migration
    const migration = await MigrationParser.parseMigrationFile(filePath!);
    
    // Validate unless skipped
    if (!options.skipValidation) {
      console.log('🔍 Validating migration...');
      const validation = MigrationParser.validateMigration(migration);
      
      if (!validation.isValid) {
        console.error('❌ Migration has validation errors:');
        validation.errors.forEach(error => {
          const location = error.section ? `[${error.section}]` : '[global]';
          console.log(`   ${location} ${error.message}`);
        });
        
        if (!options.continueOnError) {
          console.log('💡 Fix validation errors or use --continue-on-error flag');
          process.exit(1);
        } else {
          console.log('⚠️  Continuing despite validation errors (--continue-on-error)');
        }
      } else {
        console.log('✅ Validation passed');
      }
      console.log('');
    }

    // Filter sections
    let sectionsToExecute = migration.sections;
    if (options.sectionType) {
      sectionsToExecute = migration.sections.filter(s => s.type === options.sectionType);
      if (sectionsToExecute.length === 0) {
        console.error(`❌ No sections of type '${options.sectionType}' found`);
        process.exit(1);
      }
    }

    // Display execution plan
    console.log('📋 Migration Plan:');
    console.log(`   Name: ${migration.metadata.name}`);
    console.log(`   Version: ${migration.metadata.version}`);
    console.log(`   Sections: ${sectionsToExecute.length}`);
    console.log(`   Order: ${sectionsToExecute.map(s => s.name).join(' → ')}`);
    console.log('');

    // Get database connection
    console.log('🔌 Connecting to database...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Connection successful if we get here
    console.log('✅ Database connected');
    console.log('');

    // Execute sections with confirmation
    const results: SectionExecutionResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < sectionsToExecute.length; i++) {
      const section = sectionsToExecute[i];
      const isLast = i === sectionsToExecute.length - 1;
      
      console.log(`📂 Section ${i + 1}/${sectionsToExecute.length}: ${section.name} (${section.type})`);
      
      // Show section details
      const lineCount = section.sql.split('\n').filter(line => line.trim()).length;
      console.log(`   📏 Size: ${section.sql.length} chars, ${lineCount} statements`);
      
      if (options.verbose) {
        console.log('   📝 SQL Preview:');
        const preview = section.sql.split('\n').slice(0, 3).join('\n');
        console.log(`   ${preview}${section.sql.split('\n').length > 3 ? '\n   ...' : ''}`);
      }

      // Ask for confirmation unless auto-confirm
      if (!options.autoConfirm) {
        const shouldExecute = await askConfirmation(
          `Execute section "${section.name}"?`,
          ['yes', 'no', 'show', 'skip', 'abort']
        );

        switch (shouldExecute) {
          case 'no':
          case 'skip':
            console.log('⏭️  Skipping section');
            results.push({
              sectionName: section.name,
              sectionType: section.type,
              success: false,
              executionTime: 0,
              error: 'Skipped by user'
            });
            continue;
          case 'show':
            console.log('📝 Full SQL:');
            console.log(section.sql);
            console.log('');
            i--; // Repeat this section
            continue;
          case 'abort':
            console.log('🛑 Migration aborted by user');
            process.exit(1);
          case 'yes':
            break;
        }
      }

      // Execute section
      console.log('⚡ Executing...');
      logToFile(logStream, `Executing section: ${section.name} (${section.type})`);
      
      const sectionStartTime = Date.now();
      try {
        const result = await executeSectionWithRetry(supabase, section, options.verbose || false);
        const executionTime = Date.now() - sectionStartTime;

        if (result.success) {
          console.log(`✅ Section completed (${executionTime}ms)`);
          if (result.rowsAffected !== undefined) {
            console.log(`   📊 Rows affected: ${result.rowsAffected}`);
          }
          if (result.objectsCreated?.length) {
            console.log(`   🏗️  Created: ${result.objectsCreated.join(', ')}`);
          }
          successCount++;
          
          results.push({
            sectionName: section.name,
            sectionType: section.type,
            success: true,
            executionTime,
            rowsAffected: result.rowsAffected,
            objectsCreated: result.objectsCreated
          });

          logToFile(logStream, `Section completed successfully: ${section.name} (${executionTime}ms)`);
        } else {
          console.log(`❌ Section failed: ${result.error}`);
          failureCount++;
          
          results.push({
            sectionName: section.name,
            sectionType: section.type,
            success: false,
            executionTime,
            error: result.error
          });

          logToFile(logStream, `Section failed: ${section.name} - ${result.error}`);

          if (!options.continueOnError) {
            console.log('💡 Use --continue-on-error to proceed despite failures');
            break;
          } else {
            console.log('⚠️  Continuing despite error...');
          }
        }
      } catch (error) {
        const executionTime = Date.now() - sectionStartTime;
        console.log(`❌ Section failed with exception: ${error}`);
        failureCount++;
        
        results.push({
          sectionName: section.name,
          sectionType: section.type,
          success: false,
          executionTime,
          error: error instanceof Error ? error.message : String(error)
        });

        logToFile(logStream, `Section exception: ${section.name} - ${error}`);

        if (!options.continueOnError) {
          break;
        }
      }

      if (!isLast) {
        console.log('');
      }
    }

    // Final summary
    const totalTime = Date.now() - startTime;
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful sections: ${successCount}`);
    console.log(`   ❌ Failed sections: ${failureCount}`);
    console.log(`   ⏱️  Total time: ${totalTime}ms`);
    console.log(`   📈 Success rate: ${Math.round((successCount / (successCount + failureCount)) * 100)}%`);

    if (options.verbose && results.length > 0) {
      console.log('\n📋 Detailed Results:');
      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.sectionName}: ${result.executionTime}ms`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
    }

    logToFile(logStream, `Migration completed. Success: ${successCount}, Failed: ${failureCount}, Total time: ${totalTime}ms`);

    if (failureCount > 0) {
      console.log('\n💡 Some sections failed. Check the errors above and consider:');
      console.log('   - Running individual sections that failed');
      console.log('   - Checking database permissions');
      console.log('   - Verifying table/column names');
      process.exit(1);
    } else {
      console.log('\n🎉 Migration completed successfully!');
      
      // Auto-regenerate types.ts after successful migration
      console.log('\n🔄 Regenerating TypeScript types...');
      try {
        const { execSync } = require('child_process');
        execSync('pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts', {
          cwd: process.cwd(),
          stdio: 'inherit'
        });
        console.log('✅ TypeScript types regenerated successfully');
      } catch (typeGenError) {
        console.warn('⚠️  Failed to regenerate types.ts:', typeGenError);
        console.log('💡 Run manually: pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts');
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    logToFile(logStream, `Migration failed: ${error}`);
    process.exit(1);
  } finally {
    if (logStream) {
      logToFile(logStream, `=== Migration Ended: ${new Date().toISOString()} ===\n`);
      logStream.end();
    }
  }
}

async function executeSectionWithRetry(supabase: any, section: MigrationSection, verbose: boolean): Promise<{
  success: boolean;
  rowsAffected?: number;
  objectsCreated?: string[];
  error?: string;
}> {
  try {
    // For complex SQL with functions and dollar-quoted strings, execute as one block
    if (section.sql.includes('$$') || section.sql.includes('LANGUAGE plpgsql')) {
      if (verbose) {
        console.log(`     Executing complete SQL block...`);
      }
      
      const result = await supabase.rpc('execute_sql', { sql_query: section.sql });
      
      if (result.error) {
        return {
          success: false,
          error: result.error.message
        };
      }
      
      return {
        success: true,
        objectsCreated: ['Complex SQL block executed']
      };
    }

    // Split SQL into individual statements for simple cases
    const statements = section.sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (statements.length === 0) {
      return { success: true };
    }

    const objectsCreated: string[] = [];
    let totalRowsAffected = 0;

    // Execute each statement
    for (const statement of statements) {
      if (verbose) {
        console.log(`     Executing: ${statement.substring(0, 50)}...`);
      }

      // Use execute_sql function if available, otherwise try direct query
      let result;
      try {
        result = await supabase.rpc('execute_sql', { sql_query: statement });
      } catch (rpcError) {
        // Fallback to direct query for simple SELECTs
        if (statement.toUpperCase().startsWith('SELECT')) {
          result = await supabase.query(statement);
        } else {
          throw rpcError;
        }
      }

      if (result.error) {
        return {
          success: false,
          error: `SQL Error: ${result.error.message}`
        };
      }

      // Extract created objects from statement
      const createdObjects = extractCreatedObjects(statement);
      objectsCreated.push(...createdObjects);

      // Count rows affected if available
      if (result.data && Array.isArray(result.data)) {
        totalRowsAffected += result.data.length;
      }
    }

    return {
      success: true,
      rowsAffected: totalRowsAffected > 0 ? totalRowsAffected : undefined,
      objectsCreated: objectsCreated.length > 0 ? objectsCreated : undefined
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function extractCreatedObjects(sql: string): string[] {
  const objects: string[] = [];

  const patterns = [
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)/gi,
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([^\s(]+)/gi,
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s]+)/gi,
    /CREATE\s+POLICY\s+([^\s]+)/gi,
    /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([^\s]+)/gi
  ];

  for (const pattern of patterns) {
    const matches = sql.match(pattern);
    if (matches) {
      objects.push(...matches.map(m => m.split(/\s+/).pop()!.toLowerCase()));
    }
  }

  return objects;
}

async function askConfirmation(question: string, options: string[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const optionsList = options.map(opt => opt.charAt(0).toUpperCase() + opt.slice(1)).join('/');
    rl.question(`${question} (${optionsList}): `, (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      const validOption = options.find(opt => 
        opt.startsWith(normalized) || opt === normalized
      );
      resolve(validOption || 'no');
    });
  });
}

function logToFile(stream: fs.WriteStream | null, message: string): void {
  if (stream) {
    stream.write(`${new Date().toISOString()}: ${message}\n`);
  }
}

// Parse command line arguments
function parseArgs(): StagedRunOptions {
  const args = process.argv.slice(2);
  const options: StagedRunOptions = {};

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
      case '--auto-confirm':
      case '-y':
        options.autoConfirm = true;
        break;
      case '--skip-validation':
        options.skipValidation = true;
        break;
      case '--continue-on-error':
        options.continueOnError = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--log':
      case '-l':
        options.logFile = args[++i];
        break;
      case '--help':
      case '-h':
        showHelp();
        return options; // Return instead of process.exit to avoid unreachable code
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
Migration Staged Execution Tool

USAGE:
  run-staged [OPTIONS] [FILE]

OPTIONS:
  -f, --file <file>           Migration file to execute
  -s, --section <type>        Execute only specific section type
  -y, --auto-confirm         Skip confirmation prompts
      --skip-validation      Skip migration validation
      --continue-on-error    Continue execution despite failures
  -v, --verbose              Show detailed execution information
  -l, --log <file>           Write execution log to file
  -h, --help                Show this help message

EXAMPLES:
  # Interactive staged execution
  run-staged migration.sql

  # Auto-confirm all sections
  run-staged --auto-confirm migration.sql

  # Execute only table sections
  run-staged --section tables migration.sql

  # Continue on errors with logging
  run-staged --continue-on-error --log migration.log migration.sql

INTERACTIVE COMMANDS:
  yes    - Execute the section
  no     - Skip the section
  show   - Show full SQL for the section
  skip   - Skip the section (same as no)
  abort  - Stop migration entirely

SECTION TYPES:
  extensions, tables, indexes, functions, triggers, rls, grants, views, custom

NOTES:
  - Requires execute_sql function in database
  - Each section requires confirmation unless --auto-confirm
  - Failed sections stop execution unless --continue-on-error
  - Use --verbose to see SQL execution details
`);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  runStagedMigration(options);
}