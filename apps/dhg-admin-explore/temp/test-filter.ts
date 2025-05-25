import { filterService } from '../src/utils/filter-service-adapter';
import { supabase } from '../src/utils/supabase-adapter';

async function testFilter() {
  try {
    // Get a profile
    const { data: profiles } = await supabase
      .from('user_filter_profiles')
      .select('*')
      .limit(1);
    
    if (\!profiles || profiles.length === 0) {
      console.log('No profiles found');
      return;
    }
    
    const profile = profiles[0];
    console.log(`Testing with profile: ${profile.name} (${profile.id})`);
    
    // Create a basic query
    let query = supabase.from('presentations').select('id');
    
    // Apply filter
    query = await filterService.applyFilterToQuery(query, profile.id);
    
    // Execute query
    const { data, error, count } = await query.select('id', { count: 'exact' });
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log(`Found ${count} presentations matching filter criteria`);
    console.log(`This should include ALL presentations, not just 500`);
  } catch (err) {
    console.error('Test error:', err);
  }
}

testFilter();
