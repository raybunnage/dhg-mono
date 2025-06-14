/**
 * Performance benchmark for ElementCriteriaService
 */

import { ElementCriteriaService } from './ElementCriteriaService';
import { SupabaseClientService } from '../supabase-client';

async function benchmark() {
  console.log('Starting ElementCriteriaService benchmark...\n');
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  const service = new ElementCriteriaService(supabase);
  
  try {
    // Benchmark 1: Health Check
    console.log('1. Health Check Performance:');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`   ✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    
    // Benchmark 2: Fetch Criteria
    console.log('\n2. Fetch Operations:');
    const fetchStart = Date.now();
    const criteria = await service.getElementCriteria('app_feature', 'test-feature');
    const fetchDuration = Date.now() - fetchStart;
    console.log(`   ✓ Fetch criteria: ${fetchDuration}ms (found: ${criteria.length} items)`);
    
    // Benchmark 3: Fetch Gates
    const gatesStart = Date.now();
    const gates = await service.getElementGates('app_feature', 'test-feature');
    const gatesDuration = Date.now() - gatesStart;
    console.log(`   ✓ Fetch gates: ${gatesDuration}ms (found: ${gates.length} items)`);
    
    // Benchmark 4: Get Templates
    console.log('\n3. Template Operations:');
    const templatesStart = Date.now();
    const templates = await service.getTemplates('app_feature');
    const templatesDuration = Date.now() - templatesStart;
    console.log(`   ✓ Fetch templates: ${templatesDuration}ms (found: ${templates.length} templates)`);
    
    // Benchmark 5: Get Elements with Criteria
    console.log('\n4. View Queries:');
    const elementsStart = Date.now();
    const elements = await service.getElementsWithCriteria('app_feature');
    const elementsDuration = Date.now() - elementsStart;
    console.log(`   ✓ Fetch elements with criteria: ${elementsDuration}ms (found: ${elements.length} elements)`);
    
    // Benchmark 6: Batch Operations
    console.log('\n5. Batch Operations:');
    const batchStart = Date.now();
    
    // Add test criteria
    const testCriteria = {
      element_type: 'app_feature' as const,
      element_id: 'benchmark-test',
      title: 'Benchmark Test Criteria',
      success_condition: 'Performance test should complete',
      criteria_type: 'performance' as const,
      priority: 'low' as const
    };
    
    const added = await service.addCriteria(testCriteria);
    const addDuration = Date.now() - batchStart;
    console.log(`   ✓ Add criteria: ${addDuration}ms`);
    
    if (added?.id) {
      // Update the criteria
      const updateStart = Date.now();
      await service.updateCriteria(added.id, { priority: 'high' });
      const updateDuration = Date.now() - updateStart;
      console.log(`   ✓ Update criteria: ${updateDuration}ms`);
      
      // Delete the criteria
      const deleteStart = Date.now();
      await service.deleteCriteria(added.id);
      const deleteDuration = Date.now() - deleteStart;
      console.log(`   ✓ Delete criteria: ${deleteDuration}ms`);
    }
    
    // Get final metrics
    console.log('\n6. Service Metrics:');
    const metrics = service.getMetrics();
    console.log('   ✓ Total Criteria Fetched:', metrics.totalCriteriaFetched);
    console.log('   ✓ Total Gates Fetched:', metrics.totalGatesFetched);
    console.log('   ✓ Total Criteria Added:', metrics.totalCriteriaAdded);
    console.log('   ✓ Total Templates Applied:', metrics.totalTemplatesApplied);
    console.log('   ✓ Total Errors:', metrics.totalErrors);
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (require.main === module) {
  benchmark().catch(console.error);
}

export { benchmark };