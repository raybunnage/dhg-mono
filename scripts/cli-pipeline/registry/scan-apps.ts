#!/usr/bin/env ts-node

import { program } from 'commander';
import * as path from 'path';
import {
  getSubdirectories,
  readJsonFile,
  getRelativePath,
  directoryExists,
  getMonorepoRoot
} from './utils/file-scanner';
import {
  upsertApp,
  createAnalysisRun,
  updateAnalysisRun,
  RegistryAppInsert
} from './utils/supabase-helper';

interface PackageJson {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ScanResult {
  totalFound: number;
  newApps: number;
  updatedApps: number;
  errors: number;
}

// Port mappings from CLAUDE.md
const APP_PORTS: Record<string, number> = {
  'dhg-a': 5178,
  'dhg-b': 5179,
  'dhg-hub': 5174,
  'dhg-hub-lovable': 5173,
  'dhg-admin-suite': 5175,
  'dhg-admin-code': 5177,
  'dhg-admin-google': 5176,
  'dhg-audio': 5194,
  'dhg-improve-experts': 8080,
  'dhg-research': 5180 // Not in CLAUDE.md, using next available
};

function detectAppType(packageJson: PackageJson, appPath: string): string {
  const scripts = packageJson.scripts || {};
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Check for Vite
  if (deps.vite || scripts.dev?.includes('vite')) {
    return 'vite-app';
  }
  
  // Check for Next.js
  if (deps.next || scripts.dev?.includes('next')) {
    return 'next-app';
  }
  
  // Check for Express/Node service
  if (deps.express || scripts.start?.includes('node')) {
    return 'node-service';
  }
  
  // Check for CLI tool
  if (scripts.build?.includes('tsc') && !deps.react) {
    return 'cli-tool';
  }
  
  return 'unknown';
}

function detectFramework(packageJson: PackageJson): string | null {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps.react) return 'react';
  if (deps.vue) return 'vue';
  if (deps.angular) return 'angular';
  if (deps.express) return 'express';
  if (deps.fastify) return 'fastify';
  
  return null;
}

async function scanApps(options: { includeInactive?: boolean }): Promise<void> {
  console.log('🔍 Starting apps scan...\n');
  
  const startTime = Date.now();
  const runId = await createAnalysisRun('full-scan', 'apps');
  const result: ScanResult = {
    totalFound: 0,
    newApps: 0,
    updatedApps: 0,
    errors: 0
  };
  
  try {
    // Get all subdirectories in apps folder
    const appsDir = 'apps';
    const appDirs = getSubdirectories(appsDir);
    
    console.log(`📁 Found ${appDirs.length} directories in ${appsDir}\n`);
    
    for (const appName of appDirs) {
      try {
        const appPath = path.join(appsDir, appName);
        const packageJsonPath = path.join(appPath, 'package.json');
        
        // Check if package.json exists
        if (!directoryExists(appPath)) {
          console.log(`⏭️  Skipping ${appName} - not a directory`);
          continue;
        }
        
        const fullPackageJsonPath = path.join(getMonorepoRoot(), packageJsonPath);
        const packageJson = readJsonFile<PackageJson>(fullPackageJsonPath);
        
        if (!packageJson) {
          console.log(`⏭️  Skipping ${appName} - no package.json found`);
          continue;
        }
        
        const appType = detectAppType(packageJson, appPath);
        const framework = detectFramework(packageJson);
        const port = APP_PORTS[appName] || null;
        
        const app: RegistryAppInsert = {
          app_name: appName,
          display_name: packageJson.name || appName,
          description: packageJson.description || `${appName} application`,
          app_path: appPath,
          app_type: appType,
          framework: framework,
          package_manager: 'pnpm', // Project standard
          port_number: port,
          status: options.includeInactive ? 'active' : 'active'
        };
        
        const upserted = await upsertApp(app);
        
        if (upserted.created_at === upserted.updated_at) {
          console.log(`✅ Added: ${appName} (${appType}${framework ? `, ${framework}` : ''}${port ? `, port ${port}` : ''})`);
          result.newApps++;
        } else {
          console.log(`📝 Updated: ${appName}`);
          result.updatedApps++;
        }
        
        result.totalFound++;
        
      } catch (error) {
        console.error(`❌ Error processing ${appName}:`, error);
        result.errors++;
      }
    }
    
    // Update analysis run
    await updateAnalysisRun(runId, {
      status: 'completed',
      items_scanned: appDirs.length,
      dependencies_found: result.totalFound,
      new_dependencies: result.newApps,
      errors_encountered: result.errors,
      run_duration_ms: Date.now() - startTime
    });
    
    // Summary
    console.log('\n📊 Scan Summary:');
    console.log(`   Total apps found: ${result.totalFound}`);
    console.log(`   New apps added: ${result.newApps}`);
    console.log(`   Existing apps updated: ${result.updatedApps}`);
    console.log(`   Errors encountered: ${result.errors}`);
    console.log(`   Time taken: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    
  } catch (error) {
    console.error('❌ Scan failed:', error);
    await updateAnalysisRun(runId, {
      status: 'failed',
      errors_encountered: result.errors + 1,
      run_duration_ms: Date.now() - startTime,
      notes: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

// CLI setup
program
  .name('scan-apps')
  .description('Scan apps directory and populate registry')
  .option('--include-inactive', 'Include inactive/archived apps')
  .action(scanApps);

program.parse();