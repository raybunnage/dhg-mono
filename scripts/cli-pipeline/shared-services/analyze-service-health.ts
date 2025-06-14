#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function analyzeServiceHealth() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('=== SERVICE HEALTH ANALYSIS RESULTS ===\n');
  
  // 1. Overall health statistics
  console.log('1. OVERALL HEALTH STATISTICS:');
  console.log('--------------------------------');
  const { data: healthData, error: healthError } = await supabase
    .from('sys_service_health_analysis_view')
    .select('*')
    .order('confidence_score', { ascending: false })
    .order('service_name');
    
  if (healthError) {
    console.error('Error fetching health data:', healthError);
    return;
  }
  
  if (healthData && healthData.length > 0) {
    // Calculate summary statistics
    const totalServices = healthData.length;
    const avgConfidence = healthData.reduce((sum, s) => sum + (s.confidence_score || 0), 0) / totalServices;
    const servicesWithTests = healthData.filter(s => s.has_tests).length;
    const servicesWithUsage = healthData.filter(s => (s.usage_count || 0) > 0).length;
    const checklistCompliant = healthData.filter(s => s.checklist_compliant).length;
    const consolidationCandidates = healthData.filter(s => s.consolidation_candidate).length;
    
    console.log(`Total Services Analyzed: ${totalServices}`);
    console.log(`Average Confidence Score: ${avgConfidence.toFixed(2)}%`);
    console.log(`Services with Tests: ${servicesWithTests} (${((servicesWithTests/totalServices)*100).toFixed(1)}%)`);
    console.log(`Services with Usage: ${servicesWithUsage} (${((servicesWithUsage/totalServices)*100).toFixed(1)}%)`);
    console.log(`Checklist Compliant: ${checklistCompliant} (${((checklistCompliant/totalServices)*100).toFixed(1)}%)`);
    console.log(`Consolidation Candidates: ${consolidationCandidates}`);
    
    // Health distribution
    const healthDist = {
      'good': healthData.filter(s => s.service_health === 'good').length,
      'needs_attention': healthData.filter(s => s.service_health === 'needs_attention').length,
      'critical': healthData.filter(s => s.service_health === 'critical').length,
      'unknown': healthData.filter(s => !s.service_health || s.service_health === 'unknown').length
    };
    
    console.log('\nHealth Distribution:');
    Object.entries(healthDist).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} (${((count/totalServices)*100).toFixed(1)}%)`);
    });
  }
  
  // 2. Services needing attention
  console.log('\n2. SERVICES NEEDING IMMEDIATE ATTENTION:');
  console.log('----------------------------------------');
  const { data: attentionData, error: attentionError } = await supabase
    .from('sys_services_needing_attention_view')
    .select('*')
    .order('compliance_issue_count', { ascending: false })
    .order('usage_count', { ascending: false })
    .limit(15);
    
  if (attentionError) {
    console.error('Error fetching attention data:', attentionError);
  } else if (attentionData && attentionData.length > 0) {
    attentionData.forEach((service, index) => {
      console.log(`\n${index + 1}. ${service.service_name} (${service.category || 'uncategorized'})`);
      console.log(`   Health: ${service.service_health} | Usage: ${service.usage_count || 0} | Compliance Issues: ${service.compliance_issue_count || 0}`);
      console.log(`   Tests: ${service.has_tests ? 'Yes' : 'No'} | Checklist: ${service.checklist_compliant ? 'Compliant' : 'Non-compliant'}`);
      if (service.maintenance_recommendation) {
        console.log(`   Recommendation: ${service.maintenance_recommendation}`);
      }
    });
  } else {
    console.log('No services found in attention view');
  }
  
  // 3. High usage services (essential)
  console.log('\n3. HIGH USAGE SERVICES (ESSENTIAL):');
  console.log('------------------------------------');
  const { data: essentialData } = await supabase
    .from('sys_service_health_analysis_view')
    .select('service_name, category, usage_count, has_tests, service_health, checklist_compliant, confidence_score')
    .gt('usage_count', 10)
    .order('usage_count', { ascending: false })
    .limit(20);
    
  if (essentialData && essentialData.length > 0) {
    essentialData.forEach((service, index) => {
      console.log(`${index + 1}. ${service.service_name} (${service.category || 'uncategorized'})`);
      console.log(`   Usage: ${service.usage_count} | Health: ${service.service_health} | Tests: ${service.has_tests ? 'Yes' : 'No'} | Compliant: ${service.checklist_compliant ? 'Yes' : 'No'} | Confidence: ${service.confidence_score}%`);
    });
  }
  
  // 4. Services marked for consolidation
  console.log('\n4. SERVICES MARKED FOR CONSOLIDATION:');
  console.log('----------------------------------------------');
  const { data: consolidationData } = await supabase
    .from('sys_service_health_analysis_view')
    .select('service_name, category, usage_count, service_health, maintenance_recommendation, overlaps_with')
    .eq('consolidation_candidate', true)
    .order('usage_count');
    
  if (consolidationData && consolidationData.length > 0) {
    consolidationData.forEach((service, index) => {
      console.log(`${index + 1}. ${service.service_name} (${service.category || 'uncategorized'})`);
      console.log(`   Usage: ${service.usage_count || 0} | Health: ${service.service_health}`);
      if (service.overlaps_with) {
        console.log(`   Overlaps with: ${service.overlaps_with}`);
      }
      if (service.maintenance_recommendation) {
        console.log(`   Recommendation: ${service.maintenance_recommendation}`);
      }
    });
  } else {
    console.log('No services marked for consolidation');
  }
  
  // 5. Services without tests (but actively used)
  console.log('\n5. ACTIVELY USED SERVICES WITHOUT TESTS:');
  console.log('-----------------------------------------');
  const { data: noTestsData } = await supabase
    .from('sys_service_health_analysis_view')
    .select('service_name, category, usage_count, service_health, confidence_score')
    .eq('has_tests', false)
    .gt('usage_count', 5)  // Only show services with significant usage
    .order('usage_count', { ascending: false })
    .limit(20);
    
  if (noTestsData && noTestsData.length > 0) {
    noTestsData.forEach((service, index) => {
      console.log(`${index + 1}. ${service.service_name} (Usage: ${service.usage_count}, Health: ${service.service_health}, Confidence: ${service.confidence_score}%)`);
    });
  }
  
  // 6. Category breakdown
  console.log('\n6. SERVICE CATEGORY BREAKDOWN:');
  console.log('-------------------------------');
  const { data: categoryData } = await supabase
    .from('sys_service_health_analysis_view')
    .select('category, service_health, has_tests, checklist_compliant, usage_count');
    
  if (categoryData) {
    const categoryStats: Record<string, any> = {};
    
    categoryData.forEach(service => {
      const cat = service.category || 'uncategorized';
      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          total: 0,
          withTests: 0,
          compliant: 0,
          totalUsage: 0,
          healthCounts: { good: 0, needs_attention: 0, critical: 0, unknown: 0 }
        };
      }
      
      categoryStats[cat].total++;
      if (service.has_tests) categoryStats[cat].withTests++;
      if (service.checklist_compliant) categoryStats[cat].compliant++;
      categoryStats[cat].totalUsage += service.usage_count || 0;
      
      const health = service.service_health || 'unknown';
      if (categoryStats[cat].healthCounts[health] !== undefined) {
        categoryStats[cat].healthCounts[health]++;
      }
    });
    
    Object.entries(categoryStats)
      .sort(([,a], [,b]) => b.totalUsage - a.totalUsage)
      .forEach(([category, stats]) => {
        console.log(`\n${category}:`);
        console.log(`  Total Services: ${stats.total}`);
        console.log(`  Total Usage: ${stats.totalUsage}`);
        console.log(`  With Tests: ${stats.withTests} (${((stats.withTests/stats.total)*100).toFixed(1)}%)`);
        console.log(`  Compliant: ${stats.compliant} (${((stats.compliant/stats.total)*100).toFixed(1)}%)`);
        console.log(`  Health: Good=${stats.healthCounts.good}, Needs Attention=${stats.healthCounts.needs_attention}, Critical=${stats.healthCounts.critical}`);
      });
  }
  
  // 7. Services needing usage scan
  console.log('\n7. SERVICES NEEDING USAGE SCAN:');
  console.log('--------------------------------');
  const { data: scanData } = await supabase
    .from('sys_service_health_analysis_view')
    .select('service_name, last_usage_scan, next_scan_date')
    .eq('needs_scan', true)
    .limit(10);
    
  if (scanData && scanData.length > 0) {
    console.log(`${scanData.length} services need usage scanning`);
    scanData.forEach((service, index) => {
      console.log(`${index + 1}. ${service.service_name} - Last scan: ${service.last_usage_scan || 'Never'}`);
    });
  }
  
  console.log('\n=== END OF ANALYSIS ===');
}

analyzeServiceHealth().catch(console.error);