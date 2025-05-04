/**
 * Simple script to check expert data
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function main() {
  const expertId = '090d6ec2-07c7-42cf-81b3-33648a5ff297';
  console.log(`Checking expert data for ID: ${expertId}`);

  // Get the client using the shared service
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get the expert
  const { data: expert, error } = await supabase
    .from('experts')
    .select('*')
    .eq('id', expertId)
    .single();

  if (error) {
    console.error('Error fetching expert:', error);
    return;
  }

  console.log('Expert data:', {
    id: expert.id,
    expert_name: expert.expert_name,
    full_name: expert.full_name
  });

  console.log('Metadata type:', typeof expert.metadata);
  if (expert.metadata) {
    console.log('Metadata keys:', Object.keys(expert.metadata));
    
    // Check if metadata has expected enhanced profile structure
    const hasName = expert.metadata.name !== undefined;
    const hasBio = expert.metadata.bio !== undefined;
    const hasExpertise = expert.metadata.expertise !== undefined;
    
    console.log('Has enhanced profile format:', { 
      name: hasName,
      bio: hasBio,
      expertise: hasExpertise
    });
    
    // Check research_summary in metadata
    if (expert.metadata.research_summary) {
      console.log('Research summary type:', typeof expert.metadata.research_summary);
      console.log('Research summary preview:', 
        typeof expert.metadata.research_summary === 'string' 
          ? expert.metadata.research_summary.substring(0, 100) + '...'
          : expert.metadata.research_summary
      );
    }
    
    // Check basic_information in metadata
    if (expert.metadata.basic_information) {
      console.log('Basic information type:', typeof expert.metadata.basic_information);
      console.log('Basic information:', expert.metadata.basic_information);
    }
  }
}

main().catch(console.error);