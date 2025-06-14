#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import * as fg from 'fast-glob';

interface ServiceFile {
  path: string;
  exports: string[];
  imports: string[];
  className?: string;
  isSingleton: boolean;
  usage: string[];
}

// Paths to check for Supabase services
const SERVICE_PATHS = [
  'packages/shared/services/**/*supabase*.{ts,tsx,js,jsx}',
  'packages/shared/adapters/**/*supabase*.{ts,tsx,js,jsx}',
  'apps/**/services/**/*supabase*.{ts,tsx,js,jsx}',
  'apps/**/lib/**/*supabase*.{ts,tsx,js,jsx}',
];

async function analyzeFile(filePath: string): Promise<ServiceFile | null> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Skip test files and type definition files
    if (filePath.includes('.test.') || filePath.includes('.d.ts')) {
      return null;
    }
    
    const result: ServiceFile = {
      path: filePath,
      exports: [],
      imports: [],
      isSingleton: false,
      usage: []
    };
    
    // Check for class definitions
    const classMatch = content.match(/export\s+class\s+(\w+)/);
    if (classMatch) {
      result.className = classMatch[1];
    }
    
    // Check for singleton pattern
    if (content.includes('getInstance') && content.includes('static instance')) {
      result.isSingleton = true;
    }
    
    // Find exports
    const exportMatches = content.matchAll(/export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g);
    for (const match of exportMatches) {
      result.exports.push(match[1]);
    }
    
    // Find default export
    if (content.includes('export default')) {
      result.exports.push('default');
    }
    
    // Find imports
    const importMatches = content.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      result.imports.push(match[1]);
    }
    
    // Find usage patterns
    if (content.includes('createClient')) {
      result.usage.push('creates Supabase client');
    }
    if (content.includes('.from(') || content.includes('.rpc(')) {
      result.usage.push('makes database queries');
    }
    if (content.includes('SupabaseClient')) {
      result.usage.push('uses SupabaseClient type');
    }
    
    return result;
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
    return null;
  }
}

async function findReferences(serviceName: string): Promise<{ file: string; type: string }[]> {
  const references: { file: string; type: string }[] = [];
  
  const patterns = [
    'apps/**/*.{ts,tsx,js,jsx}',
    'packages/**/*.{ts,tsx,js,jsx}',
    'scripts/**/*.{ts,tsx,js,jsx}',
  ];
  
  for (const pattern of patterns) {
    const files = fg.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
      cwd: process.cwd()
    });
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check for imports
        if (content.includes(`from '@shared/services/${serviceName}'`) ||
            content.includes(`from '../services/${serviceName}'`) ||
            content.includes(`from './services/${serviceName}'`)) {
          references.push({ file, type: 'import' });
        }
        
        // Check for usage
        const regex = new RegExp(`\\b${serviceName}\\b`, 'g');
        if (regex.test(content) && !references.find(r => r.file === file)) {
          references.push({ file, type: 'usage' });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }
  
  return references;
}

async function main() {
  console.log('🔍 Analyzing Supabase Service Duplicates');
  console.log('========================================\n');
  
  // Find all Supabase-related service files
  const serviceFiles: ServiceFile[] = [];
  
  for (const pattern of SERVICE_PATHS) {
    const files = fg.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
      cwd: process.cwd()
    });
    
    for (const file of files) {
      const analysis = await analyzeFile(file);
      if (analysis) {
        serviceFiles.push(analysis);
      }
    }
  }
  
  console.log(`Found ${serviceFiles.length} Supabase-related files\n`);
  
  // Group by functionality
  const clientCreators = serviceFiles.filter(f => f.usage.includes('creates Supabase client'));
  const singletons = serviceFiles.filter(f => f.isSingleton);
  const adapters = serviceFiles.filter(f => f.path.includes('adapter'));
  
  console.log('📊 Service Analysis:');
  console.log('===================\n');
  
  console.log('🔧 Singleton Services (keep these):');
  for (const service of singletons) {
    console.log(`  ✅ ${path.relative(process.cwd(), service.path)}`);
    if (service.className) {
      console.log(`     Class: ${service.className}`);
    }
  }
  
  console.log('\n🔌 Adapter Services (evaluate for consolidation):');
  for (const service of adapters) {
    console.log(`  🔍 ${path.relative(process.cwd(), service.path)}`);
    if (service.exports.length > 0) {
      console.log(`     Exports: ${service.exports.join(', ')}`);
    }
  }
  
  console.log('\n🏭 Client Creators (consolidate these):');
  for (const service of clientCreators) {
    if (!service.isSingleton && !adapters.includes(service)) {
      console.log(`  ⚠️  ${path.relative(process.cwd(), service.path)}`);
      if (service.usage.length > 0) {
        console.log(`     Usage: ${service.usage.join(', ')}`);
      }
    }
  }
  
  // Find the main SupabaseClientService
  const mainService = serviceFiles.find(f => f.className === 'SupabaseClientService');
  if (mainService) {
    console.log('\n✅ Main Service (consolidation target):');
    console.log(`  ${path.relative(process.cwd(), mainService.path)}`);
    
    // Find references
    const refs = await findReferences('supabase-client');
    console.log(`  ${refs.length} files reference this service`);
  }
  
  console.log('\n📋 Recommended Actions:');
  console.log('======================');
  console.log('1. Keep SupabaseClientService as the main singleton');
  console.log('2. Keep createSupabaseAdapter for browser/CLI flexibility');
  console.log('3. Consolidate duplicate client creators');
  console.log('4. Update imports to use the main service');
  console.log('5. Remove unused service files after migration');
}

main().catch(error => {
  console.error('Analysis failed:', error);
  process.exit(1);
});