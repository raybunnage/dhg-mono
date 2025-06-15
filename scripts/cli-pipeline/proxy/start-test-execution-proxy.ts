#!/usr/bin/env ts-node

/**
 * Consolidated Test Execution Proxy Server
 * Combines functionality from cli-test-runner-proxy and test-runner-proxy
 * Provides HTTP endpoints for running tests and streaming results to UI apps
 */

import express from 'express';
import cors from 'cors';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import type { Request, Response } from 'express';

const app = express();
const PORT = 9890; // Using the cli-test-runner-proxy port

// Enable CORS for UI apps
app.use(cors());
app.use(express.json());

// Test execution state
interface TestExecution {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  services: Map<string, ServiceTestResult>;
  logs: string[];
  summary?: TestSummary;
}

interface ServiceTestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'no-tests';
  message?: string;
  testsRun?: number;
  testsPassed?: number;
  testsFailed?: number;
  duration?: number;
  output?: string[];
}

interface TestSummary {
  totalServices: number;
  servicesWithTests: number;
  passed: number;
  failed: number;
  running: number;
  pending: number;
  successRate: number;
}

// Store active test executions
const activeExecutions = new Map<string, TestExecution>();
const executionEmitter = new EventEmitter();

// List of refactored services
const REFACTORED_SERVICES = [
  'ai-processing-service-refactored',
  'audio-proxy-refactored',
  'audio-service-refactored',
  'audio-transcription-refactored',
  'auth-service-refactored',
  'batch-processing-service-refactored',
  'claude-service-refactored',
  'cli-registry-service-refactored',
  'converter-service-refactored',
  'database-service-refactored',
  'filter-service-refactored',
  'folder-hierarchy-service-refactored',
  'formatter-service-refactored',
  'google-auth-refactored',
  'google-drive-explorer-refactored',
  'google-drive-refactored',
  'google-drive-sync-service-refactored',
  'logger-refactored',
  'media-tracking-service-refactored',
  'prompt-service-refactored',
  'proxy-server-base-service-refactored',
  'sources-google-update-service-refactored',
  'supabase-adapter-refactored',
  'supabase-client-refactored',
  'supabase-service-refactored',
  'task-service-refactored',
  'unified-classification-service-refactored',
  'user-profile-service-refactored',
  'batch-database-service-refactored',
  'deployment-service-refactored',
  'document-service-refactored',
  'element-catalog-service-refactored',
  'element-criteria-service-refactored',
  'env-config-service-refactored',
  'file-service-refactored',
  'file-system-service-refactored',
  'html-file-browser-refactored',
  'markdown-viewer-refactored',
  'media-analytics-service-refactored',
  'pdf-processor-service-refactored',
  'script-viewer-refactored',
  'worktree-switcher-refactored'
];

// Helper to get project root
function getProjectRoot(): string {
  // Go up from scripts/cli-pipeline/proxy to project root
  return path.resolve(__dirname, '../../..');
}

