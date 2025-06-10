#!/usr/bin/env ts-node

import { program } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getMonorepoRoot } from './utils/file-scanner';

interface AppFeature {
  app_name: string;
  feature_type: 'page' | 'component' | 'hook' | 'service' | 'utility';
  feature_name: string;
  file_path: string;
  description?: string;
  parent_path?: string;
  metadata?: Record<string, any>;
}

interface ScanOptions {
  app?: string;
  type?: string;
  clean?: boolean;
}

const supabase = SupabaseClientService.getInstance().getClient();

/**
 * Extract component/page name from file path
 */
function extractFeatureName(filePath: string, featureType: string): string {
  const basename = path.basename(filePath, path.extname(filePath));
  
  // Remove common suffixes
  const cleanName = basename
    .replace(/\.(test|spec|stories)$/, '')
    .replace(/\.(tsx?|jsx?)$/, '');
  
  // Convert to readable name
  return cleanName
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Determine feature type from file path and content
 */
async function detectFeatureType(filePath: string): Promise<'page' | 'component' | 'hook' | 'service' | 'utility'> {
  const content = await fs.promises.readFile(filePath, 'utf-8').catch(() => '');
  
  // Check for pages (usually in pages directory or have routing)
  if (filePath.includes('/pages/') || filePath.includes('/routes/') || 
      content.includes('useParams') || content.includes('useNavigate')) {
    return 'page';
  }
  
  // Check for hooks
  if (filePath.includes('/hooks/') || path.basename(filePath).startsWith('use')) {
    return 'hook';
  }
  
  // Check for services
  if (filePath.includes('/services/') || filePath.includes('/api/') ||
      content.includes('Service') || content.includes('API')) {
    return 'service';
  }
  
  // Check for utilities
  if (filePath.includes('/utils/') || filePath.includes('/helpers/') ||
      filePath.includes('/lib/')) {
    return 'utility';
  }
  
  // Default to component
  return 'component';
}

/**
 * Extract description from file comments
 */
async function extractDescription(filePath: string): Promise<string | undefined> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    
    // Look for JSDoc comments
    const jsdocMatch = content.match(/\/\*\*\s*\n([^*]|\*(?!\/))*\*\//);
    if (jsdocMatch) {
      const comment = jsdocMatch[0];
      // Extract first line of description
      const descMatch = comment.match(/\*\s+([^@\n]+)/);
      if (descMatch) {
        return descMatch[1].trim();
      }
    }
    
    // Look for single-line comments at the top
    const lines = content.split('\n').slice(0, 10);
    for (const line of lines) {
      const commentMatch = line.match(/\/\/\s*(.+)/);
      if (commentMatch && !commentMatch[1].includes('eslint') && !commentMatch[1].includes('TODO')) {
        return commentMatch[1].trim();
      }
    }
  } catch (error) {
    // Ignore read errors
  }
  
  return undefined;
}

/**
 * Scan an app for features
 */
async function scanAppFeatures(appName: string, options: ScanOptions): Promise<AppFeature[]> {
  const features: AppFeature[] = [];
  const appPath = path.join(getMonorepoRoot(), 'apps', appName);
  
  // Check if app exists
  if (!fs.existsSync(appPath)) {
    throw new Error(`App directory not found: ${appPath}`);
  }
  
  // Define patterns to scan
  const patterns = [
    'src/**/*.{tsx,ts,jsx,js}',
    'pages/**/*.{tsx,ts,jsx,js}',
    'components/**/*.{tsx,ts,jsx,js}',
    'app/**/*.{tsx,ts,jsx,js}' // Next.js app directory
  ];
  
  // Exclude patterns
  const ignorePatterns = [
    '**/node_modules/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.stories.*',
    '**/test/**',
    '**/__tests__/**',
    '**/tests/**',
    '**/dist/**',
    '**/build/**',
    '**/*.d.ts',
    '**/vite-env.d.ts'
  ];
  
  console.log(`🔍 Scanning ${appName} for features...`);
  
  for (const pattern of patterns) {
    const files = glob.sync(pattern, {
      cwd: appPath,
      ignore: ignorePatterns,
      absolute: false
    });
    
    for (const file of files) {
      const fullPath = path.join(appPath, file);
      const relativePath = `apps/${appName}/${file}`;
      
      // Detect feature type
      const featureType = await detectFeatureType(fullPath);
      
      // Skip if filtering by type
      if (options.type && featureType !== options.type) {
        continue;
      }
      
      // Extract feature details
      const featureName = extractFeatureName(file, featureType);
      const description = await extractDescription(fullPath);
      
      // Find parent component if it's a subcomponent
      let parentPath: string | undefined;
      const dirPath = path.dirname(file);
      if (dirPath.includes('/') && !['src', 'pages', 'components', 'app'].includes(dirPath.split('/')[0])) {
        // This might be a nested component
        const parentDir = path.dirname(dirPath);
        if (parentDir !== '.') {
          parentPath = `apps/${appName}/${parentDir}`;
        }
      }
      
      features.push({
        app_name: appName,
        feature_type: featureType,
        feature_name: featureName,
        file_path: relativePath,
        description,
        parent_path: parentPath,
        metadata: {
          file_extension: path.extname(file),
          directory: path.dirname(file)
        }
      });
    }
  }
  
  return features;
}

