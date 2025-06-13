#!/usr/bin/env ts-node

/**
 * Comprehensive service analysis and rating system
 * This script:
 * 1. Scans all services for compliance with checklist
 * 2. Counts usage across apps, CLI pipelines, and proxy servers
 * 3. Identifies overlapping/duplicate services
 * 4. Rates service health and makes recommendations
 * 5. Updates the database with all findings
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Import using CommonJS style for ts-node compatibility
const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

interface ServiceAnalysis {
  id: string;
  serviceName: string;
  filePath: string;
  
  // Compliance
  environmentType: 'universal' | 'node-only' | 'browser-only' | 'proxy-required';
  complianceIssues: string[];
  checklistCompliant: boolean;
  hasTests: boolean;
  
  // Usage metrics
  usageCount: number;
  usageLocations: {
    apps: string[];
    pipelines: string[];
    proxyServers: string[];
    services: string[];
  };
  
  // Health assessment
  serviceHealth: 'essential' | 'active' | 'low-usage' | 'deprecated' | 'duplicate';
  confidenceScore: number;
  consolidationCandidate: boolean;
  overlapsWith: string[];
  maintenanceRecommendation: 'keep-as-is' | 'needs-refactoring' | 'consider-consolidation' | 'mark-deprecated' | 'remove-unused';
  refactoringNotes: string;
}

class ServiceAnalyzer {
  private servicesDir = path.join(process.cwd(), 'packages/shared/services');
  private services: any[] = [];
  private serviceAnalyses: Map<string, ServiceAnalysis> = new Map();
  
  async analyze(): Promise<void> {
    console.log('🔍 Starting comprehensive service analysis...\n');
    
    // Step 1: Load all services from database
    await this.loadServices();
    
    // Step 2: Analyze each service
    for (const service of this.services) {
      console.log(`\n📋 Analyzing ${service.service_name}...`);
      const analysis = await this.analyzeService(service);
      this.serviceAnalyses.set(service.service_name, analysis);
    }
    
    // Step 3: Find overlapping services
    this.findOverlappingServices();
    
    // Step 4: Update database with all findings
    await this.updateDatabase();
    
    // Step 5: Generate report
    await this.generateReport();
    
    // Step 6: Record monitoring run
    await this.recordMonitoringRun();
  }
  
  private async loadServices(): Promise<void> {
    const { data, error } = await supabase
      .from('sys_shared_services')
      .select('*')
      .order('service_name');
    
    if (error) throw error;
    this.services = data || [];
    console.log(`Loaded ${this.services.length} services from database`);
  }
  
  private async analyzeService(service: any): Promise<ServiceAnalysis> {
    const analysis: ServiceAnalysis = {
      id: service.id,
      serviceName: service.service_name,
      filePath: service.service_path,
      environmentType: 'universal',
      complianceIssues: [],
      checklistCompliant: false,
      hasTests: false,
      usageCount: 0,
      usageLocations: {
        apps: [],
        pipelines: [],
        proxyServers: [],
        services: []
      },
      serviceHealth: 'active',
      confidenceScore: 50,
      consolidationCandidate: false,
      overlapsWith: [],
      maintenanceRecommendation: 'keep-as-is',
      refactoringNotes: ''
    };
    
    // Check if file exists
    const fullPath = path.join(process.cwd(), service.service_path);
    if (!fs.existsSync(fullPath)) {
      analysis.complianceIssues.push('Service file not found');
      analysis.serviceHealth = 'deprecated';
      analysis.maintenanceRecommendation = 'remove-unused';
      analysis.confidenceScore = 0;
      return analysis;
    }
    
    // Read service content
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Analyze compliance
    this.checkCompliance(content, analysis);
    
    // Check for tests
    this.checkForTests(service, analysis);
    
    // Count usage
    await this.countUsage(service, analysis);
    
    // Determine environment type
    this.determineEnvironmentType(content, analysis);
    
    // Calculate health and confidence
    this.calculateHealthMetrics(analysis);
    
    return analysis;
  }
  
  private checkCompliance(content: string, analysis: ServiceAnalysis): void {
    // Check environment detection
    if (!content.includes('typeof window')) {
      analysis.complianceIssues.push('Missing environment detection');
    }
    
    // Check singleton pattern
    if (!content.includes('private static instance')) {
      analysis.complianceIssues.push('Missing singleton pattern');
    }
    
    if (!content.includes('getInstance')) {
      analysis.complianceIssues.push('Missing getInstance method');
    }
    
    // Check for problematic patterns
    if (content.includes('import.meta.env')) {
      analysis.complianceIssues.push('Uses import.meta.env instead of process.env');
    }
    
    // Check for direct client creation
    if (content.includes('createClient(') && !content.includes('createSupabaseAdapter')) {
      analysis.complianceIssues.push('Creates Supabase client directly');
    }
    
    // Check error handling
    if (content.includes('getInstance') && !content.includes('throw') && !content.includes('Error')) {
      analysis.complianceIssues.push('Missing proper error handling');
    }
    
    analysis.checklistCompliant = analysis.complianceIssues.length === 0;
  }
  
  private checkForTests(service: any, analysis: ServiceAnalysis): void {
    const testPaths = [
      `packages/shared/services/__tests__/${service.service_name}.test.ts`,
      `packages/shared/services/${path.dirname(service.service_path)}/__tests__/${service.service_name}.test.ts`,
      service.service_path.replace('.ts', '.test.ts'),
      service.service_path.replace('/index.ts', '/__tests__/index.test.ts')
    ];
    
    analysis.hasTests = testPaths.some(testPath => 
      fs.existsSync(path.join(process.cwd(), testPath))
    );
  }
  
  private async countUsage(service: any, analysis: ServiceAnalysis): Promise<void> {
    // Use grep to find actual imports
    const patterns = [
      service.service_name,
      path.basename(service.service_path, '.ts'),
      service.service_name.replace('Service', '')
    ];
    
    for (const pattern of patterns) {
      try {
        // Search in apps
        const appResults = execSync(
          `grep -r "import.*${pattern}" apps/ --include="*.ts" --include="*.tsx" 2>/dev/null | cut -d: -f1 | sort -u`,
          { encoding: 'utf-8', stdio: 'pipe' }
        ).trim().split('\n').filter(Boolean);
        
        appResults.forEach(file => {
          const appName = file.split('/')[1];
          if (!analysis.usageLocations.apps.includes(appName)) {
            analysis.usageLocations.apps.push(appName);
          }
        });
        
        // Search in CLI pipelines
        const pipelineResults = execSync(
          `grep -r "import.*${pattern}\\|require.*${pattern}" scripts/cli-pipeline/ --include="*.ts" --include="*.js" 2>/dev/null | cut -d: -f1 | sort -u`,
          { encoding: 'utf-8', stdio: 'pipe' }
        ).trim().split('\n').filter(Boolean);
        
        pipelineResults.forEach(file => {
          const pipelineName = file.split('/')[2];
          if (!analysis.usageLocations.pipelines.includes(pipelineName)) {
            analysis.usageLocations.pipelines.push(pipelineName);
          }
        });
        
        // Search in proxy servers
        const proxyResults = execSync(
          `find scripts/proxy-servers -name "*.ts" -o -name "*.js" 2>/dev/null | xargs grep -l "${pattern}" 2>/dev/null || true`,
          { encoding: 'utf-8', stdio: 'pipe' }
        ).trim().split('\n').filter(Boolean);
        
        proxyResults.forEach(file => {
          const serverName = path.basename(path.dirname(file));
          if (!analysis.usageLocations.proxyServers.includes(serverName)) {
            analysis.usageLocations.proxyServers.push(serverName);
          }
        });
        
        // Search in other services
        const serviceResults = execSync(
          `grep -r "import.*${pattern}" packages/shared/services/ --include="*.ts" 2>/dev/null | grep -v "${service.service_path}" | cut -d: -f1 | sort -u`,
          { encoding: 'utf-8', stdio: 'pipe' }
        ).trim().split('\n').filter(Boolean);
        
        serviceResults.forEach(file => {
          const serviceName = this.extractServiceName(file);
          if (serviceName && !analysis.usageLocations.services.includes(serviceName)) {
            analysis.usageLocations.services.push(serviceName);
          }
        });
        
      } catch (error) {
        // Grep returns non-zero if no matches found
      }
    }
    
    // Calculate total usage
    analysis.usageCount = 
      analysis.usageLocations.apps.length +
      analysis.usageLocations.pipelines.length +
      analysis.usageLocations.proxyServers.length +
      analysis.usageLocations.services.length;
  }
  
  private extractServiceName(filePath: string): string {
    const match = filePath.match(/services\/([^\/]+)\//);
    return match ? match[1] : '';
  }
  
  private determineEnvironmentType(content: string, analysis: ServiceAnalysis): void {
    const hasNodeImports = content.match(/from ['"](?:fs|path|child_process|crypto|os)['"]/) !== null;
    const hasBrowserCheck = content.includes('typeof window');
    const throwsInBrowser = content.includes('browser') && content.includes('throw');
    const hasWindowAPIs = content.match(/window\.|document\.|localStorage|sessionStorage/) !== null;
    
    if (hasNodeImports && !hasBrowserCheck) {
      analysis.environmentType = 'node-only';
    } else if (hasWindowAPIs && !hasNodeImports) {
      analysis.environmentType = 'browser-only';
    } else if (hasNodeImports && throwsInBrowser) {
      analysis.environmentType = 'proxy-required';
    } else {
      analysis.environmentType = 'universal';
    }
  }
  
  private calculateHealthMetrics(analysis: ServiceAnalysis): void {
    // Start with base confidence
    let confidence = 50;
    
    // Adjust based on compliance
    if (analysis.checklistCompliant) confidence += 20;
    else confidence -= 10 * analysis.complianceIssues.length;
    
    // Adjust based on tests
    if (analysis.hasTests) confidence += 15;
    else confidence -= 10;
    
    // Adjust based on usage
    if (analysis.usageCount >= 50) confidence += 20;
    else if (analysis.usageCount >= 10) confidence += 10;
    else if (analysis.usageCount === 0) confidence -= 30;
    
    // Cap confidence
    analysis.confidenceScore = Math.max(0, Math.min(100, confidence));
    
    // Determine health status
    if (analysis.usageCount === 0) {
      analysis.serviceHealth = 'deprecated';
      analysis.maintenanceRecommendation = 'remove-unused';
    } else if (analysis.usageCount < 5) {
      analysis.serviceHealth = 'low-usage';
      analysis.consolidationCandidate = true;
      analysis.maintenanceRecommendation = 'consider-consolidation';
    } else if (analysis.usageCount >= 50) {
      analysis.serviceHealth = 'essential';
      if (!analysis.checklistCompliant || !analysis.hasTests) {
        analysis.maintenanceRecommendation = 'needs-refactoring';
      }
    } else {
      analysis.serviceHealth = 'active';
      if (!analysis.checklistCompliant) {
        analysis.maintenanceRecommendation = 'needs-refactoring';
      }
    }
    
    // Add refactoring notes
    if (analysis.complianceIssues.length > 0) {
      analysis.refactoringNotes = `Compliance issues: ${analysis.complianceIssues.join(', ')}`;
    }
  }
  
  private findOverlappingServices(): void {
    // Find services with similar names or functionality
    const serviceNames = Array.from(this.serviceAnalyses.keys());
    
    for (const [name1, analysis1] of this.serviceAnalyses) {
      for (const name2 of serviceNames) {
        if (name1 === name2) continue;
        
        // Check for similar names
        const similarity = this.calculateSimilarity(name1, name2);
        if (similarity > 0.7) {
          analysis1.overlapsWith.push(name2);
        }
        
        // Check for services in same category with low usage
        const analysis2 = this.serviceAnalyses.get(name2);
        if (analysis2 && 
            analysis1.filePath.includes(analysis2.filePath.split('/').slice(-2, -1)[0]) &&
            (analysis1.serviceHealth === 'low-usage' || analysis2.serviceHealth === 'low-usage')) {
          if (!analysis1.overlapsWith.includes(name2)) {
            analysis1.overlapsWith.push(name2);
          }
        }
      }
      
      // Mark as duplicate if significant overlap
      if (analysis1.overlapsWith.length > 0 && analysis1.usageCount < 10) {
        analysis1.serviceHealth = 'duplicate';
        analysis1.consolidationCandidate = true;
      }
    }
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  private async updateDatabase(): Promise<void> {
    console.log('\n💾 Updating database with analysis results...');
    
    for (const [serviceName, analysis] of this.serviceAnalyses) {
      const { error } = await supabase
        .from('sys_shared_services')
        .update({
          environment_type: analysis.environmentType,
          has_tests: analysis.hasTests,
          checklist_compliant: analysis.checklistCompliant,
          compliance_issues: analysis.complianceIssues,
          usage_count: analysis.usageCount,
          usage_locations: analysis.usageLocations,
          service_health: analysis.serviceHealth,
          confidence_score: analysis.confidenceScore,
          consolidation_candidate: analysis.consolidationCandidate,
          overlaps_with: analysis.overlapsWith,
          maintenance_recommendation: analysis.maintenanceRecommendation,
          refactoring_notes: analysis.refactoringNotes,
          last_usage_scan: new Date().toISOString(),
          last_validated: new Date().toISOString(),
          next_scan_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        })
        .eq('id', analysis.id);
      
      if (error) {
        console.error(`Failed to update ${serviceName}:`, error);
      } else {
        console.log(`✅ Updated ${serviceName}`);
      }
    }
  }
  
  private async recordMonitoringRun(): Promise<void> {
    const stats = {
      services_scanned: this.serviceAnalyses.size,
      new_services_found: 0, // Would need to track this
      deprecated_services: Array.from(this.serviceAnalyses.values()).filter(a => a.serviceHealth === 'deprecated').length,
      refactoring_needed: Array.from(this.serviceAnalyses.values()).filter(a => a.maintenanceRecommendation === 'needs-refactoring').length
    };
    
    await supabase
      .from('sys_service_monitoring_runs')
      .insert({
        run_type: 'manual',
        services_scanned: stats.services_scanned,
        deprecated_services: stats.deprecated_services,
        refactoring_needed: stats.refactoring_needed,
        notes: `Comprehensive service analysis completed`
      });
  }
  
  private async generateReport(): Promise<void> {
    const reportPath = path.join(process.cwd(), '../../../docs/architecture/service-health-report.md');
    
    const analyses = Array.from(this.serviceAnalyses.values());
    const essential = analyses.filter(a => a.serviceHealth === 'essential');
    const active = analyses.filter(a => a.serviceHealth === 'active');
    const lowUsage = analyses.filter(a => a.serviceHealth === 'low-usage');
    const deprecated = analyses.filter(a => a.serviceHealth === 'deprecated');
    const duplicates = analyses.filter(a => a.serviceHealth === 'duplicate');
    
    let report = `# Service Health Report
Generated: ${new Date().toISOString()}

## Summary
- Total Services: ${analyses.length}
- Essential: ${essential.length}
- Active: ${active.length}
- Low Usage: ${lowUsage.length}
- Deprecated: ${deprecated.length}
- Duplicates: ${duplicates.length}

## Services by Health Status

### Essential Services (${essential.length})
${essential.map(s => `- **${s.serviceName}** - Usage: ${s.usageCount}, Confidence: ${s.confidenceScore}%`).join('\n')}

### Active Services (${active.length})
${active.map(s => `- **${s.serviceName}** - Usage: ${s.usageCount}, Confidence: ${s.confidenceScore}%`).join('\n')}

### Low Usage Services (${lowUsage.length})
${lowUsage.map(s => `- **${s.serviceName}** - Usage: ${s.usageCount}, Consider consolidation`).join('\n')}

### Deprecated Services (${deprecated.length})
${deprecated.map(s => `- **${s.serviceName}** - No usage found, recommend removal`).join('\n')}

### Duplicate Services (${duplicates.length})
${duplicates.map(s => `- **${s.serviceName}** overlaps with: ${s.overlapsWith.join(', ')}`).join('\n')}

## Recommendations

### Immediate Actions Required
${analyses.filter(a => a.maintenanceRecommendation === 'remove-unused')
  .map(s => `- Remove unused service: ${s.serviceName}`).join('\n')}

### Refactoring Needed
${analyses.filter(a => a.maintenanceRecommendation === 'needs-refactoring')
  .map(s => `- Refactor ${s.serviceName}: ${s.refactoringNotes}`).join('\n')}

### Consolidation Candidates
${analyses.filter(a => a.consolidationCandidate)
  .map(s => `- Consider consolidating ${s.serviceName} (overlaps with: ${s.overlapsWith.join(', ')})`).join('\n')}
`;
    
    fs.writeFileSync(reportPath, report);
    console.log(`\n📊 Report generated: ${reportPath}`);
  }
}

// Run the analyzer
const analyzer = new ServiceAnalyzer();
analyzer.analyze().catch(console.error);