/**
 * Example showing how to use the filter service to filter a sources_google query
 */
import { filterService } from '../../../../packages/shared/services/filter-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function main() {
  try {
    // 1. Load the active filter profile (if any)
    const activeProfile = await filterService.loadActiveProfile();
    
    if (!activeProfile) {
      console.log('No active filter profile found. Using unfiltered query.');
    } else {
      console.log(`Using active filter profile: ${activeProfile.name}`);
    }
    
    // 2. Prepare the query
    const supabase = SupabaseClientService.getInstance().getClient();
    let query = supabase
      .from('sources_google')
      .select('id, name, path, mime_type, drive_id')
      .limit(100);
    
    // 3. Apply any active filters to the query
    if (activeProfile) {
      console.log('Applying filters from active profile...');
      query = filterService.applyFilterToQuery(query);
    }
    
    // 4. Execute the query
    console.log('Executing query...');
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error querying sources_google:', error);
      process.exit(1);
    }
    
    // 5. Display results
    console.log(`Found ${data.length} matching items:`);
    data.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.mime_type})`);
    });
    
    // 6. Show what filters were applied
    if (activeProfile && activeProfile.filter_criteria) {
      console.log('\nFilters applied:');
      Object.entries(activeProfile.filter_criteria).forEach(([key, value]) => {
        console.log(`- ${key}: ${JSON.stringify(value)}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();