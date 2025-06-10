#!/usr/bin/env ts-node

/**
 * Generate Health Report
 * Shows testing health status for all services
 */

import { TestingService } from '../../../packages/shared/services/testing-service';
import { supabase } from '../../../packages/shared/services/supabase-client/universal';

async function generateHealthReport() {
  console.log('📊 Generating Service Health Report\n');

  try {
    const testingService = TestingService.getInstance();

    // Get health report from testing service
    console.log('🔍 Fetching health data...');
    const healthReport = await testingService.getHealthReport();

    if (healthReport.length === 0) {
      console.log('⚠️  No health data available yet');
      console.log('\nThis usually means:');
      console.log('  1. Testing infrastructure hasn\'t been set up');
      console.log('  2. No tests have been run yet');
      console.log('\nRun these commands first:');
      console.log('  ./scripts/cli-pipeline/testing/testing-cli.sh setup-infrastructure');
      console.log('  ./scripts/cli-pipeline/testing/testing-cli.sh test-critical');
      return;
    }

    // Group services by health status
    const healthyServices = healthReport.filter(s => s.isHealthy);
    const unhealthyServices = healthReport.filter(s => !s.isHealthy);

    console.log(`📈 Health Summary:`);
    console.log(`  ✅ Healthy: ${healthyServices.length}`);
    console.log(`  ❌ Unhealthy: ${unhealthyServices.length}`);
    console.log(`  📊 Total: ${healthReport.length}\n`);

    // Show detailed health status
    if (healthyServices.length > 0) {
      console.log('✅ Healthy Services:');
      healthyServices.forEach(service => {
        const lastTest = service.lastTestRun ? 
          `Last tested: ${service.lastTestRun.toLocaleDateString()}` : 
          'Never tested';
        console.log(`  - ${service.serviceName} (${lastTest})`);
      });
      console.log('');
    }

    if (unhealthyServices.length > 0) {
      console.log('❌ Unhealthy Services:');
      unhealthyServices.forEach(service => {
        console.log(`  - ${service.serviceName}`);
        if (service.issues.length > 0) {
          service.issues.forEach(issue => {
            console.log(`    ⚠️  ${issue}`);
          });
        }
        if (service.recommendations.length > 0) {
          service.recommendations.forEach(rec => {
            console.log(`    💡 ${rec}`);
          });
        }
        console.log('');
      });
    }

    // Get recent test activity
    console.log('📅 Recent Test Activity:');
    try {
      const { data: recentTests, error } = await supabase
        .from('sys_service_test_runs')
        .select('service_name, test_type, status, execution_time_ms, executed_at')
        .order('executed_at', { ascending: false })
        .limit(10);

      if (error) {
        console.log(`  ⚠️  Could not fetch recent activity: ${error.message}`);
      } else if (recentTests && recentTests.length > 0) {
        recentTests.forEach(test => {
          const status = test.status === 'passed' ? '✅' : 
                        test.status === 'failed' ? '❌' : 
                        test.status === 'skipped' ? '⏭️' : '🔄';
          const date = new Date(test.executed_at).toLocaleString();
          console.log(`  ${status} ${test.service_name} (${test.test_type}) - ${date}`);
        });
      } else {
        console.log('  📭 No recent test activity');
      }
    } catch (err) {
      console.log(`  ⚠️  Could not fetch recent activity: ${err}`);
    }

    // Service registry overview
    console.log('\n📋 Service Registry Overview:');
    try {
      const { data: registryStats, error } = await supabase
        .from('sys_shared_services')
        .select('status')
        .eq('status', 'active');

      if (error) {
        console.log(`  ⚠️  Could not fetch registry stats: ${error.message}`);
      } else if (registryStats) {
        console.log(`  📦 Active Services: ${registryStats.length}`);
        
        // Get priority breakdown
        const { data: priorityStats, error: priorityError } = await supabase
          .from('sys_service_testing_view')
          .select('test_priority');

        if (!priorityError && priorityStats) {
          const criticalCount = priorityStats.filter(s => s.test_priority === 'critical').length;
          const importantCount = priorityStats.filter(s => s.test_priority === 'important').length;
          const standardCount = priorityStats.filter(s => s.test_priority === 'standard').length;
          
          console.log(`  🔴 Critical: ${criticalCount}`);
          console.log(`  🟡 Important: ${importantCount}`);
          console.log(`  🟢 Standard: ${standardCount}`);
        }
      }
    } catch (err) {
      console.log(`  ⚠️  Could not fetch registry overview: ${err}`);
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    
    if (unhealthyServices.length > 0) {
      console.log('  1. Fix failing tests for unhealthy services');
      console.log('  2. Run tests more frequently to catch issues early');
    }
    
    const neverTested = healthReport.filter(s => !s.lastTestRun);
    if (neverTested.length > 0) {
      console.log(`  3. Run initial tests for ${neverTested.length} untested services`);
    }
    
    if (healthyServices.length === healthReport.length) {
      console.log('  🎉 All services are healthy! Consider implementing Phase 2 features.');
    }

    console.log('\nNext steps:');
    console.log('  - Fix any failing services');
    console.log('  - Run: ./scripts/cli-pipeline/testing/testing-cli.sh test-critical');
    console.log('  - Monitor test trends over time');

  } catch (error) {
    console.error('❌ Health report generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  generateHealthReport();
}