// Test a single service
async function testService(serviceName: string, execution: TestExecution): Promise<ServiceTestResult> {
  const projectRoot = getProjectRoot();
  const servicePath = path.join(projectRoot, 'packages/shared/services', serviceName);
  
  const result: ServiceTestResult = {
    name: serviceName,
    status: 'pending',
    output: []
  };

  // Update status to running
  result.status = 'running';
  execution.services.set(serviceName, result);
  executionEmitter.emit('update', execution.id);

  // Check if service directory exists
  if (!fs.existsSync(servicePath)) {
    result.status = 'no-tests';
    result.message = 'Service directory not found';
    execution.logs.push(`⚠️  Service directory not found: ${serviceName}`);
    executionEmitter.emit('update', execution.id);
    return result;
  }

  // Check if test directory exists
  const testPath = path.join(servicePath, '__tests__');
  if (!fs.existsSync(testPath)) {
    result.status = 'no-tests';
    result.message = 'No tests found';
    execution.logs.push(`⚠️  No tests found for: ${serviceName}`);
    executionEmitter.emit('update', execution.id);
    return result;
  }

  // Run vitest
  return new Promise((resolve) => {
    const startTime = Date.now();
    execution.logs.push(`📦 Testing: ${serviceName}`);
    
    const vitestProcess = spawn('npx', ['vitest', 'run', '--reporter=json'], {
      cwd: servicePath,
      env: { ...process.env, CI: 'true' }
    });

    let jsonOutput = '';
    let errorOutput = '';

    vitestProcess.stdout.on('data', (data) => {
      jsonOutput += data.toString();
    });

    vitestProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      result.output?.push(data.toString());
    });

    vitestProcess.on('close', (code) => {
      const duration = Date.now() - startTime;
      result.duration = duration;

      if (code === 0) {
        try {
          // Try to parse JSON output
          const testResults = JSON.parse(jsonOutput);
          result.status = 'passed';
          result.testsRun = testResults.numTotalTests || 0;
          result.testsPassed = testResults.numPassedTests || 0;
          result.testsFailed = testResults.numFailedTests || 0;
          result.message = `All tests passed in ${duration}ms`;
          execution.logs.push(`✅ PASSED: ${serviceName}`);
        } catch (e) {
          // Fallback if JSON parsing fails
          result.status = 'passed';
          result.message = `Tests passed in ${duration}ms`;
          execution.logs.push(`✅ PASSED: ${serviceName} (no detailed results)`);
        }
      } else {
        result.status = 'failed';
        result.message = `Tests failed with exit code ${code}`;
        execution.logs.push(`❌ FAILED: ${serviceName}`);
        if (errorOutput) {
          result.output?.push(errorOutput);
        }
      }

      executionEmitter.emit('update', execution.id);
      resolve(result);
    });

    vitestProcess.on('error', (error) => {
      result.status = 'failed';
      result.message = `Failed to run tests: ${error.message}`;
      result.duration = Date.now() - startTime;
      execution.logs.push(`❌ ERROR: ${serviceName} - ${error.message}`);
      executionEmitter.emit('update', execution.id);
      resolve(result);
    });
  });
}

// Run all tests
async function runAllTests(executionId: string) {
  const execution = activeExecutions.get(executionId);
  if (!execution) return;

  execution.logs.push('🧪 Starting test run for all refactored services...');
  execution.logs.push(`Testing ${REFACTORED_SERVICES.length} services...`);
  executionEmitter.emit('update', executionId);

  // Initialize all services as pending
  for (const service of REFACTORED_SERVICES) {
    execution.services.set(service, {
      name: service,
      status: 'pending'
    });
  }

  // Test services in batches to avoid overwhelming the system
  const BATCH_SIZE = 4;
  for (let i = 0; i < REFACTORED_SERVICES.length; i += BATCH_SIZE) {
    const batch = REFACTORED_SERVICES.slice(i, i + BATCH_SIZE);
    const promises = batch.map(service => testService(service, execution));
    await Promise.all(promises);
  }

  // Calculate summary
  const summary: TestSummary = {
    totalServices: REFACTORED_SERVICES.length,
    servicesWithTests: 0,
    passed: 0,
    failed: 0,
    running: 0,
    pending: 0,
    successRate: 0
  };

  for (const [_, result] of execution.services) {
    switch (result.status) {
      case 'passed':
        summary.passed++;
        summary.servicesWithTests++;
        break;
      case 'failed':
        summary.failed++;
        summary.servicesWithTests++;
        break;
      case 'running':
        summary.running++;
        break;
      case 'pending':
        summary.pending++;
        break;
      case 'no-tests':
        // Don't count as services with tests
        break;
    }
  }

  if (summary.servicesWithTests > 0) {
    summary.successRate = Math.round((summary.passed / summary.servicesWithTests) * 100);
  }

  execution.summary = summary;
  execution.status = 'completed';
  execution.endTime = new Date();
  
  execution.logs.push('');
  execution.logs.push('================================================');
  execution.logs.push('🏁 TEST SUMMARY');
  execution.logs.push('================================================');
  execution.logs.push(`Total services checked: ${summary.totalServices}`);
  execution.logs.push(`Services with tests: ${summary.servicesWithTests}`);
  execution.logs.push(`Passed: ${summary.passed}`);
  execution.logs.push(`Failed: ${summary.failed}`);
  execution.logs.push(`Services without tests: ${summary.totalServices - summary.servicesWithTests}`);
  execution.logs.push(`Success rate: ${summary.successRate}%`);
  execution.logs.push('');
  execution.logs.push(`Completed at: ${execution.endTime.toLocaleString()}`);

  executionEmitter.emit('update', executionId);
  executionEmitter.emit('complete', executionId);
}

