/**
 * Migration Dry Run Command
 * 
 * Shows what would be executed without actually running the migration
 */

import * as fs from 'fs';
import * as path from 'path';
import { MigrationParser } from '../../services/migration-parser';
import { MigrationSectionType } from '../../types/migration';

interface DryRunOptions {
  file?: string;
  sectionType?: MigrationSectionType;
  showSql?: boolean;
  format?: 'table' | 'json' | 'yaml';
  outputFile?: string;
}

async function dryRunMigration(options: DryRunOptions): Promise<void> {
  try {
    // Determine file path
    let filePath = options.file;
    if (!filePath) {
      const files = fs.readdirSync(process.cwd())
        .filter(f => f.endsWith('.sql') && f.includes('migration'));
      
      if (files.length === 0) {
        console.error('❌ No migration files found in current directory');
        console.log('💡 Specify a file with --file parameter');
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

    console.log(`🏃‍♂️ DRY RUN: ${path.basename(filePath!)}`);
    console.log('');

    // Parse migration
    const migration = await MigrationParser.parseMigrationFile(filePath!);
    
    // Validate first
    const validation = MigrationParser.validateMigration(migration);
    if (!validation.isValid) {
      console.log('⚠️  Migration has validation errors:');
      validation.errors.forEach(error => {
        const location = error.section ? `[${error.section}]` : '[global]';
        console.log(`   ${location} ${error.message}`);
      });
      console.log('');
      console.log('💡 Fix validation errors before running migration');
      console.log('');
    }

    // Filter sections
    let sectionsToShow = migration.sections;
    if (options.sectionType) {
      sectionsToShow = migration.sections.filter(s => s.type === options.sectionType);
      if (sectionsToShow.length === 0) {
        console.error(`❌ No sections of type '${options.sectionType}' found`);
        process.exit(1);
      }
    }

    // Display metadata
    console.log('📋 Migration Information:');
    console.log(`   Name: ${migration.metadata.name}`);
    console.log(`   Version: ${migration.metadata.version}`);
    console.log(`   Description: ${migration.metadata.description}`);
    if (migration.metadata.dependencies?.length) {
      console.log(`   Dependencies: ${migration.metadata.dependencies.join(', ')}`);
    }
    console.log('');

    // Show execution plan
    console.log('📅 Execution Plan:');
    console.log(`   Total sections: ${sectionsToShow.length}`);
    console.log(`   Execution order: ${sectionsToShow.map(s => s.name).join(' → ')}`);
    console.log('');

    // Show sections
    console.log('📂 Sections to execute:');
    sectionsToShow.forEach((section, index) => {
      const lineCount = section.sql.split('\n').filter(line => line.trim()).length;
      const sqlSize = section.sql.length;
      
      console.log(`\n   ${index + 1}. ${section.name} (${section.type})`);
      console.log(`      📏 Size: ${sqlSize} chars, ${lineCount} statements`);
      
      // Show estimated objects
      const objects = extractObjectsFromSection(section);
      if (objects.length > 0) {
        console.log(`      🏗️  Creates: ${objects.join(', ')}`);
      }
      
      // Show dependencies
      if (section.dependencies?.length) {
        console.log(`      🔗 Depends on: ${section.dependencies.join(', ')}`);
      }
      
      // Show SQL if requested
      if (options.showSql) {
        console.log(`      📝 SQL:`);
        const sqlLines = section.sql.split('\n');
        sqlLines.forEach((line, lineIndex) => {
          if (line.trim()) {
            console.log(`         ${(lineIndex + 1).toString().padStart(3)}: ${line}`);
          }
        });
      }
    });

    // Show impact analysis
    console.log('\n🎯 Impact Analysis:');
    const objects = MigrationParser.extractSqlObjects(migration);
    
    console.log('   Objects to create:');
    if (objects.tables.length > 0) {
      console.log(`      📊 Tables (${objects.tables.length}): ${objects.tables.join(', ')}`);
    }
    if (objects.functions.length > 0) {
      console.log(`      ⚙️  Functions (${objects.functions.length}): ${objects.functions.join(', ')}`);
    }
    if (objects.indexes.length > 0) {
      console.log(`      🔍 Indexes (${objects.indexes.length}): ${objects.indexes.join(', ')}`);
    }
    if (objects.policies.length > 0) {
      console.log(`      🔒 Policies (${objects.policies.length}): ${objects.policies.join(', ')}`);
    }

    // Show warnings and recommendations
    console.log('\n💡 Recommendations:');
    console.log('   - Test migration in development environment first');
    console.log('   - Review validation warnings before executing');
    console.log('   - Consider backing up affected tables');
    if (objects.tables.length > 0) {
      console.log('   - Verify table names and column types');
    }
    if (objects.functions.length > 0) {
      console.log('   - Test function definitions with sample data');
    }

    // Export to file if requested
    if (options.outputFile) {
      const dryRunData = {
        migration: {
          name: migration.metadata.name,
          version: migration.metadata.version,
          description: migration.metadata.description,
          file: filePath
        },
        sections: sectionsToShow.map(section => ({
          name: section.name,
          type: section.type,
          order: section.order,
          sqlLength: section.sql.length,
          lineCount: section.sql.split('\n').filter(line => line.trim()).length,
          objects: extractObjectsFromSection(section),
          sql: options.showSql ? section.sql : undefined
        })),
        validation: {
          isValid: validation.isValid,
          errorCount: validation.errors.filter(e => e.severity === 'error').length,
          warningCount: validation.warnings.length
        },
        objects
      };

      const ext = path.extname(options.outputFile).toLowerCase();
      let content: string;

      switch (ext) {
        case '.json':
          content = JSON.stringify(dryRunData, null, 2);
          break;
        case '.yaml':
        case '.yml':
          // Simple YAML conversion
          content = convertToYaml(dryRunData);
          break;
        default:
          content = JSON.stringify(dryRunData, null, 2);
          break;
      }

      fs.writeFileSync(options.outputFile, content);
      console.log(`\n📄 Dry run results saved to: ${options.outputFile}`);
    }

    console.log('\n✅ Dry run complete. Use migration commands to execute.');
    
    if (!validation.isValid) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Dry run failed:', error);
    process.exit(1);
  }
}

function extractObjectsFromSection(section: any): string[] {
  const sql = section.sql.toUpperCase();
  const objects: string[] = [];

  // Extract different types of objects
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
      objects.push(...matches.map((m: string) => m.split(/\s+/).pop()!.toLowerCase()));
    }
  }

  return objects;
}

