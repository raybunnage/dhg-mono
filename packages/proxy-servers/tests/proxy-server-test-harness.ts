#!/usr/bin/env ts-node

import axios, { AxiosError } from 'axios';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface ProxyServerTest {
  name: string;
  port: number;
  startupScript: string;
  healthEndpoint: string;
  additionalEndpoints?: Array<{
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    expectedStatus: number;
    body?: any;
  }>;
}

interface TestResult {
  server: string;
  port: number;
  status: 'passed' | 'failed' | 'skipped';
  tests: {
    startup: boolean;
    healthCheck: boolean;
    endpoints: Array<{
      path: string;
      success: boolean;
      error?: string;
    }>;
  };
  error?: string;
  duration: number;
}

const PROXY_SERVERS: ProxyServerTest[] = [
  {
    name: 'Vite Fix Proxy',
    port: 9876,
    startupScript: 'start-vite-fix-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/apps', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Continuous Monitoring',
    port: 9877,
    startupScript: 'start-continuous-monitoring-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/metrics', method: 'GET', expectedStatus: 200 },
      { path: '/alerts', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Proxy Manager',
    port: 9878,
    startupScript: 'start-proxy-manager-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/proxies', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Git Operations',
    port: 9879,
    startupScript: 'start-git-operations-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/git/status', method: 'GET', expectedStatus: 200 },
      { path: '/worktrees', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'File Browser',
    port: 9880,
    startupScript: 'start-file-browser-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/browse/', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Continuous Docs',
    port: 9882,
    startupScript: 'start-continuous-docs-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/status', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Audio Streaming',
    port: 9883,
    startupScript: 'start-audio-streaming-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/list', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Script Viewer',
    port: 9884,
    startupScript: 'start-script-viewer-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/api/scripts', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Markdown Viewer',
    port: 9885,
    startupScript: 'start-markdown-viewer-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/api/documents', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Docs Archive',
    port: 9886,
    startupScript: 'start-docs-archive-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/api/archives', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'Worktree Switcher',
    port: 9887,
    startupScript: 'start-worktree-switcher-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/api/worktrees', method: 'GET', expectedStatus: 200 }
    ]
  },
  {
    name: 'HTML File Browser',
    port: 8080,
    startupScript: 'start-html-file-browser-proxy.ts',
    healthEndpoint: '/health'
  },
  {
    name: 'CLI Test Runner',
    port: 9890,
    startupScript: 'start-cli-test-runner-proxy.ts',
    healthEndpoint: '/health',
    additionalEndpoints: [
      { path: '/cli-tests/status-alpha', method: 'GET', expectedStatus: 200 }
    ]
  }
];

class ProxyServerTestHarness {
  private results: TestResult[] = [];
  private processes: Map<number, ChildProcess> = new Map();
  
  async runTests(serverNames?: string[]): Promise<void> {
    console.log('🧪 Proxy Server Test Harness\n');
    console.log('This will test basic functionality of all proxy servers.\n');
    
    const serversToTest = serverNames 
      ? PROXY_SERVERS.filter(s => serverNames.includes(s.name))
      : PROXY_SERVERS;
    
    for (const server of serversToTest) {
      await this.testServer(server);
    }
    
    this.displayResults();
    await this.cleanup();
  }
  
