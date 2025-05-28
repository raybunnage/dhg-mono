/**
 * Debug expert metadata format - final attempt!
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const EXPERT_ID = '090d6ec2-07c7-42cf-81b3-33648a5ff297';

async function main() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log(`Checking expert with ID: ${EXPERT_ID}`);
  
  // Get expert data
  const { data: expert, error } = await supabase
    .from('expert_profiles')
    .select('*')
    .eq('id', EXPERT_ID)
    .single();
    
  if (error) {
    console.error('Error fetching expert:', error.message);
    return;
  }
  
  console.log('Expert data:', {
    id: expert.id,
    expert_name: expert.expert_name,
    full_name: expert.full_name
  });
  
  // Check metadata format
  console.log('Metadata type:', typeof expert.metadata);
  
  if (expert.metadata) {
    console.log('Metadata keys:', Object.keys(expert.metadata));
    
    // Check if this expert's metadata follows the EnhancedExpertProfile format expected by the UI
    if (expert.metadata.name || expert.metadata.bio || expert.metadata.expertise) {
      console.log('Metadata IS in enhanced profile format already');
    } else {
      console.log('Metadata is NOT in enhanced profile format');
      
      // The issue: current metadata is in a different format than what the UI expects
      // Let's see what format it's actually in
      if (expert.metadata.research_summary) {
        console.log('Found research_summary in metadata');
        console.log('Research summary type:', typeof expert.metadata.research_summary);
      }
      
      if (expert.metadata.basic_information) {
        console.log('Found basic_information in metadata');
        console.log('Basic information type:', typeof expert.metadata.basic_information);
      }
      
      console.log('\nCreating compatible enhanced profile format:');
      
      // Create a compatible EnhancedExpertProfile based on the existing metadata
      const enhancedProfile = {
        name: expert.full_name || expert.expert_name,
        bio: expert.metadata.research_summary || '',
        expertise: expert.metadata.expertise_keywords || [],
        affiliations: expert.metadata.basic_information?.affiliations || [],
        title: expert.metadata.basic_information?.title || ''
      };
      
      console.log('Enhanced profile:', enhancedProfile);
      
      console.log('\nThe UI expects an EnhancedExpertProfile format with these keys:');
      console.log('- name: String');
      console.log('- bio: String');
      console.log('- expertise: String[]');
      console.log('etc...');
      
      console.log('\nPROBLEM DIAGNOSIS:');
      console.log('1. The metadata field in the experts table does NOT use the EnhancedExpertProfile format');
      console.log('2. It has a different structure with keys like research_summary, basic_information, etc.');
      console.log('3. The getEnhancedProfile method in expert-service.ts checks metadata for name/bio/expertise');
      console.log('4. When it doesn\'t find those fields, it returns null instead of converting the format');
      console.log('5. This causes the UI to show "No enhanced profile information available"');
      
      console.log('\nSOLUTION:');
      console.log('Modify getEnhancedProfile in expert-service.ts to convert the current metadata format');
      console.log('to the EnhancedExpertProfile format expected by the UI.');
    }
  } else {
    console.log('No metadata found for this expert');
  }
}

main().catch(console.error);