function convertToYaml(obj: any, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      yaml += convertToYaml(value, indent + 1);
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      value.forEach(item => {
        if (typeof item === 'object') {
          yaml += `${spaces}  -\n`;
          yaml += convertToYaml(item, indent + 2);
        } else {
          yaml += `${spaces}  - ${item}\n`;
        }
      });
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

// Parse command line arguments
function parseArgs(): DryRunOptions {
  const args = process.argv.slice(2);
  const options: DryRunOptions = {};

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
      case '--show-sql':
      case '--sql':
        options.showSql = true;
        break;
      case '--format':
        options.format = args[++i] as 'table' | 'json' | 'yaml';
        break;
      case '--output':
      case '-o':
        options.outputFile = args[++i];
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
Migration Dry Run Tool

USAGE:
  dry-run [OPTIONS] [FILE]

OPTIONS:
  -f, --file <file>        Migration file to analyze
  -s, --section <type>     Focus on specific section type
      --show-sql          Include SQL code in output
      --format <format>   Output format (table, json, yaml)
  -o, --output <file>     Save results to file
  -h, --help             Show this help message

EXAMPLES:
  # Basic dry run
  dry-run migration.sql

  # Show SQL code
  dry-run --show-sql migration.sql

  # Focus on tables only
  dry-run --section tables migration.sql

  # Export to JSON
  dry-run --output results.json migration.sql

SECTION TYPES:
  extensions, tables, indexes, functions, triggers, rls, grants, views, custom

NOTES:
  - Analyzes migration without executing
  - Shows execution plan and impact
  - Validates SQL syntax and structure
  - Exports results for review
`);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  dryRunMigration(options);
}