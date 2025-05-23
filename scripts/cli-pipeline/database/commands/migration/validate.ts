/**
 * Migration Validation Command
 * 
 * Validates SQL migration files without executing them
 */

import * as fs from 'fs';
import * as path from 'path';
import { MigrationParser } from '../../services/migration-parser';

interface ValidationOptions {
  file?: string;
  verbose?: boolean;
  sectionType?: string;
  showWarnings?: boolean;
}

async function validateMigration(options: ValidationOptions): Promise<void> {
  try {
    // Determine file path
    let filePath = options.file;
    if (!filePath) {
      // Look for migration files in current directory
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

    console.log(`🔍 Validating migration: ${path.basename(filePath!)}`);
    console.log('');

    // Parse migration
    const migration = await MigrationParser.parseMigrationFile(filePath!);
    
    // Display metadata
    console.log('📋 Migration Metadata:');
    console.log(`   Name: ${migration.metadata.name}`);
    console.log(`   Version: ${migration.metadata.version}`);
    console.log(`   Description: ${migration.metadata.description}`);
    if (migration.metadata.author) {
      console.log(`   Author: ${migration.metadata.author}`);
    }
    if (migration.metadata.dependencies?.length) {
      console.log(`   Dependencies: ${migration.metadata.dependencies.join(', ')}`);
    }
    console.log('');

    // Display sections
    console.log('📂 Migration Sections:');
    migration.sections.forEach((section, index) => {
      const lineCount = section.sql.split('\n').length;
      console.log(`   ${index + 1}. ${section.name} (${section.type}) - ${lineCount} lines`);
    });
    console.log('');

    // Validate migration
    const validation = MigrationParser.validateMigration(migration);
    
    // Filter by section type if specified
    let sectionsToShow = validation.sections;
    if (options.sectionType) {
      sectionsToShow = validation.sections.filter(s => 
        s.sectionType === options.sectionType || 
        s.sectionName.toLowerCase().includes(options.sectionType!.toLowerCase())
      );
    }

    // Display validation results
    if (validation.isValid) {
      console.log('✅ Migration validation passed!');
    } else {
      console.log('❌ Migration validation failed!');
    }
    console.log('');

    // Show errors
    const errors = validation.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.log('🚨 Errors:');
      errors.forEach(error => {
        const location = error.section ? `[${error.section}]` : '[global]';
        const line = error.line ? `:${error.line}` : '';
        console.log(`   ${location}${line} ${error.message}`);
      });
      console.log('');
    }

    // Show warnings if requested
    if (options.showWarnings || options.verbose) {
      const warnings = validation.warnings;
      if (warnings.length > 0) {
        console.log('⚠️  Warnings:');
        warnings.forEach(warning => {
          const location = warning.section ? `[${warning.section}]` : '[global]';
          const line = warning.line ? `:${warning.line}` : '';
          console.log(`   ${location}${line} ${warning.message}`);
        });
        console.log('');
      }
    }

    // Show detailed section results if verbose
    if (options.verbose) {
      console.log('📊 Section Details:');
      sectionsToShow.forEach(section => {
        const status = section.isValid ? '✅' : '❌';
        console.log(`   ${status} ${section.sectionName} (${section.sectionType})`);
        
        if (section.errors.length > 0) {
          section.errors.forEach(error => {
            console.log(`      Error: ${error.message}`);
          });
        }
        
        if (section.warnings.length > 0 && options.showWarnings) {
          section.warnings.forEach(warning => {
            console.log(`      Warning: ${warning.message}`);
          });
        }
      });
      console.log('');
    }

    // Show SQL objects that would be created
    const objects = MigrationParser.extractSqlObjects(migration);
    console.log('🏗️  Objects to be created:');
    if (objects.tables.length > 0) {
      console.log(`   Tables: ${objects.tables.join(', ')}`);
    }
    if (objects.functions.length > 0) {
      console.log(`   Functions: ${objects.functions.join(', ')}`);
    }
    if (objects.indexes.length > 0) {
      console.log(`   Indexes: ${objects.indexes.join(', ')}`);
    }
    if (objects.policies.length > 0) {
      console.log(`   Policies: ${objects.policies.join(', ')}`);
    }
    
    if (!validation.isValid) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): ValidationOptions {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--file':
      case '-f':
        options.file = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--section':
      case '-s':
        options.sectionType = args[++i];
        break;
      case '--warnings':
      case '-w':
        options.showWarnings = true;
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
Migration Validation Tool

USAGE:
  validate [OPTIONS] [FILE]

OPTIONS:
  -f, --file <file>        Migration file to validate
  -v, --verbose           Show detailed validation results
  -s, --section <type>    Focus on specific section type
  -w, --warnings          Show warnings in addition to errors
  -h, --help             Show this help message

EXAMPLES:
  # Validate specific file
  validate --file migration.sql

  # Validate with verbose output
  validate --verbose migration.sql

  # Validate only table sections
  validate --section tables migration.sql

  # Show warnings
  validate --warnings migration.sql

SECTION TYPES:
  extensions, tables, indexes, functions, triggers, rls, grants, views, custom
`);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  validateMigration(options);
}