/**
 * Performance Benchmark for UnifiedClassificationService (Refactored)
 */

import { performance } from 'perf_hooks';
import { UnifiedClassificationService } from './UnifiedClassificationService';
import { UnifiedClassificationServiceConfig, SourceFile } from './types';

// Mock dependencies for benchmarking
const createMockSupabase = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        in: () => ({
          limit: () => Promise.resolve({ 
            data: generateMockFiles(100), 
            error: null 
          }),
        }),
      }),
    }),
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
    insert: () => Promise.resolve({ error: null }),
  }),
});

const createMockConfig = (): UnifiedClassificationServiceConfig => ({
  googleDriveService: {
    downloadFile: async () => '/tmp/mock-file',
    exportFile: async () => 'Mock file content',
    getHealthStatus: async () => ({ healthy: true, details: {} }),
  },
  promptService: {
    loadPrompt: async () => ({ success: true }),
    usePromptWithClaude: async () => ({
      success: true,
      data: JSON.stringify({
        document_type_id: 'benchmark-type',
        name: 'Benchmark Document',
        classification_confidence: 0.95,
        classification_reasoning: 'Fast benchmark classification',
        key_topics: ['benchmark', 'test', 'performance'],
      }),
    }),
    getHealthStatus: async () => ({ healthy: true, details: {} }),
  },
  claudeService: {
    getHealthStatus: async () => ({ healthy: true, details: {} }),
  },
  pdfProcessorService: {
    processPdf: async () => ({
      success: true,
      content: 'Mock PDF content for benchmarking',
      metadata: { pages: 5 },
    }),
  },
  filterService: {
    applyFilterToQuery: async (query) => query,
  },
});

const generateMockFiles = (count: number): SourceFile[] => {
  const mimeTypes = [
    'application/pdf',
    'text/markdown',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'audio/x-m4a',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `benchmark-file-${i}`,
    drive_id: `drive-${i}`,
    name: `benchmark-document-${i}.${mimeTypes[i % mimeTypes.length].split('/')[1]}`,
    mime_type: mimeTypes[i % mimeTypes.length],
    size: Math.floor(Math.random() * 1000000),
    path: `/benchmark/path/${i}`,
    web_view_link: `https://drive.google.com/benchmark/${i}`,
    is_deleted: false,
    pipeline_status: 'pending' as any,
    expert_document_id: i % 3 === 0 ? `expert-doc-${i}` : undefined,
  }));
};

interface BenchmarkResult {
  testName: string;
  duration: number;
  filesProcessed: number;
  averageTimePerFile: number;
  successRate: number;
  metrics: any;
}

class UnifiedClassificationServiceBenchmark {
  private service: UnifiedClassificationService;

  constructor() {
    const mockSupabase = createMockSupabase();
    const mockConfig = createMockConfig();
    this.service = new UnifiedClassificationService(mockSupabase as any, mockConfig);
  }

  async runBenchmark(): Promise<BenchmarkResult[]> {
    console.log('🚀 Starting UnifiedClassificationService Benchmark Suite\n');

    const results: BenchmarkResult[] = [];

    // Test 1: Small batch processing
    results.push(await this.benchmarkBatchProcessing('Small Batch (10 files)', 10, 1));

    // Test 2: Medium batch processing
    results.push(await this.benchmarkBatchProcessing('Medium Batch (50 files)', 50, 3));

    // Test 3: Large batch processing
    results.push(await this.benchmarkBatchProcessing('Large Batch (100 files)', 100, 5));

    // Test 4: High concurrency
    results.push(await this.benchmarkBatchProcessing('High Concurrency (50 files)', 50, 10));

    // Test 5: Health check performance
    results.push(await this.benchmarkHealthChecks());

    // Test 6: Metrics retrieval performance
    results.push(await this.benchmarkMetricsRetrieval());

    this.printResults(results);
    return results;
  }

