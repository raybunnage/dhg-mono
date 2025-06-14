#!/usr/bin/env ts-node

/**
 * Testing Pipeline Health Check
 * Verifies the testing infrastructure is working properly
 */

import { supabase } from '../../../packages/shared/services/supabase-client/universal';

async function healthCheck() {
  console.log('🏥 Testing Pipeline Health Check\n');

  let overallHealth = true;
  const checks: Array<{ name: string; status: boolean; message: string }> = [];

  // Check 1: Database connection
  console.log('1. 🔌 Database Connection...');
  try {
    const { data, error } = await supabase
      .from('document_types')
      .select('document_type')
      .limit(1);

    if (error) {
      checks.push({ name: 'Database Connection', status: false, message: error.message });
      overallHealth = false;
      console.log(`   ❌ Failed: ${error.message}`);
    } else {
      checks.push({ name: 'Database Connection', status: true, message: 'Connected successfully' });
      console.log('   ✅ Connected successfully');
    }
  } catch (err) {
    checks.push({ name: 'Database Connection', status: false, message: String(err) });
    overallHealth = false;
    console.log(`   ❌ Exception: ${err}`);
  }

  // Check 2: Testing tables exist
  console.log('\n2. 🗃️  Testing Tables...');
  try {
    const { data: tableData, error } = await supabase
      .from('sys_service_test_runs')
      .select('id')
      .limit(1);

    if (error) {
      checks.push({ name: 'Testing Tables', status: false, message: 'sys_service_test_runs table missing or inaccessible' });
      overallHealth = false;
      console.log('   ❌ sys_service_test_runs table missing or inaccessible');
    } else {
      checks.push({ name: 'Testing Tables', status: true, message: 'Testing tables accessible' });
      console.log('   ✅ sys_service_test_runs table accessible');
    }
  } catch (err) {
    checks.push({ name: 'Testing Tables', status: false, message: String(err) });
    overallHealth = false;
    console.log(`   ❌ Exception: ${err}`);
  }

  // Check 3: Testing views exist
  console.log('\n3. 👁️  Testing Views...');
  try {
    const { data: viewData, error } = await supabase
      .from('sys_service_testing_view')
      .select('service_name')
      .limit(1);

    if (error) {
      checks.push({ name: 'Testing Views', status: false, message: 'sys_service_testing_view missing or inaccessible' });
      overallHealth = false;
      console.log('   ❌ sys_service_testing_view missing or inaccessible');
    } else {
      checks.push({ name: 'Testing Views', status: true, message: 'Testing views accessible' });
      console.log('   ✅ sys_service_testing_view accessible');
    }
  } catch (err) {
    checks.push({ name: 'Testing Views', status: false, message: String(err) });
    overallHealth = false;
    console.log(`   ❌ Exception: ${err}`);
  }

  // Check 4: Service registry
  console.log('\n4. 📋 Service Registry...');
  try {
    const { data: services, error } = await supabase
      .from('sys_shared_services')
      .select('service_name, status')
      .eq('status', 'active');

    if (error) {
      checks.push({ name: 'Service Registry', status: false, message: error.message });
      overallHealth = false;
      console.log(`   ❌ Failed: ${error.message}`);
    } else if (!services || services.length === 0) {
      checks.push({ name: 'Service Registry', status: false, message: 'No active services found in registry' });
      overallHealth = false;
      console.log('   ⚠️  No active services found in registry');
    } else {
      checks.push({ name: 'Service Registry', status: true, message: `${services.length} active services found` });
      console.log(`   ✅ ${services.length} active services found`);
    }
  } catch (err) {
    checks.push({ name: 'Service Registry', status: false, message: String(err) });
    overallHealth = false;
    console.log(`   ❌ Exception: ${err}`);
  }

  // Check 5: Testing service import
  console.log('\n5. 🧪 Testing Service...');
  try {
    const { TestingService } = await import('../../../packages/shared/services/testing-service');
    const testingService = TestingService.getInstance();
    
    if (testingService) {
      checks.push({ name: 'Testing Service', status: true, message: 'Testing service imported and instantiated' });
      console.log('   ✅ Testing service imported and instantiated');
    } else {
      checks.push({ name: 'Testing Service', status: false, message: 'Testing service returned null' });
      overallHealth = false;
      console.log('   ❌ Testing service returned null');
    }
  } catch (err) {
    checks.push({ name: 'Testing Service', status: false, message: String(err) });
    overallHealth = false;
    console.log(`   ❌ Failed to import: ${err}`);
  }

  // Check 6: Mock data factory
  console.log('\n6. 🏭 Mock Data Factory...');
  try {
    const { MockDataFactory } = await import('../../../packages/shared/services/testing-service');
    
    // Test creating mock data
    const mockRecord = MockDataFactory.createSupabaseRecord('test_table', { test_field: 'test_value' });
    const mockDriveFile = MockDataFactory.createGoogleDriveFile('audio');
    
    if (mockRecord && mockDriveFile) {
      checks.push({ name: 'Mock Data Factory', status: true, message: 'Mock data factory working' });
      console.log('   ✅ Mock data factory working');
    } else {
      checks.push({ name: 'Mock Data Factory', status: false, message: 'Mock data factory returned null' });
      overallHealth = false;
      console.log('   ❌ Mock data factory returned null');
    }
  } catch (err) {
    checks.push({ name: 'Mock Data Factory', status: false, message: String(err) });
    overallHealth = false;
    console.log(`   ❌ Failed: ${err}`);
  }

  // Check 7: File permissions
  console.log('\n7. 📁 File Permissions...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const scriptPath = path.join(__dirname, 'testing-cli.sh');
    const stats = fs.statSync(scriptPath);
    
    if (stats.mode & parseInt('111', 8)) {
      checks.push({ name: 'File Permissions', status: true, message: 'CLI script is executable' });
      console.log('   ✅ CLI script is executable');
    } else {
      checks.push({ name: 'File Permissions', status: false, message: 'CLI script is not executable' });
      overallHealth = false;
      console.log('   ❌ CLI script is not executable');
    }
  } catch (err) {
    checks.push({ name: 'File Permissions', status: false, message: String(err) });
    overallHealth = false;
    console.log(`   ❌ Failed: ${err}`);
  }

  // Summary
  console.log('\n📊 Health Check Summary:');
  const passedChecks = checks.filter(c => c.status).length;
  const totalChecks = checks.length;
  console.log(`  ✅ Passed: ${passedChecks}/${totalChecks}`);
  console.log(`  ❌ Failed: ${totalChecks - passedChecks}/${totalChecks}`);
  console.log(`  📈 Health Score: ${Math.round((passedChecks / totalChecks) * 100)}%`);

  if (overallHealth) {
    console.log('\n🎉 Testing pipeline is healthy!');
    console.log('\nReady to run:');
    console.log('  ./scripts/cli-pipeline/testing/testing-cli.sh test-critical');
    console.log('  ./scripts/cli-pipeline/testing/testing-cli.sh health-report');
  } else {
    console.log('\n⚠️  Testing pipeline has issues that need attention:');
    checks.filter(c => !c.status).forEach(check => {
      console.log(`  - ${check.name}: ${check.message}`);
    });
    
    console.log('\nRecommended fixes:');
    if (!checks.find(c => c.name === 'Database Connection')?.status) {
      console.log('  1. Check database credentials and connectivity');
    }
    if (!checks.find(c => c.name === 'Testing Tables')?.status) {
      console.log('  2. Run: ./scripts/cli-pipeline/testing/testing-cli.sh setup-infrastructure');
    }
    if (!checks.find(c => c.name === 'Service Registry')?.status) {
      console.log('  3. Populate service registry with active services');
    }
  }

  process.exit(overallHealth ? 0 : 1);
}

if (require.main === module) {
  healthCheck();
}