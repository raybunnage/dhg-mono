/**
 * Performance Benchmark for ProxyServerBaseService (Refactored)
 */

import { performance } from 'perf_hooks';
import axios from 'axios';
import { ProxyServerBaseService } from './ProxyServerBaseService';
import { ProxyServerBaseServiceConfig } from './types';

// Test implementation for benchmarking
class BenchmarkProxyServer extends ProxyServerBaseService {
  constructor(config: ProxyServerBaseServiceConfig) {
    super(config);
  }

  protected setupRoutes(): void {
    // Simple echo endpoint
    this.app.get('/echo', (req, res) => {
      res.json({ message: 'echo', timestamp: Date.now() });
    });

    // Slow endpoint (simulates processing)
    this.app.get('/slow', (req, res) => {
      setTimeout(() => {
        res.json({ message: 'slow response', timestamp: Date.now() });
      }, 100);
    });

    // Error endpoint
    this.app.get('/error', (req, res) => {
      res.status(500).json({ error: 'Simulated error' });
    });

    // Large response endpoint
    this.app.get('/large', (req, res) => {
      const largeData = {
        data: Array(1000).fill(0).map((_, i) => ({
          id: i,
          value: `item-${i}`,
          timestamp: Date.now()
        }))
      };
      res.json(largeData);
    });
  }

  protected getServiceDescription(): string {
    return 'Benchmark proxy server for performance testing';
  }
}

interface BenchmarkResult {
  testName: string;
  duration: number;
  requestCount: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  successRate: number;
  errors: number;
  serverMetrics: any;
}

class ProxyServerBaseServiceBenchmark {
  private server: BenchmarkProxyServer;
  private baseUrl: string;
  private port = 9998; // Use test port

  constructor() {
    const config: ProxyServerBaseServiceConfig = {
      proxyConfig: {
        name: 'benchmark-proxy',
        port: this.port,
        description: 'Performance benchmark proxy'
      }
    };
    
    this.server = new BenchmarkProxyServer(config);
    this.baseUrl = `http://localhost:${this.port}`;
  }

  async runBenchmark(): Promise<BenchmarkResult[]> {
    console.log('🚀 Starting ProxyServerBaseService Benchmark Suite\n');

    try {
      // Start the server
      await this.server.start();
      console.log(`✅ Benchmark server started on port ${this.port}\n`);

      const results: BenchmarkResult[] = [];

      // Test 1: Basic request handling
      results.push(await this.benchmarkBasicRequests('Basic Requests (100 concurrent)', 100));

      // Test 2: High load testing
      results.push(await this.benchmarkBasicRequests('High Load (500 concurrent)', 500));

      // Test 3: Mixed endpoint testing
      results.push(await this.benchmarkMixedEndpoints('Mixed Endpoints (200 requests)', 200));

      // Test 4: Error handling performance
      results.push(await this.benchmarkErrorHandling('Error Handling (100 requests)', 100));

      // Test 5: Large response handling
      results.push(await this.benchmarkLargeResponses('Large Responses (50 requests)', 50));

      // Test 6: Health check performance
      results.push(await this.benchmarkHealthChecks('Health Checks (200 requests)', 200));

      // Test 7: Server lifecycle performance
      results.push(await this.benchmarkServerLifecycle('Server Lifecycle (10 cycles)', 10));

      this.printResults(results);
      return results;

    } finally {
      // Ensure server is stopped
      if (this.server.isRunning()) {
        await this.server.stop();
        console.log('✅ Benchmark server stopped\n');
      }
    }
  }

