/**
 * Scan Services Command
 * 
 * Discovers and registers all shared services in the monorepo by:
 * 1. Scanning packages/shared/services/ directory recursively
 * 2. Parsing TypeScript files for exports and metadata
 * 3. Identifying service types (singleton, adapter, utility)
 * 4. Registering services in the services_registry table
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
const glob = promisify(require('glob'));

interface ServiceInfo {
  serviceName: string;
  displayName: string;
  description?: string;
  packagePath: string;
  serviceFile: string;
  serviceType: 'singleton' | 'adapter' | 'utility' | 'helper';
  exportType: 'class' | 'function' | 'object' | 'constant';
  isSingleton: boolean;
  exports?: Array<{
    name: string;
    type: string;
    isDefault: boolean;
  }>;
}

interface ScanOptions {
  dryRun?: boolean;
  verbose?: boolean;
  force?: boolean;
  limit?: number;
}

class ServiceScanner {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = process.cwd();
  private servicesPath = path.join(this.projectRoot, 'packages/shared/services');

  async scanServices(options: ScanOptions = {}): Promise<void> {
    const { dryRun = false, verbose = false, force = false, limit } = options;

    console.log('🔍 Scanning for shared services...');
    console.log(`📁 Searching in: ${this.servicesPath}`);
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }
    
    console.log('');

    try {
      // Find all TypeScript service files
      const serviceFiles = await this.findServiceFiles();
      
      if (limit && serviceFiles.length > limit) {
        serviceFiles.splice(limit);
        console.log(`⚠️ Limited to ${limit} services`);
      }

      console.log(`📋 Found ${serviceFiles.length} service files to analyze`);
      console.log('');

      // Analyze each service file
      const services: ServiceInfo[] = [];
      for (const filePath of serviceFiles) {
        try {
          const serviceInfo = await this.analyzeServiceFile(filePath, verbose);
          if (serviceInfo) {
            services.push(serviceInfo);
          }
        } catch (error) {
          console.log(`   ❌ Failed to analyze ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log('');
      console.log(`✅ Successfully analyzed ${services.length} services`);
      console.log('');

      // Register services in database
      if (!dryRun) {
        await this.registerServices(services, force, verbose);
      } else {
        this.showServicesPreview(services);
      }

      // Show summary
      this.showScanSummary(services);

    } catch (error) {
      Logger.error(`Service scan failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  private async findServiceFiles(): Promise<string[]> {
    const pattern = path.join(this.servicesPath, '**/*.ts').replace(/\\/g, '/');
    
    try {
      // glob returns an array in newer versions
      const files = await glob(pattern, { 
        ignore: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'] 
      });
      
      // Check if files is an array
      if (!Array.isArray(files)) {
        console.log('Glob returned non-array:', typeof files);
        return [];
      }
      
      return files.filter(file => {
        // Exclude index files and test files
        const basename = path.basename(file);
        return !basename.startsWith('index.') && 
               !basename.includes('.test.') && 
               !basename.includes('.spec.');
      });
    } catch (error) {
      console.error('Error finding service files:', error);
      return [];
    }
  }

  private async analyzeServiceFile(filePath: string, verbose: boolean): Promise<ServiceInfo | null> {
    const relativePath = path.relative(this.projectRoot, filePath);
    const serviceFile = path.basename(filePath);
    const packagePath = path.dirname(relativePath);
    
    if (verbose) {
      console.log(`🔍 Analyzing: ${relativePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract service metadata
      const serviceName = this.extractServiceName(filePath, content);
      const displayName = this.extractDisplayName(serviceName, content);
      const description = this.extractDescription(content);
      const serviceType = this.determineServiceType(content, serviceName);
      const exportType = this.determineExportType(content);
      const isSingleton = this.isSingletonService(content);
      const exports = this.extractExports(content);

      if (verbose) {
        console.log(`   📋 Service: ${serviceName} (${serviceType})`);
      }

      return {
        serviceName,
        displayName,
        description,
        packagePath,
        serviceFile,
        serviceType,
        exportType,
        isSingleton,
        exports
      };

    } catch (error) {
      if (verbose) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      return null;
    }
  }

  private extractServiceName(filePath: string, content: string): string {
    const fileName = path.basename(filePath, '.ts');
    
    // Try to extract from class/function declarations
    const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+)/);
    if (classMatch) {
      return classMatch[1];
    }
    
    const functionMatch = content.match(/export\s+(?:default\s+)?(?:const|function)\s+(\w+)/);
    if (functionMatch) {
      return functionMatch[1];
    }
    
    // Fall back to file name
    return fileName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private extractDisplayName(serviceName: string, content: string): string {
    // Try to extract from JSDoc comments
    const jsdocMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^\n*]+)/);
    if (jsdocMatch) {
      return jsdocMatch[1].trim();
    }
    
    // Convert camelCase/PascalCase to readable format
    return serviceName.replace(/([A-Z])/g, ' $1').trim();
  }

  private extractDescription(content: string): string | undefined {
    // Extract from JSDoc block
    const jsdocMatch = content.match(/\/\*\*\s*([\s\S]*?)\*\//);
    if (jsdocMatch) {
      const jsdocContent = jsdocMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line.length > 0)
        .join(' ');
      
      return jsdocContent.length > 10 ? jsdocContent : undefined;
    }
    
    return undefined;
  }

  private determineServiceType(content: string, serviceName: string): ServiceInfo['serviceType'] {
    // Check for singleton pattern
    if (content.includes('getInstance()') || content.includes('instance')) {
      return 'singleton';
    }
    
    // Check for adapter pattern
    if (serviceName.toLowerCase().includes('adapter') || content.includes('createAdapter')) {
      return 'adapter';
    }
    
    // Check for utility functions
    if (content.includes('export function') || content.includes('export const')) {
      return 'utility';
    }
    
    return 'helper';
  }

  private determineExportType(content: string): ServiceInfo['exportType'] {
    if (content.includes('export class') || content.includes('export default class')) {
      return 'class';
    }
    
    if (content.includes('export function') || content.includes('export default function')) {
      return 'function';
    }
    
    if (content.includes('export const') && content.includes('{')) {
      return 'object';
    }
    
    return 'constant';
  }

  private isSingletonService(content: string): boolean {
    return content.includes('getInstance()') || 
           content.includes('private static instance') ||
           content.includes('static getInstance');
  }

  private extractExports(content: string): Array<{ name: string; type: string; isDefault: boolean }> {
    const exports: Array<{ name: string; type: string; isDefault: boolean }> = [];
    
    // Extract named exports
    const namedExportMatches = content.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g);
    for (const match of namedExportMatches) {
      exports.push({
        name: match[1],
        type: this.getExportType(content, match[1]),
        isDefault: false
      });
    }
    
    // Extract default export
    const defaultExportMatch = content.match(/export\s+default\s+(?:class\s+)?(\w+)/);
    if (defaultExportMatch) {
      exports.push({
        name: defaultExportMatch[1],
        type: this.getExportType(content, defaultExportMatch[1]),
        isDefault: true
      });
    }
    
    return exports;
  }

  private getExportType(content: string, exportName: string): string {
    if (content.includes(`class ${exportName}`)) return 'class';
    if (content.includes(`function ${exportName}`)) return 'function';
    if (content.includes(`const ${exportName}`) && content.includes('{')) return 'object';
    return 'constant';
  }

  private async registerServices(services: ServiceInfo[], force: boolean, verbose: boolean): Promise<void> {
    console.log('💾 Registering services in database...');
    
    let registered = 0;
    let updated = 0;
    let skipped = 0;

    for (const service of services) {
      try {
        // Check if service already exists
        const { data: existing } = await this.supabase
          .from('services_registry')
          .select('id, service_name')
          .eq('service_name', service.serviceName)
          .single();

        if (existing && !force) {
          skipped++;
          if (verbose) {
            console.log(`   ⏭️ Skipped existing: ${service.serviceName}`);
          }
          continue;
        }

        const serviceData = {
          service_name: service.serviceName,
          display_name: service.displayName,
          description: service.description,
          package_path: service.packagePath,
          service_file: service.serviceFile,
          service_type: service.serviceType,
          export_type: service.exportType,
          is_singleton: service.isSingleton,
          status: 'active',
          updated_at: new Date().toISOString()
        };

        if (existing) {
          // Update existing service
          const { error } = await this.supabase
            .from('services_registry')
            .update(serviceData)
            .eq('id', existing.id);

          if (error) {
            throw new Error(`Failed to update service: ${error.message}`);
          }

          updated++;
          if (verbose) {
            console.log(`   🔄 Updated: ${service.serviceName}`);
          }
        } else {
          // Insert new service
          const { data: newService, error } = await this.supabase
            .from('services_registry')
            .insert(serviceData)
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to insert service: ${error.message}`);
          }

          // Register service exports if any
          if (service.exports && service.exports.length > 0) {
            await this.registerServiceExports(newService.id, service.exports);
          }

          registered++;
          if (verbose) {
            console.log(`   ✅ Registered: ${service.serviceName}`);
          }
        }

      } catch (error) {
        console.log(`   ❌ Failed to register ${service.serviceName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('');
    console.log(`📊 Registration Results:`);
    console.log(`   ✅ Registered: ${registered}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ⏭️ Skipped: ${skipped}`);
  }

  private async registerServiceExports(serviceId: string, exports: Array<{ name: string; type: string; isDefault: boolean }>): Promise<void> {
    const exportData = exports.map(exp => ({
      service_id: serviceId,
      export_name: exp.name,
      export_type: exp.type,
      is_default: exp.isDefault
    }));

    const { error } = await this.supabase
      .from('service_exports')
      .insert(exportData);

    if (error) {
      console.log(`   ⚠️ Failed to register exports: ${error.message}`);
    }
  }

  private showServicesPreview(services: ServiceInfo[]): void {
    console.log('🔍 Services Preview (DRY RUN):');
    console.log('');
    
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.serviceName}`);
      console.log(`   Type: ${service.serviceType}`);
      console.log(`   Path: ${service.packagePath}`);
      console.log(`   File: ${service.serviceFile}`);
      if (service.description) {
        console.log(`   Description: ${service.description.substring(0, 100)}...`);
      }
      console.log('');
    });
  }

  private showScanSummary(services: ServiceInfo[]): void {
    console.log('📊 Scan Summary:');
    console.log('');
    
    const byType = services.reduce((acc, service) => {
      acc[service.serviceType] = (acc[service.serviceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} services`);
    });

    const singletons = services.filter(s => s.isSingleton).length;
    console.log(`   singletons: ${singletons} services`);
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
    console.log('Scan Services Command');
    console.log('');
    console.log('Discovers and registers all shared services in the monorepo.');
    console.log('');
    console.log('Usage: scan-services [options]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run         Preview mode without making changes');
    console.log('  --verbose, -v     Show detailed output');
    console.log('  --force, -f       Update existing services');
    console.log('  --limit, -l       Limit number of services to process');
    console.log('  --help, -h        Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  scan-services');
    console.log('  scan-services --dry-run --verbose');
    console.log('  scan-services --force --limit 10');
    return;
  }

  const scanner = new ServiceScanner();
  await scanner.scanServices(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}