#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface UnusedService {
  id: string;
  service_name: string;
  service_path: string;
  description: string | null;
  category: string | null;
  status: string;
  dependency_count: number;
  is_unused: boolean;
  created_at: string;
  updated_at: string | null;
}

interface ServiceUsageReport {
  total_services: number;
  unused_services: number;
  services_by_category: Record<string, number>;
  recommendations: ServiceRecommendation[];
  generated_at: string;
}

interface ServiceRecommendation {
  service_name: string;
  path: string;
  category: string | null;
  recommendation: 'archive' | 'review' | 'keep';
  reason: string;
}

async function analyzeServices() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Fetching service usage data...\n');
  
  try {
    // Get all services
    const { data: allServices, error: allError } = await supabase
      .from('registry_services')
      .select('*')
      .order('service_name');
      
    if (allError) throw allError;
    
    // Get unused services
    const { data: unusedServices, error: unusedError } = await supabase
      .from('registry_unused_services_view')
      .select('*')
      .eq('is_unused', true)
      .order('service_name');
      
    if (unusedError) throw unusedError;
    
    // Build recommendations
    const recommendations: ServiceRecommendation[] = [];
    
    for (const service of unusedServices || []) {
      let recommendation: 'archive' | 'review' | 'keep' = 'review';
      let reason = 'No dependencies found';
      
      // Check service age
      const createdDate = new Date(service.created_at);
      const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (ageInDays > 180 && service.dependency_count === 0) {
        recommendation = 'archive';
        reason = `No dependencies and created ${ageInDays} days ago`;
      } else if (service.category === 'utility' || service.category === 'auth') {
        recommendation = 'review';
        reason = 'Core utility service - manual review required';
      } else if (service.description?.toLowerCase().includes('deprecated')) {
        recommendation = 'archive';
        reason = 'Already marked as deprecated in description';
      }
      
      recommendations.push({
        service_name: service.service_name,
        path: service.service_path,
        category: service.category,
        recommendation,
        reason
      });
    }
    
    // Generate report
    const report: ServiceUsageReport = {
      total_services: allServices?.length || 0,
      unused_services: unusedServices?.length || 0,
      services_by_category: {},
      recommendations,
      generated_at: new Date().toISOString()
    };
    
    // Count by category
    for (const service of allServices || []) {
      const category = service.category || 'uncategorized';
      report.services_by_category[category] = (report.services_by_category[category] || 0) + 1;
    }
    
    // Display report
    console.log('📊 Service Usage Analysis Report');
    console.log('================================\n');
    console.log(`Total Services: ${report.total_services}`);
    console.log(`Unused Services: ${report.unused_services} (${((report.unused_services / report.total_services) * 100).toFixed(1)}%)\n`);
    
    console.log('Services by Category:');
    Object.entries(report.services_by_category).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
    
    console.log('\n🎯 Deprecation Recommendations:');
    console.log('-------------------------------\n');
    
    const archiveCount = recommendations.filter(r => r.recommendation === 'archive').length;
    const reviewCount = recommendations.filter(r => r.recommendation === 'review').length;
    const keepCount = recommendations.filter(r => r.recommendation === 'keep').length;
    
    console.log(`  🗑️  Archive: ${archiveCount} services`);
    console.log(`  🔍 Review: ${reviewCount} services`);
    console.log(`  ✅ Keep: ${keepCount} services\n`);
    
    // Show details
    if (archiveCount > 0) {
      console.log('📦 Services to Archive:');
      recommendations
        .filter(r => r.recommendation === 'archive')
        .forEach(r => {
          console.log(`  - ${r.service_name}`);
          console.log(`    Path: ${r.path}`);
          console.log(`    Reason: ${r.reason}\n`);
        });
    }
    
    if (reviewCount > 0) {
      console.log('🔍 Services Requiring Review:');
      recommendations
        .filter(r => r.recommendation === 'review')
        .forEach(r => {
          console.log(`  - ${r.service_name}`);
          console.log(`    Path: ${r.path}`);
          console.log(`    Reason: ${r.reason}\n`);
        });
    }
    
    // Save report
    const outputPath = join(process.cwd(), `service-deprecation-report-${new Date().toISOString().split('T')[0]}.json`);
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Full report saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error analyzing services:', error);
    process.exit(1);
  }
}

// Run the analysis
analyzeServices();