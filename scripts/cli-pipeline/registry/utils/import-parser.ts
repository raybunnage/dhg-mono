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
  let match;
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
        .map(s => s.trim())
        .filter(s => s)
        .map(s => s.split(' as ')[0].trim());
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
    const [fullMatch, destructured, importPath] = match;
    
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
  // Shared services imports
  if (importPath.startsWith('@shared/services') || 
      importPath.includes('packages/shared/services')) {
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
  // Handle @shared/services imports
  const sharedMatch = importPath.match(/@shared\/services\/([^/]+)/);
  if (sharedMatch) {
    return sharedMatch[1];
  }
  
  // Handle relative imports to shared services
  const relativeMatch = importPath.match(/packages\/shared\/services\/([^/]+)/);
  if (relativeMatch) {
    return relativeMatch[1];
  }
  
  return null;
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