// API Routes

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Test Execution Proxy (Consolidated)',
    port: PORT,
    activeExecutions: activeExecutions.size,
    capabilities: ['cli-tests', 'refactored-services'],
    timestamp: new Date().toISOString()
  });
});

// Basic info endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Test Execution Proxy',
    description: 'Consolidated test runner for CLI pipelines and refactored services',
    port: PORT,
    status: 'running',
    endpoints: {
      health: '/health',
      cliTests: ['/cli-tests/status-alpha', '/cli-tests/status-beta', '/cli-tests/status-gamma'],
      refactoredServices: ['/tests/run-all', '/tests/run-service', '/tests/status/:id', '/tests/stream/:id', '/tests/services']
    }
  });
});

// === CLI Test Runner Endpoints (from cli-test-runner-proxy) ===

// Test status endpoints for ALPHA/BETA/GAMMA groups
app.get('/cli-tests/status-alpha', (_req: Request, res: Response) => {
  res.json({
    group: 'alpha',
    status: 'ready',
    tests: [],
    message: 'Alpha group test status endpoint'
  });
});

app.get('/cli-tests/status-beta', (_req: Request, res: Response) => {
  res.json({
    group: 'beta', 
    status: 'ready',
    tests: [],
    message: 'Beta group test status endpoint'
  });
});

app.get('/cli-tests/status-gamma', (_req: Request, res: Response) => {
  res.json({
    group: 'gamma',
    status: 'ready', 
    tests: [],
    message: 'Gamma group test status endpoint'
  });
});

// === Refactored Service Test Runner Endpoints (from test-runner-proxy) ===

// Start test run
app.post('/tests/run-all', async (_req: Request, res: Response) => {
  const executionId = Date.now().toString();
  const execution: TestExecution = {
    id: executionId,
    status: 'running',
    startTime: new Date(),
    services: new Map(),
    logs: []
  };

  activeExecutions.set(executionId, execution);

  // Start tests asynchronously
  runAllTests(executionId).catch(error => {
    execution.status = 'failed';
    execution.logs.push(`Fatal error: ${error.message}`);
    executionEmitter.emit('update', executionId);
  });

  res.json({ 
    executionId,
    message: 'Test run started',
    servicesCount: REFACTORED_SERVICES.length
  });
});

// Get test execution status
app.get('/tests/status/:executionId', (req: Request, res: Response) => {
  const { executionId } = req.params;
  const execution = activeExecutions.get(executionId);

  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  // Convert Map to array for JSON serialization
  const services = Array.from(execution.services.values());

  res.json({
    id: execution.id,
    status: execution.status,
    startTime: execution.startTime,
    endTime: execution.endTime,
    summary: execution.summary,
    services,
    logs: execution.logs.slice(-50) // Last 50 log entries
  });
});

