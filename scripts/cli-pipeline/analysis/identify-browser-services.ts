#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Database } from '../../../supabase/types';

type SharedService = Database['public']['Tables']['sys_shared_services']['Row'];

// Services already being tested in dhg-service-test app
const ALREADY_TESTED_SERVICES = new Set([
  // From ServiceTesterIncremental4
  'createSupabaseAdapter',
  'BrowserAuthService', 
  'ServerRegistryService',
  'ClipboardService',
  'CLIRegistryService',
  'DevTaskService',
  'DocumentTypeService',
  'DocumentClassificationService',
  'ElementCatalogService',
  'ElementCriteriaService',
  'MediaAnalyticsService',
  'WorkSummaryService',
  
  // From ServiceTesterIncremental5
  'FilterService',
  'DatabaseMetadataService',
  'MediaTrackingService',
  'UserProfileService',
  'SupabaseService'
]);

// Keywords that suggest browser compatibility
const BROWSER_COMPATIBLE_KEYWORDS = [
  'browser',
  'client',
  'ui',
  'frontend',
  'component',
  'form',
  'validation',
  'analytics',
  'tracking',
  'metadata',
  'profile',
  'auth',
  'session',
  'storage',
  'helper',
  'util',
  'format',
  'parse',
  'transform',
  'search',
  'filter',
  'sort',
  'display',
  'render',
  'interface',
  'adapter',
  'service'
];

// Keywords that suggest Node.js only
const SERVER_ONLY_KEYWORDS = [
  'file',
  'fs',
  'path',
  'process',
  'spawn',
  'exec',
  'child_process',
  'buffer',
  'stream',
  'crypto',
  'os',
  'system',
  'cli',
  'command',
  'pipeline',
  'migration',
  'deployment',
  'server',
  'worker',
  'queue',
  'batch',
  'background',
  'cron',
  'schedule'
];

function scoreServiceForBrowserCompatibility(service: SharedService): number {
  let score = 0;
  const serviceName = service.service_name.toLowerCase();
  const description = (service.description || '').toLowerCase();
  const category = (service.category || '').toLowerCase();
  const path = service.service_path.toLowerCase();
  
  const allText = `${serviceName} ${description} ${category} ${path}`;
  
  // Base score adjustments
  if (service.has_browser_variant) score += 50;
  if (service.is_singleton) score += 20;
  if (service.status === 'active') score += 10;
  
  // Category-based scoring
  if (category.includes('auth')) score += 30;
  if (category.includes('utility') || category.includes('util')) score += 25;
  if (category.includes('media') && !category.includes('processing')) score += 20;
  if (category.includes('document') && !serviceName.includes('pipeline')) score += 15;
  if (category.includes('ui') || category.includes('component')) score += 40;
  if (category.includes('adapter')) score += 30;
  
  // Positive keywords
  BROWSER_COMPATIBLE_KEYWORDS.forEach(keyword => {
    if (allText.includes(keyword)) {
      score += 5;
    }
  });
  
  // Negative keywords (server-only indicators)
  SERVER_ONLY_KEYWORDS.forEach(keyword => {
    if (allText.includes(keyword)) {
      score -= 10;
    }
  });
  
  // Special penalties for obvious server-only services
  if (serviceName.includes('pipeline')) score -= 30;
  if (serviceName.includes('cli')) score -= 25;
  if (serviceName.includes('command')) score -= 25;
  if (serviceName.includes('execution')) score -= 30;
  if (serviceName.includes('file') && serviceName.includes('operation')) score -= 25;
  if (serviceName.includes('git')) score -= 20;
  if (serviceName.includes('deployment')) score -= 30;
  if (serviceName.includes('migration')) score -= 30;
  
  // Boost for services used by apps (indicates browser usage)
  if (service.used_by_apps && service.used_by_apps.length > 0) {
    score += service.used_by_apps.length * 10;
  }
  
  // Penalty for services only used by pipelines
  if (service.used_by_pipelines && service.used_by_pipelines.length > 0 && (!service.used_by_apps || service.used_by_apps.length === 0)) {
    score -= 15;
  }
  
  return Math.max(0, score);
}

