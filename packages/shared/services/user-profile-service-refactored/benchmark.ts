/**
 * Performance Benchmark for UserProfileService (Refactored)
 */

import { performance } from 'perf_hooks';
import { UserProfileService } from './UserProfileService';
import { ProfileFormData } from './types';

// Mock Supabase client for benchmarking
const createMockSupabase = () => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ 
          data: generateMockProfile(), 
          error: null 
        }),
        limit: () => Promise.resolve({ error: null }),
      }),
    }),
    upsert: () => ({
      select: () => ({
        single: () => Promise.resolve({ 
          data: generateMockProfile(), 
          error: null 
        }),
      }),
    }),
    update: () => ({
      eq: () => ({
        select: () => ({
          single: () => Promise.resolve({ 
            data: generateMockProfile(), 
            error: null 
          }),
        }),
      }),
    }),
  }),
});

const generateMockProfile = () => ({
  id: `user-${Math.random().toString(36).substring(7)}`,
  profession: 'Software Engineer',
  learning_goals: ['TypeScript', 'React', 'Node.js'],
  reason_for_learning: 'Career advancement',
  interested_topics: ['Web Development', 'AI', 'Cloud Computing'],
  profile_completeness: Math.floor(Math.random() * 40) + 60, // 60-100%
  onboarding_completed: true,
  last_activity: new Date().toISOString(),
});

const generateMockProfileData = (): ProfileFormData => ({
  profession: 'Software Engineer',
  professional_title: 'Senior Developer',
  years_experience: Math.floor(Math.random() * 10) + 1,
  industry_sectors: ['Technology', 'Healthcare'],
  specialty_areas: ['Frontend', 'Backend'],
  credentials: ['AWS Certified', 'Google Cloud'],
  learning_goals: ['TypeScript', 'React', 'Node.js', 'GraphQL'],
  reason_for_learning: 'Career advancement and skill development',
  preferred_formats: ['video', 'interactive', 'text'],
  learning_pace: 'structured',
  time_commitment: '10 hours/week',
  preferred_depth: 'advanced',
  preferred_session_length: 60,
  interested_topics: ['Web Development', 'AI', 'Cloud Computing', 'DevOps'],
  interested_experts: ['Expert 1', 'Expert 2'],
  priority_subjects: ['React', 'TypeScript', 'AWS'],
  bio_summary: 'Experienced software engineer passionate about learning new technologies',
  learning_background: 'Computer Science degree + online courses',
  current_challenges: 'Keeping up with rapidly evolving frontend frameworks',
  intended_application: 'Apply to current work projects and personal development',
  referral_source: 'Professional recommendation',
});

interface BenchmarkResult {
  testName: string;
  duration: number;
  operationsPerformed: number;
  averageTimePerOperation: number;
  successRate: number;
  metrics: any;
}

class UserProfileServiceBenchmark {
  private service: UserProfileService;

  constructor() {
    const mockSupabase = createMockSupabase();
    this.service = new UserProfileService(mockSupabase as any);
  }

  async runBenchmark(): Promise<BenchmarkResult[]> {
    console.log('🚀 Starting UserProfileService Benchmark Suite\n');

    const results: BenchmarkResult[] = [];

    // Test 1: Profile retrieval performance
    results.push(await this.benchmarkProfileRetrieval('Profile Retrieval (100 ops)', 100));

    // Test 2: Profile creation performance
    results.push(await this.benchmarkProfileCreation('Profile Creation (50 ops)', 50));

    // Test 3: Profile update performance
    results.push(await this.benchmarkProfileUpdates('Profile Updates (100 ops)', 100));

    // Test 4: Recommendations generation
    results.push(await this.benchmarkRecommendations('Recommendations (100 ops)', 100));

    // Test 5: Health check performance
    results.push(await this.benchmarkHealthChecks('Health Checks (200 ops)', 200));

    // Test 6: Onboarding status checks
    results.push(await this.benchmarkOnboardingChecks('Onboarding Checks (150 ops)', 150));

    // Test 7: Profile statistics
    results.push(await this.benchmarkProfileStats('Profile Statistics (100 ops)', 100));

    // Test 8: Metrics retrieval
    results.push(await this.benchmarkMetricsRetrieval('Metrics Retrieval (1000 ops)', 1000));

    this.printResults(results);
    return results;
  }

