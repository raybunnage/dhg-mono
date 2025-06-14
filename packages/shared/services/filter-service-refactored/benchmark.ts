import { FilterService } from './FilterService';
import { SupabaseClientService } from '../supabase-client';

/**
 * Benchmark FilterService performance
 */
async function benchmark() {
  console.log('🚀 Starting FilterService benchmark...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const service = new FilterService(supabase);
  
  try {
    // Health Check
    console.log('📊 Testing health check...');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    console.log(`  Profile count: ${health.details.profileCount}`);
    console.log(`  Cache size: ${health.details.cacheSize}`);
    
    // List Profiles
    console.log('\n📊 Testing profile listing...');
    const listStart = Date.now();
    const profiles = await service.listProfiles();
    const listDuration = Date.now() - listStart;
    console.log(`✓ List profiles: ${listDuration}ms (found ${profiles.length} profiles)`);
    
    if (profiles.length > 0) {
      // Test profile loading
      console.log('\n📊 Testing profile loading...');
      const profileId = profiles[0].id;
      
      // First load (no cache)
      const loadStart1 = Date.now();
      const profile1 = await service.loadProfile(profileId);
      const loadDuration1 = Date.now() - loadStart1;
      console.log(`✓ Load profile (cold): ${loadDuration1}ms`);
      
      // Get drive IDs (should use cache)
      console.log('\n📊 Testing drive ID retrieval...');
      const driveStart1 = Date.now();
      const drives1 = await service.getProfileDriveIds(profileId);
      const driveDuration1 = Date.now() - driveStart1;
      console.log(`✓ Get drives (cold): ${driveDuration1}ms (found ${drives1.length} drives)`);
      
      const driveStart2 = Date.now();
      const drives2 = await service.getProfileDriveIds(profileId);
      const driveDuration2 = Date.now() - driveStart2;
      console.log(`✓ Get drives (cached): ${driveDuration2}ms`);
      console.log(`  Cache speedup: ${Math.round((driveDuration1 - driveDuration2) / driveDuration1 * 100)}%`);
      
      // Test filter application
      if (profiles.find(p => p.is_active)) {
        console.log('\n📊 Testing filter application...');
        const mockQuery = {
          from: 'google_sources',
          select: '*',
          in: (field: string, values: any[]) => {
            console.log(`  Applied filter: ${field} IN (${values.length} values)`);
            return mockQuery;
          }
        };
        
        const filterStart = Date.now();
        await service.applyFilterToQuery(mockQuery);
        const filterDuration = Date.now() - filterStart;
        console.log(`✓ Apply filter: ${filterDuration}ms`);
      }
    }
    
    // Display metrics
    console.log('\n📈 Service Metrics:');
    const metrics = service.getMetrics();
    console.log(`  Profiles loaded: ${metrics.profilesLoaded}`);
    console.log(`  Cache hits: ${metrics.cacheHits}`);
    console.log(`  Cache misses: ${metrics.cacheMisses}`);
    console.log(`  Queries filtered: ${metrics.queriesFiltered}`);
    console.log(`  Errors: ${metrics.errors}`);
    
    // Test creating and deleting a profile
    console.log('\n📊 Testing profile creation/deletion...');
    const createStart = Date.now();
    const newProfile = await service.createProfile({
      name: 'Benchmark Test Profile',
      description: 'Created for benchmarking',
      is_active: false
    });
    const createDuration = Date.now() - createStart;
    
    if (newProfile) {
      console.log(`✓ Create profile: ${createDuration}ms`);
      
      // Update profile
      const updateStart = Date.now();
      const updated = await service.updateProfile(newProfile.id, {
        description: 'Updated during benchmark'
      });
      const updateDuration = Date.now() - updateStart;
      console.log(`✓ Update profile: ${updateDuration}ms`);
      
      // Add drives
      const addDrivesStart = Date.now();
      const drivesAdded = await service.addDrivesToProfile(newProfile.id, [
        'benchmark-drive-1',
        'benchmark-drive-2'
      ]);
      const addDrivesDuration = Date.now() - addDrivesStart;
      console.log(`✓ Add drives: ${addDrivesDuration}ms`);
      
      // Delete profile
      const deleteStart = Date.now();
      const deleted = await service.deleteProfile(newProfile.id);
      const deleteDuration = Date.now() - deleteStart;
      console.log(`✓ Delete profile: ${deleteDuration}ms`);
    }
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  benchmark().catch(console.error);
}

export { benchmark };