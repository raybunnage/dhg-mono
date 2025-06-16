#!/usr/bin/env ts-node

/**
 * Critical Evaluator for Continuous Development Scenarios
 * 
 * This tool performs rigorous evaluation of scenario requests to prevent
 * unnecessary complexity and ensure alignment with monorepo principles.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface ScenarioRequest {
  scenarioId: string;
  objectType: 'service' | 'cli' | 'database' | 'ui' | 'proxy' | 'infra';
  description: string;
  proposedParameters: Record<string, any>;
  requestedBy: string;
}

interface EvaluationResult {
  decision: 'approve' | 'reject' | 'needs_review';
  confidence: number; // 1-10
  reasoning: string;
  evidence: string[];
  alternatives: string[];
  blockers: string[];
}

interface CodeSearchResult {
  searchType: string;
  query: string;
  resultsFound: number;
  findings: string[];
  similarity: number; // 0-100
}

class CriticalEvaluator {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot: string;

  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../../');
  }

  async evaluateScenario(request: ScenarioRequest): Promise<EvaluationResult> {
    console.log(`🔍 Critically evaluating scenario: ${request.scenarioId}`);
    console.log(`📝 Description: ${request.description}`);
    
    // Phase 1: Automated screening
    const automatedResults = await this.performAutomatedScreening(request);
    
    // Phase 2: Code similarity analysis
    const similarityResults = await this.performSimilarityAnalysis(request);
    
    // Phase 3: Usage pattern analysis
    const usageResults = await this.analyzeUsagePatterns(request);
    
    // Phase 4: Architecture fit evaluation
    const architectureResults = await this.evaluateArchitectureFit(request);
    
    // Synthesize results
    return this.synthesizeEvaluation(request, {
      automated: automatedResults,
      similarity: similarityResults,
      usage: usageResults,
      architecture: architectureResults
    });
  }

  private async performAutomatedScreening(request: ScenarioRequest): Promise<any> {
    const results = {
      blockers: [] as string[],
      warnings: [] as string[],
      checks: [] as any[]
    };

    // Check for similar existing objects
    const similarityThreshold = 80;
    const searches = await this.performCodeSearches(request);
    
    for (const search of searches) {
      if (search.similarity > similarityThreshold) {
        results.blockers.push(
          `High similarity (${search.similarity}%) found: ${search.searchType}`
        );
      }
    }

    // Check system health metrics
    const healthMetrics = await this.checkSystemHealth(request.objectType);
    if (healthMetrics.overloadedCategory) {
      results.warnings.push(
        `Category ${request.objectType} may be overloaded (${healthMetrics.count} existing objects)`
      );
    }

    return results;
  }

  private async performCodeSearches(request: ScenarioRequest): Promise<CodeSearchResult[]> {
    const searches: CodeSearchResult[] = [];

    try {
      // Search for similar functionality
      const codeSearch = this.searchCode(request.description, request.objectType);
      searches.push(codeSearch);

      // Search service registry
      if (request.objectType === 'service') {
        const serviceSearch = await this.searchServices(request.description);
        searches.push(serviceSearch);
      }

      // Search CLI commands
      if (request.objectType === 'cli') {
        const cliSearch = this.searchCLICommands(request.description);
        searches.push(cliSearch);
      }

      // Search proxy servers
      if (request.objectType === 'proxy') {
        const proxySearch = this.searchProxyServers(request.description);
        searches.push(proxySearch);
      }

    } catch (error) {
      console.warn('Code search failed:', error);
    }

    return searches;
  }

  private searchCode(description: string, objectType: string): CodeSearchResult {
    const keywords = this.extractKeywords(description);
    const searchPath = this.getSearchPath(objectType);
    
    let resultsFound = 0;
    const findings: string[] = [];
    
    try {
      for (const keyword of keywords) {
        const cmd = `rg -i "${keyword}" ${searchPath} --count-matches`;
        const output = execSync(cmd, { encoding: 'utf8', cwd: this.projectRoot });
        const matches = parseInt(output.trim()) || 0;
        resultsFound += matches;
        
        if (matches > 0) {
          findings.push(`"${keyword}": ${matches} matches in ${searchPath}`);
        }
      }
    } catch (error) {
      // Command may fail if no matches - that's okay
    }

    return {
      searchType: 'code_search',
      query: keywords.join(' '),
      resultsFound,
      findings,
      similarity: this.calculateSimilarity(resultsFound, keywords.length)
    };
  }

  private async searchServices(description: string): Promise<CodeSearchResult> {
    const keywords = this.extractKeywords(description);
    
    try {
      const { data, error } = await this.supabase
        .from('sys_shared_services')
        .select('service_name, description, usage_count')
        .or(keywords.map(k => `description.ilike.%${k}%`).join(','));

      if (error) throw error;

      const findings = data?.map(s => 
        `Service "${s.service_name}": ${s.description} (used ${s.usage_count || 0} times)`
      ) || [];

      return {
        searchType: 'service_registry',
        query: keywords.join(' '),
        resultsFound: data?.length || 0,
        findings,
        similarity: this.calculateServiceSimilarity(data || [], keywords)
      };
    } catch (error) {
      return {
        searchType: 'service_registry',
        query: keywords.join(' '),
        resultsFound: 0,
        findings: [`Error searching services: ${error}`],
        similarity: 0
      };
    }
  }

  private searchCLICommands(description: string): CodeSearchResult {
    const keywords = this.extractKeywords(description);
    let resultsFound = 0;
    const findings: string[] = [];

    try {
      const cliDir = path.join(this.projectRoot, 'scripts/cli-pipeline');
      const pipelineDirs = fs.readdirSync(cliDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const keyword of keywords) {
        for (const dir of pipelineDirs) {
          const searchPath = path.join(cliDir, dir);
          try {
            const cmd = `rg -i "${keyword}" ${searchPath} --count-matches`;
            const output = execSync(cmd, { encoding: 'utf8' });
            const matches = parseInt(output.trim()) || 0;
            
            if (matches > 0) {
              resultsFound += matches;
              findings.push(`"${keyword}" in ${dir}: ${matches} matches`);
            }
          } catch {
            // No matches in this directory
          }
        }
      }
    } catch (error) {
      findings.push(`CLI search error: ${error}`);
    }

    return {
      searchType: 'cli_commands',
      query: keywords.join(' '),
      resultsFound,
      findings,
      similarity: this.calculateSimilarity(resultsFound, keywords.length)
    };
  }

  private searchProxyServers(description: string): CodeSearchResult {
    const keywords = this.extractKeywords(description);
    let resultsFound = 0;
    const findings: string[] = [];

    try {
      const proxyDir = path.join(this.projectRoot, 'scripts/cli-pipeline/proxy');
      const proxyFiles = fs.readdirSync(proxyDir)
        .filter(file => file.startsWith('start-') && file.endsWith('.ts'));

      for (const keyword of keywords) {
        const cmd = `rg -i "${keyword}" ${proxyDir} --count-matches`;
        try {
          const output = execSync(cmd, { encoding: 'utf8' });
          const matches = parseInt(output.trim()) || 0;
          resultsFound += matches;
          
          if (matches > 0) {
            findings.push(`"${keyword}": ${matches} matches in proxy servers`);
          }
        } catch {
          // No matches
        }
      }

      findings.push(`Found ${proxyFiles.length} existing proxy servers`);
    } catch (error) {
      findings.push(`Proxy search error: ${error}`);
    }

    return {
      searchType: 'proxy_servers',
      query: keywords.join(' '),
      resultsFound,
      findings,
      similarity: this.calculateSimilarity(resultsFound, keywords.length)
    };
  }

  private async performSimilarityAnalysis(request: ScenarioRequest): Promise<any> {
    const searches = await this.performCodeSearches(request);
    
    const highSimilarity = searches.filter(s => s.similarity > 70);
    const mediumSimilarity = searches.filter(s => s.similarity > 40 && s.similarity <= 70);
    
    return {
      highSimilarityFound: highSimilarity.length > 0,
      similarObjects: highSimilarity,
      potentialConflicts: mediumSimilarity,
      consolidationOpportunities: this.identifyConsolidationOpportunities(searches)
    };
  }

  private async analyzeUsagePatterns(request: ScenarioRequest): Promise<any> {
    try {
      // Get usage data for similar objects
      const usageQuery = this.buildUsageQuery(request.objectType);
      const { data: usageData, error } = await this.supabase.rpc('execute_sql', {
        sql_query: usageQuery
      });

      if (error) throw error;

      return {
        averageUsage: this.calculateAverageUsage(usageData),
        utilizationRate: this.calculateUtilizationRate(usageData),
        recommendation: this.generateUsageRecommendation(usageData)
      };
    } catch (error) {
      return {
        error: `Usage analysis failed: ${error}`,
        recommendation: 'manual_review_required'
      };
    }
  }

  private async evaluateArchitectureFit(request: ScenarioRequest): Promise<any> {
    const checks = {
      followsPatterns: this.checkPatternCompliance(request),
      fitsWorktreeModel: this.checkWorktreeFit(request),
      maintainsSimplicity: this.checkSimplicity(request),
      hasTestPlan: this.checkTestingPlan(request)
    };

    return {
      architecturalFit: Object.values(checks).every(Boolean),
      violations: Object.entries(checks)
        .filter(([_, passed]) => !passed)
        .map(([check, _]) => check),
      recommendations: this.generateArchitectureRecommendations(checks)
    };
  }

  private synthesizeEvaluation(
    request: ScenarioRequest, 
    results: any
  ): EvaluationResult {
    const blockers = results.automated.blockers || [];
    const warnings = results.automated.warnings || [];
    
    let decision: 'approve' | 'reject' | 'needs_review' = 'approve';
    let confidence = 8;
    const reasoning: string[] = [];
    const evidence: string[] = [];
    const alternatives: string[] = [];

    // Critical blockers
    if (blockers.length > 0) {
      decision = 'reject';
      confidence = 9;
      reasoning.push('Critical blockers found');
      evidence.push(...blockers);
    }

    // High similarity concerns
    if (results.similarity.highSimilarityFound) {
      if (decision !== 'reject') {
        decision = 'needs_review';
        confidence = Math.min(confidence, 6);
      }
      reasoning.push('High similarity to existing solutions');
      alternatives.push(...results.similarity.consolidationOpportunities);
    }

    // Architecture violations
    if (!results.architecture.architecturalFit) {
      if (decision !== 'reject') {
        decision = 'needs_review';
        confidence = Math.min(confidence, 5);
      }
      reasoning.push('Architecture pattern violations');
      evidence.push(...results.architecture.violations);
    }

    // Usage pattern concerns
    if (results.usage.recommendation === 'not_justified') {
      if (decision !== 'reject') {
        decision = 'needs_review';
        confidence = Math.min(confidence, 4);
      }
      reasoning.push('Usage patterns do not justify new object');
    }

    // Warnings
    if (warnings.length > 0) {
      reasoning.push(`Warnings: ${warnings.join(', ')}`);
      confidence = Math.min(confidence, 7);
    }

    return {
      decision,
      confidence,
      reasoning: reasoning.join('; '),
      evidence,
      alternatives,
      blockers
    };
  }

  // Helper methods
  private extractKeywords(description: string): string[] {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 5); // Top 5 keywords
  }

  private getSearchPath(objectType: string): string {
    const paths = {
      service: 'packages/shared/services/',
      cli: 'scripts/cli-pipeline/',
      proxy: 'scripts/cli-pipeline/proxy/',
      database: 'supabase/migrations/',
      ui: 'apps/',
      infra: '.'
    };
    return paths[objectType] || '.';
  }

  private calculateSimilarity(resultsFound: number, keywordCount: number): number {
    if (keywordCount === 0) return 0;
    const avgMatches = resultsFound / keywordCount;
    return Math.min(100, Math.round(avgMatches * 10));
  }

  private calculateServiceSimilarity(services: any[], keywords: string[]): number {
    if (!services.length) return 0;
    
    let totalSimilarity = 0;
    for (const service of services) {
      const description = service.description?.toLowerCase() || '';
      const matches = keywords.filter(k => description.includes(k)).length;
      totalSimilarity += (matches / keywords.length) * 100;
    }
    
    return Math.round(totalSimilarity / services.length);
  }

  private async checkSystemHealth(objectType: string): Promise<any> {
    // Simplified health check - in real implementation, this would be more sophisticated
    const counts = {
      service: await this.countObjects('sys_shared_services'),
      proxy: await this.countObjects('sys_server_ports_registry', "metadata->>'server_type' = 'proxy'"),
      cli: await this.countObjects('command_pipelines')
    };

    const thresholds = {
      service: 100,
      proxy: 20,
      cli: 50
    };

    return {
      count: counts[objectType] || 0,
      overloadedCategory: (counts[objectType] || 0) > (thresholds[objectType] || 100)
    };
  }

  private async countObjects(table: string, condition?: string): Promise<number> {
    try {
      const query = `SELECT COUNT(*) as count FROM ${table}${condition ? ` WHERE ${condition}` : ''}`;
      const { data, error } = await this.supabase.rpc('execute_sql', { sql_query: query });
      if (error) throw error;
      return data?.[0]?.count || 0;
    } catch {
      return 0;
    }
  }

  private identifyConsolidationOpportunities(searches: CodeSearchResult[]): string[] {
    const opportunities: string[] = [];
    
    for (const search of searches) {
      if (search.similarity > 50 && search.resultsFound > 0) {
        opportunities.push(
          `Consider enhancing existing ${search.searchType} instead of creating new`
        );
      }
    }
    
    return opportunities;
  }

  private buildUsageQuery(objectType: string): string {
    const queries = {
      service: `
        SELECT service_name, usage_count, last_used 
        FROM sys_shared_services 
        WHERE usage_count > 0 
        ORDER BY usage_count DESC
      `,
      proxy: `
        SELECT service_name, last_health_check, status 
        FROM sys_server_ports_registry 
        WHERE metadata->>'server_type' = 'proxy'
      `
    };
    
    return queries[objectType] || 'SELECT 1 as dummy';
  }

  private calculateAverageUsage(usageData: any[]): number {
    if (!usageData?.length) return 0;
    const total = usageData.reduce((sum, item) => sum + (item.usage_count || 0), 0);
    return Math.round(total / usageData.length);
  }

  private calculateUtilizationRate(usageData: any[]): number {
    if (!usageData?.length) return 0;
    const utilized = usageData.filter(item => (item.usage_count || 0) > 0).length;
    return Math.round((utilized / usageData.length) * 100);
  }

  private generateUsageRecommendation(usageData: any[]): string {
    const utilizationRate = this.calculateUtilizationRate(usageData);
    const avgUsage = this.calculateAverageUsage(usageData);
    
    if (utilizationRate < 50) return 'not_justified';
    if (avgUsage < 5) return 'consolidation_preferred';
    return 'justified';
  }

  private checkPatternCompliance(request: ScenarioRequest): boolean {
    // Simplified pattern check - would be more sophisticated in real implementation
    return true; // Placeholder
  }

  private checkWorktreeFit(request: ScenarioRequest): boolean {
    // Check if this fits the multi-agent worktree model
    return true; // Placeholder
  }

  private checkSimplicity(request: ScenarioRequest): boolean {
    // Evaluate if this maintains system simplicity
    return true; // Placeholder
  }

  private checkTestingPlan(request: ScenarioRequest): boolean {
    // Check if adequate testing is planned
    return true; // Placeholder
  }

  private generateArchitectureRecommendations(checks: any): string[] {
    const recommendations: string[] = [];
    
    Object.entries(checks).forEach(([check, passed]) => {
      if (!passed) {
        recommendations.push(`Address ${check} violation before proceeding`);
      }
    });
    
    return recommendations;
  }
}

// CLI Interface
async function main() {
  const evaluator = new CriticalEvaluator();
  const [command, ...args] = process.argv.slice(2);

  if (command === 'evaluate') {
    const [scenarioId, objectType, description] = args;
    
    if (!scenarioId || !objectType || !description) {
      console.error('Usage: critical-evaluator.ts evaluate <scenario-id> <object-type> <description>');
      process.exit(1);
    }

    const request: ScenarioRequest = {
      scenarioId,
      objectType: objectType as any,
      description,
      proposedParameters: {},
      requestedBy: process.env.USER || 'unknown'
    };

    try {
      const result = await evaluator.evaluateScenario(request);
      
      console.log('\n📊 Evaluation Results:');
      console.log(`Decision: ${result.decision.toUpperCase()}`);
      console.log(`Confidence: ${result.confidence}/10`);
      console.log(`Reasoning: ${result.reasoning}`);
      
      if (result.evidence.length > 0) {
        console.log('\n🔍 Evidence:');
        result.evidence.forEach(e => console.log(`  - ${e}`));
      }
      
      if (result.alternatives.length > 0) {
        console.log('\n💡 Alternatives:');
        result.alternatives.forEach(a => console.log(`  - ${a}`));
      }
      
      if (result.blockers.length > 0) {
        console.log('\n🚫 Blockers:');
        result.blockers.forEach(b => console.log(`  - ${b}`));
      }
      
    } catch (error) {
      console.error('Evaluation failed:', error);
      process.exit(1);
    }
  } else {
    console.log('Critical Evaluator for Continuous Development Scenarios\n');
    console.log('Usage:');
    console.log('  critical-evaluator.ts evaluate <scenario-id> <object-type> <description>');
    console.log('\nExample:');
    console.log('  critical-evaluator.ts evaluate new-file-proxy proxy "Need a proxy for file uploads"');
  }
}

export { CriticalEvaluator };

if (require.main === module) {
  main();
}