#!/usr/bin/env ts-node

/**
 * Analyze service compliance with environment standards
 * This script evaluates each service against the SERVICE_STANDARDS_CHECKLIST
 * and identifies all callers that need to be updated after refactoring
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client.js';
import { execSync } from 'child_process';

const supabase = SupabaseClientService.getInstance().getClient();

interface ServiceAnalysis {
  serviceName: string;
  filePath: string;
  environmentType: 'universal' | 'node-only' | 'browser-only' | 'proxy-required';
  complianceIssues: string[];
  hasTests: boolean;
  callers: {
    apps: string[];
    pipelines: string[];
    proxyServers: string[];
    services: string[];
  };
  refactoringNeeded: boolean;
  refactoringNotes: string;
}

class ServiceComplianceAnalyzer {
  private servicesDir = path.join(process.cwd(), 'packages/shared/services');
  
  async analyzeAllServices(): Promise<void> {
    console.log('🔍 Starting service compliance analysis...\n');
    
    // Get all services from database
    const { data: services, error } = await supabase
      .from('sys_shared_services')
      .select('*')
      .order('service_name');
    
    if (error) {
      console.error('Error fetching services:', error);
      return;
    }
    
    const results: ServiceAnalysis[] = [];
    
    for (const service of services || []) {
      console.log(`\n📋 Analyzing ${service.service_name}...`);
      const analysis = await this.analyzeService(service);
      results.push(analysis);
      
      // Update database with findings
      await this.updateServiceCompliance(service.id, analysis);
    }
    
    // Generate report
    await this.generateReport(results);
  }
  
  private async analyzeService(service: any): Promise<ServiceAnalysis> {
    const analysis: ServiceAnalysis = {
      serviceName: service.service_name,
      filePath: service.service_path,
      environmentType: 'universal',
      complianceIssues: [],
      hasTests: false,
      callers: {
        apps: [],
        pipelines: [],
        proxyServers: [],
        services: []
      },
      refactoringNeeded: false,
      refactoringNotes: ''
    };
    
    // Read service file
    const fullPath = path.join(process.cwd(), service.service_path);
    if (!fs.existsSync(fullPath)) {
      analysis.complianceIssues.push('Service file not found');
      analysis.refactoringNeeded = true;
      return analysis;
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Check compliance items
    this.checkEnvironmentDetection(content, analysis);
    this.checkSingletonPattern(content, analysis);
    this.checkErrorHandling(content, analysis);
    this.checkDependencies(content, analysis);
    this.checkTests(service, analysis);
    
    // Find all callers
    await this.findCallers(service, analysis);
    
    // Determine environment type
    this.determineEnvironmentType(content, analysis);
    
    return analysis;
  }
  
  private checkEnvironmentDetection(content: string, analysis: ServiceAnalysis): void {
    if (!content.includes('typeof window')) {
      analysis.complianceIssues.push('Missing environment detection (typeof window)');
      analysis.refactoringNeeded = true;
    }
  }
  
  private checkSingletonPattern(content: string, analysis: ServiceAnalysis): void {
    const hasStaticInstance = content.includes('private static instance');
    const hasGetInstance = content.includes('getInstance');
    const hasPrivateConstructor = content.includes('private constructor');
    
    if (!hasStaticInstance) {
      analysis.complianceIssues.push('Missing static instance variable');
      analysis.refactoringNeeded = true;
    }
    
    if (!hasGetInstance) {
      analysis.complianceIssues.push('Missing getInstance method');
      analysis.refactoringNeeded = true;
    }
    
    if (!hasPrivateConstructor) {
      analysis.complianceIssues.push('Constructor should be private');
      analysis.refactoringNeeded = true;
    }
  }
  
  private checkErrorHandling(content: string, analysis: ServiceAnalysis): void {
    // Check for proper error messages in browser context
    if (content.includes('getInstance') && !content.includes('requires Supabase client in browser')) {
      analysis.complianceIssues.push('Missing clear browser error message');
    }
  }
  
  private checkDependencies(content: string, analysis: ServiceAnalysis): void {
    // Check for problematic imports
    if (content.includes('import.meta.env')) {
      analysis.complianceIssues.push('Uses import.meta.env instead of process.env');
      analysis.refactoringNeeded = true;
    }
    
    if (content.includes("from 'fs'") || content.includes("from 'node:fs'")) {
      if (!content.includes('typeof window')) {
        analysis.complianceIssues.push('Imports Node.js modules without environment check');
        analysis.refactoringNeeded = true;
      }
    }
  }
  
  private checkTests(service: any, analysis: ServiceAnalysis): void {
    const testPaths = [
      `packages/shared/services/__tests__/${service.service_name}.test.ts`,
      `packages/shared/services/${service.service_name}/${service.service_name}.test.ts`,
      `packages/shared/services/${service.service_name}/index.test.ts`
    ];
    
    analysis.hasTests = testPaths.some(testPath => 
      fs.existsSync(path.join(process.cwd(), testPath))
    );
  }
  
  private async findCallers(service: any, analysis: ServiceAnalysis): Promise<void> {
    // Get callers from database
    analysis.callers.apps = service.used_by_apps || [];
    analysis.callers.pipelines = service.used_by_pipelines || [];
    analysis.callers.proxyServers = service.used_by_proxy_servers || [];
    
    // Find service-to-service dependencies
    const { data: dependencies } = await supabase
      .from('sys_service_dependencies')
      .select('service_id')
      .eq('depends_on_service_id', service.id);
    
    analysis.callers.services = dependencies?.map(d => d.service_id) || [];
    
    // Use grep to find actual imports (more accurate)
    try {
      const importPatterns = [
        service.service_name,
        service.service_name.replace('Service', ''),
        path.basename(service.service_path, '.ts')
      ];
      
      for (const pattern of importPatterns) {
        // Search in apps
        const appImports = execSync(
          `grep -r "from.*${pattern}" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | cut -d: -f1 | sort -u`,
          { encoding: 'utf-8', stdio: 'pipe' }
        ).trim().split('\n').filter(Boolean);
        
        // Search in CLI pipelines
        const pipelineImports = execSync(
          `grep -r "from.*${pattern}" scripts/cli-pipeline/ --include="*.ts" | grep -v node_modules | cut -d: -f1 | sort -u`,
          { encoding: 'utf-8', stdio: 'pipe' }
        ).trim().split('\n').filter(Boolean);
        
        // Search in proxy servers
        const proxyImports = execSync(
          `grep -r "from.*${pattern}" scripts/proxy-servers/ --include="*.ts" | grep -v node_modules | cut -d: -f1 | sort -u`,
          { encoding: 'utf-8', stdio: 'pipe' }
        ).trim().split('\n').filter(Boolean);
        
        // Add findings to refactoring notes
        if (appImports.length + pipelineImports.length + proxyImports.length > 0) {
          analysis.refactoringNotes += `\nActual imports found:\n`;
          if (appImports.length) analysis.refactoringNotes += `- Apps: ${appImports.length} files\n`;
          if (pipelineImports.length) analysis.refactoringNotes += `- Pipelines: ${pipelineImports.length} files\n`;
          if (proxyImports.length) analysis.refactoringNotes += `- Proxy servers: ${proxyImports.length} files\n`;
        }
      }
    } catch (error) {
      // Grep might fail if no matches found
    }
  }
  
  private determineEnvironmentType(content: string, analysis: ServiceAnalysis): void {
    const hasNodeImports = content.includes("from 'fs'") || 
                          content.includes("from 'child_process'") ||
                          content.includes("from 'path'");
    const hasBrowserCheck = content.includes('typeof window');
    const hasProxyRequirement = content.includes('proxy') || content.includes('server-url');
    
    if (hasNodeImports && !hasBrowserCheck) {
      analysis.environmentType = 'node-only';
    } else if (hasBrowserCheck && content.includes('throw') && content.includes('browser')) {
      analysis.environmentType = 'proxy-required';
    } else if (content.includes('window.') || content.includes('document.')) {
      analysis.environmentType = 'browser-only';
    } else {
      analysis.environmentType = 'universal';
    }
  }
  
  private async updateServiceCompliance(serviceId: string, analysis: ServiceAnalysis): Promise<void> {
    const { error } = await supabase
      .from('sys_shared_services')
      .update({
        environment_type: analysis.environmentType,
        has_tests: analysis.hasTests,
        checklist_compliant: analysis.complianceIssues.length === 0,
        compliance_issues: analysis.complianceIssues,
        refactoring_notes: analysis.refactoringNotes,
        last_validated: new Date().toISOString()
      })
      .eq('id', serviceId);
    
    if (error) {
      console.error(`Failed to update ${serviceId}:`, error);
    }
  }
  
  private async generateReport(results: ServiceAnalysis[]): Promise<void> {
    const reportPath = path.join(process.cwd(), 'docs/architecture/service-compliance-report.md');
    
    let report = `# Service Compliance Report
Generated: ${new Date().toISOString()}

## Summary
- Total Services: ${results.length}
- Compliant: ${results.filter(r => r.complianceIssues.length === 0).length}
- Need Refactoring: ${results.filter(r => r.refactoringNeeded).length}
- Have Tests: ${results.filter(r => r.hasTests).length}

## Environment Types
- Universal: ${results.filter(r => r.environmentType === 'universal').length}
- Node Only: ${results.filter(r => r.environmentType === 'node-only').length}
- Browser Only: ${results.filter(r => r.environmentType === 'browser-only').length}
- Proxy Required: ${results.filter(r => r.environmentType === 'proxy-required').length}

## Services Needing Refactoring
`;
    
    const needsWork = results.filter(r => r.refactoringNeeded);
    for (const service of needsWork) {
      report += `
### ${service.serviceName}
- **Type**: ${service.environmentType}
- **Issues**: ${service.complianceIssues.join(', ')}
- **Callers**: 
  - Apps: ${service.callers.apps.join(', ') || 'none'}
  - Pipelines: ${service.callers.pipelines.join(', ') || 'none'}
  - Proxy Servers: ${service.callers.proxyServers.join(', ') || 'none'}
- **Notes**: ${service.refactoringNotes}
`;
    }
    
    fs.writeFileSync(reportPath, report);
    console.log(`\n✅ Report generated: ${reportPath}`);
  }
}

// Run the analyzer
const analyzer = new ServiceComplianceAnalyzer();
analyzer.analyzeAllServices().catch(console.error);