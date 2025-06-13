#!/usr/bin/env ts-node

/**
 * Smart Service Discovery - Phase 1 Fix
 * Only registers services that are actually meant to be services
 * Stops creating duplicates from scanning old/unused code
 */

import * as fs from 'fs';
import * as path from 'path';

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

interface ServiceCandidate {
  name: string;
  path: string;
  isActualService: boolean;
  reason: string;
  confidence: number;
}

class SmartServiceDiscovery {
  private servicesDir = path.join(__dirname, '../../../packages/shared/services');
  private existingServices: Set<string> = new Set();
  
  async discover(): Promise<void> {
    console.log('🔍 Smart Service Discovery - Phase 1\n');
    console.log('Goal: Only register actual services, stop duplicate creation\n');
    
    // Load existing services
    await this.loadExistingServices();
    
    // Find actual service directories (not individual files)
    const candidates = await this.findServiceCandidates();
    
    // Filter to only real services
    const actualServices = candidates.filter(c => c.isActualService && c.confidence >= 80);
    
    console.log(`📊 Analysis Results:`);
    console.log(`  Total candidates found: ${candidates.length}`);
    console.log(`  Actual services: ${actualServices.length}`);
    console.log(`  Already registered: ${this.existingServices.size}`);
    console.log(`  New services to add: ${actualServices.filter(s => !this.existingServices.has(s.name)).length}\n`);
    
    // Show what we're rejecting and why
    const rejected = candidates.filter(c => !c.isActualService || c.confidence < 80);
    if (rejected.length > 0) {
      console.log('❌ Rejecting these candidates:');
      rejected.forEach(r => {
        console.log(`  - ${r.name}: ${r.reason} (confidence: ${r.confidence}%)`);
      });
      console.log('');
    }
    
    // Register only the new actual services
    const newServices = actualServices.filter(s => !this.existingServices.has(s.name));
    if (newServices.length > 0) {
      console.log('✅ Registering these new services:');
      newServices.forEach(s => {
        console.log(`  + ${s.name}: ${s.reason}`);
      });
      
      // Only register if we're confident
      // await this.registerServices(newServices);
    } else {
      console.log('✅ No new services to register - registry is up to date!');
    }
  }
  
  private async loadExistingServices(): Promise<void> {
    const { data, error } = await supabase
      .from('sys_shared_services')
      .select('service_name');
    
    if (error) throw error;
    
    data?.forEach((service: any) => {
      this.existingServices.add(service.service_name);
    });
    
    console.log(`📋 Loaded ${this.existingServices.size} existing services from registry\n`);
  }
  
  private async findServiceCandidates(): Promise<ServiceCandidate[]> {
    const candidates: ServiceCandidate[] = [];
    
    // Scan service directories (not individual files)
    if (!fs.existsSync(this.servicesDir)) {
      console.error('Services directory not found:', this.servicesDir);
      return candidates;
    }
    
    const entries = fs.readdirSync(this.servicesDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = path.join(this.servicesDir, entry.name);
        const candidate = await this.analyzeServiceDirectory(entry.name, dirPath);
        if (candidate) {
          candidates.push(candidate);
        }
      }
    }
    
