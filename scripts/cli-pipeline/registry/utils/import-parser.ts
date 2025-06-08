import * as path from 'path';

// Import types
export type ImportType = 'shared-service' | 'local' | 'external' | 'relative';

export interface ParsedImport {
  statement: string;
  source: string;
  importPath: string;
  type: ImportType;
  isTypeOnly: boolean;
  importedItems: string[];
}

// Regular expressions for import parsing
const IMPORT_REGEX = /import\s+(?:type\s+)?(?:(\*\s+as\s+\w+)|(\w+)|({[^}]+}))\s+from\s+['"]([^'"]+)['"]/g;
const REQUIRE_REGEX = /(?:const|let|var)\s+(?:({[^}]+})|\w+)\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// Parse all imports from file content
export function parseImports(content: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  
  // Parse ES6 imports
  let match: RegExpExecArray | null;
  IMPORT_REGEX.lastIndex = 0;
  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const [fullMatch, namespaceImport, defaultImport, namedImports, importPath] = match;
    const isTypeOnly = fullMatch.includes('import type');
    
    const importedItems: string[] = [];
    if (namespaceImport) {
      importedItems.push(namespaceImport.replace('* as ', ''));
    } else if (defaultImport) {
      importedItems.push(defaultImport);
    } else if (namedImports) {
      // Extract individual named imports
      const names = namedImports
        .replace(/{|}/g, '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s)
        .map((s: string) => s.split(' as ')[0].trim());
      importedItems.push(...names);
    }
    
    imports.push({
      statement: fullMatch,
      source: importPath,
      importPath: importPath,
      type: classifyImport(importPath),
      isTypeOnly,
      importedItems
    });
  }
  
  // Parse CommonJS requires
  REQUIRE_REGEX.lastIndex = 0;
  while ((match = REQUIRE_REGEX.exec(content)) !== null) {
    const [fullMatch, , importPath] = match;
    
    imports.push({
      statement: fullMatch,
      source: importPath,
      importPath: importPath,
      type: classifyImport(importPath),
      isTypeOnly: false,
      importedItems: [] // Could parse destructured but not critical
    });
  }
  
  // Parse dynamic imports
  DYNAMIC_IMPORT_REGEX.lastIndex = 0;
  while ((match = DYNAMIC_IMPORT_REGEX.exec(content)) !== null) {
    const [fullMatch, importPath] = match;
    
    imports.push({
      statement: fullMatch,
      source: importPath,
      importPath: importPath,
      type: classifyImport(importPath),
      isTypeOnly: false,
      importedItems: ['*'] // Dynamic imports import everything
    });
  }
  
  return imports;
}

// Classify import type based on path
export function classifyImport(importPath: string): ImportType {
  // Shared services imports (including adapters)
  if (importPath.startsWith('@shared/services') || 
      importPath.includes('packages/shared/services') ||
      importPath.startsWith('@shared/adapters') ||
      importPath.includes('packages/shared/adapters')) {
    return 'shared-service';
  }
  
  // Local imports (alias)
  if (importPath.startsWith('@/')) {
    return 'local';
  }
  
  // Relative imports
  if (importPath.startsWith('.')) {
    return 'relative';
  }
  
  // Everything else is external (npm packages)
  return 'external';
}

// Extract service name from import path
export function extractServiceFromImport(importPath: string): string | null {
  // Handle @shared/services imports with file-specific patterns
  const sharedMatch = importPath.match(/@shared\/services\/(.+)/);
  if (sharedMatch) {
    return extractServiceFromSharedPath(sharedMatch[1]);
  }
  
  // Handle @shared/adapters imports (adapters are services too)
  const adapterMatch = importPath.match(/@shared\/adapters\/([^/]+)/);
  if (adapterMatch) {
    // Convert adapter name to service name (e.g., supabase-adapter -> supabase)
    return adapterMatch[1].replace('-adapter', '');
  }
  
  // Handle relative imports to shared services (multiple levels deep)
  const relativeMatch = importPath.match(/packages\/shared\/services\/(.+)/);
  if (relativeMatch) {
    return extractServiceFromSharedPath(relativeMatch[1]);
  }
  
  // Handle relative imports to shared adapters
  const relativeAdapterMatch = importPath.match(/packages\/shared\/adapters\/([^/]+)/);
  if (relativeAdapterMatch) {
    return relativeAdapterMatch[1].replace('-adapter', '');
  }
  
  return null;
}

