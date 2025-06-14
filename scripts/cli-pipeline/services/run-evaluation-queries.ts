#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function runServiceEvaluationQueries() {
  console.log('🔍 Running Service Evaluation Queries...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Query 1: Overview
  console.log('=== 1. SERVICE OVERVIEW ===');
  const { data: overview, error: overviewError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT 
        'Total Services' as metric,
        COUNT(*) as count
      FROM sys_shared_services
      UNION ALL
      SELECT 
        'Classified Services',
        COUNT(*) FILTER (WHERE service_type IS NOT NULL)
      FROM sys_shared_services
      UNION ALL
      SELECT 
        'Unclassified Services',
        COUNT(*) FILTER (WHERE service_type IS NULL)
      FROM sys_shared_services
      UNION ALL
      SELECT 
        'High Usage (10+)',
        COUNT(*) FILTER (WHERE usage_count >= 10)
      FROM sys_shared_services
      UNION ALL
      SELECT 
        'Low Usage (1-9)',
        COUNT(*) FILTER (WHERE usage_count BETWEEN 1 AND 9)
      FROM sys_shared_services
      UNION ALL
      SELECT 
        'Unused (0)',
        COUNT(*) FILTER (WHERE usage_count = 0 OR usage_count IS NULL)
      FROM sys_shared_services
    `
  });
  
  if (overviewError) {
    console.error('Error running overview query:', overviewError);
  } else {
    console.table(overview);
  }
  
  // Query 2: Top Used Services
  console.log('\n=== 2. TOP 10 MOST USED SERVICES (Classify These First) ===');
  const { data: topServices, error: topError } = await supabase
    .from('sys_shared_services')
    .select('service_name, usage_count, service_type, instantiation_pattern, has_browser_variant')
    .order('usage_count', { ascending: false, nullsFirst: false })
    .limit(10);
    
  if (topError) {
    console.error('Error getting top services:', topError);
  } else {
    console.table(topServices);
  }
  
  // Query 3: Find Duplicates
  console.log('\n=== 3. POTENTIAL DUPLICATE SERVICES ===');
  const { data: allServices } = await supabase
    .from('sys_shared_services')
    .select('service_name, usage_count, category');
    
  if (allServices) {
    const duplicates: any[] = [];
    
    // Find services with similar names
    for (let i = 0; i < allServices.length; i++) {
      for (let j = i + 1; j < allServices.length; j++) {
        const service1 = allServices[i];
        const service2 = allServices[j];
        
        // Remove common suffixes for comparison
        const name1 = service1.service_name.replace(/(Service|Manager|Handler|Provider)$/, '');
        const name2 = service2.service_name.replace(/(Service|Manager|Handler|Provider)$/, '');
        
        if (name1.toLowerCase().includes(name2.toLowerCase()) || 
            name2.toLowerCase().includes(name1.toLowerCase())) {
          duplicates.push({
            service1: service1.service_name,
            usage1: service1.usage_count || 0,
            service2: service2.service_name,
            usage2: service2.usage_count || 0,
            status: '🔄 Potential Duplicate'
          });
        }
      }
    }
    
    if (duplicates.length > 0) {
      console.table(duplicates);
    } else {
      console.log('No obvious duplicates found by name similarity.');
    }
  }
  
  // Query 4: Unused Services
  console.log('\n=== 4. UNUSED SERVICES (Removal Candidates) ===');
  const { data: unusedServices, error: unusedError } = await supabase
    .from('sys_shared_services')
    .select('service_name, service_path, usage_count, created_at')
    .or('usage_count.eq.0,usage_count.is.null')
    .order('created_at');
    
  if (unusedError) {
    console.error('Error getting unused services:', unusedError);
  } else {
    console.table(unusedServices?.slice(0, 10)); // Show first 10
    if (unusedServices && unusedServices.length > 10) {
      console.log(`... and ${unusedServices.length - 10} more unused services`);
    }
  }
  
  // Query 5: Pattern Mismatches
  console.log('\n=== 5. PATTERN MISMATCHES (Need Refactoring) ===');
  const { data: mismatches, error: mismatchError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT 
        service_name,
        service_type,
        instantiation_pattern,
        CASE 
          WHEN service_type = 'infrastructure' AND instantiation_pattern != 'singleton' 
          THEN '⚠️ Should be singleton!'
          WHEN service_type = 'business' AND instantiation_pattern = 'singleton' 
          THEN '⚠️ Should use dependency injection!'
          ELSE '✅ Correct pattern'
        END as issue
      FROM sys_shared_services
      WHERE service_type IS NOT NULL
        AND (
          (service_type = 'infrastructure' AND instantiation_pattern != 'singleton')
          OR (service_type = 'business' AND instantiation_pattern = 'singleton')
        )
    `
  });
  
  if (mismatchError) {
    console.error('Error checking pattern mismatches:', mismatchError);
  } else if (mismatches && mismatches.length > 0) {
    console.table(mismatches);
  } else {
    console.log('No pattern mismatches found in classified services.');
  }
  
  // Generate classification suggestions
  console.log('\n=== 6. CLASSIFICATION SUGGESTIONS FOR TOP UNCLASSIFIED SERVICES ===');
  const { data: unclassified, error: unclassifiedError } = await supabase
    .from('sys_shared_services')
    .select('service_name, usage_count, is_singleton')
    .is('service_type', null)
    .order('usage_count', { ascending: false, nullsFirst: false })
    .limit(10);
    
  if (unclassifiedError) {
    console.error('Error getting unclassified services:', unclassifiedError);
  } else if (unclassified) {
    const suggestions = unclassified.map((service: any) => {
      // Suggest type based on name patterns
      let suggestedType = 'business';
      if (service.service_name.match(/client|connection|logger|auth/i)) {
        suggestedType = 'infrastructure';
      }
      
      // Suggest pattern
      let suggestedPattern = service.is_singleton ? 'singleton' : 'dependency_injection';
      
      return {
        service_name: service.service_name,
        usage_count: service.usage_count,
        suggested_type: suggestedType,
        suggested_pattern: suggestedPattern
      };
    });
    
    console.table(suggestions);
    
    console.log('\nTo classify these services, run:');
    suggestions.slice(0, 3).forEach((s: any) => {
      console.log(`UPDATE sys_shared_services SET service_type = '${s.suggested_type}', instantiation_pattern = '${s.suggested_pattern}' WHERE service_name = '${s.service_name}';`);
    });
  }
  
  // Summary
  console.log('\n=== RECOMMENDED NEXT STEPS ===');
  console.log('1. Classify the top 10 most-used services first');
  console.log('2. Review and merge obvious duplicates');
  console.log('3. Fix pattern mismatches (infrastructure should be singleton)');
  console.log('4. Investigate unused services for removal');
  console.log('5. Test high-value services in dhg-service-test');
}

// Run the queries
runServiceEvaluationQueries().catch(console.error);