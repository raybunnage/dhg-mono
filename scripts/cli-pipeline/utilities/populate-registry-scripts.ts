#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

interface PackageJson {
  name: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ScriptEntry {
  script_name: string;
  shortcut_name?: string;
  script_type: 'pnpm';
  package_location: string;
  script_command: string;
  description?: string;
  dependencies?: string[];
  environment: 'any' | 'development' | 'production' | 'ci';
  file_path: string;
  file_name: string;
  title: string;
  language: 'json';
}

// Known shortcuts mapping (add more as needed)
const KNOWN_SHORTCUTS: Record<string, string> = {
  'dev': 'Development server',
  'build': 'Production build',
  'test': 'Run tests',
  'lint': 'Code linting',
  'type-check': 'TypeScript checking',
  'preview': 'Preview build',
  'start': 'Start application',
  'servers': 'Start all servers',
  'format': 'Code formatting',
  'clean': 'Clean build artifacts'
};

function findPackageJsonFiles(dir: string, rootDir: string): string[] {
  const results: string[] = [];
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, dist, build directories
      if (!['node_modules', 'dist', 'build', '.git'].includes(item)) {
        results.push(...findPackageJsonFiles(fullPath, rootDir));
      }
    } else if (item === 'package.json') {
      const relativePath = relative(rootDir, fullPath);
      results.push(relativePath);
    }
  }
  
  return results;
}

async function populateRegistryScripts() {
  const supabase = SupabaseClientService.getInstance().getClient();
  const rootDir = process.cwd();
  
  console.log('🔍 Scanning for package.json files with pnpm scripts...\n');
  
  try {
    // Find all package.json files
    const packageJsonFiles = findPackageJsonFiles(rootDir, rootDir);
    
    const scriptEntries: ScriptEntry[] = [];
    
    for (const packagePath of packageJsonFiles) {
      const fullPath = join(rootDir, packagePath);
      const packageDir = packagePath.replace('/package.json', '') || '.';
      
      try {
        const packageContent = JSON.parse(readFileSync(fullPath, 'utf-8')) as PackageJson;
        
        if (packageContent.scripts && Object.keys(packageContent.scripts).length > 0) {
          console.log(`📦 Found scripts in: ${packageDir}`);
          
          for (const [scriptName, scriptCommand] of Object.entries(packageContent.scripts)) {
            // Determine environment based on script name/command
            let environment: 'any' | 'development' | 'production' | 'ci' = 'any';
            if (scriptName.includes('dev') || scriptCommand.includes('--mode development')) {
              environment = 'development';
            } else if (scriptName.includes('build') || scriptName.includes('prod')) {
              environment = 'production';
            } else if (scriptName.includes('test') || scriptName.includes('ci')) {
              environment = 'ci';
            }
            
            // Get dependencies from package.json
            const allDeps = {
              ...packageContent.dependencies,
              ...packageContent.devDependencies
            };
            const dependencies = Object.keys(allDeps);
            
            const entry: ScriptEntry = {
              script_name: scriptName,
              shortcut_name: KNOWN_SHORTCUTS[scriptName],
              script_type: 'pnpm',
              package_location: packageDir,
              script_command: scriptCommand,
              description: `${scriptName} script in ${packageContent.name || packageDir}`,
              dependencies: dependencies.length > 0 ? dependencies : undefined,
              environment,
              file_path: packagePath,
              file_name: 'package.json',
              title: `${packageContent.name || packageDir}: ${scriptName}`,
              language: 'json'
            };
            
            scriptEntries.push(entry);
            console.log(`  ✅ ${scriptName}: ${scriptCommand.substring(0, 50)}${scriptCommand.length > 50 ? '...' : ''}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Error reading ${packagePath}:`, error);
      }
    }
    
    if (scriptEntries.length === 0) {
      console.log('No pnpm scripts found to register.');
      return;
    }
    
    console.log(`\n📊 Found ${scriptEntries.length} scripts across ${new Set(scriptEntries.map(e => e.package_location)).size} packages`);
    
    // Clear existing entries for a fresh start
    console.log('\n🧹 Clearing existing registry_scripts entries...');
    const { error: deleteError } = await supabase
      .from('registry_scripts')
      .delete()
      .eq('script_type', 'pnpm');
      
    if (deleteError) {
      // Table might not exist or be accessible, try to continue
      console.warn('Warning clearing existing entries:', deleteError.message);
      console.log('Continuing with insert...');
    } else {
      console.log('✅ Cleared existing entries');
    }
    
    // Insert new entries
    console.log('💾 Inserting script entries...');
    const { data, error } = await supabase
      .from('registry_scripts')
      .insert(scriptEntries)
      .select();
      
    if (error) {
      console.error('Error inserting script entries:', error);
      return;
    }
    
    console.log(`\n✅ Successfully registered ${data?.length || 0} pnpm scripts!`);
    
    // Show summary by package
    const packageSummary = scriptEntries.reduce((acc, entry) => {
      acc[entry.package_location] = (acc[entry.package_location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n📋 Summary by package:');
    Object.entries(packageSummary)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([pkg, count]) => {
        console.log(`  ${pkg}: ${count} scripts`);
      });
      
  } catch (error) {
    console.error('❌ Error populating registry:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  populateRegistryScripts();
}

export { populateRegistryScripts };