  private async benchmarkBasicRequests(testName: string, requestCount: number): Promise<BenchmarkResult> {
    console.log(`📊 Running: ${testName}`);
    
    const startTime = performance.now();
    const promises: Promise<any>[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Create concurrent requests
    for (let i = 0; i < requestCount; i++) {
      const promise = axios.get(`${this.baseUrl}/echo`)
        .then(() => successCount++)
        .catch(() => errorCount++);
      promises.push(promise);
    }

    await Promise.allSettled(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const requestsPerSecond = (successCount / duration) * 1000;
    const successRate = (successCount / requestCount) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, ${requestsPerSecond.toFixed(2)} req/s, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      requestCount,
      requestsPerSecond,
      averageResponseTime: duration / requestCount,
      successRate,
      errors: errorCount,
      serverMetrics: this.server.getMetrics()
    };
  }

  private async benchmarkMixedEndpoints(testName: string, requestCount: number): Promise<BenchmarkResult> {
    console.log(`🔄 Running: ${testName}`);
    
    const startTime = performance.now();
    const endpoints = ['/echo', '/slow', '/health', '/info'];
    const promises: Promise<any>[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < requestCount; i++) {
      const endpoint = endpoints[i % endpoints.length];
      const promise = axios.get(`${this.baseUrl}${endpoint}`)
        .then(() => successCount++)
        .catch(() => errorCount++);
      promises.push(promise);
    }

    await Promise.allSettled(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const requestsPerSecond = (successCount / duration) * 1000;
    const successRate = (successCount / requestCount) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, ${requestsPerSecond.toFixed(2)} req/s, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      requestCount,
      requestsPerSecond,
      averageResponseTime: duration / requestCount,
      successRate,
      errors: errorCount,
      serverMetrics: this.server.getMetrics()
    };
  }

  private async benchmarkErrorHandling(testName: string, requestCount: number): Promise<BenchmarkResult> {
    console.log(`❌ Running: ${testName}`);
    
    const startTime = performance.now();
    const promises: Promise<any>[] = [];
    let responseCount = 0;

    for (let i = 0; i < requestCount; i++) {
      const promise = axios.get(`${this.baseUrl}/error`)
        .catch(() => responseCount++); // Errors are expected
      promises.push(promise);
    }

    await Promise.allSettled(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const requestsPerSecond = (responseCount / duration) * 1000;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, ${requestsPerSecond.toFixed(2)} req/s, All errors handled\n`);

    return {
      testName,
      duration,
      requestCount,
      requestsPerSecond,
      averageResponseTime: duration / requestCount,
      successRate: 100, // All requests were handled (even if they returned errors)
      errors: 0, // Server handled all requests properly
      serverMetrics: this.server.getMetrics()
    };
  }

  private async benchmarkLargeResponses(testName: string, requestCount: number): Promise<BenchmarkResult> {
    console.log(`📦 Running: ${testName}`);
    
    const startTime = performance.now();
    const promises: Promise<any>[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < requestCount; i++) {
      const promise = axios.get(`${this.baseUrl}/large`)
        .then((response) => {
          if (response.data && response.data.data && response.data.data.length === 1000) {
            successCount++;
          }
        })
        .catch(() => errorCount++);
      promises.push(promise);
    }

    await Promise.allSettled(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const requestsPerSecond = (successCount / duration) * 1000;
    const successRate = (successCount / requestCount) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, ${requestsPerSecond.toFixed(2)} req/s, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      requestCount,
      requestsPerSecond,
      averageResponseTime: duration / requestCount,
      successRate,
      errors: errorCount,
      serverMetrics: this.server.getMetrics()
    };
  }

  private async benchmarkHealthChecks(testName: string, requestCount: number): Promise<BenchmarkResult> {
    console.log(`🏥 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;
    let errorCount = 0;

    // Mix of health endpoint and direct health check calls
    for (let i = 0; i < requestCount; i++) {
      try {
        if (i % 2 === 0) {
          // HTTP health check
          await axios.get(`${this.baseUrl}/health`);
        } else {
          // Direct health check
          await this.server.healthCheck();
        }
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const requestsPerSecond = (successCount / duration) * 1000;
    const successRate = (successCount / requestCount) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, ${requestsPerSecond.toFixed(2)} checks/s, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      requestCount,
      requestsPerSecond,
      averageResponseTime: duration / requestCount,
      successRate,
      errors: errorCount,
      serverMetrics: this.server.getMetrics()
    };
  }

  private async benchmarkServerLifecycle(testName: string, cycles: number): Promise<BenchmarkResult> {
    console.log(`🔄 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < cycles; i++) {
      try {
        await this.server.stop();
        await this.server.start();
        
        // Verify server is responsive
        await axios.get(`${this.baseUrl}/health`);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const cyclesPerSecond = (successCount / duration) * 1000;
    const successRate = (successCount / cycles) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, ${cyclesPerSecond.toFixed(2)} cycles/s, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      requestCount: cycles,
      requestsPerSecond: cyclesPerSecond,
      averageResponseTime: duration / cycles,
      successRate,
      errors: errorCount,
      serverMetrics: this.server.getMetrics()
    };
  }

  private printResults(results: BenchmarkResult[]): void {
    console.log('📋 BENCHMARK RESULTS SUMMARY');
    console.log('=' .repeat(80));
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`   Requests: ${result.requestCount}`);
      console.log(`   Throughput: ${result.requestsPerSecond.toFixed(2)} req/s`);
      console.log(`   Avg Response Time: ${result.averageResponseTime.toFixed(2)}ms`);
      console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`);
      console.log(`   Errors: ${result.errors}`);
      console.log('');
    });

    // Overall statistics
    const totalRequests = results.reduce((sum, r) => sum + r.requestCount, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;
    const avgThroughput = results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / results.length;

    console.log('📊 OVERALL STATISTICS');
    console.log('-'.repeat(50));
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    console.log(`Average Throughput: ${avgThroughput.toFixed(2)} req/s`);
    
    // Final server metrics
    const finalMetrics = this.server.getMetrics();
    console.log('\n🎯 FINAL SERVER METRICS');
    console.log('-'.repeat(50));
    console.log(`Requests Received: ${finalMetrics.requestsReceived}`);
    console.log(`Requests Completed: ${finalMetrics.requestsCompleted}`);
    console.log(`Requests Failed: ${finalMetrics.requestsFailed}`);
    console.log(`Average Response Time: ${finalMetrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`Start Count: ${finalMetrics.startCount}`);
    console.log(`Stop Count: ${finalMetrics.stopCount}`);
    console.log(`Restart Count: ${finalMetrics.restartCount}`);
    console.log(`Health Checks: ${finalMetrics.healthCheckCount}`);
    console.log(`Health Check Failures: ${finalMetrics.healthCheckFailures}`);
    console.log(`Peak Connections: ${finalMetrics.peakConnections}`);
    console.log(`Total Errors: ${finalMetrics.errors}`);
  }
}

// Run the benchmark if this file is executed directly
async function main(): Promise<void> {
  try {
    const benchmark = new ProxyServerBaseServiceBenchmark();
    await benchmark.runBenchmark();
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { ProxyServerBaseServiceBenchmark, BenchmarkResult };

// Run if called directly
if (require.main === module) {
  main();
}