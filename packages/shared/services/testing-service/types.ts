/**
 * Types for the Testing Service
 * Defines interfaces and types used throughout the testing infrastructure
 */

export interface ServiceTestConfig {
  serviceName: string;
  testTypes: ('unit' | 'integration' | 'contract')[];
  dependencies: string[];
  mockRequirements: string[];
  timeoutMs: number;
  priority: 'critical' | 'important' | 'standard';
}

export interface TestResult {
  testType: 'unit' | 'integration' | 'contract';
  status: 'passed' | 'failed' | 'skipped';
  executionTimeMs: number;
  errorMessage?: string;
  testDetails: Record<string, any>;
}

export interface ServiceTestResults {
  serviceName: string;
  overallStatus: 'passed' | 'failed' | 'partial';
  executionTimeMs: number;
  results: TestResult[];
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
  };
}

export interface TestSuiteResults {
  totalServices: number;
  passedServices: number;
  failedServices: number;
  totalExecutionTimeMs: number;
  serviceResults: ServiceTestResults[];
  summary: {
    criticalServicesPassed: number;
    criticalServicesTotal: number;
    overallHealthStatus: 'healthy' | 'warning' | 'critical';
  };
}

export interface HealthReport {
  serviceName: string;
  isHealthy: boolean;
  lastTestRun?: Date;
  issues: string[];
  recommendations: string[];
}

export interface IntegrationTestCase {
  name: string;
  description: string;
  services: string[];
  testFunction: () => Promise<boolean>;
  expectedBehavior: string;
}

export interface MockScenario {
  name: string;
  type: 'network' | 'auth' | 'validation' | 'database';
  description: string;
  setup: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export interface TestRunRecord {
  id?: string;
  service_name: string;
  test_type: 'unit' | 'integration' | 'contract';
  status: 'running' | 'passed' | 'failed' | 'skipped';
  execution_time_ms?: number;
  error_message?: string;
  test_details?: Record<string, any>;
  executed_at?: string;
  executed_by?: string;
}