  private async testServer(server: ProxyServerTest): Promise<void> {
    console.log(`\n📡 Testing ${server.name} (port ${server.port})...`);
    
    const startTime = Date.now();
    const result: TestResult = {
      server: server.name,
      port: server.port,
      status: 'failed',
      tests: {
        startup: false,
        healthCheck: false,
        endpoints: []
      },
      duration: 0
    };
    
    try {
      // Test 1: Start the server
      console.log('  1️⃣ Starting server...');
      const process = await this.startServer(server);
      if (process) {
        this.processes.set(server.port, process);
        result.tests.startup = true;
        console.log('  ✅ Server started successfully');
      } else {
        throw new Error('Failed to start server');
      }
      
      // Wait for server to stabilize
      await this.wait(3000);
      
      // Test 2: Health check
      console.log('  2️⃣ Checking health endpoint...');
      const healthOk = await this.checkEndpoint(
        `http://localhost:${server.port}${server.healthEndpoint}`,
        'GET',
        200
      );
      result.tests.healthCheck = healthOk;
      if (healthOk) {
        console.log('  ✅ Health check passed');
      } else {
        console.log('  ❌ Health check failed');
      }
      
      // Test 3: Additional endpoints
      if (server.additionalEndpoints && server.additionalEndpoints.length > 0) {
        console.log('  3️⃣ Testing additional endpoints...');
        for (const endpoint of server.additionalEndpoints) {
          const url = `http://localhost:${server.port}${endpoint.path}`;
          const success = await this.checkEndpoint(
            url,
            endpoint.method,
            endpoint.expectedStatus,
            endpoint.body
          );
          
          result.tests.endpoints.push({
            path: endpoint.path,
            success,
            error: success ? undefined : 'Request failed'
          });
          
          if (success) {
            console.log(`  ✅ ${endpoint.method} ${endpoint.path} - OK`);
          } else {
            console.log(`  ❌ ${endpoint.method} ${endpoint.path} - Failed`);
          }
        }
      }
      
      // Determine overall status
      const allEndpointsPassed = result.tests.endpoints.every(e => e.success);
      if (result.tests.startup && result.tests.healthCheck && 
          (result.tests.endpoints.length === 0 || allEndpointsPassed)) {
        result.status = 'passed';
      }
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ❌ Error: ${result.error}`);
    }
    
    result.duration = Date.now() - startTime;
    this.results.push(result);
  }
  
  private async startServer(server: ProxyServerTest): Promise<ChildProcess | null> {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, '../../cli-pipeline/proxy', server.startupScript);
      const tsNode = path.join(__dirname, '../../../node_modules/.bin/ts-node');
      
      const process = spawn(tsNode, [scriptPath], {
        cwd: path.join(__dirname, '../../..'),
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let started = false;
      
      process.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('started') || output.includes('listening') || output.includes('ready')) {
          started = true;
        }
      });
      
      process.on('error', (error) => {
        console.error(`Failed to start ${server.name}:`, error);
        resolve(null);
      });
      
      // Give it time to start
      setTimeout(() => {
        resolve(process);
      }, 2000);
    });
  }
  
  private async checkEndpoint(
    url: string, 
    method: string, 
    expectedStatus: number,
    body?: any
  ): Promise<boolean> {
    try {
      const config: any = {
        method,
        url,
        timeout: 5000,
        validateStatus: () => true // Don't throw on any status
      };
      
      if (body) {
        config.data = body;
      }
      
      const response = await axios(config);
      return response.status === expectedStatus;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`    Request error: ${error.message}`);
      }
      return false;
    }
  }
  
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private displayResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const total = this.results.length;
    
    console.log(`\nTotal: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);
    
    console.log('Server'.padEnd(25) + 'Port'.padEnd(10) + 'Status'.padEnd(10) + 'Startup'.padEnd(10) + 'Health'.padEnd(10) + 'Endpoints');
    console.log('-'.repeat(80));
    
    for (const result of this.results) {
      const endpointStats = result.tests.endpoints.length > 0
        ? `${result.tests.endpoints.filter(e => e.success).length}/${result.tests.endpoints.length}`
        : 'N/A';
      
      console.log(
        result.server.padEnd(25) +
        result.port.toString().padEnd(10) +
        (result.status === 'passed' ? '✅' : '❌').padEnd(10) +
        (result.tests.startup ? '✅' : '❌').padEnd(10) +
        (result.tests.healthCheck ? '✅' : '❌').padEnd(10) +
        endpointStats
      );
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    for (const [port, process] of this.processes) {
      console.log(`  Stopping server on port ${port}...`);
      process.kill('SIGTERM');
    }
    
    // Give them time to shut down gracefully
    await this.wait(2000);
    
    // Force kill any remaining
    for (const [port, process] of this.processes) {
      if (!process.killed) {
        process.kill('SIGKILL');
      }
    }
    
    console.log('✅ Cleanup complete\n');
  }
}

// Main execution
async function main() {
  const harness = new ProxyServerTestHarness();
  
  // Check if specific servers were requested
  const args = process.argv.slice(2);
  if (args.length > 0) {
    console.log(`Testing specific servers: ${args.join(', ')}`);
    await harness.runTests(args);
  } else {
    await harness.runTests();
  }
}

// Handle interrupts
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted, cleaning up...');
  process.exit(1);
});

// Run tests
main().catch(error => {
  console.error('Test harness failed:', error);
  process.exit(1);
});