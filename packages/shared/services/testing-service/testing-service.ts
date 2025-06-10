/**
 * Testing Service
 * Orchestrates testing of shared services with registry-driven intelligence
 */

import { supabase } from '../supabase-client/universal';
import type { 
  ServiceTestConfig, 
  ServiceTestResults, 
  TestSuiteResults, 
  TestResult,
  TestRunRecord,
  HealthReport,
  IntegrationTestCase
} from './types';
import { MockDataFactory } from './mock-data-factory';

export class TestingService {
  private static instance: TestingService;

  private constructor() {}

  public static getInstance(): TestingService {
    if (!TestingService.instance) {
      TestingService.instance = new TestingService();
    }
    return TestingService.instance;
  }

  /**
   * Get services from registry with test priority
   */
  async getServicesForTesting(priority?: 'critical' | 'important' | 'standard'): Promise<ServiceTestConfig[]> {
    const query = supabase
      .from('sys_shared_services')
      .select('service_name, category, used_by_apps, used_by_pipelines, service_path')
      .eq('status', 'active');

    const { data: services, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch services for testing: ${error.message}`);
    }

    if (!services) {
      return [];
    }

    // Transform registry data into test configs
    const configs: ServiceTestConfig[] = services.map(service => {
      const usageCount = (service.used_by_apps?.length || 0) + (service.used_by_pipelines?.length || 0);
      const testPriority = usageCount >= 5 ? 'critical' : usageCount >= 2 ? 'important' : 'standard';
      
      return {
        serviceName: service.service_name,
        testTypes: this.getTestTypesForService(service.service_name, testPriority),
        dependencies: this.extractDependencies(service.service_name),
        mockRequirements: this.getMockRequirements(service.service_name),
        timeoutMs: testPriority === 'critical' ? 5000 : 3000,
        priority: testPriority
      };
    });

    // Filter by priority if specified
    if (priority) {
      return configs.filter(config => config.priority === priority);
    }

    return configs;
  }

  /**
   * Run tests for a specific service
   */
  async runServiceTests(config: ServiceTestConfig): Promise<ServiceTestResults> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    console.log(`🧪 Testing ${config.serviceName} (${config.priority} priority)`);

    // Record test run start
    await this.recordTestRun({
      service_name: config.serviceName,
      test_type: 'unit', // We'll update this for each test type
      status: 'running',
      executed_at: new Date().toISOString(),
      executed_by: 'testing-service'
    });

    try {
      // Run each test type
      for (const testType of config.testTypes) {
        const testResult = await this.runTestType(config.serviceName, testType, config.timeoutMs);
        results.push(testResult);

        // Record individual test result
        await this.recordTestRun({
          service_name: config.serviceName,
          test_type: testType,
          status: testResult.status,
          execution_time_ms: testResult.executionTimeMs,
          error_message: testResult.errorMessage,
          test_details: testResult.testDetails,
          executed_at: new Date().toISOString(),
          executed_by: 'testing-service'
        });
      }

      const totalExecutionTime = Date.now() - startTime;
      const overallStatus = results.every(r => r.status === 'passed') ? 'passed' : 
                           results.some(r => r.status === 'passed') ? 'partial' : 'failed';

      console.log(`  ✅ ${config.serviceName} completed in ${totalExecutionTime}ms (${overallStatus})`);

      return {
        serviceName: config.serviceName,
        overallStatus,
        executionTimeMs: totalExecutionTime,
        results
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`  ❌ ${config.serviceName} failed: ${errorMessage}`);

      return {
        serviceName: config.serviceName,
        overallStatus: 'failed',
        executionTimeMs: Date.now() - startTime,
        results: [{
          testType: 'unit',
          status: 'failed',
          executionTimeMs: Date.now() - startTime,
          errorMessage,
          testDetails: { error: errorMessage }
        }]
      };
    }
  }

  /**
   * Run test suite for multiple services
   */
  async runTestSuite(priority?: 'critical' | 'important' | 'standard'): Promise<TestSuiteResults> {
    const startTime = Date.now();
    console.log(`🚀 Starting test suite${priority ? ` (${priority} services only)` : ''}`);

    const services = await this.getServicesForTesting(priority);
    const serviceResults: ServiceTestResults[] = [];
    
    let passedServices = 0;
    let failedServices = 0;

    // Run tests for each service
    for (const service of services) {
      try {
        const result = await this.runServiceTests(service);
        serviceResults.push(result);
        
        if (result.overallStatus === 'passed') {
          passedServices++;
        } else {
          failedServices++;
        }
      } catch (error) {
        console.error(`Failed to test ${service.serviceName}:`, error);
        failedServices++;
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    
    // Calculate critical services health
    const criticalServices = serviceResults.filter(r => 
      services.find(s => s.serviceName === r.serviceName)?.priority === 'critical'
    );
    const criticalServicesPassed = criticalServices.filter(r => r.overallStatus === 'passed').length;
    const criticalServicesTotal = criticalServices.length;

    const overallHealthStatus = criticalServicesPassed === criticalServicesTotal ? 'healthy' :
                               criticalServicesPassed >= criticalServicesTotal * 0.8 ? 'warning' : 'critical';

    console.log(`🏁 Test suite completed in ${totalExecutionTime}ms`);
    console.log(`   Passed: ${passedServices}, Failed: ${failedServices}`);
    console.log(`   Critical services: ${criticalServicesPassed}/${criticalServicesTotal} (${overallHealthStatus})`);

    return {
      totalServices: services.length,
      passedServices,
      failedServices,
      totalExecutionTimeMs: totalExecutionTime,
      serviceResults,
      summary: {
        criticalServicesPassed,
        criticalServicesTotal,
        overallHealthStatus
      }
    };
  }

  /**
   * Get health report for services
   */
  async getHealthReport(): Promise<HealthReport[]> {
    const { data: healthData, error } = await supabase
      .from('sys_service_test_health_view')
      .select('*')
      .order('test_priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch health report: ${error.message}`);
    }

