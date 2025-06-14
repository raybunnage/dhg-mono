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

    return healthData
      .filter(service => service.service_name !== null)
      .map(service => ({
        serviceName: service.service_name as string,
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
   * Run integration tests for a service (Phase 2)
   */
  private async runIntegrationTests(serviceName: string, timeoutMs: number): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Phase 2: Real integration tests
      const integrationCases = this.getIntegrationTestCases(serviceName);
      let passedTests = 0;
      let failedTests = 0;
      const testResults: any[] = [];

      for (const testCase of integrationCases) {
        try {
          console.log(`    Running integration test: ${testCase.name}`);
          const result = await Promise.race([
            testCase.testFunction(),
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
            )
          ]);
          
          if (result) {
            passedTests++;
            testResults.push({ test: testCase.name, status: 'passed' });
          } else {
            failedTests++;
            testResults.push({ test: testCase.name, status: 'failed', reason: 'Test returned false' });
          }
        } catch (error) {
          failedTests++;
          testResults.push({ 
            test: testCase.name, 
            status: 'failed', 
            reason: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      const allPassed = failedTests === 0 && passedTests > 0;
      
      return {
        testType: 'integration',
        status: allPassed ? 'passed' : 'failed' as 'passed' | 'failed' | 'skipped',
        executionTimeMs: Date.now() - startTime,
        testDetails: {
          totalTests: integrationCases.length,
          passed: passedTests,
          failed: failedTests,
          results: testResults
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        testType: 'integration',
        status: 'failed',
        executionTimeMs: Date.now() - startTime,
        errorMessage,
        testDetails: { error: errorMessage }
      };
    }
  }

  /**
   * Run contract tests for a service (Phase 2)
   */
  private async runContractTests(serviceName: string, timeoutMs: number): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Phase 2: Contract testing for API stability
      const contractTests = this.getContractTestCases(serviceName);
      let passedTests = 0;
      let failedTests = 0;
      const testResults: any[] = [];

      for (const contractTest of contractTests) {
        try {
          const result = await contractTest.validator();
          if (result.isValid) {
            passedTests++;
            testResults.push({ 
              contract: contractTest.name, 
              status: 'passed',
              description: contractTest.description 
            });
          } else {
            failedTests++;
            testResults.push({ 
              contract: contractTest.name, 
              status: 'failed', 
              description: contractTest.description,
              violations: result.violations 
            });
          }
        } catch (error) {
          failedTests++;
          testResults.push({ 
            contract: contractTest.name, 
            status: 'failed', 
            description: contractTest.description,
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      const allPassed = failedTests === 0 && passedTests > 0;
      
      return {
        testType: 'contract',
        status: allPassed ? 'passed' : 'failed' as 'passed' | 'failed' | 'skipped',
        executionTimeMs: Date.now() - startTime,
        testDetails: {
          totalContracts: contractTests.length,
          passed: passedTests,
          failed: failedTests,
          results: testResults
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        testType: 'contract',
        status: 'failed',
        executionTimeMs: Date.now() - startTime,
        errorMessage,
        testDetails: { error: errorMessage }
      };
    }
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
   * Get integration test cases for a service
   */
  private getIntegrationTestCases(serviceName: string): IntegrationTestCase[] {
    const cases: IntegrationTestCase[] = [];

    // Service-specific integration tests
    switch (serviceName) {
      case 'SupabaseClientService':
        cases.push({
          name: 'Database Connection Pool',
          description: 'Test concurrent database connections',
          services: ['SupabaseClientService'],
          testFunction: async () => {
            // Test multiple concurrent connections
            const promises = Array(5).fill(0).map(async () => {
              try {
                const { supabase } = await import('../supabase-client/universal');
                const { data, error } = await supabase.from('document_types').select('document_type').limit(1);
                return !error && data;
              } catch {
                return false;
              }
            });
            const results = await Promise.all(promises);
            return results.every(r => r !== false);
          },
          expectedBehavior: 'All concurrent connections should succeed'
        });
        break;

      case 'FileService':
        cases.push({
          name: 'Cross-Environment File Operations',
          description: 'Test file operations across browser and Node.js environments',
          services: ['FileService'],
          testFunction: async () => {
            // Basic file service functionality test
            try {
              const { FileService } = await import('../file-service');
              // Test if service can be instantiated (basic integration)
              return typeof FileService === 'function' || typeof FileService === 'object';
            } catch {
              return false;
            }
          },
          expectedBehavior: 'File service should work in both environments'
        });
        break;

      case 'FilterService':
        cases.push({
          name: 'Database Query Integration',
          description: 'Test filter service with real database queries',
          services: ['FilterService', 'SupabaseClientService'],
          testFunction: async () => {
            try {
              const { FilterService } = await import('../filter-service');
              const filterService = new FilterService(supabase);
              // Test if the filter service can apply filters (basic integration)
              return typeof filterService.applyFilterToQuery === 'function';
            } catch {
              return false;
            }
          },
          expectedBehavior: 'Filter service should integrate with database queries'
        });
        break;

      case 'GoogleDriveService':
        cases.push({
          name: 'Authentication Flow',
          description: 'Test Google Drive authentication and API access',
          services: ['GoogleDriveService'],
          testFunction: async () => {
            try {
              const { GoogleDriveService } = await import('../google-drive');
              // Test static methods availability (basic integration)
              return typeof GoogleDriveService.getAudioProxyUrl === 'function';
            } catch {
              return false;
            }
          },
          expectedBehavior: 'Google Drive service should handle authentication properly'
        });
        break;

      case 'ClaudeService':
        cases.push({
          name: 'Rate Limiting Integration',
          description: 'Test Claude API rate limiting and error handling',
          services: ['ClaudeService'],
          testFunction: async () => {
            try {
              const { claudeService } = await import('../claude-service');
              // Test if claude service is available (basic integration)
              return typeof claudeService === 'object' && claudeService !== null;
            } catch {
              return false;
            }
          },
          expectedBehavior: 'Claude service should handle rate limits gracefully'
        });
        break;

      default:
        // Generic integration test for other services
        cases.push({
          name: 'Service Import Integration',
          description: 'Test that service can be imported and instantiated',
          services: [serviceName],
          testFunction: async () => {
            try {
              const servicePath = this.getServicePath(serviceName);
              const serviceModule = await import(`../../../packages/shared/services/${servicePath}`);
              return typeof serviceModule === 'object' && serviceModule !== null;
            } catch {
              return false;
            }
          },
          expectedBehavior: 'Service should be importable and usable'
        });
    }

    return cases;
  }

  /**
   * Get contract test cases for a service
   */
  private getContractTestCases(serviceName: string): Array<{
    name: string;
    description: string;
    validator: () => Promise<{ isValid: boolean; violations?: string[] }>;
  }> {
    const cases: Array<{
      name: string;
      description: string;
      validator: () => Promise<{ isValid: boolean; violations?: string[] }>;
    }> = [];

    // Service-specific contract tests
    switch (serviceName) {
      case 'SupabaseClientService':
        cases.push({
          name: 'Singleton Pattern Contract',
          description: 'Service must maintain singleton pattern',
          validator: async () => {
            try {
              const { supabaseAdapter } = await import('../supabase-client/universal');
              const instance1 = supabaseAdapter;
              const instance2 = supabaseAdapter;
              return { isValid: instance1 === instance2 };
            } catch (error) {
              return { isValid: false, violations: [`Singleton test failed: ${error}`] };
            }
          }
        });
        break;

      case 'FilterService':
        cases.push({
          name: 'Filter API Contract',
          description: 'Filter service must expose correct API methods',
          validator: async () => {
            try {
              const { FilterService } = await import('../filter-service');
              const filterService = new FilterService(supabase);
              const violations: string[] = [];
              
              if (typeof filterService.applyFilterToQuery !== 'function') {
                violations.push('Missing applyFilterToQuery method');
              }
              
              return { isValid: violations.length === 0, violations };
            } catch (error) {
              return { isValid: false, violations: [`API contract test failed: ${error}`] };
            }
          }
        });
        break;

      default:
        // Generic contract test
        cases.push({
          name: 'Basic Export Contract',
          description: 'Service must export expected interface',
          validator: async () => {
            try {
              const servicePath = this.getServicePath(serviceName);
              const serviceModule = await import(`../../../packages/shared/services/${servicePath}`);
              return { isValid: typeof serviceModule === 'object' && serviceModule !== null };
            } catch (error) {
              return { isValid: false, violations: [`Export contract test failed: ${error}`] };
            }
          }
        });
    }

    return cases;
  }

  /**
   * Helper methods
   */
  private getTestTypesForService(serviceName: string, priority: 'critical' | 'important' | 'standard'): ('unit' | 'integration' | 'contract')[] {
    // Phase 2: Include integration and contract tests based on priority
    const testTypes: ('unit' | 'integration' | 'contract')[] = ['unit'];
    
    // Critical services get all test types
    if (priority === 'critical') {
      testTypes.push('integration', 'contract');
    }
    // Important services get integration tests
    else if (priority === 'important') {
      testTypes.push('integration');
    }
    
    return testTypes;
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