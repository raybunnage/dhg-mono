#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

const supabase = SupabaseClientService.getInstance().getClient();

interface PageFeature {
  feature_name: string;
  feature_type: string;
  file_path: string;
  description: string;
  metadata?: any;
}

interface PageInfo {
  page_name: string;
  page_path: string;
  file_path: string;
  features: PageFeature[];
}

// Define page mappings from App.tsx routes
const PAGE_MAPPINGS = [
  { page_name: 'Login', page_path: '/login', file_name: 'LoginPage.tsx' },
  { page_name: 'Reset Password', page_path: '/reset-password', file_name: 'ResetPasswordPage.tsx' },
  { page_name: 'Work Summaries', page_path: '/work-summaries', file_name: 'WorkSummariesEnhanced.tsx' },
  { page_name: 'Command Refactor Status', page_path: '/refactor-status', file_name: 'CommandRefactorStatus.tsx' },
  { page_name: 'CLI Commands Registry', page_path: '/cli-commands', file_name: 'CLICommandsRegistry.tsx' },
  { page_name: 'Database', page_path: '/database', file_name: 'DatabasePage.tsx' },
  { page_name: 'Documents', page_path: '/documents', file_name: 'DocumentsPage.tsx' },
  { page_name: 'Claude Tasks', page_path: '/tasks', file_name: 'TasksPage.tsx' },
  { page_name: 'Create Task', page_path: '/tasks/new', file_name: 'CreateTaskPage.tsx' },
  { page_name: 'Task Detail', page_path: '/tasks/:id', file_name: 'TaskDetailPage.tsx' },
  { page_name: 'Scripts Management', page_path: '/scripts', file_name: 'ScriptsManagement.tsx' },
  { page_name: 'Git Management', page_path: '/git', file_name: 'GitManagement.tsx' },
  { page_name: 'Git Branch Management', page_path: '/git-branches', file_name: 'GitBranchManagement.tsx' },
  { page_name: 'Living Docs', page_path: '/living-docs', file_name: 'LivingDocsPage.tsx' },
  { page_name: 'Clipboard Manager', page_path: '/clipboard', file_name: 'ClipboardManager.tsx' },
  { page_name: 'Worktree Mappings', page_path: '/worktree-mappings', file_name: 'WorktreeMappings.tsx' },
  { page_name: 'Service Dependencies', page_path: '/service-dependencies', file_name: 'ServiceDependencies.tsx' },
  { page_name: 'Deprecation Analysis', page_path: '/deprecation-analysis', file_name: 'DeprecationAnalysis.tsx' },
  { page_name: 'AI Page', page_path: '/ai', file_name: 'AIPage.tsx' }
];