  private async benchmarkProfileRetrieval(testName: string, operations: number): Promise<BenchmarkResult> {
    console.log(`📊 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;

    for (let i = 0; i < operations; i++) {
      try {
        await this.service.getProfile(`user-${i}`);
        successCount++;
      } catch (error) {
        // Count failed operations
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / operations;
    const successRate = (successCount / operations) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      operationsPerformed: operations,
      averageTimePerOperation: averageTime,
      successRate,
      metrics: this.service.getMetrics(),
    };
  }

  private async benchmarkProfileCreation(testName: string, operations: number): Promise<BenchmarkResult> {
    console.log(`💾 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;

    for (let i = 0; i < operations; i++) {
      try {
        const profileData = generateMockProfileData();
        await this.service.saveProfile(`user-${i}`, profileData);
        successCount++;
      } catch (error) {
        // Count failed operations
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / operations;
    const successRate = (successCount / operations) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      operationsPerformed: operations,
      averageTimePerOperation: averageTime,
      successRate,
      metrics: this.service.getMetrics(),
    };
  }

  private async benchmarkProfileUpdates(testName: string, operations: number): Promise<BenchmarkResult> {
    console.log(`🔄 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;

    const updateFields = [
      { profession: 'Lead Developer' },
      { years_experience: 8 },
      { preferred_depth: 'expert' as const },
      { time_commitment: '15 hours/week' },
    ];

    for (let i = 0; i < operations; i++) {
      try {
        const updateData = updateFields[i % updateFields.length];
        await this.service.updateProfile(`user-${i}`, updateData);
        successCount++;
      } catch (error) {
        // Count failed operations
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / operations;
    const successRate = (successCount / operations) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      operationsPerformed: operations,
      averageTimePerOperation: averageTime,
      successRate,
      metrics: this.service.getMetrics(),
    };
  }

  private async benchmarkRecommendations(testName: string, operations: number): Promise<BenchmarkResult> {
    console.log(`🎯 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;

    for (let i = 0; i < operations; i++) {
      try {
        await this.service.getRecommendedTopics(`user-${i}`);
        successCount++;
      } catch (error) {
        // Count failed operations
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / operations;
    const successRate = (successCount / operations) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      operationsPerformed: operations,
      averageTimePerOperation: averageTime,
      successRate,
      metrics: this.service.getMetrics(),
    };
  }

  private async benchmarkHealthChecks(testName: string, operations: number): Promise<BenchmarkResult> {
    console.log(`🏥 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;

    for (let i = 0; i < operations; i++) {
      try {
        await this.service.healthCheck();
        successCount++;
      } catch (error) {
        // Count failed operations
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / operations;
    const successRate = (successCount / operations) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      operationsPerformed: operations,
      averageTimePerOperation: averageTime,
      successRate,
      metrics: { healthCheckOperations: operations },
    };
  }

  private async benchmarkOnboardingChecks(testName: string, operations: number): Promise<BenchmarkResult> {
    console.log(`🎓 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;

    for (let i = 0; i < operations; i++) {
      try {
        await this.service.hasCompletedOnboarding(`user-${i}`);
        successCount++;
      } catch (error) {
        // Count failed operations
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / operations;
    const successRate = (successCount / operations) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      operationsPerformed: operations,
      averageTimePerOperation: averageTime,
      successRate,
      metrics: this.service.getMetrics(),
    };
  }

  private async benchmarkProfileStats(testName: string, operations: number): Promise<BenchmarkResult> {
    console.log(`📈 Running: ${testName}`);
    
    const startTime = performance.now();
    let successCount = 0;

    for (let i = 0; i < operations; i++) {
      try {
        await this.service.getProfileStats(`user-${i}`);
        successCount++;
      } catch (error) {
        // Count failed operations
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / operations;
    const successRate = (successCount / operations) * 100;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, Success Rate: ${successRate.toFixed(1)}%\n`);

    return {
      testName,
      duration,
      operationsPerformed: operations,
      averageTimePerOperation: averageTime,
      successRate,
      metrics: this.service.getMetrics(),
    };
  }

  private async benchmarkMetricsRetrieval(testName: string, operations: number): Promise<BenchmarkResult> {
    console.log(`📊 Running: ${testName}`);
    
    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      this.service.getMetrics();
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const averageTime = duration / operations;

    console.log(`✅ Completed: ${duration.toFixed(2)}ms, ${averageTime.toFixed(3)}ms per retrieval\n`);

    return {
      testName,
      duration,
      operationsPerformed: operations,
      averageTimePerOperation: averageTime,
      successRate: 100,
      metrics: { metricsRetrievalOperations: operations },
    };
  }

  private printResults(results: BenchmarkResult[]): void {
    console.log('📋 BENCHMARK RESULTS SUMMARY');
    console.log('=' .repeat(70));
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`   Operations: ${result.operationsPerformed}`);
      console.log(`   Avg Time: ${result.averageTimePerOperation.toFixed(3)}ms per operation`);
      console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`);
      console.log('');
    });

    // Overall statistics
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const totalOperations = results.reduce((sum, r) => sum + r.operationsPerformed, 0);
    const avgSuccessRate = results.reduce((sum, r) => sum + r.successRate, 0) / results.length;

    console.log('📊 OVERALL STATISTICS');
    console.log('-'.repeat(40));
    console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`Total Operations: ${totalOperations}`);
    console.log(`Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    console.log(`Overall Throughput: ${(totalOperations / totalDuration * 1000).toFixed(2)} ops/second`);
    
    // Final service metrics
    const finalMetrics = this.service.getMetrics();
    console.log('\n🎯 FINAL SERVICE METRICS');
    console.log('-'.repeat(40));
    console.log(`Profiles Created: ${finalMetrics.profilesCreated}`);
    console.log(`Profiles Updated: ${finalMetrics.profilesUpdated}`);
    console.log(`Profiles Retrieved: ${finalMetrics.profilesRetrieved}`);
    console.log(`Lookup Failures: ${finalMetrics.profileLookupsFailed}`);
    console.log(`Save Failures: ${finalMetrics.profileSavesFailed}`);
    console.log(`Onboarding Completions: ${finalMetrics.onboardingCompletions}`);
    console.log(`Recommendations Generated: ${finalMetrics.recommendationsGenerated}`);
    console.log(`Average Profile Completeness: ${finalMetrics.averageProfileCompleteness.toFixed(1)}%`);
    console.log(`Total Errors: ${finalMetrics.errors}`);
  }
}

// Performance comparison with different usage patterns
async function runUsagePatternComparison(): Promise<void> {
  console.log('\n🔬 USAGE PATTERN COMPARISON\n');

  const patterns = [
    { name: 'Read-Heavy (90% reads)', reads: 90, writes: 10 },
    { name: 'Balanced (50% reads)', reads: 50, writes: 50 },
    { name: 'Write-Heavy (30% reads)', reads: 30, writes: 70 },
  ];

  for (const pattern of patterns) {
    console.log(`Testing ${pattern.name}`);
    
    const benchmark = new UserProfileServiceBenchmark();
    const startTime = performance.now();
    
    // Simulate the usage pattern
    const totalOps = 100;
    const readOps = Math.floor(totalOps * pattern.reads / 100);
    const writeOps = totalOps - readOps;
    
    // Perform reads
    for (let i = 0; i < readOps; i++) {
      await benchmark.service.getProfile(`user-${i}`);
    }
    
    // Perform writes
    for (let i = 0; i < writeOps; i++) {
      const profileData = generateMockProfileData();
      await benchmark.service.saveProfile(`user-${i}`, profileData);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`  Duration: ${duration.toFixed(2)}ms`);
    console.log(`  Throughput: ${(totalOps / duration * 1000).toFixed(2)} ops/second`);
    console.log(`  Reads: ${readOps}, Writes: ${writeOps}\n`);
  }
}

// Run the benchmark if this file is executed directly
async function main(): Promise<void> {
  try {
    const benchmark = new UserProfileServiceBenchmark();
    await benchmark.runBenchmark();
    await runUsagePatternComparison();
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { UserProfileServiceBenchmark, BenchmarkResult };

// Run if called directly
if (require.main === module) {
  main();
}