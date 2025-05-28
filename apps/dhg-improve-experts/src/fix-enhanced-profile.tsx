/**
 * Fix for ExpertDetailView to properly load enhanced profiles
 */
import { ExpertDetailView } from "./components/experts/ExpertDetailView";
import { expertServiceAdapter } from "./services/expert-service-adapter";
import { supabase } from "./integrations/supabase/client";

/**
 * The issue with ExpertDetailView is likely in the getEnhancedProfile method of the expert service.
 * 
 * It's trying to load profile data from the processed_content field of expert_documents,
 * but either:
 * 1. The document doesn't exist
 * 2. The processed_content is null
 * 3. The processed_content isn't in the expected format
 * 
 * Here's a modified implementation of getEnhancedProfile:
 */

const debugEnhancedProfile = `
// Add this to the expert-service.ts file:

/**
 * Get the enhanced profile for an expert
 */
async getEnhancedProfile(expertId: string): Promise<EnhancedExpertProfile | null> {
  try {
    Logger.debug(\`Getting enhanced profile for expert ID: \${expertId}\`);
    
    // First try to get the expert data itself - it may have metadata
    const { data: expertData, error: expertError } = await supabase
      .from('expert_profiles')
      .select('metadata')
      .eq('id', expertId)
      .single();
    
    if (expertError) {
      Logger.error(\`Error fetching expert: \${expertError.message}\`);
    } else if (expertData?.metadata) {
      // If the expert has metadata and it's in a compatible format, use it directly
      if (typeof expertData.metadata === 'object') {
        Logger.debug('Using expert metadata as profile');
        const metadata = expertData.metadata;
        
        // Check if it has required enhanced profile keys
        if (metadata.name || metadata.bio || metadata.expertise) {
          return metadata as EnhancedExpertProfile;
        }
      }
    }
    
    // If metadata wasn't suitable, try processed documents
    Logger.debug('Checking for processed documents');
    
    // Get the latest processed document with enhanced profile information
    const { data, error } = await supabase
      .from('google_expert_documents')
      .select('*')
      .eq('expert_id', expertId)
      .eq('processing_status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1);
    
    if (error) {
      Logger.error(\`Error fetching documents: \${error.message}\`);
      throw error;
    }
    
    if (data && data.length > 0 && data[0].processed_content) {
      try {
        Logger.debug('Document has processed content');
        const processedContent = data[0].processed_content;
        
        // Handle string content (needs parsing to JSON)
        if (typeof processedContent === 'string') {
          try {
            Logger.debug('Parsing string content to JSON');
            return JSON.parse(processedContent) as EnhancedExpertProfile;
          } catch (parseError) {
            Logger.error('Error parsing enhanced profile:', parseError);
            // Return a fallback profile with an error message
            return {
              name: \`Parse Error: \${expertId}\`,
              bio: \`Failed to parse profile data. Error: \${parseError.message}\`
            };
          }
        } 
        // Handle object content (already parsed)
        else if (typeof processedContent === 'object') {
          Logger.debug('Using object content directly');
          return processedContent as EnhancedExpertProfile;
        }
      } catch (contentError) {
        Logger.error('Error processing content:', contentError);
      }
    } else {
      // Log what's missing
      if (!data || data.length === 0) {
        Logger.debug('No completed documents found for expert');
      } else {
        Logger.debug('Document found but has no processed_content');
      }
    }
    
    // No suitable profile found - return basic fallback
    Logger.debug('No enhanced profile found, returning null');
    return null;
  } catch (error) {
    Logger.error(\`Error getting enhanced profile for expert ID \${expertId}:\`, error);
    return null;
  }
}
`;

// This file is meant to document the fix, not to be executed directly
console.log("ExpertDetailView fix instructions:");
console.log("1. The problem is likely in the getEnhancedProfile method in expert-service.ts");
console.log("2. It may not be correctly handling the processed_content field or expert metadata");
console.log("3. The modified implementation above checks both sources and handles parsing errors");
console.log("4. Apply this implementation to fix the 'Unable to load profile information' issue");