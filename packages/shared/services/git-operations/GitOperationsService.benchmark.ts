/**
 * GitOperationsService Benchmark
 * 
 * Performance benchmarks for GitOperationsService operations
 */

import { GitOperationsService } from './GitOperationsService';
import { GitOperationsServiceConfig } from './types';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  operationsPerSecond: number;
  cacheHitRate?: number;
  memoryUsage?: number;
}

interface BenchmarkSuite {
  suiteName: string;
  results: BenchmarkResult[];
  totalExecutionTime: number;
  summary: {
    fastestOperation: string;
    slowestOperation: string;
    averageOperationTime: number;
    totalOperations: number;
  };
}

class GitOperationsBenchmark {
  private service: GitOperationsService;
  private results: BenchmarkResult[] = [];

  constructor(config?: GitOperationsServiceConfig) {
    this.service = GitOperationsService.getInstance(config);
  }

  async runBenchmarkSuite(): Promise<BenchmarkSuite> {
    console.log('🚀 Starting GitOperationsService Benchmark Suite');
    const suiteStartTime = Date.now();

    // Basic Operations Benchmark
    await this.benchmarkListWorktrees();
    await this.benchmarkListBranches();
    await this.benchmarkGetStatus();
    await this.benchmarkGetCommitHistory();
    
    // Caching Performance Benchmark
    await this.benchmarkCachePerformance();
    
    // Concurrent Operations Benchmark
    await this.benchmarkConcurrentOperations();
    
    // Error Handling Benchmark
    await this.benchmarkErrorHandling();

    const totalExecutionTime = Date.now() - suiteStartTime;
    
    return this.generateSummary(totalExecutionTime);
  }

  private async benchmarkListWorktrees(): Promise<void> {
    console.log('📋 Benchmarking listWorktrees()...');
    
    const iterations = 100;
    const startTime = Date.now();
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const result = await this.service.listWorktrees();
        if (result.success) successCount++;
      } catch (error) {
        // Expected in benchmark environment
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / iterations;
    const operationsPerSecond = (successCount / totalTime) * 1000;

    this.results.push({
      operation: 'listWorktrees',
      iterations,
      totalTime,
      averageTime,
      operationsPerSecond,
      memoryUsage: this.getMemoryUsage()
    });
  }

  private async benchmarkListBranches(): Promise<void> {
    console.log('🌿 Benchmarking listBranches()...');
    
    const iterations = 100;
    const startTime = Date.now();
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const result = await this.service.listBranches();
        if (result.success) successCount++;
      } catch (error) {
        // Expected in benchmark environment
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / iterations;
    const operationsPerSecond = (successCount / totalTime) * 1000;

    this.results.push({
      operation: 'listBranches',
      iterations,
      totalTime,
      averageTime,
      operationsPerSecond,
      memoryUsage: this.getMemoryUsage()
    });
  }

  private async benchmarkGetStatus(): Promise<void> {
    console.log('📊 Benchmarking getStatus()...');
    
    const iterations = 50;
    const startTime = Date.now();
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const result = await this.service.getStatus();
        if (result.success) successCount++;
      } catch (error) {
        // Expected in benchmark environment
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / iterations;
    const operationsPerSecond = (successCount / totalTime) * 1000;

    this.results.push({
      operation: 'getStatus',
      iterations,
      totalTime,
      averageTime,
      operationsPerSecond,
      memoryUsage: this.getMemoryUsage()
    });
  }

  private async benchmarkGetCommitHistory(): Promise<void> {
    console.log('📝 Benchmarking getCommitHistory()...');
    
    const iterations = 25;
    const startTime = Date.now();
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const result = await this.service.getCommitHistory(10);
        if (result.success) successCount++;
      } catch (error) {
        // Expected in benchmark environment
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / iterations;
    const operationsPerSecond = (successCount / totalTime) * 1000;

    this.results.push({
      operation: 'getCommitHistory',
      iterations,
      totalTime,
      averageTime,
      operationsPerSecond,
      memoryUsage: this.getMemoryUsage()
    });
  }

  private async benchmarkCachePerformance(): Promise<void> {
    console.log('💾 Benchmarking cache performance...');
    
    // Clear cache first
    this.service.clearCache();
    
    const iterations = 50;
    const initialMetrics = this.service.getMetrics();
    const startTime = Date.now();

    // First run - cache misses
    for (let i = 0; i < iterations; i++) {
      try {
        await this.service.listWorktrees();
      } catch (error) {
        // Expected in benchmark environment
      }
    }

    // Second run - cache hits
    for (let i = 0; i < iterations; i++) {
      try {
        await this.service.listWorktrees();
      } catch (error) {
        // Expected in benchmark environment
      }
    }

    const totalTime = Date.now() - startTime;
    const finalMetrics = this.service.getMetrics();
    const cacheHits = finalMetrics.cacheHits - initialMetrics.cacheHits;
    const totalOps = finalMetrics.worktreeOperations - initialMetrics.worktreeOperations;
    const cacheHitRate = totalOps > 0 ? (cacheHits / totalOps) * 100 : 0;

    this.results.push({
      operation: 'cachePerformance',
      iterations: iterations * 2,
      totalTime,
      averageTime: totalTime / (iterations * 2),
      operationsPerSecond: (iterations * 2 / totalTime) * 1000,
      cacheHitRate,
      memoryUsage: this.getMemoryUsage()
    });
  }