    if (!healthData) {
      return [];
    }

    return healthData.map(service => ({
      serviceName: service.service_name,
      isHealthy: service.health_status === 'healthy',
      lastTestRun: service.last_test_run ? new Date(service.last_test_run) : undefined,
      issues: this.generateIssues(service),
      recommendations: this.generateRecommendations(service)
    }));
  }

  /**
   * Run individual test type for a service
   */
  private async runTestType(serviceName: string, testType: 'unit' | 'integration' | 'contract', timeoutMs: number): Promise<TestResult> {
    const startTime = Date.now();

    try {
      switch (testType) {
        case 'unit':
          return await this.runUnitTests(serviceName, timeoutMs);
        case 'integration':
          return await this.runIntegrationTests(serviceName, timeoutMs);
        case 'contract':
          return await this.runContractTests(serviceName, timeoutMs);
        default:
          throw new Error(`Unknown test type: ${testType}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        testType,
        status: 'failed',
        executionTimeMs: Date.now() - startTime,
        errorMessage,
        testDetails: { error: errorMessage }
      };
    }
  }

  /**
   * Run unit tests for a service
   */
  private async runUnitTests(serviceName: string, timeoutMs: number): Promise<TestResult> {
    const startTime = Date.now();
    
    // For Phase 1, we'll implement basic validation tests
    try {
      // Test 1: Service can be imported
      const servicePath = `../../../packages/shared/services/${this.getServicePath(serviceName)}`;
      const serviceModule = await import(servicePath);
      
      // Test 2: Service has expected structure
      const hasExpectedStructure = this.validateServiceStructure(serviceModule, serviceName);
      
      // Test 3: Singleton pattern (if applicable)
      const singletonTest = this.testSingletonPattern(serviceModule, serviceName);
      
      const allTestsPassed = hasExpectedStructure && singletonTest;
      
      return {
        testType: 'unit',
        status: allTestsPassed ? 'passed' : 'failed',
        executionTimeMs: Date.now() - startTime,
        testDetails: {
          importTest: true,
          structureTest: hasExpectedStructure,
          singletonTest,
          testedMethods: this.getTestableMethodsCount(serviceModule)
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        testType: 'unit',
        status: 'failed',
        executionTimeMs: Date.now() - startTime,
        errorMessage,
        testDetails: { importError: errorMessage }
      };
    }
  }

  /**
   * Run integration tests for a service
   */
  private async runIntegrationTests(serviceName: string, timeoutMs: number): Promise<TestResult> {
    const startTime = Date.now();
    
    // For Phase 1, basic integration tests
    return {
      testType: 'integration',
      status: 'skipped', // Will be implemented in Phase 2
      executionTimeMs: Date.now() - startTime,
      testDetails: { reason: 'Integration tests scheduled for Phase 2' }
    };
  }

  /**
   * Run contract tests for a service
   */
  private async runContractTests(serviceName: string, timeoutMs: number): Promise<TestResult> {
    const startTime = Date.now();
    
    // For Phase 1, basic contract validation
    return {
      testType: 'contract',
      status: 'skipped', // Will be implemented in Phase 2
      executionTimeMs: Date.now() - startTime,
      testDetails: { reason: 'Contract tests scheduled for Phase 2' }
    };
  }

  /**
   * Record test run in database
   */
  private async recordTestRun(record: TestRunRecord): Promise<void> {
    const { error } = await supabase
      .from('sys_service_test_runs')
      .insert(record);

    if (error) {
      console.warn(`Failed to record test run: ${error.message}`);
    }
  }

  /**
   * Helper methods
   */
  private getTestTypesForService(serviceName: string, priority: 'critical' | 'important' | 'standard'): ('unit' | 'integration' | 'contract')[] {
    // Phase 1: Only unit tests
    return ['unit'];
  }

  private extractDependencies(serviceName: string): string[] {
    // TODO: Implement dependency extraction
    return [];
  }

  private getMockRequirements(serviceName: string): string[] {
    // TODO: Implement mock requirement detection
    return [];
  }

  private getServicePath(serviceName: string): string {
    // Convert service name to file path
    return serviceName.toLowerCase().replace(/service$/, '') + '-service';
  }

  private validateServiceStructure(serviceModule: any, serviceName: string): boolean {
    // Check if service exports expected structure
    return typeof serviceModule === 'object' && serviceModule !== null;
  }

  private testSingletonPattern(serviceModule: any, serviceName: string): boolean {
    // Check if service implements singleton pattern
    if (typeof serviceModule.getInstance === 'function') {
      try {
        const instance1 = serviceModule.getInstance();
        const instance2 = serviceModule.getInstance();
        return instance1 === instance2;
      } catch {
        return false;
      }
    }
    return true; // Not all services need to be singletons
  }

  private getTestableMethodsCount(serviceModule: any): number {
    if (typeof serviceModule.getInstance === 'function') {
      const instance = serviceModule.getInstance();
      return Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
        .filter(name => typeof instance[name] === 'function' && name !== 'constructor').length;
    }
    return 0;
  }

  private generateIssues(service: any): string[] {
    const issues: string[] = [];
    
    if (service.health_status === 'critical') {
      issues.push('Multiple test failures detected');
    }
    if (service.failed_runs > 0) {
      issues.push(`${service.failed_runs} failed test runs in the last 7 days`);
    }
    if (!service.last_test_run) {
      issues.push('Service has never been tested');
    }
    
    return issues;
  }

  private generateRecommendations(service: any): string[] {
    const recommendations: string[] = [];
    
    if (service.health_status === 'critical') {
      recommendations.push('Investigate failing tests and fix underlying issues');
    }
    if (service.avg_execution_time > 2000) {
      recommendations.push('Consider optimizing test performance');
    }
    if (!service.last_test_run) {
      recommendations.push('Run initial test suite to establish baseline');
    }
    
    return recommendations;
  }
}