    return candidates;
  }
  
  private async analyzeServiceDirectory(dirName: string, dirPath: string): Promise<ServiceCandidate | null> {
    const indexPath = path.join(dirPath, 'index.ts');
    const mainFile = fs.existsSync(indexPath) ? indexPath : null;
    
    if (!mainFile) {
      // No index.ts, might be a service file directly
      const tsFiles = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.ts') && !f.includes('.test.'))
        .filter(f => f.includes('service') || f === `${dirName}.ts`);
      
      if (tsFiles.length === 0) {
        return {
          name: dirName,
          path: dirPath,
          isActualService: false,
          reason: 'No service files found',
          confidence: 0
        };
      }
    }
    
    // Read the main service file
    const content = fs.readFileSync(mainFile || path.join(dirPath, fs.readdirSync(dirPath)[0]), 'utf-8');
    
    return this.analyzeServiceContent(dirName, dirPath, content);
  }
  
  private analyzeServiceContent(name: string, dirPath: string, content: string): ServiceCandidate {
    let confidence = 0;
    const reasons: string[] = [];
    
    // Positive indicators (increase confidence)
    if (content.includes('export class') && content.includes('Service')) {
      confidence += 30;
      reasons.push('Has service class');
    }
    
    if (content.includes('getInstance')) {
      confidence += 25;
      reasons.push('Singleton pattern');
    }
    
    if (content.includes('constructor') && content.includes('private')) {
      confidence += 20;
      reasons.push('Proper encapsulation');
    }
    
    if (content.includes('Supabase') || content.includes('database')) {
      confidence += 15;
      reasons.push('Database integration');
    }
    
    if (fs.existsSync(path.join(dirPath, 'index.ts'))) {
      confidence += 10;
      reasons.push('Has index file');
    }
    
    // Negative indicators (decrease confidence)
    if (content.includes('// TODO') || content.includes('PLACEHOLDER')) {
      confidence -= 20;
      reasons.push('Contains TODOs/placeholders');
    }
    
    if (content.length < 100) {
      confidence -= 30;
      reasons.push('Very small file (likely stub)');
    }
    
    if (name.includes('test') || name.includes('mock') || name.includes('example')) {
      confidence -= 40;
      reasons.push('Test/mock/example code');
    }
    
    // Special cases - known good patterns
    const goodPatterns = [
      'supabase-client', 'claude-service', 'auth-service', 
      'document-type-service', 'google-drive', 'work-summary-service'
    ];
    
    if (goodPatterns.some(pattern => name.toLowerCase().includes(pattern))) {
      confidence += 20;
      reasons.push('Known good service pattern');
    }
    
    // Check if it's actually used (has exports that look useful)
    const hasUsefulExports = content.includes('export const') || 
                           content.includes('export class') ||
                           content.includes('export default');
    
    if (!hasUsefulExports) {
      confidence -= 25;
      reasons.push('No useful exports');
    }
    
    // Determine service name (prefer class name over directory name)
    const classMatch = content.match(/export\s+class\s+(\w+Service|\w+Client|\w+Adapter)/);
    const serviceName = classMatch ? classMatch[1] : name;
    
    return {
      name: serviceName,
      path: dirPath,
      isActualService: confidence >= 50,
      reason: reasons.join(', ') || 'Basic analysis',
      confidence: Math.max(0, Math.min(100, confidence))
    };
  }
  
  private async registerServices(services: ServiceCandidate[]): Promise<void> {
    console.log('\n💾 Registering new services...\n');
    
    for (const service of services) {
      const { error } = await supabase
        .from('sys_shared_services')
        .insert({
          service_name: service.name,
          service_path: path.relative(process.cwd(), service.path),
          description: `${service.name} - Smart discovery (${service.confidence}% confidence)`,
          category: this.categorizeService(service.name),
          status: 'active',
          confidence_score: service.confidence,
          scan_frequency: 'weekly',
          next_scan_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
      
      if (error) {
        console.error(`❌ Failed to register ${service.name}:`, error.message);
      } else {
        console.log(`✅ Registered ${service.name} (${service.confidence}% confidence)`);
      }
    }
  }
  
  private categorizeService(name: string): string {
    const lowName = name.toLowerCase();
    
    if (lowName.includes('auth')) return 'auth';
    if (lowName.includes('supabase') || lowName.includes('database')) return 'database';
    if (lowName.includes('google') || lowName.includes('drive')) return 'google';
    if (lowName.includes('claude') || lowName.includes('ai')) return 'ai';
    if (lowName.includes('document')) return 'document';
    if (lowName.includes('file')) return 'file';
    if (lowName.includes('media') || lowName.includes('audio')) return 'media';
    if (lowName.includes('work') || lowName.includes('task')) return 'workflow';
    
    return 'utility';
  }
}

// Run the smart discovery
const discovery = new SmartServiceDiscovery();
discovery.discover().catch(console.error);