  private async benchmarkConcurrentOperations(): Promise<void> {
    console.log('⚡ Benchmarking concurrent operations...');
    
    const concurrentRequests = 10;
    const startTime = Date.now();

    const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
      try {
        const results = await Promise.all([
          this.service.listWorktrees(),
          this.service.listBranches(),
          this.service.getStatus()
        ]);
        return results.every(r => r.success);
      } catch (error) {
        return false;
      }
    });

    const results = await Promise.all(promises);
    const successCount = results.filter(Boolean).length;
    const totalTime = Date.now() - startTime;

    this.results.push({
      operation: 'concurrentOperations',
      iterations: concurrentRequests * 3, // 3 operations per concurrent request
      totalTime,
      averageTime: totalTime / (concurrentRequests * 3),
      operationsPerSecond: (successCount * 3 / totalTime) * 1000,
      memoryUsage: this.getMemoryUsage()
    });
  }

  private async benchmarkErrorHandling(): Promise<void> {
    console.log('🚨 Benchmarking error handling...');
    
    // Create a service with invalid configuration to test error handling
    const errorService = GitOperationsService.getInstance({
      workingDirectory: '/nonexistent/path',
      gitPath: 'invalid-git-command'
    });

    const iterations = 20;
    const startTime = Date.now();
    let errorCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const result = await errorService.listWorktrees();
        if (!result.success) errorCount++;
      } catch (error) {
        errorCount++;
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / iterations;
    const errorsPerSecond = (errorCount / totalTime) * 1000;

    this.results.push({
      operation: 'errorHandling',
      iterations,
      totalTime,
      averageTime,
      operationsPerSecond: errorsPerSecond,
      memoryUsage: this.getMemoryUsage()
    });
  }

  private generateSummary(totalExecutionTime: number): BenchmarkSuite {
    const totalOperations = this.results.reduce((sum, result) => sum + result.iterations, 0);
    const averageOperationTime = this.results.reduce((sum, result) => sum + result.averageTime, 0) / this.results.length;
    
    const fastestOperation = this.results.reduce((fastest, current) => 
      current.operationsPerSecond > fastest.operationsPerSecond ? current : fastest
    ).operation;
    
    const slowestOperation = this.results.reduce((slowest, current) => 
      current.operationsPerSecond < slowest.operationsPerSecond ? current : slowest
    ).operation;

    return {
      suiteName: 'GitOperationsService Performance Benchmark',
      results: this.results,
      totalExecutionTime,
      summary: {
        fastestOperation,
        slowestOperation,
        averageOperationTime,
        totalOperations
      }
    };
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100; // MB
  }

  static async runQuickBenchmark(): Promise<void> {
    console.log('🏃‍♀️ Running Quick GitOperationsService Benchmark...\n');
    
    const benchmark = new GitOperationsBenchmark({
      workingDirectory: process.cwd(),
      cacheTimeout: 30000,
      enableMetrics: true
    });

    try {
      const suite = await benchmark.runBenchmarkSuite();
      
      console.log('\n📊 Benchmark Results:');
      console.log('═'.repeat(80));
      
      suite.results.forEach(result => {
        console.log(`\n🔸 ${result.operation}`);
        console.log(`   Iterations: ${result.iterations}`);
        console.log(`   Total Time: ${result.totalTime}ms`);
        console.log(`   Average Time: ${result.averageTime.toFixed(2)}ms`);
        console.log(`   Operations/sec: ${result.operationsPerSecond.toFixed(2)}`);
        if (result.cacheHitRate !== undefined) {
          console.log(`   Cache Hit Rate: ${result.cacheHitRate.toFixed(1)}%`);
        }
        console.log(`   Memory Usage: ${result.memoryUsage}MB`);
      });
      
      console.log('\n📈 Summary:');
      console.log('═'.repeat(80));
      console.log(`Total Execution Time: ${suite.totalExecutionTime}ms`);
      console.log(`Total Operations: ${suite.summary.totalOperations}`);
      console.log(`Average Operation Time: ${suite.summary.averageOperationTime.toFixed(2)}ms`);
      console.log(`Fastest Operation: ${suite.summary.fastestOperation}`);
      console.log(`Slowest Operation: ${suite.summary.slowestOperation}`);
      
      // Service metrics
      const service = GitOperationsService.getInstance();
      const metrics = service.getMetrics();
      const health = service.getHealth();
      
      console.log('\n🏥 Service Health:');
      console.log('═'.repeat(80));
      console.log(`Healthy: ${health.isHealthy ? '✅' : '❌'}`);
      console.log(`Git Available: ${health.gitAvailable ? '✅' : '❌'}`);
      console.log(`Working Directory Valid: ${health.workingDirectoryValid ? '✅' : '❌'}`);
      console.log(`Repository Valid: ${health.repositoryValid ? '✅' : '❌'}`);
      console.log(`Uptime: ${health.uptime}ms`);
      console.log(`Cache Size: ${health.cacheSize} entries`);
      console.log(`Operations Count: ${health.operationsCount}`);
      
      console.log('\n📊 Service Metrics:');
      console.log('═'.repeat(80));
      console.log(`Worktree Operations: ${metrics.worktreeOperations}`);
      console.log(`Branch Operations: ${metrics.branchOperations}`);
      console.log(`Commit Queries: ${metrics.commitQueries}`);
      console.log(`Cache Hit Rate: ${((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)}%`);
      console.log(`Error Rate: ${((metrics.errors / health.operationsCount) * 100).toFixed(1)}%`);
      console.log(`Average Execution Time: ${metrics.averageExecutionTime.toFixed(2)}ms`);
      console.log(`Operations Per Minute: ${metrics.operationsPerMinute.toFixed(2)}`);
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
    }
  }
}

// Export for use in other files
export { GitOperationsBenchmark, BenchmarkResult, BenchmarkSuite };

// Run benchmark if called directly
if (require.main === module) {
  GitOperationsBenchmark.runQuickBenchmark().catch(console.error);
}