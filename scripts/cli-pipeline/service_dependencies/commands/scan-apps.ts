/**
 * Scan Apps Command
 * 
 * Discovers and registers all applications in the monorepo by:
 * 1. Scanning apps/ directory for applications
 * 2. Reading package.json files for metadata
 * 3. Identifying app types and frameworks
 * 4. Registering apps in the apps_registry table
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

interface AppInfo {
  appName: string;
  displayName: string;
  description?: string;
  appPath: string;
  appType: 'vite-app' | 'node-service' | 'cli-tool' | 'static-site';
  framework?: string;
  packageManager: string;
  dependencies?: string[];
  devDependencies?: string[];
}

interface ScanOptions {
  dryRun?: boolean;
  verbose?: boolean;
  force?: boolean;
  limit?: number;
}

class AppScanner {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = process.cwd();
  private appsPath = path.join(this.projectRoot, 'apps');

  async scanApps(options: ScanOptions = {}): Promise<void> {
    const { dryRun = false, verbose = false, force = false, limit } = options;

    console.log('🔍 Scanning for applications...');
    console.log(`📁 Searching in: ${this.appsPath}`);
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }
    
    console.log('');

    try {
      // Find all app directories
      const appDirs = await this.findAppDirectories();
      
      if (limit && appDirs.length > limit) {
        appDirs.splice(limit);
        console.log(`⚠️ Limited to ${limit} applications`);
      }

      console.log(`📋 Found ${appDirs.length} applications to analyze`);
      console.log('');

      // Analyze each app
      const apps: AppInfo[] = [];
      for (const appDir of appDirs) {
        try {
          const appInfo = await this.analyzeApp(appDir, verbose);
          if (appInfo) {
            apps.push(appInfo);
          }
        } catch (error) {
          console.log(`   ❌ Failed to analyze ${appDir}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log('');
      console.log(`✅ Successfully analyzed ${apps.length} applications`);
      console.log('');

      // Register apps in database
      if (!dryRun) {
        await this.registerApps(apps, force, verbose);
      } else {
        this.showAppsPreview(apps);
      }

      // Show summary
      this.showScanSummary(apps);

    } catch (error) {
      Logger.error(`App scan failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  private async findAppDirectories(): Promise<string[]> {
    if (!fs.existsSync(this.appsPath)) {
      throw new Error(`Apps directory not found: ${this.appsPath}`);
    }

    const entries = fs.readdirSync(this.appsPath, { withFileTypes: true });
    
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(this.appsPath, entry.name))
      .filter(appPath => {
        // Check if it has a package.json (indicates it's an app)
        return fs.existsSync(path.join(appPath, 'package.json'));
      });
  }

  private async analyzeApp(appPath: string, verbose: boolean): Promise<AppInfo | null> {
    const appName = path.basename(appPath);
    const relativePath = path.relative(this.projectRoot, appPath);
    
    if (verbose) {
      console.log(`🔍 Analyzing: ${appName}`);
    }

    try {
      const packageJsonPath = path.join(appPath, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        if (verbose) {
          console.log(`   ⚠️ No package.json found`);
        }
        return null;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      const appInfo: AppInfo = {
        appName,
        displayName: packageJson.name || appName,
        description: packageJson.description,
        appPath: relativePath,
        appType: this.determineAppType(appPath, packageJson),
        framework: this.determineFramework(packageJson),
        packageManager: this.determinePackageManager(appPath),
        dependencies: packageJson.dependencies ? Object.keys(packageJson.dependencies) : [],
        devDependencies: packageJson.devDependencies ? Object.keys(packageJson.devDependencies) : []
      };

      if (verbose) {
        console.log(`   📋 App: ${appInfo.displayName} (${appInfo.appType})`);
        console.log(`   🛠️ Framework: ${appInfo.framework || 'Unknown'}`);
      }

      return appInfo;

    } catch (error) {
      if (verbose) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    }
  }

  private determineAppType(appPath: string, packageJson: any): AppInfo['appType'] {
    // Check for Vite config
    const viteConfigs = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
    if (viteConfigs.some(config => fs.existsSync(path.join(appPath, config)))) {
      return 'vite-app';
    }

    // Check for static site indicators
    if (fs.existsSync(path.join(appPath, 'index.html')) && !packageJson.scripts?.dev) {
      return 'static-site';
    }

    // Check for CLI tool indicators
    if (packageJson.bin || (packageJson.scripts && 
        (packageJson.scripts.cli || Object.keys(packageJson.scripts).some(script => script.includes('cli'))))) {
      return 'cli-tool';
    }

    // Check for Node.js service indicators
    if (packageJson.main || packageJson.scripts?.start) {
      return 'node-service';
    }

    return 'vite-app'; // Default fallback
  }

  private determineFramework(packageJson: any): string | undefined {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Check for React
    if (dependencies.react || dependencies['@types/react']) {
      return 'react';
    }

    // Check for Vue
    if (dependencies.vue || dependencies['@vue/cli']) {
      return 'vue';
    }

    // Check for Angular
    if (dependencies['@angular/core']) {
      return 'angular';
    }

    // Check for Express
    if (dependencies.express) {
      return 'express';
    }

    // Check for Fastify
    if (dependencies.fastify) {
      return 'fastify';
    }

    // Check for Next.js
    if (dependencies.next) {
      return 'nextjs';
    }

    // Check for SvelteKit
    if (dependencies['@sveltejs/kit']) {
      return 'sveltekit';
    }

    // Check for static site generators
    if (dependencies.vitepress) {
      return 'vitepress';
    }

    return undefined;
  }

  private determinePackageManager(appPath: string): string {
    if (fs.existsSync(path.join(appPath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    
    if (fs.existsSync(path.join(appPath, 'yarn.lock'))) {
      return 'yarn';
    }
    
    if (fs.existsSync(path.join(appPath, 'package-lock.json'))) {
      return 'npm';
    }

    // Check parent directories for workspace indicators
    if (fs.existsSync(path.join(this.projectRoot, 'pnpm-workspace.yaml'))) {
      return 'pnpm';
    }

    return 'npm'; // Default fallback
  }

  private async registerApps(apps: AppInfo[], force: boolean, verbose: boolean): Promise<void> {
    console.log('💾 Registering applications in database...');
    
    let registered = 0;
    let updated = 0;
    let skipped = 0;

    for (const app of apps) {
      try {
        // Check if app already exists
        const { data: existing } = await this.supabase
          .from('apps_registry')
          .select('id, app_name')
          .eq('app_name', app.appName)
          .single();

        if (existing && !force) {
          skipped++;
          if (verbose) {
            console.log(`   ⏭️ Skipped existing: ${app.appName}`);
          }
          continue;
        }

        const appData = {
          app_name: app.appName,
          display_name: app.displayName,
          description: app.description,
          app_path: app.appPath,
          app_type: app.appType,
          framework: app.framework,
          package_manager: app.packageManager,
          status: 'active',
          updated_at: new Date().toISOString()
        };

        if (existing) {
          // Update existing app
          const { error } = await this.supabase
            .from('apps_registry')
            .update(appData)
            .eq('id', existing.id);

          if (error) {
            throw new Error(`Failed to update app: ${error.message}`);
          }

          updated++;
          if (verbose) {
            console.log(`   🔄 Updated: ${app.appName}`);
          }
        } else {
          // Insert new app
          const { error } = await this.supabase
            .from('apps_registry')
            .insert(appData);

          if (error) {
            throw new Error(`Failed to insert app: ${error.message}`);
          }

          registered++;
          if (verbose) {
            console.log(`   ✅ Registered: ${app.appName}`);
          }
        }

      } catch (error) {
        console.log(`   ❌ Failed to register ${app.appName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('');
    console.log(`📊 Registration Results:`);
    console.log(`   ✅ Registered: ${registered}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ⏭️ Skipped: ${skipped}`);
  }

  private showAppsPreview(apps: AppInfo[]): void {
    console.log('🔍 Applications Preview (DRY RUN):');
    console.log('');
    
    apps.forEach((app, index) => {
      console.log(`${index + 1}. ${app.appName}`);
      console.log(`   Display Name: ${app.displayName}`);
      console.log(`   Type: ${app.appType}`);
      console.log(`   Framework: ${app.framework || 'Unknown'}`);
      console.log(`   Path: ${app.appPath}`);
      console.log(`   Package Manager: ${app.packageManager}`);
      if (app.description) {
        console.log(`   Description: ${app.description}`);
      }
      console.log('');
    });
  }

  private showScanSummary(apps: AppInfo[]): void {
    console.log('📊 Scan Summary:');
    console.log('');
    
    const byType = apps.reduce((acc, app) => {
      acc[app.appType] = (acc[app.appType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('   App Types:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`     ${type}: ${count} apps`);
    });

    const byFramework = apps.reduce((acc, app) => {
      const framework = app.framework || 'unknown';
      acc[framework] = (acc[framework] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('');
    console.log('   Frameworks:');
    Object.entries(byFramework).forEach(([framework, count]) => {
      console.log(`     ${framework}: ${count} apps`);
    });

    const byPackageManager = apps.reduce((acc, app) => {
      acc[app.packageManager] = (acc[app.packageManager] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('');
    console.log('   Package Managers:');
    Object.entries(byPackageManager).forEach(([pm, count]) => {
      console.log(`     ${pm}: ${count} apps`);
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options: ScanOptions = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    force: args.includes('--force') || args.includes('-f'),
  };

  const limitIndex = args.findIndex(arg => arg === '--limit' || arg === '-l');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    options.limit = parseInt(args[limitIndex + 1], 10);
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Scan Apps Command');
    console.log('');
    console.log('Discovers and registers all applications in the monorepo.');
    console.log('');
    console.log('Usage: scan-apps [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run         Preview mode without making changes');
    console.log('  --verbose, -v     Show detailed output');
    console.log('  --force, -f       Update existing apps');
    console.log('  --limit, -l       Limit number of apps to process');
    console.log('  --help, -h        Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  scan-apps');
    console.log('  scan-apps --dry-run --verbose');
    console.log('  scan-apps --force --limit 5');
    return;
  }

  const scanner = new AppScanner();
  await scanner.scanApps(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}