  private async benchmarkBatchProcessing(
    testName: string,
    fileCount: number,
    concurrency: number
  ): Promise<BenchmarkResult> {
    console.log(`📊 Running: ${testName}`);
    
    const startTime = performance.now();

    const result = await this.service.classifyDocuments({
      limit: fileCount,
      concurrency,
      verbose: false,
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    const successRate = result.totalFiles > 0 ? 
      (result.successfulFiles / result.totalFiles) * 100 : 0;

    const averageTimePerFile = result.totalFiles > 0 ? 
      duration / result.totalFiles : 0;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      filesProcessed: result.totalFiles,
      averageTimePerFile,
      successRate,
      metrics: this.service.getMetrics(),
    };
  }

  private async benchmarkHealthChecks(): Promise<BenchmarkResult> {
    console.log('🏥 Running: Health Check Performance');
    
    const iterations = 100;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      await this.service.getHealthStatus();
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / iterations;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms total, ${averageTime.toFixed(2)}ms per check\n`);

    return {
      testName: 'Health Check Performance',
      duration,
      filesProcessed: iterations,
      averageTimePerFile: averageTime,
      successRate: 100,
      metrics: { healthCheckIterations: iterations },
    };
  }

  private async benchmarkMetricsRetrieval(): Promise<BenchmarkResult> {
    console.log('📈 Running: Metrics Retrieval Performance');
    
    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      this.service.getMetrics();
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / iterations;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms total, ${averageTime.toFixed(3)}ms per retrieval\n`);

    return {
      testName: 'Metrics Retrieval Performance',
      duration,
      filesProcessed: iterations,
      averageTimePerFile: averageTime,
      successRate: 100,
      metrics: { metricsRetrievalIterations: iterations },
    };
  }

  private printResults(results: BenchmarkResult[]): void {
    console.log('📋 BENCHMARK RESULTS SUMMARY');
    console.log('=' .repeat(60));
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`   Files/Operations: ${result.filesProcessed}`);
      console.log(`   Avg Time: ${result.averageTimePerFile.toFixed(3)}ms per item`);
      console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`);
      console.log('');
    });

    // Overall statistics
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const totalFiles = results.reduce((sum, r) => sum + r.filesProcessed, 0);
    const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;

    console.log('📊 OVERALL STATISTICS');
    console.log('-'.repeat(30));
    console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`Total Operations: ${totalFiles}`);
    console.log(`Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    console.log(`Throughput: ${(totalFiles / totalDuration * 1000).toFixed(2)} ops/second`);
    
    // Final metrics
    const finalMetrics = this.service.getMetrics();
    console.log('\n🎯 FINAL SERVICE METRICS');
    console.log('-'.repeat(30));
    console.log(`Classifications Requested: ${finalMetrics.classificationsRequested}`);
    console.log(`Classifications Completed: ${finalMetrics.classificationsCompleted}`);
    console.log(`Classifications Failed: ${finalMetrics.classificationsFailed}`);
    console.log(`Files Processed: ${finalMetrics.filesProcessed}`);
    console.log(`Content Extractions: ${finalMetrics.contentExtractionSuccesses}/${finalMetrics.contentExtractionAttempts}`);
    console.log(`Claude API Calls: ${finalMetrics.claudeApiCalls}`);
    console.log(`Database Updates: ${finalMetrics.databaseUpdates}`);
    console.log(`Cache Hits: ${finalMetrics.cacheHits}`);
    console.log(`Cache Misses: ${finalMetrics.cacheMisses}`);
    console.log(`Total Errors: ${finalMetrics.errors}`);
    console.log(`Average Processing Time: ${finalMetrics.averageProcessingTime.toFixed(2)}ms`);
  }
}

// Performance comparison with different configurations
async function runPerformanceComparison(): Promise<void> {
  console.log('\n🔬 PERFORMANCE COMPARISON\n');

  const configurations = [
    { name: 'Low Concurrency', concurrency: 1 },
    { name: 'Medium Concurrency', concurrency: 3 },
    { name: 'High Concurrency', concurrency: 5 },
    { name: 'Very High Concurrency', concurrency: 10 },
  ];

  for (const config of configurations) {
    console.log(`Testing ${config.name} (concurrency: ${config.concurrency})`);
    
    const benchmark = new UnifiedClassificationServiceBenchmark();
    const startTime = performance.now();
    
    await benchmark.service.classifyDocuments({
      limit: 30,
      concurrency: config.concurrency,
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`  Duration: ${duration.toFixed(2)}ms`);
    console.log(`  Throughput: ${(30 / duration * 1000).toFixed(2)} files/second\n`);
  }
}

// Run the benchmark if this file is executed directly
async function main(): Promise<void> {
  try {
    const benchmark = new UnifiedClassificationServiceBenchmark();
    await benchmark.runBenchmark();
    await runPerformanceComparison();
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { UnifiedClassificationServiceBenchmark, BenchmarkResult };

// Run if called directly
if (require.main === module) {
  main();
}