// Stream test updates (Server-Sent Events)
app.get('/tests/stream/:executionId', (req: Request, res: Response) => {
  const { executionId } = req.params;
  const execution = activeExecutions.get(executionId);

  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' });
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial state
  const services = Array.from(execution.services.values());
  res.write(`data: ${JSON.stringify({
    type: 'update',
    execution: {
      id: execution.id,
      status: execution.status,
      summary: execution.summary,
      services,
      logs: execution.logs
    }
  })}\n\n`);

  // Set up listeners
  const updateListener = (updateId: string) => {
    if (updateId === executionId) {
      const services = Array.from(execution.services.values());
      res.write(`data: ${JSON.stringify({
        type: 'update',
        execution: {
          id: execution.id,
          status: execution.status,
          summary: execution.summary,
          services,
          logs: execution.logs.slice(-10) // Last 10 logs for updates
        }
      })}\n\n`);
    }
  };

  const completeListener = (completeId: string) => {
    if (completeId === executionId) {
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      cleanup();
    }
  };

  executionEmitter.on('update', updateListener);
  executionEmitter.on('complete', completeListener);

  // Clean up on client disconnect
  const cleanup = () => {
    executionEmitter.off('update', updateListener);
    executionEmitter.off('complete', completeListener);
    res.end();
  };

  req.on('close', cleanup);
});

// Test individual service
app.post('/tests/run-service', async (req: Request, res: Response) => {
  const { serviceName } = req.body;

  if (!serviceName || !REFACTORED_SERVICES.includes(serviceName)) {
    return res.status(400).json({ error: 'Invalid service name' });
  }

  const executionId = Date.now().toString();
  const execution: TestExecution = {
    id: executionId,
    status: 'running',
    startTime: new Date(),
    services: new Map(),
    logs: []
  };

  activeExecutions.set(executionId, execution);

  // Test single service
  testService(serviceName, execution).then(result => {
    execution.status = 'completed';
    execution.endTime = new Date();
    execution.summary = {
      totalServices: 1,
      servicesWithTests: result.status !== 'no-tests' ? 1 : 0,
      passed: result.status === 'passed' ? 1 : 0,
      failed: result.status === 'failed' ? 1 : 0,
      running: 0,
      pending: 0,
      successRate: result.status === 'passed' ? 100 : 0
    };
    executionEmitter.emit('complete', executionId);
  });

  res.json({ executionId, serviceName });
});

// List available services
app.get('/tests/services', (_req: Request, res: Response) => {
  res.json({
    services: REFACTORED_SERVICES,
    count: REFACTORED_SERVICES.length
  });
});

// Cleanup old executions (keep last 10)
setInterval(() => {
  if (activeExecutions.size > 10) {
    const sortedIds = Array.from(activeExecutions.keys()).sort();
    const toRemove = sortedIds.slice(0, sortedIds.length - 10);
    toRemove.forEach(id => activeExecutions.delete(id));
  }
}, 60000); // Every minute

// Start server
app.listen(PORT, () => {
  console.log(`🧪 Test Execution Proxy Server (Consolidated) running on http://localhost:${PORT}`);
  console.log(`📍 This server combines functionality from:`);
  console.log(`   - cli-test-runner-proxy (ALPHA/BETA/GAMMA status endpoints)`);
  console.log(`   - test-runner-proxy (refactored services testing)`);
  console.log(`\n📋 CLI Test Endpoints:`);
  console.log(`   GET    /cli-tests/status-alpha    - Alpha group status`);
  console.log(`   GET    /cli-tests/status-beta     - Beta group status`);
  console.log(`   GET    /cli-tests/status-gamma    - Gamma group status`);
  console.log(`\n🧪 Refactored Services Test Endpoints:`);
  console.log(`   POST   /tests/run-all             - Run all refactored service tests`);
  console.log(`   POST   /tests/run-service         - Run single service test`);
  console.log(`   GET    /tests/status/:id          - Get test execution status`);
  console.log(`   GET    /tests/stream/:id          - Stream test updates (SSE)`);
  console.log(`   GET    /tests/services            - List available services`);
  console.log(`\n🏥 General Endpoints:`);
  console.log(`   GET    /health                    - Health check`);
  console.log(`   GET    /                          - Server info and endpoints`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Test Execution Proxy Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Test Execution Proxy Server...');
  process.exit(0);
});