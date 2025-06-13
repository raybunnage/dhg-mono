#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as fg from 'fast-glob';

interface MigrationTarget {
  service: string;
  references: number;
  files: string[];
}

interface MigrationResult {
  file: string;
  changes: number;
  status: 'success' | 'error' | 'skipped';
  message?: string;
}

// Services to migrate to SupabaseClientService
const SERVICES_TO_MIGRATE = [
  'SupabaseClient',
  'SupabaseAdapter', 
  'SupabaseService',
  'SupabaseClientAdapter',
  'SupabaseCache',
  'supabase-helpers',
  'SupabaseHelpers'
];

// The target service
const TARGET_SERVICE = 'SupabaseClientService';

// Patterns to search for imports
const IMPORT_PATTERNS = [
  // Named imports: import { ServiceName } from '...'
  /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/g,
  // Default imports: import ServiceName from '...'
  /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,
  // Require statements: const ServiceName = require('...')
  /const\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

async function findFilesWithService(service: string): Promise<string[]> {
  const files: string[] = [];
  
  // Search patterns
  const searchPatterns = [
    'apps/**/*.{ts,tsx,js,jsx}',
    'packages/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,tsx,js,jsx}',
  ];
  
  for (const pattern of searchPatterns) {
    const matches = fg.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
      cwd: process.cwd()
    });
    
    for (const file of matches) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check if file contains the service
      const regex = new RegExp(`\\b${service}\\b`, 'g');
      if (regex.test(content)) {
        files.push(file);
      }
    }
  }
  
  return files;
}

async function analyzeService(service: string): Promise<MigrationTarget> {
  const files = await findFilesWithService(service);
  
  let totalReferences = 0;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const regex = new RegExp(`\\b${service}\\b`, 'g');
    const matches = content.match(regex);
    totalReferences += matches ? matches.length : 0;
  }
  
  return {
    service,
    references: totalReferences,
    files
  };
}

function createBackup(filePath: string): string {
  const backupPath = `${filePath}.backup.${Date.now()}`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function migrateFile(filePath: string, service: string, dryRun: boolean = false): MigrationResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let newContent = content;
    let changes = 0;
    
    // Skip if file already uses TARGET_SERVICE
    if (content.includes(TARGET_SERVICE)) {
      return {
        file: filePath,
        changes: 0,
        status: 'skipped',
        message: 'Already uses SupabaseClientService'
      };
    }
    
    // Replace import statements
    IMPORT_PATTERNS.forEach(pattern => {
      newContent = newContent.replace(pattern, (match, imports, modulePath) => {
        if (imports.includes(service)) {
          changes++;
          
          // Handle named imports
          if (match.includes('{')) {
            const importList = imports.split(',').map((i: string) => i.trim());
            const newImportList = importList.map((imp: string) => {
              return imp === service ? TARGET_SERVICE : imp;
            });
            
            return `import { ${newImportList.join(', ')} } from '@shared/services/supabase-client'`;
          }
          
          // Handle default imports
          return `import { ${TARGET_SERVICE} } from '@shared/services/supabase-client'`;
        }
        
        return match;
      });
    });
    
    // Replace usage patterns
    const usagePatterns = [
      // Direct instantiation: new ServiceName()
      new RegExp(`new\\s+${service}\\s*\\(`, 'g'),
      // Method calls: ServiceName.getInstance()
      new RegExp(`${service}\\.`, 'g'),
      // Type annotations: : ServiceName
      new RegExp(`:\\s*${service}\\b`, 'g'),
    ];
    
    usagePatterns.forEach(pattern => {
      newContent = newContent.replace(pattern, (match) => {
        changes++;
        
        if (match.startsWith('new')) {
          // Convert instantiation to singleton
          return `${TARGET_SERVICE}.getInstance().getClient(`;
        } else if (match.includes('.')) {
          // Replace service name in method calls
          return match.replace(service, TARGET_SERVICE);
        } else {
          // Replace in type annotations
          return match.replace(service, 'SupabaseClient');
        }
      });
    });
    
    if (changes > 0 && !dryRun) {
      // Create backup
      const backupPath = createBackup(filePath);
      
      // Write updated content
      fs.writeFileSync(filePath, newContent);
      
      return {
        file: filePath,
        changes,
        status: 'success',
        message: `Backup created at: ${path.basename(backupPath)}`
      };
    }
    
    return {
      file: filePath,
      changes,
      status: dryRun ? 'success' : 'skipped',
      message: dryRun ? 'Dry run - no changes made' : 'No changes needed'
    };
    
  } catch (error) {
    return {
      file: filePath,
      changes: 0,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const service = args.find(arg => !arg.startsWith('--'));
  
  console.log('🔄 Supabase Service Migration Tool');
  console.log('==================================\n');
  
  if (!service) {
    console.log('Usage: ts-node migrate-supabase-services.ts [service-name] [--dry-run]');
    console.log('\nAvailable services to migrate:');
    for (const svc of SERVICES_TO_MIGRATE) {
      const target = await analyzeService(svc);
      console.log(`  - ${svc}: ${target.references} references in ${target.files.length} files`);
    }
    return;
  }
  
  if (!SERVICES_TO_MIGRATE.includes(service)) {
    console.error(`❌ Service "${service}" is not in the migration list`);
    console.log('\nAvailable services:', SERVICES_TO_MIGRATE.join(', '));
    return;
  }
  
  console.log(`🎯 Migrating: ${service} → ${TARGET_SERVICE}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);
  
  // Analyze service
  const target = await analyzeService(service);
  console.log(`📊 Found ${target.references} references in ${target.files.length} files\n`);
  
  if (target.files.length === 0) {
    console.log('✅ No files to migrate!');
    return;
  }
  
  // Migrate files
  const results: MigrationResult[] = [];
  
  for (const file of target.files) {
    const result = migrateFile(file, service, dryRun);
    results.push(result);
    
    if (result.status === 'success' && result.changes > 0) {
      console.log(`✅ ${path.relative(process.cwd(), file)}: ${result.changes} changes`);
      if (result.message) {
        console.log(`   ${result.message}`);
      }
    } else if (result.status === 'error') {
      console.log(`❌ ${path.relative(process.cwd(), file)}: ${result.message}`);
    }
  }
  
  // Summary
  console.log('\n📊 Migration Summary');
  console.log('===================');
  
  const successful = results.filter(r => r.status === 'success' && r.changes > 0).length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;
  const totalChanges = results.reduce((sum, r) => sum + r.changes, 0);
  
  console.log(`Files processed: ${results.length}`);
  console.log(`Files migrated: ${successful}`);
  console.log(`Files skipped: ${skipped}`);
  console.log(`Files with errors: ${errors}`);
  console.log(`Total changes: ${totalChanges}`);
  
  if (!dryRun && successful > 0) {
    console.log('\n⚠️  Important: Run TypeScript compilation to check for errors:');
    console.log('  pnpm tsc --noEmit');
    console.log('\nBackups were created for all modified files.');
  }
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});