async function identifyBrowserServices() {
  try {
    console.log('=== Identifying Browser-Compatible Services ===\n');
    
    const supabase = SupabaseClientService.getInstance().getClient();
    
    const { data: services, error } = await supabase
      .from('sys_shared_services')
      .select('*')
      .eq('status', 'active')
      .order('service_name');
    
    if (error) {
      console.error('Error querying services:', error);
      return;
    }
    
    if (!services || services.length === 0) {
      console.log('No active services found');
      return;
    }
    
    console.log(`Found ${services.length} active services\n`);
    
    // Score and filter services
    const scoredServices = services
      .map(service => ({
        ...service,
        browserScore: scoreServiceForBrowserCompatibility(service),
        alreadyTested: ALREADY_TESTED_SERVICES.has(service.service_name)
      }))
      .filter(service => !service.alreadyTested)
      .sort((a, b) => b.browserScore - a.browserScore);
    
    console.log('=== Top Browser-Compatible Service Candidates ===');
    console.log('Services with high browser compatibility scores that are NOT already tested:\n');
    
    const topCandidates = scoredServices.slice(0, 15);
    
    topCandidates.forEach((service, index) => {
      console.log(`${index + 1}. ${service.service_name} (Score: ${service.browserScore})`);
      console.log(`   Path: ${service.service_path}`);
      console.log(`   Category: ${service.category || 'N/A'}`);
      console.log(`   Has Browser Variant: ${service.has_browser_variant ? 'Yes' : 'No'}`);
      console.log(`   Is Singleton: ${service.is_singleton ? 'Yes' : 'No'}`);
      
      if (service.description) {
        console.log(`   Description: ${service.description}`);
      }
      
      if (service.used_by_apps && service.used_by_apps.length > 0) {
        console.log(`   Used by Apps: ${service.used_by_apps.join(', ')}`);
      }
      
      console.log('');
    });
    
    // Show services by category
    console.log('=== Candidates by Category ===');
    const candidatesByCategory = topCandidates.reduce((acc, service) => {
      const category = service.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(service);
      return acc;
    }, {} as Record<string, any[]>);
    
    Object.entries(candidatesByCategory).forEach(([category, services]) => {
      console.log(`\n${category}:`);
      (services as any[]).forEach((service: any) => {
        console.log(`  - ${service.service_name} (${service.browserScore})`);
      });
    });
    
    // Recommended services for testing
    console.log('\n=== TOP 5 RECOMMENDED FOR BROWSER TESTING ===');
    const recommendations = topCandidates.slice(0, 5);
    
    recommendations.forEach((service, index) => {
      console.log(`\n${index + 1}. ${service.service_name}`);
      console.log(`   Why: ${getRecommendationReason(service)}`);
      console.log(`   Browser Features: ${getBrowserFeatures(service)}`);
      console.log(`   Test Priority: ${getTestPriority(service)}`);
    });
    
    // Services that might need browser adaptation
    console.log('\n=== Services That Might Need Browser Adaptation ===');
    const needsAdaptation = scoredServices.filter(s => 
      s.browserScore >= 30 && 
      s.browserScore < 60 && 
      !s.has_browser_variant
    ).slice(0, 10);
    
    needsAdaptation.forEach((service: any) => {
      console.log(`- ${service.service_name}: ${service.description || 'No description'}`);
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

function getRecommendationReason(service: any): string {
  const reasons = [];
  
  if (service.has_browser_variant) reasons.push('Has browser variant');
  if (service.is_singleton) reasons.push('Singleton pattern');
  if (service.used_by_apps && service.used_by_apps.length > 0) reasons.push(`Used by ${service.used_by_apps.length} apps`);
  if (service.browserScore > 80) reasons.push('High compatibility score');
  if (service.category?.includes('auth')) reasons.push('Auth-related service');
  if (service.category?.includes('utility')) reasons.push('Utility service');
  
  return reasons.join(', ') || 'General compatibility indicators';
}

function getBrowserFeatures(service: any): string {
  const features = [];
  
  if (service.service_name.toLowerCase().includes('http')) features.push('HTTP client');
  if (service.service_name.toLowerCase().includes('response')) features.push('Response handling');
  if (service.service_name.toLowerCase().includes('format')) features.push('Data formatting');
  if (service.service_name.toLowerCase().includes('validator')) features.push('Validation');
  if (service.service_name.toLowerCase().includes('element')) features.push('Element management');
  if (service.service_name.toLowerCase().includes('media')) features.push('Media handling');
  if (service.has_browser_variant) features.push('Browser-specific implementation');
  if (service.is_singleton) features.push('Singleton access');
  
  return features.join(', ') || 'Basic service functionality';
}

function getTestPriority(service: any): string {
  if (service.browserScore > 80) return 'HIGH - Strong browser compatibility indicators';
  if (service.browserScore > 60) return 'MEDIUM - Good candidate with some adaptation needed';
  if (service.browserScore > 40) return 'LOW - Might work but needs investigation';
  return 'VERY LOW - Likely needs significant adaptation';
}

// Run the analysis
identifyBrowserServices().catch(console.error);