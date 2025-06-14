#!/usr/bin/env ts-node

/**
 * Discover new services that aren't yet registered in sys_shared_services
 * This ensures we capture ALL services as they're created
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

interface DiscoveredService {
  serviceName: string;
  filePath: string;
  category: string;
  hasIndexFile: boolean;
  exports: string[];
  isSingleton: boolean;
  hasBrowserVariant: boolean;
}

class ServiceDiscoverer {
  private servicesDir = path.join(__dirname, '../../../packages/shared/services');
  private existingServices: Set<string> = new Set();
  private newServices: DiscoveredService[] = [];
  
  async discover(): Promise<void> {
    console.log('🔍 Discovering new shared services...\n');
    
    // Step 1: Load existing services
    await this.loadExistingServices();
    
    // Step 2: Scan file system for all services
    await this.scanFileSystem();
    
    // Step 3: Register new services
    if (this.newServices.length > 0) {
      await this.registerNewServices();
    }
    
    // Step 4: Report findings
    this.reportFindings();
  }
  
  private async loadExistingServices(): Promise<void> {
    const { data, error } = await supabase
      .from('sys_shared_services')
      .select('service_name, service_path');
    
    if (error) throw error;
    
    data?.forEach((service: any) => {
      this.existingServices.add(service.service_name);
      // Also track by path to catch renamed services
      this.existingServices.add(service.service_path);
    });
    
    console.log(`Found ${this.existingServices.size} existing services in database\n`);
  }
  
  private async scanFileSystem(): Promise<void> {
    // Find all TypeScript files in services directory
    const serviceFiles = this.findServiceFiles(this.servicesDir);
    
    for (const file of serviceFiles) {
      const relativePath = path.relative(process.cwd(), file);
      
      // Skip if already registered
      if (this.existingServices.has(relativePath)) continue;
      
      // Analyze the service
      const service = await this.analyzeService(file);
      if (service) {
        // Check if service name already exists (might be moved)
        if (!this.existingServices.has(service.serviceName)) {
          this.newServices.push(service);
          console.log(`📦 Found new service: ${service.serviceName}`);
        }
      }
    }
  }
  
  private findServiceFiles(dir: string): string[] {
    const files: string[] = [];
    
    const scanDir = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip test directories and node_modules
          if (!entry.name.startsWith('.') && 
              entry.name !== '__tests__' && 
              entry.name !== 'node_modules') {
            scanDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          // Skip test files
          if (!entry.name.includes('.test.') && 
              !entry.name.includes('.spec.')) {
            files.push(fullPath);
          }
        }
      }
    };
    
    scanDir(dir);
    return files;
  }
  
  private async analyzeService(filePath: string): Promise<DiscoveredService | null> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Skip if it's not a service (heuristics)
    if (!content.includes('export class') && 
        !content.includes('export const') &&
        !content.includes('export function')) {
      return null;
    }
    
    // Extract service name from file path or content
    const serviceName = this.extractServiceName(filePath, content);
    if (!serviceName) return null;
    
    // Determine category from path
    const category = this.determineCategory(filePath);
    
    // Check for common patterns
    const isSingleton = content.includes('getInstance') || 
                       content.includes('private static instance');
    const hasBrowserVariant = content.includes('browser') || 
                             content.includes('BrowserService');
    
    // Extract exports
    const exports = this.extractExports(content);
    
    return {
      serviceName,
      filePath: path.relative(process.cwd(), filePath),
      category,
      hasIndexFile: path.basename(filePath) === 'index.ts',
      exports,
      isSingleton,
      hasBrowserVariant
    };
  }
  
  private extractServiceName(filePath: string, content: string): string {
    // Try to find class name
    const classMatch = content.match(/export\s+class\s+(\w+)/);
    if (classMatch) return classMatch[1];
    
    // Try to find exported const
    const constMatch = content.match(/export\s+const\s+(\w+Service)/);
    if (constMatch) return constMatch[1];
    
    // Fall back to directory name
    const dirName = path.basename(path.dirname(filePath));
    if (dirName !== 'services') {
      return dirName;
    }
    
    // Fall back to file name
    const fileName = path.basename(filePath, '.ts');
    if (fileName !== 'index') {
      return fileName;
    }
    
    return '';
  }
  
  private determineCategory(filePath: string): string {
    const relativePath = filePath.toLowerCase();
    
    if (relativePath.includes('auth')) return 'auth';
    if (relativePath.includes('database') || relativePath.includes('supabase')) return 'database';
    if (relativePath.includes('google') || relativePath.includes('drive')) return 'google';
    if (relativePath.includes('ai') || relativePath.includes('claude')) return 'ai';
    if (relativePath.includes('media') || relativePath.includes('audio') || relativePath.includes('video')) return 'media';
    if (relativePath.includes('document')) return 'document';
    if (relativePath.includes('file')) return 'file';
    if (relativePath.includes('git')) return 'git';
    if (relativePath.includes('command') || relativePath.includes('cli')) return 'cli';
    if (relativePath.includes('test')) return 'testing';
    
    return 'utility';
  }
  
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Find all export statements
    const exportMatches = content.matchAll(/export\s+(?:class|const|function|interface|type)\s+(\w+)/g);
    for (const match of exportMatches) {
      exports.push(match[1]);
    }
    
    return exports;
  }
  
  private async registerNewServices(): Promise<void> {
    console.log(`\n💾 Registering ${this.newServices.length} new services...\n`);
    
    for (const service of this.newServices) {
      // Generate a normalized name
      const normalizedName = service.serviceName
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
      
      const { error } = await supabase
        .from('sys_shared_services')
        .insert({
          service_name: service.serviceName,
          service_path: service.filePath,
          description: `${service.serviceName} - Discovered by automated scan`,
          category: service.category,
          is_singleton: service.isSingleton,
          has_browser_variant: service.hasBrowserVariant,
          exports: service.exports,
          status: 'active',
          service_name_normalized: normalizedName,
          scan_frequency: 'weekly',
          next_scan_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
      
      if (error) {
        console.error(`Failed to register ${service.serviceName}:`, error);
      } else {
        console.log(`✅ Registered ${service.serviceName}`);
      }
    }
  }
  
  private reportFindings(): void {
    console.log('\n📊 Discovery Summary:');
    console.log(`- Services already registered: ${this.existingServices.size}`);
    console.log(`- New services discovered: ${this.newServices.length}`);
    
    if (this.newServices.length > 0) {
      console.log('\nNew services by category:');
      const byCategory = this.newServices.reduce((acc, service) => {
        acc[service.category] = (acc[service.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(byCategory).forEach(([category, count]) => {
        console.log(`  - ${category}: ${count}`);
      });
    }
  }
}

// Run the discoverer
const discoverer = new ServiceDiscoverer();
discoverer.discover().catch(console.error);