/**
 * Catalog features to database
 */
async function catalogFeatures(features: AppFeature[]): Promise<void> {
  console.log(`\n💾 Cataloging ${features.length} features to database...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const feature of features) {
    try {
      // Call the database function to catalog the feature
      const { data, error } = await supabase.rpc('catalog_app_feature', {
        p_app_name: feature.app_name,
        p_feature_type: feature.feature_type,
        p_feature_name: feature.feature_name,
        p_file_path: feature.file_path,
        p_description: feature.description || null,
        p_parent_path: feature.parent_path || null,
        p_metadata: feature.metadata || {}
      });
      
      if (error) {
        console.error(`❌ Error cataloging ${feature.feature_name}:`, error);
        errorCount++;
      } else {
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Error cataloging ${feature.feature_name}:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n✅ Successfully cataloged ${successCount} features`);
  if (errorCount > 0) {
    console.log(`❌ Failed to catalog ${errorCount} features`);
  }
}

/**
 * Clean old features for an app
 */
async function cleanOldFeatures(appName: string): Promise<void> {
  console.log(`🧹 Cleaning old features for ${appName}...`);
  
  const { error } = await supabase
    .from('app_features')
    .delete()
    .eq('app_name', appName);
  
  if (error) {
    console.error('Error cleaning old features:', error);
  }
}

/**
 * Main scan function
 */
async function scan(options: ScanOptions): Promise<void> {
  console.log('🚀 Starting app features scan...\n');
  
  try {
    let appsToScan: string[] = [];
    
    if (options.app) {
      // Scan specific app
      appsToScan = [options.app];
    } else {
      // Scan all apps
      const appsDir = path.join(getMonorepoRoot(), 'apps');
      const entries = await fs.promises.readdir(appsDir, { withFileTypes: true });
      appsToScan = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    }
    
    console.log(`📦 Apps to scan: ${appsToScan.join(', ')}\n`);
    
    let totalFeatures = 0;
    
    for (const appName of appsToScan) {
      try {
        // Clean old features if requested
        if (options.clean) {
          await cleanOldFeatures(appName);
        }
        
        // Scan for features
        const features = await scanAppFeatures(appName, options);
        console.log(`📊 Found ${features.length} features in ${appName}`);
        
        // Show breakdown by type
        const typeBreakdown = features.reduce((acc, f) => {
          acc[f.feature_type] = (acc[f.feature_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(typeBreakdown).forEach(([type, count]) => {
          console.log(`   - ${type}s: ${count}`);
        });
        
        // Catalog to database
        if (features.length > 0) {
          await catalogFeatures(features);
        }
        
        totalFeatures += features.length;
        console.log('');
        
      } catch (error) {
        console.error(`❌ Error scanning ${appName}:`, error);
      }
    }
    
    console.log(`\n🎉 Scan complete! Total features cataloged: ${totalFeatures}`);
    
  } catch (error) {
    console.error('❌ Scan failed:', error);
    process.exit(1);
  }
}

// CLI setup
program
  .name('scan-app-features')
  .description('Scan apps for features (pages, components, hooks, etc.) and catalog them')
  .option('-a, --app <name>', 'Scan specific app only')
  .option('-t, --type <type>', 'Filter by feature type (page, component, hook, service, utility)')
  .option('-c, --clean', 'Clean existing features before scanning')
  .action(scan);

program.parse();