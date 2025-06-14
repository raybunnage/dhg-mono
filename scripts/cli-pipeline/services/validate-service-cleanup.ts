#!/usr/bin/env ts-node

/**
 * Service Cleanup Validation Workflow
 * Ensures services are actually working after cleanup
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import axios from 'axios';

interface ValidationResult {
  service_name: string;
  validation_type: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
  timestamp: string;
}

interface ServiceValidation {
  service_name: string;
  validations: ValidationResult[];
  overall_status: 'pass' | 'fail' | 'partial';
  test_results?: any;
  visual_confirmation?: boolean;
}

class ServiceCleanupValidator {
  private supabase = SupabaseClientService.getInstance().getClient();
  
  async validateService(serviceName: string): Promise<ServiceValidation> {
    console.log(`\n🔍 Validating ${serviceName}...`);
    
    const validations: ValidationResult[] = [];
    
    // 1. Compile Check
    validations.push(await this.validateCompilation(serviceName));
    
    // 2. Import Resolution
    validations.push(await this.validateImports(serviceName));
    
    // 3. Unit Tests (if available)
    validations.push(await this.validateUnitTests(serviceName));
    
    // 4. Integration Tests (dhg-service-test)
    const integrationResult = await this.validateIntegrationTests(serviceName);
    validations.push(integrationResult);
    
    // 5. Runtime Validation
    validations.push(await this.validateRuntime(serviceName));
    
    // 6. Visual Confirmation Check
    const visualConfirmed = await this.checkVisualConfirmation(serviceName);
    
    // Calculate overall status
    const failCount = validations.filter(v => v.status === 'fail').length;
    const overall_status = failCount === 0 ? 'pass' : 
                          failCount === validations.length ? 'fail' : 'partial';
    
    const result: ServiceValidation = {
      service_name: serviceName,
      validations,
      overall_status,
      test_results: integrationResult.details,
      visual_confirmation: visualConfirmed
    };
    
    // Store results
    await this.storeValidationResults(result);
    
    // Generate report
    this.generateReport(result);
    
    return result;
  }
  
  private async validateCompilation(serviceName: string): Promise<ValidationResult> {
    console.log('  ✓ Running TypeScript compilation check...');
    
    try {
      // Find service file
      const servicePath = await this.findServicePath(serviceName);
      if (!servicePath) {
        return {
          service_name: serviceName,
          validation_type: 'compilation',
          status: 'fail',
          message: 'Service file not found',
          timestamp: new Date().toISOString()
        };
      }
      
      // Run tsc on the specific file
      execSync(`npx tsc --noEmit ${servicePath}`, { encoding: 'utf-8' });
      
      return {
        service_name: serviceName,
        validation_type: 'compilation',
        status: 'pass',
        message: 'TypeScript compilation successful',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service_name: serviceName,
        validation_type: 'compilation',
        status: 'fail',
        message: 'TypeScript compilation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  private async validateImports(serviceName: string): Promise<ValidationResult> {
    console.log('  ✓ Checking import resolution...');
    
    try {
      // Check for old import paths
      const oldImports = execSync(
        `grep -r "${serviceName}" --include="*.ts" --exclude-dir=node_modules . | grep -E "(cli-pipeline|scripts)" | wc -l`,
        { encoding: 'utf-8' }
      ).trim();
      
      const oldImportCount = parseInt(oldImports);
      
      if (oldImportCount > 0) {
        return {
          service_name: serviceName,
          validation_type: 'imports',
          status: 'warning',
          message: `Found ${oldImportCount} old import paths`,
          details: { old_imports: oldImportCount },
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        service_name: serviceName,
        validation_type: 'imports',
        status: 'pass',
        message: 'All imports use correct paths',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service_name: serviceName,
        validation_type: 'imports',
        status: 'fail',
        message: 'Import validation failed',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  private async validateUnitTests(serviceName: string): Promise<ValidationResult> {
    console.log('  ✓ Running unit tests...');
    
    // Check if unit tests exist
    const testPaths = [
      `packages/shared/services/${serviceName.toLowerCase()}/__tests__`,
      `packages/shared/services/${serviceName.toLowerCase()}/${serviceName.toLowerCase()}.test.ts`
    ];
    
    const hasTests = testPaths.some(path => fs.existsSync(path));
    
    if (!hasTests) {
      return {
        service_name: serviceName,
        validation_type: 'unit_tests',
        status: 'warning',
        message: 'No unit tests found',
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      // Run jest for this specific service
      const output = execSync(
        `npx jest ${serviceName} --passWithNoTests`,
        { encoding: 'utf-8' }
      );
      
      return {
        service_name: serviceName,
        validation_type: 'unit_tests',
        status: 'pass',
        message: 'Unit tests passed',
        details: { output },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service_name: serviceName,
        validation_type: 'unit_tests',
        status: 'fail',
        message: 'Unit tests failed',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  private async validateIntegrationTests(serviceName: string): Promise<ValidationResult> {
    console.log('  ✓ Running integration tests via dhg-service-test...');
    
    try {
      // Call the dhg-service-test API endpoint
      const response = await axios.post('http://localhost:5180/api/test-service', {
        serviceName: serviceName
      });
      
      const results = response.data;
      
      // Check test results
      const failedTests = results.tests.filter((t: any) => t.status === 'error');
      
      if (failedTests.length > 0) {
        return {
          service_name: serviceName,
          validation_type: 'integration_tests',
          status: 'fail',
          message: `${failedTests.length} tests failed`,
          details: results,
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        service_name: serviceName,
        validation_type: 'integration_tests',
        status: 'pass',
        message: 'All integration tests passed',
        details: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service_name: serviceName,
        validation_type: 'integration_tests',
        status: 'warning',
        message: 'Could not run integration tests (is dhg-service-test running?)',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  private async validateRuntime(serviceName: string): Promise<ValidationResult> {
    console.log('  ✓ Validating runtime behavior...');
    
    try {
      // Dynamically import and test the service
      const servicePath = await this.findServicePath(serviceName);
      if (!servicePath) {
        return {
          service_name: serviceName,
          validation_type: 'runtime',
          status: 'fail',
          message: 'Service not found',
          timestamp: new Date().toISOString()
        };
      }
      
      // Test basic functionality based on service type
      if (serviceName.includes('ClientService') || serviceName.includes('Service')) {
        // Test singleton pattern
        const module = require(servicePath);
        const ServiceClass = module[serviceName] || module.default;
        
        if (ServiceClass && ServiceClass.getInstance) {
          const instance1 = ServiceClass.getInstance();
          const instance2 = ServiceClass.getInstance();
          
          if (instance1 !== instance2) {
            return {
              service_name: serviceName,
              validation_type: 'runtime',
              status: 'fail',
              message: 'Singleton pattern violated',
              timestamp: new Date().toISOString()
            };
          }
        }
      }
      
      return {
        service_name: serviceName,
        validation_type: 'runtime',
        status: 'pass',
        message: 'Runtime validation passed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        service_name: serviceName,
        validation_type: 'runtime',
        status: 'fail',
        message: 'Runtime validation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  private async checkVisualConfirmation(serviceName: string): Promise<boolean> {
    // Check if test results are visible in dhg-service-test UI
    try {
      const { data } = await this.supabase
        .from('sys_shared_services')
        .select('last_test_run, test_coverage')
        .eq('service_name', serviceName)
        .single();
        
      return !!data?.last_test_run;
    } catch {
      return false;
    }
  }
  
  private async findServicePath(serviceName: string): Promise<string | null> {
    const possiblePaths = [
      `packages/shared/services/${serviceName.toLowerCase()}.ts`,
      `packages/shared/services/${serviceName}.ts`,
      `packages/shared/services/${serviceName.toLowerCase()}/${serviceName.toLowerCase()}.ts`,
      `packages/shared/services/${serviceName}/${serviceName}.ts`,
      `packages/shared/adapters/${serviceName.toLowerCase()}.ts`
    ];
    
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }
    
    return null;
  }
  
  private async storeValidationResults(result: ServiceValidation) {
    // Store in database for tracking
    await this.supabase
      .from('sys_service_validation_results')
      .insert({
        service_name: result.service_name,
        validation_results: result.validations,
        overall_status: result.overall_status,
        visual_confirmation: result.visual_confirmation,
        validated_at: new Date().toISOString()
      });
      
    // Update service health status
    await this.supabase
      .from('sys_shared_services')
      .update({
        last_validation: new Date().toISOString(),
        validation_status: result.overall_status,
        has_visual_confirmation: result.visual_confirmation
      })
      .eq('service_name', result.service_name);
  }
  
  private generateReport(result: ServiceValidation) {
    console.log('\n📊 Validation Report:');
    console.log('='.repeat(50));
    console.log(`Service: ${result.service_name}`);
    console.log(`Overall Status: ${this.getStatusEmoji(result.overall_status)} ${result.overall_status.toUpperCase()}`);
    console.log(`Visual Confirmation: ${result.visual_confirmation ? '✅ Yes' : '❌ No'}`);
    console.log('\nValidation Results:');
    
    result.validations.forEach(v => {
      console.log(`  ${this.getStatusEmoji(v.status)} ${v.validation_type}: ${v.message}`);
    });
    
    if (result.overall_status !== 'pass') {
      console.log('\n⚠️  Action Required:');
      console.log('1. Fix failing validations');
      console.log('2. Run tests in dhg-service-test UI');
      console.log('3. Verify visual confirmation in the app');
      console.log('4. Re-run validation');
    } else {
      console.log('\n✅ Service cleanup validated successfully!');
    }
  }
  
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'warning': return '⚠️';
      case 'partial': return '🟡';
      default: return '❓';
    }
  }
}

// CLI Interface
if (require.main === module) {
  const serviceName = process.argv[2];
  
  if (!serviceName) {
    console.error('Usage: validate-service-cleanup.ts <service-name>');
    console.error('Example: validate-service-cleanup.ts SupabaseClientService');
    process.exit(1);
  }
  
  const validator = new ServiceCleanupValidator();
  validator.validateService(serviceName)
    .then(() => console.log('\nValidation complete!'))
    .catch(console.error);
}

export { ServiceCleanupValidator };