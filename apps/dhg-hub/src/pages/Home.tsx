import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase-adapter';
// @ts-ignore - This import will work at runtime
import { Database } from '../../../supabase/types';
import ReactMarkdown from 'react-markdown';
import JsonFormatter from '../components/JsonFormatter';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible';
import { ChevronDown, ChevronRight, ArrowLeft, RefreshCcw } from 'lucide-react';
import { filterService } from '@/utils/filter-service-adapter';

// Verify Supabase connection on page load
(async () => {
  try {
    // Check environment variables
    console.log('Environment variables in browser:');
    console.log('- VITE_SUPABASE_URL exists:', !!import.meta.env.VITE_SUPABASE_URL);
    console.log('- VITE_SUPABASE_ANON_KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
    console.log('- VITE_SUPABASE_SERVICE_ROLE_KEY exists:', !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
    
    // Use supabaseAdapter diagnostics
    console.log('Getting Supabase adapter diagnostics...');
    const diagnostics = await supabaseAdapter.getDiagnostics();
    console.log('Supabase diagnostics:', diagnostics);
    
    // Test connection with direct test query
    console.log('Testing Supabase connection with direct query...');
    const { data, error } = await supabase.from('user_filter_profiles').select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.error('Supabase connection test failed:', error);
    } else {
      console.log('Supabase connection test succeeded, profile count:', data?.count);
    }
  } catch (e) {
    console.error('Error testing Supabase connection:', e);
  }
})();

// Import FilterProfile interface from adapter
import { FilterProfile } from '@/utils/filter-service-adapter';

// Debug function to check the database directly
async function debugCheckFilterProfiles() {
  try {
    // Direct database query to check what profiles exist - USING THE EXACT QUERY THAT WORKS IN SUPABASE
    console.log('Debug: Running exact query that works in Supabase: select id, name, is_active from user_filter_profiles');
    
    const { data, error } = await supabase
      .from('user_filter_profiles')
      .select('id, name, is_active');
      
    console.log('Debug: Direct database check for profiles');
    console.log('Results:', data);
    
    // Check available fields in first profile
    if (data && data.length > 0) {
      console.log('Debug: Available fields in first profile:', Object.keys(data[0]).join(', '));
      console.log('Debug: Found', data.length, 'profiles with these IDs:', data.map(p => p.id).join(', '));
      
      data.forEach(profile => {
        console.log(`Debug: Profile ${profile.id}: Name="${profile.name}", IsActive=${profile.is_active}`);
      });
    } else {
      console.log('Debug: No profiles found in direct database check');
      
      // Additional error checking
      console.log('Debug: Trying to diagnose connection issues...');
      // Check if supabase object is properly configured
      if (!supabase) {
        console.error('Debug: supabase client is null or undefined!');
      }
      
      if (error) {
        console.error('Debug: SQL Error details:', JSON.stringify(error, null, 2));
      }
    }
    
    return data;
  } catch (err) {
    console.error('Error in debug check:', err);
    // Log full error details
    if (err instanceof Error) {
      console.error('Error details:', err.message);
      console.error('Error stack:', err.stack);
    }
    return null;
  }
}

// Utility function to get video duration, either from metadata or estimated from file size
// Helper function to search within processed content objects or strings
const searchInProcessedContent = (content: any, query: string): boolean => {
  // For string content, do a simple includes check
  if (typeof content === 'string') {
    return content.toLowerCase().includes(query);
  }
  
  // For object content, recursively check properties
  if (typeof content === 'object' && content !== null) {
    // Check common summary fields first
    if (content.summary && typeof content.summary === 'string') {
      if (content.summary.toLowerCase().includes(query)) return true;
    }
    
    // Check key points, highlights, or insights
    const keyPoints = content.key_points || content.highlights || content.key_insights;
    if (Array.isArray(keyPoints)) {
      for (const point of keyPoints) {
        if (typeof point === 'string' && point.toLowerCase().includes(query)) {
          return true;
        }
      }
    }
    
    // Check markdown content
    if (content.markdown && typeof content.markdown === 'string') {
      if (content.markdown.toLowerCase().includes(query)) return true;
    }
    
    // Check all string properties at top level
    for (const key in content) {
      const value = content[key];
      
      // Skip already checked properties
      if (key === 'summary' || key === 'key_points' || key === 'highlights' || 
          key === 'key_insights' || key === 'markdown') {
        continue;
      }
      
      // Check string properties
      if (typeof value === 'string' && value.toLowerCase().includes(query)) {
        return true;
      }
      
      // Check arrays of strings
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.toLowerCase().includes(query)) {
            return true;
          }
        }
      }
      
      // Limit recursion depth to avoid performance issues on deeply nested objects
      if (typeof value === 'object' && value !== null) {
        for (const nestedKey in value) {
          const nestedValue = value[nestedKey];
          if (typeof nestedValue === 'string' && nestedValue.toLowerCase().includes(query)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
};

const getVideoDuration = (videoSource: SourceGoogle | null | undefined): string => {
  if (!videoSource) return '';
  
  // Check if we have actual duration in metadata
  if (videoSource.metadata && 
      (videoSource.metadata.videoDuration || 
       videoSource.metadata.formattedDuration ||
       (videoSource.metadata.videoMetadata && videoSource.metadata.videoMetadata.durationSeconds))) {
    
    // If we have a pre-formatted duration string, use it
    if (videoSource.metadata.formattedDuration) {
      return videoSource.metadata.formattedDuration;
    }
    
    // If we have duration in seconds, format it
    const durationSeconds = videoSource.metadata.videoDuration || 
                           (videoSource.metadata.videoMetadata && videoSource.metadata.videoMetadata.durationSeconds);
    
    if (durationSeconds) {
      const hours = Math.floor(durationSeconds / 3600);
      const minutes = Math.floor((durationSeconds % 3600) / 60);
      const seconds = Math.floor(durationSeconds % 60);
      
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    }
  }
  
  // Fall back to size-based estimation if no duration metadata is available
  if (!videoSource.size) return '';
  
  // Assuming average bitrate of 2000 kbps (250 KB/s) for typical MP4 videos
  // This is a rough estimate - actual duration depends on video encoding
  const durationInSeconds = videoSource.size / (250 * 1024);
  
  // Format as minutes:seconds
  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = Math.floor(durationInSeconds % 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Helper function to extract Drive ID from Google Drive URL
const extractDriveId = (url: string | null): string | null => {
  if (!url) return null;
  
  try {
    const match = url.match(/\/d\/([^/]+)/);
    return match ? match[1] : null;
  } catch (err) {
    console.error("Error extracting drive ID:", err);
    return null;
  }
};

// Define key types
type Presentation = Database['public']['Tables']['presentations']['Row'] & {
  title?: string | null;
  expert_document?: ExpertDocument | null;
  video_source?: SourceGoogle | null;
  high_level_folder?: SourceGoogle | null;
  expert?: {
    id: string;
    full_name: string;
    expert_name: string;
  } | null;
  expert_names?: string; // String for multiple experts
  experts?: Array<{id: string, name: string}>; // Array of expert objects
  created_at?: string | null;
};

type PresentationAsset = Database['public']['Tables']['presentation_assets']['Row'] & {
  source_file?: SourceGoogle | null;
  expert_document?: ExpertDocument | null;
};

type SourceGoogle = Database['public']['Tables']['sources_google']['Row'] & {
  document_type?: { document_type: string; mime_type: string | null } | null;
};

type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'] & {
  processed_content: any;
  title: string | null;
  document_type?: { document_type: string } | null;
};

type SubjectClassification = Database['public']['Tables']['subject_classifications']['Row'];
type TableClassification = Database['public']['Tables']['table_classifications']['Row'];

export function Home() {
  // State variables
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectClassifications, setSubjectClassifications] = useState<SubjectClassification[]>([]);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PresentationAsset | null>(null);
  const [presentationAssets, setPresentationAssets] = useState<PresentationAsset[]>([]);
  const [showExpertBio, setShowExpertBio] = useState<boolean>(false);
  const [expertBioContent, setExpertBioContent] = useState<any>(null);
  const [filterProfiles, setFilterProfiles] = useState<FilterProfile[]>([]);
  const [activeFilterProfile, setActiveFilterProfile] = useState<FilterProfile | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(false);
  
  // Collapsible section states - default all open except asset view mode
  const [videoSectionOpen, setVideoSectionOpen] = useState<boolean>(true);
  const [presentationAssetsOpen, setPresentationAssetsOpen] = useState<boolean>(true);
  const [assetSectionOpen, setAssetSectionOpen] = useState<boolean>(true);
  const [assetViewMode, setAssetViewMode] = useState<boolean>(false);

  // Fetch filter profiles
  useEffect(() => {
    async function fetchFilterProfiles() {
      setLoadingProfiles(true);
      try {
        console.log('======== INITIAL PROFILE LOADING ========');
        
        // Debug check first using direct Supabase query
        const directProfiles = await debugCheckFilterProfiles();
        console.log('Initial load: Direct database check found', directProfiles?.length || 0, 'profiles');
        
        if (directProfiles?.length > 0) {
          console.log('Initial load: Direct database check profile names:', directProfiles.map(p => p.name).join(', '));
          console.log('Initial load: First profile structure:', Object.keys(directProfiles[0]).join(', '));
        }
        
        // Fetch all available profiles using the filter service
        console.log('Initial load: Now retrieving profiles with filterService.listProfiles()...');
        const profiles = await filterService.listProfiles();
        console.log('Initial load: Filter service returned', profiles.length, 'profiles');
        
        if (profiles.length > 0) {
          console.log('Initial load: Profile names from filterService:', profiles.map(p => p.name).join(', '));
          console.log('Initial load: Profile data structure from service:', 
            Object.keys(profiles[0]).join(', '));
          setFilterProfiles(profiles);
          
          // Then get the active profile
          console.log('Initial load: Retrieving active profile...');
          const active = await filterService.loadActiveProfile();
          if (active) {
            console.log('Initial load: Found active profile:', active.name);
            console.log('Initial load: Active profile structure:', Object.keys(active).join(', '));
            setActiveFilterProfile(active);
          } else {
            console.log('Initial load: No active profile found, using first available profile');
            // If no active profile, use the first one
            if (profiles.length > 0) {
              // Set the first profile as active
              const success = await filterService.setActiveProfile(profiles[0].id);
              if (success) {
                console.log(`Initial load: Set profile ${profiles[0].name} as active`);
                const active = await filterService.loadActiveProfile();
                setActiveFilterProfile(active);
              }
            }
          }
        } else {
          console.warn('Initial load: No profiles returned from filterService');
          
          // No profiles exist yet - just proceed without a filter
          console.log('Initial load: No profiles found, proceeding without filtering');
          setActiveFilterProfile(null);
        }
      } catch (err) {
        console.error('Error fetching filter profiles:', err);
        // If there's an error, still allow showing the data
        setActiveFilterProfile(null);
      } finally {
        setLoadingProfiles(false);
      }
    }
    
    fetchFilterProfiles();
  }, []);

  // Handler for profile selection change
  const handleProfileSelect = async (profileId: string) => {
    try {
      console.log('handleProfileSelect called with profileId:', profileId);
      
      if (!profileId) {
        console.warn('Empty profileId passed to handleProfileSelect');
        return;
      }
      
      // Show loading state
      setLoading(true);
      
      console.log('Setting active profile...');
      const success = await filterService.setActiveProfile(profileId);
      
      if (!success) {
        console.error('Failed to set profile as active');
        setLoading(false);
        return;
      }
      
      // Reload the active profile - this will also load the drive IDs
      console.log('Reloading active profile...');
      const active = await filterService.loadActiveProfile();
      console.log('Active profile loaded:', active);
      
      if (active) {
        // Update the UI with the new active profile
        setActiveFilterProfile(active);
        
        // Clear any search or subject filters
        setSearchQuery('');
        setSelectedSubjects([]);
        
        // Reload the presentations with the new filter
        console.log('Reloading presentations with new filter...');
        await fetchData();
      } else {
        console.warn('No active profile found after setting active');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error setting active filter profile:', err);
      setLoading(false);
    }
  };

  // Fetch presentations data
  useEffect(() => {
    fetchData();
  }, [activeFilterProfile]);

  // Function to fetch presentations data
  async function fetchData() {
    try {
      setLoading(true);
      console.log('Home: Fetching presentations data');
      console.log('Home: Current active profile:', activeFilterProfile);
      
      // DEBUG: Let's directly verify if there are profiles in the user_filter_profiles table
      try {
        console.log('Home: DEBUG - Checking available profiles directly');
        const { data: profilesDebug, error: profilesError } = await supabase
          .from('user_filter_profiles')
          .select('*')
          .order('name');
        
        if (profilesError) {
          console.error('Home: Error directly querying profiles:', profilesError);
        } else {
          console.log(`Home: Found ${profilesDebug?.length || 0} profiles directly from DB`);
          if (profilesDebug && profilesDebug.length > 0) {
            console.log('Home: Profile names:', profilesDebug.map(p => p.name).join(', '));
          }
        }
      } catch (e) {
        console.error('Home: Error in direct profile check:', e);
      }
      
      // DEBUG: Let's check profile drives directly
      try {
        console.log('Home: DEBUG - Checking profile drives directly');
        const { data: drivesDebug, error: drivesError } = await supabase
          .from('user_filter_profile_drives')
          .select('*');
        
        if (drivesError) {
          console.error('Home: Error directly querying profile drives:', drivesError);
        } else {
          console.log(`Home: Found ${drivesDebug?.length || 0} profile drives directly from DB`);
          if (drivesDebug && drivesDebug.length > 0) {
            console.log('Home: Sample profile drive fields:', Object.keys(drivesDebug[0]).join(', '));
          }
        }
      } catch (e) {
        console.error('Home: Error in direct drives check:', e);
      }
      
      try {
        // Fetch presentations with their video sources and expert documents
        let query = supabase
          .from('presentations')
          .select(`
            id, 
            video_source_id,
            expert_document_id,
            high_level_folder_source_id,
            web_view_link,
            created_at,
            expert_document:expert_document_id(
              id, 
              title, 
              processed_content
            ),
            video_source:video_source_id(
              id, 
              name, 
              mime_type, 
              web_view_link,
              document_type_id,
              created_at,
              modified_at,
              size,
              metadata
            ),
            high_level_folder:high_level_folder_source_id(
              id,
              name,
              drive_id
            )
          `)
          .not('video_source_id', 'is', null);
        
        // DEBUG: Let's check total presentations before filtering
        const { count: totalBeforeFilter, error: countError } = await supabase
          .from('presentations')
          .select('id', { count: 'exact', head: true })
          .not('video_source_id', 'is', null);
        
        if (!countError) {
          console.log(`Home: Total presentations before filtering: ${totalBeforeFilter}`);
        }
          
        // Apply a custom filtering approach that won't hit URL length limits
        if (activeFilterProfile) {
          try {
            console.log(`Home: Applying custom filter for profile: ${activeFilterProfile.name}`);
            
            // Get root drive IDs directly - this establishes what we want to filter by
            const { data: profileDrives, error: drivesError } = await supabase
              .from('user_filter_profile_drives')
              .select('root_drive_id')
              .eq('profile_id', activeFilterProfile.id);
            
            if (drivesError) {
              console.error('Home: Error getting profile drives:', drivesError);
              console.log('Home: Will proceed without filtering');
            } 
            else if (profileDrives && profileDrives.length > 0) {
              const rootDriveIds = profileDrives.map(d => d.root_drive_id).filter(Boolean);
              console.log(`Home: Found ${rootDriveIds.length} root drive IDs for filtering`);
              
              if (rootDriveIds.length > 0) {
                // THIS IS THE KEY CHANGE: Instead of filtering by source_id (which creates a huge URL),
                // we'll filter presentations directly by the root_drive_ids using a join
                
                // Create the join query using expert_documents table to connect presentations to root_drive_ids
                // This creates a much shorter query than listing hundreds of source_ids
                console.log('Home: Using a Join query approach for filtering');
                
                // Instead of the complex approach, we'll make a simpler version
                // that filters the presentations after we fetch them
                
                // Get all presentations first (this query works fine)
                // Then we'll filter them in memory
              }
            } else {
              console.log('Home: No profile drives found for filtering');
            }
            
            // Get all presentations - we'll filter them after fetching
            // This approach prevents the URL length issues completely
            console.log('Home: Getting all presentations - will filter after fetching');
          } catch (filterError) {
            console.error('Home: Error in custom filter process:', filterError);
            console.log('Home: Proceeding without filtering due to error');
          }
        } else {
          console.log('Home: No active filter profile to apply');
        }

        // Add a timeout to the query to prevent hanging
        const queryPromise = query;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout - request took too long')), 30000);
        });
        
        const { data: presentationsData, error: presentationsError } = await Promise.race([
          queryPromise,
          timeoutPromise
        ]) as any;

        if (presentationsError) {
          throw new Error(`Error fetching presentations: ${presentationsError.message}`);
        }
        
        // Apply in-memory filtering based on active profile
        let filteredPresentationsData = presentationsData || [];
        
        // Only apply filtering if we have an active profile and presentations
        if (activeFilterProfile && filteredPresentationsData.length > 0) {
          try {
            console.log(`Home: Applying in-memory filtering for ${filteredPresentationsData.length} presentations`);
            
            // Get root drive IDs for the active profile
            const { data: profileDrives } = await supabase
              .from('user_filter_profile_drives')
              .select('root_drive_id')
              .eq('profile_id', activeFilterProfile.id);
            
            if (profileDrives && profileDrives.length > 0) {
              const rootDriveIds = profileDrives.map(d => d.root_drive_id).filter(Boolean);
              
              if (rootDriveIds.length > 0) {
                console.log(`Home: Filtering by ${rootDriveIds.length} root drive IDs`);
                
                // Get all relevant source IDs for these root drive IDs
                const { data: sources } = await supabase
                  .from('sources_google')
                  .select('id')
                  .in('root_drive_id', rootDriveIds);
                
                if (sources && sources.length > 0) {
                  const sourceIds = sources.map(s => s.id);
                  console.log(`Home: Found ${sourceIds.length} source IDs for filtering`);
                  
                  // Filter presentations by video_source_id
                  filteredPresentationsData = filteredPresentationsData.filter(p => 
                    sourceIds.includes(p.video_source_id)
                  );
                  
                  console.log(`Home: Filtered to ${filteredPresentationsData.length} presentations`);
                }
              }
            }
          } catch (filterError) {
            console.error('Home: Error in in-memory filtering:', filterError);
            // Keep using all presentations if filtering fails
          }
        }
      
        // Fetch expert information separately for each presentation using sources_google_experts
        const presentationsWithExperts = await Promise.all(
          (filteredPresentationsData || []).map(async (presentation) => {
            if (!presentation.video_source_id) return presentation;
          
          // Get experts associated with this video source
          const { data: expertsData, error: expertsError } = await supabase
            .from('sources_google_experts')
            .select(`
              expert_id,
              is_primary,
              expert:expert_id(
                id,
                full_name,
                expert_name
              )
            `)
            .eq('source_id', presentation.video_source_id);
            
          if (expertsError) {
            console.error(`Error fetching experts for presentation ${presentation.id}:`, expertsError);
            return presentation;
          }
          
          // If we found experts, add them to the presentation
          if (expertsData && expertsData.length > 0) {
            // Find primary expert (if any) or use the first one
            const primaryExpert = expertsData.find(e => e.is_primary) || expertsData[0];
            
            return {
              ...presentation,
              expert: primaryExpert.expert,
              experts: expertsData.map(e => e.expert), // All experts
              expert_names: expertsData.map(e => e.expert?.full_name || e.expert?.expert_name || '').join(', ')
            };
          }
          
          return presentation;
        })
      );
      
        // Use the presentations with experts data
        const sortedPresentations = [...(presentationsWithExperts || [])].sort((a, b) => {
          const dateA = a.video_source?.modified_at ? new Date(a.video_source.modified_at).getTime() : 0;
          const dateB = b.video_source?.modified_at ? new Date(b.video_source.modified_at).getTime() : 0;
          return dateB - dateA;
        });
        
        setPresentations(sortedPresentations);

        // Fetch all subject classifications for the filter
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subject_classifications')
          .select('*')
          .order('subject');

        if (subjectsError) {
          throw new Error(`Error fetching subject classifications: ${subjectsError.message}`);
        }

        setSubjectClassifications(subjectsData || []);
      } catch (queryError) {
        // Handle errors from the inner try block (query execution)
        console.error('Error executing presentation query:', queryError);
        setError(queryError instanceof Error ? 
          queryError.message : 
          'Error loading presentations. The request may have timed out due to the large filter size.'
        );
      }
    } catch (err) {
      // Handle errors from the outer try block
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error in fetchData:', err);
    } finally {
      setLoading(false);
    }
  }

  // Fetch presentation assets when a presentation is selected
  useEffect(() => {
    async function fetchAssets() {
      if (!selectedPresentation) return;
      
      try {
        setLoading(true);
        // Fetch assets for the selected presentation
        const { data: assetsData, error: assetsError } = await supabase
          .from('presentation_assets')
          .select(`
            id, 
            asset_type,
            asset_role,
            asset_source_id,
            asset_expert_document_id,
            importance_level,
            user_notes,
            source_file:asset_source_id(
              id, 
              name, 
              mime_type, 
              web_view_link,
              document_type_id
            ),
            expert_document:asset_expert_document_id(
              id, 
              processed_content,
              document_type_id,
              title
            )
          `)
          .eq('presentation_id', selectedPresentation.id);

        if (assetsError) {
          throw new Error(`Error fetching presentation assets: ${assetsError.message}`);
        }

        setPresentationAssets(assetsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, [selectedPresentation]);

  // State for presentation classifications
  const [presentationClassifications, setPresentationClassifications] = useState<Record<string, string[]>>({});
  
  // Fetch subject classifications for videos when presentations change
  useEffect(() => {
    async function fetchClassifications() {
      if (presentations.length === 0) return;
      
      try {
        // Get all video source IDs from presentations (only MP4 files)
        const videoSourceIds = presentations
          .filter(p => p.video_source_id && p.video_source?.mime_type === 'video/mp4')
          .map(p => p.video_source_id!);
        
        if (videoSourceIds.length === 0) return;
        
        // Fetch classifications for these videos
        const { data: classificationData, error: classificationError } = await supabase
          .from('table_classifications')
          .select(`
            entity_id,
            subject_classification_id
          `)
          .in('entity_id', videoSourceIds)
          .eq('entity_type', 'sources_google');
        
        if (classificationError) {
          console.error('Error fetching classifications:', classificationError);
          return;
        }
        
        // Organize classifications by entity_id
        const classificationsMap: Record<string, string[]> = {};
        
        (classificationData || []).forEach(classification => {
          if (!classificationsMap[classification.entity_id]) {
            classificationsMap[classification.entity_id] = [];
          }
          classificationsMap[classification.entity_id].push(classification.subject_classification_id);
        });
        
        setPresentationClassifications(classificationsMap);
      } catch (err) {
        console.error('Error fetching classifications:', err);
      }
    }
    
    fetchClassifications();
  }, [presentations]);
  
  // Filter presentations based on search query and selected subjects
  const filteredPresentations = useMemo(() => {
    let filtered = [...presentations];
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p => 
          // Search in title
          (p.expert_document?.title?.toLowerCase().includes(query)) || 
          // Search in filename
          (p.video_source?.name?.toLowerCase().includes(query)) ||
          // Search in expert name
          (p.expert?.full_name?.toLowerCase().includes(query) || 
           p.expert?.expert_name?.toLowerCase().includes(query)) ||
          // Search in high level folder name
          (p.high_level_folder?.name?.toLowerCase().includes(query)) ||
          // Search in processed content (video summaries)
          (p.expert_document?.processed_content && searchInProcessedContent(p.expert_document.processed_content, query))
      );
    }
    
    // Filter by selected subjects
    if (selectedSubjects.length > 0) {
      filtered = filtered.filter(presentation => {
        if (!presentation.video_source_id) return false;
        
        const classifications = presentationClassifications[presentation.video_source_id];
        if (!classifications || classifications.length === 0) return false;
        
        // Check if this presentation has any of the selected subjects
        return selectedSubjects.some(subjectId => 
          classifications.includes(subjectId)
        );
      });
    }
    
    // Sort by modified date (most recent first)
    filtered.sort((a, b) => {
      const dateA = a.video_source?.modified_at ? new Date(a.video_source.modified_at).getTime() : 0;
      const dateB = b.video_source?.modified_at ? new Date(b.video_source.modified_at).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });
    
    return filtered;
  }, [presentations, searchQuery, selectedSubjects, presentationClassifications]);

  // Check if content is likely markdown
  const isMarkdown = (content: string): boolean => {
    // Check for common markdown elements
    return (
      content.includes('#') || // Headers
      content.includes('==') || // Headers alternative
      content.includes('```') || // Code blocks
      /\[.+\]\(.+\)/.test(content) || // Links
      /\*\*.+\*\*/.test(content) || // Bold
      /\*.+\*/.test(content) || // Italic
      /- .+/.test(content) || // Lists
      /\d\. .+/.test(content) // Numbered lists
    );
  };

  // Special formatter for expert profiles
  const formatExpertProfile = (content: any): React.ReactNode => {
    if (!content) return <p>No content available</p>;
    
    try {
      // Ensure we have an object to work with
      const profileData = typeof content === 'string' ? JSON.parse(content) : content;
      
      // Check if this is a profile object with expected fields
      if (typeof profileData === 'object') {
        return (
          <div className="expert-profile">
            {/* Name and Title Section */}
            {profileData.name && (
              <h2 className="text-xl font-bold mb-3">{profileData.name}</h2>
            )}
            
            {profileData.title && (
              <p className="text-lg text-gray-700 mb-4">{profileData.title}</p>
            )}
            
            {/* Short Bio */}
            {profileData.short_bio && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Biography</h3>
                <p className="text-gray-800">{profileData.short_bio}</p>
              </div>
            )}
            
            {/* Areas of Expertise */}
            {profileData.areas_of_expertise && profileData.areas_of_expertise.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Areas of Expertise</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {profileData.areas_of_expertise.map((area: string, index: number) => (
                    <li key={index} className="text-gray-800">{area}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Key Publications */}
            {profileData.key_publications && profileData.key_publications.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Key Publications</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {profileData.key_publications.map((pub: string, index: number) => (
                    <li key={index} className="text-gray-800">{pub}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Affiliations */}
            {profileData.affiliations && profileData.affiliations.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Affiliations</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {profileData.affiliations.map((affiliation: string, index: number) => (
                    <li key={index} className="text-gray-800">{affiliation}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Education */}
            {profileData.education && profileData.education.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Education</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {profileData.education.map((edu: string, index: number) => (
                    <li key={index} className="text-gray-800">{edu}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Contact Information */}
            {(profileData.email || profileData.website) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Contact</h3>
                {profileData.email && <p className="text-gray-800">Email: {profileData.email}</p>}
                {profileData.website && (
                  <p className="text-gray-800">
                    Website: <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{profileData.website}</a>
                  </p>
                )}
              </div>
            )}
            
            {/* Additional fields - display any other fields that weren't explicitly handled */}
            {Object.entries(profileData)
              .filter(([key]) => ![
                'name', 'title', 'short_bio', 'areas_of_expertise', 
                'key_publications', 'affiliations', 'education', 
                'email', 'website'
              ].includes(key))
              .map(([key, value]) => {
                // Skip if value is null/undefined or empty array/string
                if (value === null || value === undefined) return null;
                if (Array.isArray(value) && value.length === 0) return null;
                if (typeof value === 'string' && value.trim() === '') return null;
                
                // Format arrays as lists
                if (Array.isArray(value)) {
                  return (
                    <div key={key} className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">{key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        {value.map((item: any, index: number) => (
                          <li key={index} className="text-gray-800">{item}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                
                // Format objects recursively (skip for now to avoid complexity)
                if (typeof value === 'object' && value !== null) {
                  return (
                    <div key={key} className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">{key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</h3>
                      <JsonFormatter data={value} fontSize="0.75rem" />
                    </div>
                  );
                }
                
                // Format strings and other primitives
                return (
                  <div key={key} className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">{key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</h3>
                    <p className="text-gray-800">{String(value)}</p>
                  </div>
                );
              })
            }
          </div>
        );
      }
      
      // If not a structured profile, fall back to the normal content formatter
      return formatContent(content);
    } catch (error) {
      console.error("Error formatting expert profile:", error);
      // Fallback to normal content formatter
      return formatContent(content);
    }
  };

  // Format and display processed content (JSON, markdown, or plain text)
  const formatContent = (content: any): React.ReactNode => {
    if (!content) return <p>No content available</p>;
    
    // If we have an object, use the formatter directly
    if (typeof content === 'object') {
      return <JsonFormatter data={content} fontSize="0.875rem" />;
    }
    
    // For strings or other types, just use the regular formatter
    return formatContentInternal(content);
  };
  
  // Internal version of formatContent that handles the actual formatting
  const formatContentInternal = (content: any): React.ReactNode => {
    if (!content) return <p>No content available</p>;
    
    if (typeof content === 'string') {
      // Check if the content is likely markdown
      if (isMarkdown(content)) {
        return (
          <div className="markdown-content">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        );
      }
      
      // If not markdown, split by double newlines to create paragraphs
      return (
        <div>
          {content.split('\n\n').map((paragraph, index) => (
            <p key={index} className="mb-4">
              {/* Check if this looks like a heading (all caps or ends with colon) */}
              {(paragraph.toUpperCase() === paragraph && paragraph.length > 4) || paragraph.trim().endsWith(':') ? 
                <strong>{paragraph}</strong> : 
                paragraph}
            </p>
          ))}
        </div>
      );
    }
    
    if (typeof content === 'object') {
      // Check if there's a summary field
      if (content.summary) {
        const summaryContent = content.summary;
        const keyName = content.key_points ? "Points" : content.key_insights ? "Insights" : "Highlights";
        
        // Check if the summary is markdown
        if (typeof summaryContent === 'string' && isMarkdown(summaryContent)) {
          return (
            <div className="markdown-content">
              <h2 className="font-bold text-xl text-blue-700 mb-4 pb-2 border-b border-blue-200">
                Summary
              </h2>
              <div className="mb-6 text-gray-800">
                <ReactMarkdown>{summaryContent}</ReactMarkdown>
              </div>
              
              {/* Add key points/insights if they exist */}
              {(content.key_points || content.highlights || content.key_insights) && (
                <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-bold text-base mb-3 text-blue-800">Key {keyName}:</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {(content.key_points || content.highlights || content.key_insights || []).map((point: string, index: number) => (
                      <li key={index} className="text-gray-700">{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        }
        
        // If not markdown, format as paragraphs
        return (
          <div className="content-container bg-white rounded-lg shadow-sm p-5">
            <h2 className="font-bold text-xl text-blue-700 mb-4 pb-2 border-b border-blue-200">
              Summary
            </h2>
            <div className="mb-6 text-gray-800">
              {typeof summaryContent === 'string' ? 
                summaryContent.split('\n\n').map((paragraph: string, index: number) => (
                  <p key={index} className="mb-3">
                    {/* Check if this looks like a heading */}
                    {(paragraph.toUpperCase() === paragraph && paragraph.length > 4) || paragraph.trim().endsWith(':') ? 
                      <strong>{paragraph}</strong> : 
                      paragraph}
                  </p>
                )) : 
                <JsonFormatter data={summaryContent} />
              }
            </div>
            
            {/* Add key points/insights if they exist */}
            {(content.key_points || content.highlights || content.key_insights) && (
              <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                <h3 className="font-bold text-base mb-3 text-blue-800">Key {keyName}:</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {(content.key_points || content.highlights || content.key_insights || []).map((point: string, index: number) => (
                    <li key={index} className="text-gray-700">{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }
      
      // If there are key_points or highlights, format them as a list
      if (content.key_points || content.highlights || content.key_insights) {
        const points = content.key_points || content.highlights || content.key_insights || [];
        const keyName = content.key_points ? "Points" : content.key_insights ? "Insights" : "Highlights";
        
        return (
          <div className="content-container bg-white rounded-lg shadow-sm p-5">
            {content.summary && (
              <div className="mb-6">
                <h2 className="font-bold text-xl text-blue-700 mb-4 pb-2 border-b border-blue-200">
                  Summary
                </h2>
                {typeof content.summary === 'string' ? 
                  content.summary.split('\n\n').map((paragraph: string, index: number) => (
                    <p key={index} className="mb-3 text-gray-800">{paragraph}</p>
                  )) : 
                  <JsonFormatter data={content.summary} className="text-gray-800" />
                }
              </div>
            )}
            
            {points.length > 0 && (
              <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                <h3 className="font-bold text-base mb-3 text-blue-800">Key {keyName}:</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {points.map((point: string, index: number) => (
                    <li key={index} className="text-gray-700">{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }
      
      // Check if the object has a markdown field
      if (content.markdown) {
        return (
          <div className="markdown-content p-5 bg-white rounded-lg shadow-sm">
            <ReactMarkdown>{content.markdown}</ReactMarkdown>
          </div>
        );
      }
      
      // Enhanced structured content display
      const hasSummarySection = content.summary || content.overview;
      const hasKeyPoints = content.key_points || content.highlights || content.key_insights;
      
      if (hasSummarySection || hasKeyPoints) {
        return (
          <div className="json-enhanced-content p-5 bg-white rounded-lg shadow-sm">
            {/* Summary Section */}
            {(content.summary || content.overview) && (
              <div className="mb-6">
                <h2 className="font-bold text-xl text-blue-700 mb-4 pb-2 border-b border-blue-200">
                  {content.summary ? "Summary" : "Overview"}
                </h2>
                <div className="text-gray-800">
                  {typeof (content.summary || content.overview) === 'string' ?
                    (content.summary || content.overview).split('\n\n').map((paragraph: string, index: number) => (
                      <p key={index} className="mb-3">{paragraph}</p>
                    )) :
                    <JsonFormatter data={content.summary || content.overview} />
                  }
                </div>
              </div>
            )}
            
            {/* Key Points/Insights Section */}
            {hasKeyPoints && (
              <div className="mt-6 bg-blue-50 p-4 rounded-lg">
                <h3 className="font-bold text-lg mb-3 text-blue-800">
                  {content.key_points ? "Key Points" : 
                   content.key_insights ? "Key Insights" : 
                   "Highlights"}
                </h3>
                <ul className="list-disc pl-5 space-y-2">
                  {(content.key_points || content.highlights || content.key_insights || []).map((point: string, index: number) => (
                    <li key={index} className="text-gray-700">{point}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Other sections that might be important */}
            {Object.entries(content)
              .filter(([key]) => !['summary', 'overview', 'key_points', 'highlights', 'key_insights'].includes(key))
              .map(([key, value]) => {
                if (value === null || value === undefined) return null;
                
                const displayName = key
                  .replace(/_/g, ' ')
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
                
                return (
                  <div key={key} className="mt-6">
                    <h3 className="font-bold text-lg text-blue-700 mb-3">
                      {displayName}
                    </h3>
                    
                    {typeof value === 'string' && (
                      <p className="text-gray-800">{value}</p>
                    )}
                    
                    {typeof value === 'number' && (
                      <p className="text-gray-800">{value}</p>
                    )}
                    
                    {typeof value === 'boolean' && (
                      <p className="text-gray-800">{value ? 'Yes' : 'No'}</p>
                    )}
                    
                    {Array.isArray(value) && value.length > 0 && (
                      <ul className="list-disc pl-5 space-y-2">
                        {value.map((item, idx) => (
                          <li key={idx} className="text-gray-800">
                            {typeof item === 'object' ? 
                              <div className="text-sm p-2">
                                {Object.entries(item).map(([itemKey, itemValue]) => (
                                  <div key={itemKey} className="mb-2">
                                    <span className="font-semibold">{itemKey.replace(/_/g, ' ')}: </span>
                                    <span>{String(itemValue)}</span>
                                  </div>
                                ))}
                              </div> : 
                              String(item)
                            }
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    {typeof value === 'object' && !Array.isArray(value) && value !== null && (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        {Object.entries(value).map(([subKey, subValue]) => {
                          if (subValue === null || subValue === undefined) return null;
                          
                          const subKeyFormatted = subKey
                            .replace(/_/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                            
                          return (
                            <div key={subKey} className="mb-3">
                              <span className="font-semibold text-blue-600">{subKeyFormatted}: </span>
                              {typeof subValue === 'object' ? (
                                <div className="pl-4 mt-1 border-l-2 border-blue-100">
                                  {Array.isArray(subValue) ? (
                                    <ul className="list-disc pl-4">
                                      {subValue.map((item, i) => (
                                        <li key={i} className="mb-1">{String(item)}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    Object.entries(subValue).map(([deepKey, deepValue]) => (
                                      <div key={deepKey} className="mb-1">
                                        <span className="font-medium">{deepKey.replace(/_/g, ' ')}: </span>
                                        <span className="text-gray-700">{String(deepValue)}</span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-700">{String(subValue)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            }
            
            {/* No need to show raw JSON here since we now show it at the top */}
          </div>
        );
      } else {
        // If no structured sections found, display in a clean format
        return (
          <div className="json-formatted-content p-5 bg-white rounded-lg shadow-sm">
            <h2 className="font-bold text-xl text-blue-700 mb-4">Document Content</h2>
            
            {Object.entries(content).map(([key, value]) => {
              if (value === null || value === undefined) return null;
              
              const displayName = key
                .replace(/_/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              
              return (
                <div key={key} className="mb-5 pb-4 border-b border-gray-100">
                  <h3 className="font-bold text-lg text-blue-700 mb-2">
                    {displayName}
                  </h3>
                  
                  {typeof value === 'string' && (
                    <p className="text-gray-800">{value}</p>
                  )}
                  
                  {typeof value === 'number' && (
                    <p className="text-gray-800">{value}</p>
                  )}
                  
                  {typeof value === 'boolean' && (
                    <p className="text-gray-800">{value ? 'Yes' : 'No'}</p>
                  )}
                  
                  {Array.isArray(value) && (
                    <ul className="list-disc pl-5 space-y-1">
                      {value.map((item, idx) => (
                        <li key={idx} className="text-gray-800">
                          {typeof item === 'object' ? 
                            <div className="text-sm p-2">
                              {Object.entries(item).map(([itemKey, itemValue]) => (
                                <div key={itemKey} className="mb-2">
                                  <span className="font-semibold">{itemKey.replace(/_/g, ' ')}: </span>
                                  <span>{String(itemValue)}</span>
                                </div>
                              ))}
                            </div> : 
                            String(item)
                          }
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {typeof value === 'object' && !Array.isArray(value) && value !== null && (
                    <div className="pl-4 mt-2">
                      {Object.entries(value).map(([subKey, subValue]) => {
                        if (subValue === null || subValue === undefined) return null;
                        return (
                          <div key={subKey} className="mb-3">
                            <span className="font-semibold text-blue-600">{subKey.replace(/_/g, ' ')}: </span>
                            {typeof subValue === 'object' ? (
                              <JsonFormatter data={subValue} fontSize="0.75rem" className="mt-1" />
                            ) : (
                              <span className="text-gray-700">{String(subValue)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }
    }
    
    return <p>Content format not supported</p>;
  };

  // Toggle subject filter
  const toggleSubject = (subjectId: string) => {
    // First, clear the search if it's active
    if (isSearchFocused) {
      setIsSearchFocused(false);
    }
    if (searchQuery) {
      setSearchQuery('');
    }

    // Then toggle the subject, clearing any other selected subjects first
    if (selectedSubjects.includes(subjectId)) {
      setSelectedSubjects(selectedSubjects.filter(id => id !== subjectId));
    } else {
      // Clear other subjects and set only this one
      setSelectedSubjects([subjectId]);
    }
  };

  // Fetch expert bio
  const fetchExpertBio = async (expertId?: string) => {
    if (!expertId) {
      console.log("No expert ID provided, using fallback");
      // Create a fallback profile for when no expert ID is provided
      setExpertBioContent({ 
        name: selectedPresentation?.expert_names || selectedPresentation?.expert?.full_name || "Expert Profile",
        short_bio: "Detailed profile information is not available for this expert."
      });
      setShowExpertBio(true);
      return;
    }
    
    try {
      // First try to get the expert's basic info to ensure we can display something
      const { data: expertData, error: expertError } = await supabase
        .from('experts')
        .select('id, full_name, expert_name, bio')
        .eq('id', expertId)
        .single();
      
      if (expertError) {
        console.error('Error fetching expert:', expertError);
        // Create a fallback profile to display
        setExpertBioContent({ 
          name: selectedPresentation?.expert_names || selectedPresentation?.expert?.full_name || "Expert Profile",
          short_bio: "Unable to load expert profile information."
        });
        setShowExpertBio(true);
        return;
      }
      
      // If expert has a bio field directly in the experts table, use that
      if (expertData && expertData.bio) {
        // Check if bio is a string (possibly JSON) or already an object
        if (typeof expertData.bio === 'string') {
          try {
            // Try to parse it as JSON
            const parsedBio = JSON.parse(expertData.bio);
            setExpertBioContent(parsedBio);
          } catch (parseError) {
            // If parsing fails, use as plain text
            setExpertBioContent({
              name: expertData.full_name || expertData.expert_name,
              short_bio: expertData.bio
            });
          }
        } else {
          // If bio is already an object, use it directly
          setExpertBioContent(expertData.bio);
        }
        setShowExpertBio(true);
        return;
      }
      
      // If no bio in experts table, try to fetch an expert document with the bio document_type_id
      const { data: bioDocuments, error: bioError } = await supabase
        .from('expert_documents')
        .select(`
          id,
          processed_content,
          source_id
        `)
        .in('document_type_id', [
          '554ed67c-35d1-4218-abba-8d1b0ff7156d',
          'af194b7e-cbf9-45c3-a1fc-863dbc815f1e',
          '03743a23-d2f3-4c73-a282-85afc138fdfd'
        ]); // Bio document type IDs
      
      if (bioError) {
        console.error('Error fetching expert bio documents:', bioError);
        // Fall back to basic profile
        setExpertBioContent({ 
          name: expertData.full_name || expertData.expert_name,
          short_bio: "Profile information is currently unavailable."
        });
        setShowExpertBio(true);
        return;
      }
      
      // Find if any of the bio documents is associated with this expert
      if (bioDocuments && bioDocuments.length > 0) {
        // Get presentation_assets for the current expert to find matching source_ids
        const { data: expertAssets, error: assetsError } = await supabase
          .from('presentation_assets')
          .select('source_id')
          .eq('expert_id', expertId);
          
        if (!assetsError && expertAssets && expertAssets.length > 0) {
          const expertSourceIds = expertAssets.map(asset => asset.source_id);
          const matchingBio = bioDocuments.find(doc => 
            expertSourceIds.includes(doc.source_id)
          );
          
          if (matchingBio) {
            // Found a matching bio document
            const bioContent = matchingBio.processed_content;
            
            // Ensure the content has the expert's name if it's missing
            if (typeof bioContent === 'object' && bioContent !== null && !bioContent.name && expertData) {
              bioContent.name = expertData.full_name || expertData.expert_name;
            }
            
            setExpertBioContent(bioContent);
            setShowExpertBio(true);
            return;
          }
        }
        
        // If we didn't find a matching bio, use the first bio but add the expert's name
        const firstBioContent = bioDocuments[0].processed_content;
        if (typeof firstBioContent === 'object' && firstBioContent !== null && !firstBioContent.name && expertData) {
          firstBioContent.name = expertData.full_name || expertData.expert_name;
        }
        
        setExpertBioContent(firstBioContent);
        setShowExpertBio(true);
        return;
      }
      
      // If no specific bio documents found, try to get any document associated with this expert
      const { data: expertAssets, error: assetsError } = await supabase
        .from('presentation_assets')
        .select('source_id')
        .eq('expert_id', expertId);
          
      if (!assetsError && expertAssets && expertAssets.length > 0) {
        const sourceId = expertAssets[0].source_id;
        
        const { data: anyDocument, error: anyError } = await supabase
          .from('expert_documents')
          .select('id, processed_content')
          .eq('source_id', sourceId)
          .limit(1);
        
        if (!anyError && anyDocument && anyDocument.length > 0) {
          // Ensure the content has a name
          const docContent = anyDocument[0].processed_content;
          if (typeof docContent === 'object' && docContent !== null && !docContent.name && expertData) {
            docContent.name = expertData.full_name || expertData.expert_name;
          }
          
          setExpertBioContent(docContent);
          setShowExpertBio(true);
          return;
        }
      }
      
      // If we got here, we couldn't find any detailed profile info - create a minimal profile
      setExpertBioContent({ 
        name: expertData.full_name || expertData.expert_name,
        title: expertData.expert_name ? `Known as: ${expertData.expert_name}` : undefined,
        short_bio: "No detailed biography is available for this expert."
      });
      setShowExpertBio(true);
    } catch (err) {
      console.error('Error in fetchExpertBio:', err);
      // Show a fallback profile even if everything fails
      setExpertBioContent({ 
        name: "Expert Profile",
        short_bio: "Unable to load expert profile information due to an error."
      });
      setShowExpertBio(true);
    }
  };

  // Handle presentation selection
  const handlePresentationSelect = (presentation: Presentation) => {
    if (selectedPresentation?.id === presentation.id) {
      // If clicking the same presentation, just restore default section states
      setVideoSectionOpen(true);
      setPresentationAssetsOpen(true);
      setAssetSectionOpen(true);
      return;
    }
    
    setSelectedPresentation(presentation);
    setSelectedAsset(null);
    setShowExpertBio(false); // Hide expert bio when changing presentations
    
    // Restore default section states when changing presentations
    setVideoSectionOpen(true);
    setPresentationAssetsOpen(true);
    setAssetSectionOpen(true);
    setAssetViewMode(false);
  };

  // State managed via assetViewMode instead of showAssetViewer
  
  // Handle asset selection
  const handleAssetSelect = (asset: PresentationAsset) => {
    const isSelectingSameAsset = selectedAsset?.id === asset.id;
    setSelectedAsset(asset);
    setAssetViewMode(false);
    
    // Make sure asset section is open and visible
    setAssetSectionOpen(true);
    
    // When selecting a new asset, make the presentation assets more prominent
    if (!isSelectingSameAsset) {
      // Keep the presentation assets section visible
      // but collapse video section to give more space to assets
      setVideoSectionOpen(false);
    }
  };
  
  // This function is now handled inline with the onClick/onDoubleClick handlers

  // Close the expert bio modal
  const closeExpertBio = () => {
    setShowExpertBio(false);
  };
  
  // Handle closing the search results
  const closeSearchResults = () => {
    setIsSearchFocused(false);
  };
  
  // State for showing expert profile modal
  const [showExpertProfileModal, setShowExpertProfileModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false); // Keep debug modal for testing
  const [expertMetadata, setExpertMetadata] = useState<any>(null);
  const [selectedExpertId, setSelectedExpertId] = useState<string | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  // Function to fetch expert metadata by ID
  const fetchExpertMetadata = async (expertId: string) => {
    setLoadingMetadata(true);
    setMetadataError(null);
    
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .eq('id', expertId)
        .single();
      
      if (error) throw error;
      setExpertMetadata(data);
    } catch (err) {
      console.error('Error fetching expert metadata:', err);
      setMetadataError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoadingMetadata(false);
    }
  };

  // Handler for opening expert profile
  const openExpertProfile = (expertId: string) => {
    setSelectedExpertId(expertId);
    setExpertMetadata(null); // Clear previous data
    setShowExpertProfileModal(true);
  };

  // Handler for debug link
  const openDebugExpert = () => {
    const debugExpertId = '16bdcf4b-ad1a-445a-825b-e0f9a76db6af';
    setSelectedExpertId(debugExpertId);
    setExpertMetadata(null); // Clear previous data
    setShowDebugModal(true);
  };

  // Fetch metadata when any modal opens
  useEffect(() => {
    if ((showExpertProfileModal || showDebugModal) && selectedExpertId && !loadingMetadata) {
      fetchExpertMetadata(selectedExpertId);
    }
  }, [showExpertProfileModal, showDebugModal, selectedExpertId]);

  return (
    <div className="container mx-auto p-4">
      {/* Expert Profile Modal - Used for both debug and regular viewing */}
      {(showDebugModal || showExpertProfileModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[85vh] overflow-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {expertMetadata ? `Expert Profile for ${expertMetadata.full_name || expertMetadata.expert_name}` : 'Expert Profile'}
              </h2>
              <button 
                onClick={() => {
                  setShowDebugModal(false);
                  setShowExpertProfileModal(false);
                }}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6">
              {loadingMetadata ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-3 text-gray-600">Loading expert profile...</p>
                </div>
              ) : metadataError ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <p className="font-bold">Error</p>
                  <p>{metadataError}</p>
                </div>
              ) : expertMetadata ? (
                <div>
                  {expertMetadata.metadata ? (
                    <div className="border rounded p-4 bg-gray-50">
                      <JsonFormatter data={expertMetadata.metadata} fontSize="1rem" />
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No profile data available for this expert.</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No expert found</p>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowDebugModal(false);
                  setShowExpertProfileModal(false);
                }}
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expert Bio Modal */}
      {showExpertBio && expertBioContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50">
              <h3 className="text-xl font-semibold text-gray-900">Expert Profile</h3>
              <button 
                onClick={closeExpertBio}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:mb-3 prose-li:my-1 prose-ul:ml-4 prose-ul:list-disc prose-ol:ml-4 prose-ol:list-decimal">
                {/* Use JsonFormatter for the expert metadata instead of the custom formatter */}
                <JsonFormatter data={expertBioContent} fontSize="0.875rem" />
              </div>
            </div>
            <div className="px-6 py-3 bg-gray-50 rounded-b-lg">
              <button
                onClick={closeExpertBio}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Main content area with everything side by side */}
      <div className="flex lg:flex-row gap-6">
        {/* Left column with filter dropdown and left sidebar content */}
        <div className="lg:w-1/3 space-y-4">
          {/* Filter profiles dropdown */}
          <select 
            className="px-4 py-2 w-full bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
            onChange={(e) => {
              if (e.target.value) {
                handleProfileSelect(e.target.value);
              }
            }}
            value={activeFilterProfile?.id || ''}
            disabled={loadingProfiles}
          >
            <option value="" disabled>
              {loadingProfiles ? 'Loading profiles...' : 'Select a filter profile'}
            </option>
            {filterProfiles && filterProfiles.length > 0 ? (
              filterProfiles
                .filter(profile => profile && profile.id && profile.name)
                .map((profile) => {
                  const id = String(profile.id);
                  const name = String(profile.name);
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })
            ) : (
              <option value="" disabled>No profiles available</option>
            )}
          </select>
          
          {/* Search Box - Moved up */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="mb-4">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Presentations
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="search"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Search titles, experts, or content..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    // Clear any selected subjects when entering a search query
                    if (e.target.value && selectedSubjects.length > 0) {
                      setSelectedSubjects([]);
                    }
                  }}
                  onFocus={() => {
                    setIsSearchFocused(true);
                    // Also clear selected subjects when focusing on search
                    if (selectedSubjects.length > 0) {
                      setSelectedSubjects([]);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Search Results Counter */}
              {searchQuery && (
                <div className="mt-2 text-sm text-gray-600">
                  Found {filteredPresentations.length} matching presentations
                </div>
              )}
              
              {/* Floating Search Results - Only show when there are results and searching */}
              {searchQuery && isSearchFocused && filteredPresentations.length > 0 ? (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-[60vh] overflow-y-auto">
                  <div className="p-2 border-b sticky top-0 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {filteredPresentations.length} search results
                    </span>
                    <button
                      onClick={closeSearchResults}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="divide-y divide-gray-100">
                    {filteredPresentations.slice(0, 20).map((presentation) => (
                      <div
                        key={presentation.id}
                        onClick={() => {
                          handlePresentationSelect(presentation);
                          closeSearchResults();
                        }}
                        className="p-3 hover:bg-blue-50 cursor-pointer transition-colors flex flex-col"
                      >
                        <span className="font-medium text-gray-900 line-clamp-1">
                          {presentation.expert_document?.title || presentation.video_source?.name || 'Untitled Presentation'}
                        </span>
                        <div className="flex items-center text-xs text-gray-500 mt-1 gap-2">
                          {presentation.expert?.full_name && (
                            <span className="truncate">{presentation.expert.full_name}</span>
                          )}
                          {presentation.video_source?.modified_at && (
                            <span className="whitespace-nowrap text-gray-400">
                              {new Date(presentation.video_source.modified_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short'
                              })}
                            </span>
                          )}
                          {presentation.high_level_folder?.name && (
                            <span className="text-blue-600 font-medium truncate max-w-[180px] inline-block">
                              {presentation.high_level_folder.name}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {filteredPresentations.length > 20 && (
                      <div className="p-2 text-center text-sm text-gray-500 bg-gray-50">
                        {filteredPresentations.length - 20} more results available. Refine your search to see more specific results.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          
          {/* Subject Classification Pills - Moved up */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Filter by Subject</h2>
            <div className="flex flex-wrap gap-2">
              {/* "All" pill as the first item */}
              <div className="relative group">
                <button
                  onClick={() => setSelectedSubjects([])}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedSubjects.length === 0
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                  title={`All presentations (${presentations.length})`}
                >
                  All
                </button>
                
                {/* Custom Tooltip for All pill */}
                <div className="absolute z-10 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white p-2 rounded shadow-lg mt-2 min-w-[200px] max-w-xs text-left text-xs">
                  <div className="font-semibold text-white mb-1">
                    All Presentations
                  </div>
                  <div className="text-gray-300 mb-1">{presentations.length} presentations</div>
                  
                  {/* Add a hint about clicking */}
                  <div className="mt-1 pt-1 border-t border-gray-600 italic text-gray-400">
                    Click to show all presentations
                  </div>
                  
                  {/* Tooltip arrow */}
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                </div>
              </div>
              
              {subjectClassifications
                .map((subject) => {
                  // Count how many videos have this subject tag
                  const videoCount = Object.values(presentationClassifications)
                    .filter(subjectIds => subjectIds.includes(subject.id))
                    .length;
                  
                  return {
                    subject,
                    videoCount
                  };
                })
                // Filter out subjects with zero videos
                .filter(({ videoCount }) => videoCount > 0)
                // Sort by count (highest first)
                .sort((a, b) => b.videoCount - a.videoCount)
                .map(({ subject, videoCount }) => {
                  // Format the subject text - remove prefix numbers, underscores, dashes and capitalize first letter
                  const formattedSubject = subject.subject
                    .replace(/^\d+[.\s_-]*\s*/g, '')  // Remove number prefixes and separators
                    .replace(/^[_-]+/, '')  // Remove leading underscores or dashes
                    .replace(/^\w/, (c: string) => c.toUpperCase());  // Capitalize first letter
                  
                  return (
                    <div key={subject.id} className="relative group">
                      <button
                        onClick={() => toggleSubject(subject.id)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedSubjects.includes(subject.id)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                        }`}
                        title={`${formattedSubject} (${videoCount} video${videoCount !== 1 ? 's' : ''})${subject.description ? ': ' + subject.description : ''}`}
                      >
                        {subject.short_name || formattedSubject}
                      </button>
                      
                      {/* Custom Tooltip */}
                      <div className="absolute z-10 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white p-2 rounded shadow-lg mt-2 min-w-[200px] max-w-xs text-left text-xs">
                        <div className="font-semibold text-white mb-1">
                          {/* Format subject text */}
                          {formattedSubject}
                        </div>
                        <div className="text-gray-300 mb-1">{videoCount} video{videoCount !== 1 ? 's' : ''}</div>
                        
                        {/* Show the description if it exists */}
                        {subject.description && (
                          <div className="text-gray-300 border-t border-gray-600 pt-1 mt-1">
                            {subject.description}
                          </div>
                        )}
                        
                        {/* Add a hint about clicking */}
                        <div className="mt-1 pt-1 border-t border-gray-600 italic text-gray-400">
                          Click to filter presentations
                        </div>
                        
                        {/* Tooltip arrow */}
                        <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
          
          {/* Presentations List - Moved up */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">
              {filteredPresentations.length > 0 ? `${filteredPresentations.length} ` : ""}Presentations
            </h2>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-sm text-gray-500">Loading presentations...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded">
                <div className="font-semibold mb-1">Error loading presentations</div>
                <div className="text-sm">{error}</div>
                <div className="flex mt-3 gap-3">
                  <button 
                    onClick={() => {
                      setError(null);
                      fetchData();
                    }}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors flex items-center"
                  >
                    <RefreshCcw className="h-3 w-3 mr-1" />
                    Retry
                  </button>
                  
                  <button
                    onClick={async () => {
                      // Reset active profile to null (no filtering)
                      setActiveFilterProfile(null);
                      // Clear error
                      setError(null);
                      // Refetch data with a slight delay to ensure state update
                      setTimeout(() => fetchData(), 100);
                    }}
                    className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm transition-colors"
                  >
                    Show All (No Filter)
                  </button>
                </div>
              </div>
            ) : filteredPresentations.length === 0 ? (
              <div className="text-gray-500 text-center py-6 bg-gray-50 rounded-md">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-10 w-10 mx-auto text-gray-400 mb-2" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="mb-1">No presentations found</p>
                <p className="text-xs text-gray-400">Try adjusting your search criteria</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredPresentations.map((presentation) => (
                  <div
                    key={presentation.id}
                    onClick={() => handlePresentationSelect(presentation)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedPresentation?.id === presentation.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-gray-100'
                    }`}
                  >
                    <h3 className="font-medium text-gray-900 line-clamp-2">
                      {presentation.expert_document?.title || presentation.video_source?.name || 'Untitled Presentation'}
                    </h3>
                    
                    {/* Author and date info */}
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      {presentation.expert_names ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering parent's onClick
                            // If we have multiple experts, show the bio of the primary one
                            if (presentation.expert?.id) {
                              openExpertProfile(presentation.expert.id);
                            } else if (presentation.experts && presentation.experts.length > 0 && presentation.experts[0].id) {
                              openExpertProfile(presentation.experts[0].id);
                            } else {
                              // If no expert ID is available, just show the bio with the name
                              fetchExpertBio();
                            }
                          }}
                          className="truncate max-w-[160px] text-blue-600 hover:underline"
                        >
                          {presentation.expert_names}
                        </button>
                      ) : presentation.expert?.full_name && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering parent's onClick
                            if (presentation.expert?.id) {
                              openExpertProfile(presentation.expert.id);
                            } else {
                              fetchExpertBio(presentation.expert?.id);
                            }
                          }}
                          className="truncate max-w-[120px] hover:text-blue-600 hover:underline"
                        >
                          {presentation.expert.full_name}
                        </button>
                      )}
                      
                      {presentation.video_source?.modified_at && (
                        <span className="whitespace-nowrap">
                          {new Date(presentation.video_source.modified_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      )}
                      
                      {presentation.high_level_folder?.name && (
                        <span className="text-blue-600 font-medium truncate max-w-[150px] inline-block">
                          {presentation.high_level_folder.name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-sm text-gray-500 truncate">
                        {presentation.video_source?.name && (
                          <span className="text-xs italic">
                            {presentation.video_source.name}
                            <span className="ml-1 text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-600">
                              {getVideoDuration(presentation.video_source)}
                            </span>
                          </span>
                        )}
                      </div>
                      
                      {/* Display any classifications/tags if available */}
                      {presentation.video_source_id && 
                       presentationClassifications[presentation.video_source_id] && 
                       presentationClassifications[presentation.video_source_id].length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {presentationClassifications[presentation.video_source_id]
                            .slice(0, 2) // Limit to first 2 tags
                            .map(subjectId => {
                              const subject = subjectClassifications.find(s => s.id === subjectId);
                              return subject ? (
                                <span 
                                  key={subjectId}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600"
                                >
                                  {subject.short_name || 
                                    subject.subject
                                      .replace(/^\d+[.\s_-]*\s*/g, '')  // Remove number prefixes
                                      .replace(/^[_-]+/, '')  // Remove leading underscores or dashes
                                      .replace(/^\w/, (c: string) => c.toUpperCase())  // Capitalize first letter
                                      .substring(0, 12) // Limit length
                                  }
                                </span>
                              ) : null;
                            })}
                          {presentationClassifications[presentation.video_source_id].length > 2 && (
                            <span className="text-xs text-gray-500">+{presentationClassifications[presentation.video_source_id].length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      
        {/* Right Content Area */}
        <div className="lg:w-2/3">
          {/* Video Title and Player */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {selectedPresentation?.expert_document?.title ? (
              <Collapsible 
                open={videoSectionOpen} 
                onOpenChange={(open) => {
                  setVideoSectionOpen(open);
                  // If opening this section and asset is being viewed, collapse asset view
                  if (open && assetViewMode) {
                    setAssetViewMode(false);
                  }
                }}
              >
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <CollapsibleTrigger className="flex w-full">
                    <div className="flex justify-between w-full items-center">
                      <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                        {videoSectionOpen ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                        {selectedPresentation.expert_document.title}
                      </h2>
                      {!videoSectionOpen && selectedPresentation.video_source && (
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-600">
                          Video
                        </span>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600">
                      {selectedPresentation.expert_names ? (
                        <button
                          onClick={() => {
                            // If we have multiple experts, show the bio of the primary one
                            if (selectedPresentation.expert?.id) {
                              openExpertProfile(selectedPresentation.expert.id);
                            } else if (selectedPresentation.experts && selectedPresentation.experts.length > 0 && selectedPresentation.experts[0].id) {
                              openExpertProfile(selectedPresentation.experts[0].id);
                            } else {
                              // If no expert ID is available, just show the bio with the name
                              fetchExpertBio();
                            }
                          }}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-blue-600 hover:underline">{selectedPresentation.expert_names}</span>
                        </button>
                      ) : selectedPresentation.expert?.full_name && (
                        <button 
                          onClick={() => {
                            if (selectedPresentation.expert?.id) {
                              openExpertProfile(selectedPresentation.expert.id);
                            } else {
                              fetchExpertBio(selectedPresentation.expert?.id);
                            }
                          }}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="hover:underline">{selectedPresentation.expert.full_name}</span>
                        </button>
                      )}
                      
                      {selectedPresentation.video_source?.modified_at && (
                        <div className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{new Date(selectedPresentation.video_source.modified_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long'
                          })}</span>
                        </div>
                      )}
                      
                      {selectedPresentation.high_level_folder?.name && (
                        <div className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="text-blue-600 font-medium">{selectedPresentation.high_level_folder.name}</span>
                          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="inline h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {getVideoDuration(selectedPresentation.video_source)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
                
                <CollapsibleContent>
                  {selectedPresentation?.video_source?.web_view_link ? (
                    <div className="aspect-video bg-black">
                      <iframe 
                        src={`https://drive.google.com/file/d/${extractDriveId(selectedPresentation.video_source.web_view_link)}/preview`}
                        className="w-full h-full"
                        title="Video Player"
                        allow="autoplay"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <p className="text-gray-500">
                        No video available for this presentation
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ) : selectedPresentation ? (
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500">
                  No video information available for this presentation
                </p>
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500">
                  Select a presentation to view video
                </p>
              </div>
            )}
          </div>
          
          {/* Content moved up - Now part of the right area */}
          {selectedPresentation?.expert_document?.processed_content ? (
            <div className="bg-white rounded-lg shadow mt-4">
              <JsonFormatter 
                data={selectedPresentation.expert_document.processed_content} 
                fontSize="0.875rem"
              />
            </div>
          ) : selectedPresentation ? (
            <div className="bg-white rounded-lg shadow p-4 mt-4">
              <h2 className="text-xl font-semibold text-blue-700 mb-3">
                Video Summary
              </h2>
              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-blue-700">No processed content available for this video.</p>
                {selectedPresentation.video_source?.metadata ? (
                  <div className="mt-4">
                    <p className="text-sm text-blue-600 mb-2">Video metadata:</p>
                    <JsonFormatter 
                      data={selectedPresentation.video_source.metadata} 
                      fontSize="0.75rem"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic mt-1">No metadata available</p>
                )}
              </div>
            </div>
          ) : null}
          
          {/* Presentation Assets - Moved to the top section */}
          {selectedPresentation && (
            <div className="bg-white rounded-lg shadow mt-4">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h2 className="text-lg font-medium text-gray-900">
                  Presentation Assets 
                  <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-600">
                    {presentationAssets.length} assets
                  </span>
                </h2>
              </div>
              
              <div className="p-4">
                {presentationAssets.length === 0 ? (
                  <p className="text-gray-500">No assets available for this presentation</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {presentationAssets.map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => {
                          // When selecting an asset, collapse other sections if not already collapsed
                          if (!selectedAsset || selectedAsset.id !== asset.id) {
                            setVideoSectionOpen(false);
                          }
                          
                          // Make sure the asset is selected and visible
                          handleAssetSelect(asset);
                        }}
                        onDoubleClick={() => {
                          // Double-click behavior goes directly to asset view
                          setVideoSectionOpen(false);
                          handleAssetSelect(asset);
                          setAssetViewMode(true);
                        }}
                        className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                          selectedAsset?.id === asset.id
                            ? 'bg-blue-50 border-blue-200'
                            : 'hover:bg-gray-50 border-gray-100'
                        }`}
                        title="Click to see summary, double-click to view file"
                      >
                        <div className="flex items-start gap-3">
                          <div className="bg-blue-100 text-blue-800 p-2 rounded">
                            {asset.asset_type === 'document' ? '📄' : 
                             asset.asset_type === 'image' ? '🖼️' : 
                             asset.asset_type === 'video' ? '🎬' : 
                             asset.asset_type === 'audio' ? '🔊' : 
                             asset.asset_type === 'presentation' ? '📊' : 
                             '📎'}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 line-clamp-1">
                              {asset.source_file?.name || 'Unknown Asset'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {asset.asset_role && (
                                <span className="capitalize">{asset.asset_role} • </span>
                              )}
                              {asset.source_file?.mime_type || 'Unknown type'}
                            </p>
                            {asset.user_notes && (
                              <p className="text-xs italic text-gray-600 mt-1">
                                "{asset.user_notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Selected Asset Content or Viewer */}
          {selectedAsset && (
            <div className={`bg-white rounded-lg shadow mt-4 ${assetViewMode ? 'h-[750px] overflow-hidden' : ''}`}>
              <Collapsible 
                open={assetSectionOpen} 
                onOpenChange={(open) => {
                  setAssetSectionOpen(open);
                }}
              >
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <div className="flex justify-between items-center w-full">
                    <h2 className="text-lg font-medium text-gray-900 flex items-center">
                      {assetViewMode && (
                        <button 
                          onClick={() => setAssetViewMode(false)}
                          className="inline-flex items-center justify-center mr-2 text-gray-500 hover:text-gray-700"
                        >
                          <ArrowLeft className="h-5 w-5" />
                          <span className="sr-only">Back</span>
                        </button>
                      )}
                      <CollapsibleTrigger className="flex items-center focus:outline-none">
                        {!assetViewMode && (
                          <>
                            {assetSectionOpen ? <ChevronDown className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 mr-2" />}
                          </>
                        )}
                        {selectedAsset.source_file?.name || 'Selected Asset'}
                      </CollapsibleTrigger>
                    </h2>
                    {selectedAsset.source_file?.web_view_link && (
                      <button
                        onClick={() => {
                          // Toggle asset view mode
                          if (!assetViewMode) {
                            // When entering view mode, collapse all other sections
                            setVideoSectionOpen(false);
                            // Make the asset viewer very prominent
                            setAssetViewMode(true);
                          } else {
                            // When exiting view mode, keep other sections collapsed
                            setAssetViewMode(false);
                          }
                        }}
                        className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >
                        {assetViewMode ? 'Return to Summary' : 'View File'}
                      </button>
                    )}
                  </div>
                </div>
                
                <CollapsibleContent>
                  {/* Asset viewer (expanded in the same panel) */}
                  {assetViewMode && selectedAsset.source_file?.web_view_link ? (
                    <div className="h-[700px]">
                      <iframe 
                        src={`https://drive.google.com/file/d/${extractDriveId(selectedAsset.source_file.web_view_link)}/preview`}
                        className="w-full h-full"
                        title={selectedAsset.source_file.name || 'Asset Preview'}
                        allow="autoplay"
                      />
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:mb-3 prose-li:my-1 prose-ul:ml-4 prose-ul:list-disc prose-ol:ml-4 prose-ol:list-decimal">
                        {selectedAsset.expert_document?.processed_content ? (
                          <div className="p-1">
                            <JsonFormatter 
                              data={selectedAsset.expert_document.processed_content} 
                              fontSize="0.875rem"
                            />
                          </div>
                        ) : (
                          <p>No content available for this asset</p>
                        )}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}