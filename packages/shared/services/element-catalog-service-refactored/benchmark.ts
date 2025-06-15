/**
 * Performance benchmark for ElementCatalogService
 */

import { ElementCatalogService } from './ElementCatalogService';
import { SupabaseClientService } from '../supabase-client';

async function benchmark() {
  console.log('Starting ElementCatalogService benchmark...\n');
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  const service = new ElementCatalogService(supabase);
  
  try {
    // Benchmark 1: Health Check
    console.log('1. Health Check Performance:');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`   ✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    
    // Benchmark 2: Fetch App Features
    console.log('\n2. App Feature Operations:');
    const apps = ['dhg-hub', 'dhg-audio', 'dhg-admin-suite'];
    for (const app of apps) {
      const featuresStart = Date.now();
      const features = await service.getAppFeatures(app);
      const featuresDuration = Date.now() - featuresStart;
      console.log(`   ✓ Fetch features for ${app}: ${featuresDuration}ms (found: ${features.length} features)`);
    }
    
    // Benchmark 3: Fetch CLI Commands
    console.log('\n3. CLI Command Operations:');
    const pipelines = ['google_sync', 'document', 'media-processing'];
    for (const pipeline of pipelines) {
      const commandsStart = Date.now();
      const commands = await service.getCLICommands(pipeline);
      const commandsDuration = Date.now() - commandsStart;
      console.log(`   ✓ Fetch commands for ${pipeline}: ${commandsDuration}ms (found: ${commands.length} commands)`);
    }
    
    // Benchmark 4: Fetch Shared Services
    console.log('\n4. Shared Service Operations:');
    const servicesStart = Date.now();
    const allServices = await service.getSharedServices();
    const servicesDuration = Date.now() - servicesStart;
    console.log(`   ✓ Fetch all services: ${servicesDuration}ms (found: ${allServices.length} services)`);
    
    // Fetch by category
    const categories = ['authentication', 'business', 'infrastructure'];
    for (const category of categories) {
      const catStart = Date.now();
      const catServices = await service.getSharedServices(category);
      const catDuration = Date.now() - catStart;
      console.log(`   ✓ Fetch ${category} services: ${catDuration}ms (found: ${catServices.length} services)`);
    }
    
    // Benchmark 5: Get All Available Elements
    console.log('\n5. Available Elements Query:');
    const elementsStart = Date.now();
    const allElements = await service.getAllAvailableElements();
    const elementsDuration = Date.now() - elementsStart;
    console.log(`   ✓ Fetch all available elements: ${elementsDuration}ms (found: ${allElements.length} elements)`);
    
    // Benchmark 6: Catalog Operations
    console.log('\n6. Catalog Operations:');
    const testFeature = {
      app_name: 'benchmark-test',
      feature_type: 'component' as const,
      feature_name: `BenchmarkComponent_${Date.now()}`,
      file_path: '/components/Benchmark.tsx',
      description: 'Performance test component'
    };
    
    const catalogStart = Date.now();
    const featureId = await service.catalogAppFeature(testFeature);
    const catalogDuration = Date.now() - catalogStart;
    console.log(`   ✓ Catalog new feature: ${catalogDuration}ms (created: ${featureId ? 'success' : 'failed'})`);
    
    // Benchmark 7: Element Details
    console.log('\n7. Element Detail Queries:');
    if (allElements.length > 0) {
      // Test with first 3 elements
      const testElements = allElements.slice(0, 3);
      for (const elem of testElements) {
        const detailStart = Date.now();
        const details = await service.getElementDetails(elem.element_type, elem.element_id);
        const detailDuration = Date.now() - detailStart;
        console.log(`   ✓ Get details for ${elem.element_type} "${elem.name}": ${detailDuration}ms`);
      }
    }
    
    // Get final metrics
    console.log('\n8. Service Metrics:');
    const metrics = service.getMetrics();
    console.log('   ✓ Total App Features Queried:', metrics.totalAppFeaturesQueried);
    console.log('   ✓ Total CLI Commands Queried:', metrics.totalCLICommandsQueried);
    console.log('   ✓ Total Shared Services Queried:', metrics.totalSharedServicesQueried);
    console.log('   ✓ Total Features Cataloged:', metrics.totalFeaturesCataloged);
    console.log('   ✓ Total Elements Linked:', metrics.totalElementsLinked);
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