// Enhanced service extraction from shared services path
function extractServiceFromSharedPath(fullPath: string): string | null {
  // Pattern 1: service-name/service-file
  // e.g., filter-service/filter-service -> filter-service (from file)
  const specificServiceMatch = fullPath.match(/([^/]+)\/([^/]+)$/);
  if (specificServiceMatch) {
    const [, directory, filename] = specificServiceMatch;
    
    // Priority 1: Extract from filename if it's a clear service name
    const serviceFromFile = extractServiceNameFromFilename(filename);
    if (serviceFromFile && serviceFromFile !== directory) {
      // If filename differs from directory, it's likely the specific service
      return serviceFromFile;
    }
    
    // Priority 2: Handle same-name pattern (filter-service/filter-service)
    if (filename === directory || filename === directory + '-service') {
      return directory;
    }
    
    // Priority 3: Handle service variants (auth-service/browser-auth-service)
    if (filename.includes(directory)) {
      return extractServiceNameFromFilename(filename) || filename;
    }
    
    // Fallback to directory name
    return directory;
  }
  
  // Pattern 2: direct service file
  // e.g., some-service or batch-processing-service.ts
  return extractServiceNameFromFilename(fullPath) || fullPath;
}

// Helper function to extract service name from filename
function extractServiceNameFromFilename(filename: string): string | null {
  // Remove file extension
  const withoutExt = filename.replace(/\.(ts|js|tsx|jsx)$/, '');
  
  // Handle index files - return null to use parent directory context
  if (withoutExt === 'index') {
    return null;
  }
  
  // Handle common service patterns:
  
  // Pattern 1: Exact service suffix patterns
  if (withoutExt.endsWith('-service')) {
    return withoutExt.slice(0, -8); // Remove '-service'
  }
  
  if (withoutExt.endsWith('-adapter')) {
    return withoutExt.slice(0, -8); // Remove '-adapter'
  }
  
  if (withoutExt.endsWith('.service')) {
    return withoutExt.slice(0, -8); // Remove '.service'
  }
  
  // Pattern 2: Service variations (browser-auth-service -> browser-auth)
  if (withoutExt.includes('-') && withoutExt.endsWith('service')) {
    // Handle cases like "browser-auth-service" -> "browser-auth"
    const parts = withoutExt.split('-');
    if (parts[parts.length - 1] === 'service') {
      return parts.slice(0, -1).join('-');
    }
  }
  
  // Pattern 3: Standalone service names
  // For files like "filter-service" in directory "filter-service"
  // Keep the full name as the service identifier
  
  return withoutExt;
}

// Get normalized import path for comparison
export function normalizeImportPath(importPath: string, fromFile: string): string {
  // If it's already an absolute or alias path, return as is
  if (!importPath.startsWith('.')) {
    return importPath;
  }
  
  // Resolve relative imports
  const fromDir = path.dirname(fromFile);
  const resolved = path.resolve(fromDir, importPath);
  
  // Try to convert back to a recognizable pattern
  if (resolved.includes('packages/shared/services')) {
    const serviceMatch = resolved.match(/packages\/shared\/services\/(.+)/);
    if (serviceMatch) {
      return `@shared/services/${serviceMatch[1].replace(/\.(ts|js|tsx|jsx)$/, '')}`;
    }
  }
  
  return resolved;
}

// Filter imports to only shared services
export function filterSharedServiceImports(imports: ParsedImport[]): ParsedImport[] {
  return imports.filter(imp => imp.type === 'shared-service');
}

// Get unique service names from imports
export function getUniqueServicesFromImports(imports: ParsedImport[]): string[] {
  const services = new Set<string>();
  
  for (const imp of imports) {
    const serviceName = extractServiceFromImport(imp.importPath);
    if (serviceName) {
      services.add(serviceName);
    }
  }
  
  return Array.from(services);
}

// Analyze import frequency
export function analyzeImportFrequency(imports: ParsedImport[]): Map<string, number> {
  const frequency = new Map<string, number>();
  
  for (const imp of imports) {
    const serviceName = extractServiceFromImport(imp.importPath);
    if (serviceName) {
      frequency.set(serviceName, (frequency.get(serviceName) || 0) + 1);
    }
  }
  
  return frequency;
}

// Determine dependency type based on import pattern
export function getDependencyType(imp: ParsedImport): string {
  const importPath = imp.importPath.toLowerCase();
  
  // Check for adapter pattern
  if (importPath.includes('adapter')) {
    return 'adapter-usage';
  }
  
  // Check for singleton pattern (often has getInstance)
  if (imp.importedItems.some(item => 
    item.toLowerCase().includes('service') || 
    item.toLowerCase().includes('instance'))) {
    return 'singleton-call';
  }
  
  // Default to direct import
  return 'direct-import';
}