function analyzePageContent(filePath: string, content: string): PageFeature[] {
  const features: PageFeature[] = [];
  const fileName = path.basename(filePath);
  
  // Look for UI components and patterns
  // Only use allowed feature types: 'page', 'component', 'hook', 'service', 'utility'
  const patterns = [
    // UI components (forms, buttons, etc.)
    { pattern: /input[^>]*type=["']text["']/g, type: 'component', name: 'Text Input Component' },
    { pattern: /input[^>]*type=["']password["']/g, type: 'component', name: 'Password Input Component' },
    { pattern: /input[^>]*type=["']email["']/g, type: 'component', name: 'Email Input Component' },
    { pattern: /input[^>]*type=["']search["']/g, type: 'component', name: 'Search Input Component' },
    { pattern: /<select/g, type: 'component', name: 'Select Dropdown Component' },
    { pattern: /<textarea/g, type: 'component', name: 'Text Area Component' },
    { pattern: /type=["']checkbox["']/g, type: 'component', name: 'Checkbox Component' },
    { pattern: /type=["']radio["']/g, type: 'component', name: 'Radio Button Component' },
    { pattern: /<button/g, type: 'component', name: 'Button Component' },
    { pattern: /<table/g, type: 'component', name: 'Table Component' },
    { pattern: /modal/gi, type: 'component', name: 'Modal Dialog Component' },
    { pattern: /tooltip/gi, type: 'component', name: 'Tooltip Component' },
    
    // React hooks
    { pattern: /useState</g, type: 'hook', name: 'React State Hook' },
    { pattern: /useEffect/g, type: 'hook', name: 'Effect Hook' },
    { pattern: /useCallback/g, type: 'hook', name: 'Callback Hook' },
    { pattern: /useMemo/g, type: 'hook', name: 'Memo Hook' },
    { pattern: /useNavigate/g, type: 'hook', name: 'Navigation Hook' },
    
    // Services 
    { pattern: /TaskService/g, type: 'service', name: 'Task Service Integration' },
    { pattern: /CLIRegistryService/g, type: 'service', name: 'CLI Registry Service Integration' },
    { pattern: /DatabaseMetadataService/g, type: 'service', name: 'Database Metadata Service Integration' },
    { pattern: /claudeService/g, type: 'service', name: 'Claude AI Service Integration' },
    { pattern: /supabase\.from/g, type: 'service', name: 'Supabase Database Service' },
    { pattern: /fetch\s*\(/g, type: 'service', name: 'HTTP Request Service' },
    
    // Utilities
    { pattern: /\.filter\s*\(/g, type: 'utility', name: 'Data Filtering Utility' },
    { pattern: /\.sort\s*\(/g, type: 'utility', name: 'Data Sorting Utility' },
    { pattern: /map\s*\([^)]*\)\s*=>/g, type: 'utility', name: 'Data Mapping Utility' },
    { pattern: /debounce/gi, type: 'utility', name: 'Debounced Input Utility' },
    { pattern: /setTimeout/g, type: 'utility', name: 'Delayed Execution Utility' },
    { pattern: /className=["'][^"']*grid/g, type: 'utility', name: 'Grid Layout Utility' },
    { pattern: /className=["'][^"']*flex/g, type: 'utility', name: 'Flex Layout Utility' },
    { pattern: /onClick=/g, type: 'utility', name: 'Click Handler Utility' },
    { pattern: /Link\s+to=/g, type: 'utility', name: 'Navigation Link Utility' },
    { pattern: /loading/gi, type: 'utility', name: 'Loading State Utility' },
    { pattern: /error/gi, type: 'utility', name: 'Error Handling Utility' },
    
    // Layout components
    { pattern: /DashboardLayout/g, type: 'component', name: 'Dashboard Layout Component' },
    { pattern: /ProtectedRoute/g, type: 'component', name: 'Route Protection Component' },
    
    // Icons and graphics
    { pattern: /from\s+['"]lucide-react['"]/, type: 'component', name: 'Lucide Icons Component' },
    { pattern: /\.svg/g, type: 'component', name: 'SVG Graphics Component' },
  ];
  
  // Count occurrences and extract features
  const featureCounts = new Map<string, number>();
  
  patterns.forEach(({ pattern, type, name }) => {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const key = `${type}:${name}`;
      featureCounts.set(key, matches.length);
      
      features.push({
        feature_name: name,
        feature_type: type,
        file_path: filePath,
        description: `${name} found ${matches.length} time(s) in ${fileName}`,
        metadata: {
          occurrence_count: matches.length,
          pattern_matched: pattern.toString()
        }
      });
    }
  });
  
  // Look for specific component imports
  const importPattern = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let importMatch;
  while ((importMatch = importPattern.exec(content)) !== null) {
    const components = importMatch[1].split(',').map(c => c.trim());
    const source = importMatch[2];
    
    if (source.startsWith('@shared/') || source.startsWith('../components/')) {
      components.forEach(component => {
        features.push({
          feature_name: `${component} Component`,
          feature_type: 'component',
          file_path: filePath,
          description: `Imported ${component} from ${source}`,
          metadata: {
            import_source: source,
            component_name: component
          }
        });
      });
    }
  }
  
  return features;
}

async function scanPageFeatures(): Promise<PageInfo[]> {
  const pagesDir = path.join(process.cwd(), 'apps/dhg-admin-code/src/pages');
  const pageInfos: PageInfo[] = [];
  
  for (const mapping of PAGE_MAPPINGS) {
    const filePath = path.join(pagesDir, mapping.file_name);
    
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const features = analyzePageContent(filePath, content);
        
        pageInfos.push({
          page_name: mapping.page_name,
          page_path: mapping.page_path,
          file_path: filePath,
          features
        });
        
        console.log(`✅ Analyzed ${mapping.page_name}: ${features.length} features found`);
      } else {
        console.warn(`⚠️  File not found: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error analyzing ${mapping.page_name}:`, error);
    }
  }
  
  return pageInfos;
}

async function populateAppFeatures(pageInfos: PageInfo[]) {
  console.log('\\n🔄 Populating app_features table...');
  
  // Get current page IDs from database
  const { data: pages, error: pagesError } = await supabase
    .from('app_ui_pages')
    .select('id, page_name, page_path')
    .eq('app_name', 'dhg-admin-code');
    
  if (pagesError) {
    throw new Error(`Failed to load pages: ${pagesError.message}`);
  }
  
  const pageIdMap = new Map<string, string>();
  pages?.forEach(page => {
    pageIdMap.set(page.page_path, page.id);
  });
  
  // Clear existing features for dhg-admin-code
  const { error: clearError } = await supabase
    .from('app_features')
    .delete()
    .eq('app_name', 'dhg-admin-code');
    
  if (clearError) {
    console.warn('Warning: Could not clear existing features:', clearError.message);
  }
  
  // Insert all features
  let totalFeatures = 0;
  
  for (const pageInfo of pageInfos) {
    for (const feature of pageInfo.features) {
      const { error } = await supabase
        .from('app_features')
        .insert({
          app_name: 'dhg-admin-code',
          feature_name: feature.feature_name,
          feature_type: feature.feature_type,
          file_path: feature.file_path,
          description: feature.description,
          metadata: feature.metadata
        });
        
      if (error) {
        console.error(`❌ Error inserting feature ${feature.feature_name}:`, error.message);
      } else {
        totalFeatures++;
      }
    }
  }
  
  console.log(`✅ Inserted ${totalFeatures} features into app_features table`);
}

async function populatePageFeatures(pageInfos: PageInfo[]) {
  console.log('\\n🔄 Populating app_page_features table...');
  
  // Get current page IDs from database
  const { data: pages, error: pagesError } = await supabase
    .from('app_ui_pages')
    .select('id, page_name, page_path')
    .eq('app_name', 'dhg-admin-code');
    
  if (pagesError) {
    throw new Error(`Failed to load pages: ${pagesError.message}`);
  }
  
  const pageIdMap = new Map<string, string>();
  pages?.forEach(page => {
    pageIdMap.set(page.page_path, page.id);
  });
  
  // Clear existing page features for dhg-admin-code pages
  const pageIds = Array.from(pageIdMap.values());
  if (pageIds.length > 0) {
    const { error: clearError } = await supabase
      .from('app_page_features')
      .delete()
      .in('page_id', pageIds);
      
    if (clearError) {
      console.warn('Warning: Could not clear existing page features:', clearError.message);
    }
  }
  
  // Group features by type and importance
  let totalPageFeatures = 0;
  
  for (const pageInfo of pageInfos) {
    const pageId = pageIdMap.get(pageInfo.page_path);
    if (!pageId) {
      console.warn(`⚠️  Page ID not found for ${pageInfo.page_path}`);
      continue;
    }
    
    // Aggregate features by type for this page
    const featureTypes = new Map<string, { count: number; features: PageFeature[] }>();
    
    pageInfo.features.forEach(feature => {
      const key = feature.feature_type;
      if (!featureTypes.has(key)) {
        featureTypes.set(key, { count: 0, features: [] });
      }
      const typeInfo = featureTypes.get(key)!;
      typeInfo.count++;
      typeInfo.features.push(feature);
    });
    
    // Create consolidated page features
    for (const [featureType, typeInfo] of featureTypes.entries()) {
      const isCritical = ['data_access', 'auth', 'navigation', 'service_integration'].includes(featureType);
      const serviceDeps = typeInfo.features
        .filter(f => f.feature_type === 'service_integration')
        .map(f => f.feature_name);
      
      const { error } = await supabase
        .from('app_page_features')
        .insert({
          page_id: pageId,
          feature_name: `${featureType.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())} (${typeInfo.count})`,
          feature_type: featureType,
          description: `${typeInfo.count} ${featureType} feature(s) on ${pageInfo.page_name}`,
          is_critical: isCritical,
          service_dependencies: serviceDeps.length > 0 ? serviceDeps : null
        });
        
      if (error) {
        console.error(`❌ Error inserting page feature for ${pageInfo.page_name}:`, error.message);
      } else {
        totalPageFeatures++;
      }
    }
  }
  
  console.log(`✅ Inserted ${totalPageFeatures} page features into app_page_features table`);
}

async function main() {
  console.log('🚀 Starting dhg-admin-code feature scanning...');
  
  try {
    // Scan all page files
    const pageInfos = await scanPageFeatures();
    console.log(`\\n📊 Scanned ${pageInfos.length} pages`);
    
    // Populate database tables
    await populateAppFeatures(pageInfos);
    await populatePageFeatures(pageInfos);
    
    // Summary
    const totalFeatures = pageInfos.reduce((sum, page) => sum + page.features.length, 0);
    console.log(`\\n🎉 Successfully completed feature scanning!`);
    console.log(`   📄 Pages analyzed: ${pageInfos.length}`);
    console.log(`   🔧 Total features found: ${totalFeatures}`);
    console.log(`   📊 Average features per page: ${Math.round(totalFeatures / pageInfos.length)}`);
    
  } catch (error) {
    console.error('❌ Error during feature scanning:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}