import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase-adapter';
// @ts-ignore - This import will work at runtime
import { Database } from '../../../supabase/types';

// Define key types
type Presentation = Database['public']['Tables']['presentations']['Row'] & {
  title?: string | null;
  expert_document?: ExpertDocument | null;
  video_source?: SourceGoogle | null;
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
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectClassifications, setSubjectClassifications] = useState<SubjectClassification[]>([]);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PresentationAsset | null>(null);
  const [presentationAssets, setPresentationAssets] = useState<PresentationAsset[]>([]);

  // Fetch presentations data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch presentations with their video sources and expert documents
        const { data: presentationsData, error: presentationsError } = await supabase
          .from('presentations')
          .select(`
            id, 
            video_source_id,
            expert_document_id,
            web_view_link,
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
              document_type_id
            )
          `)
          .not('video_source_id', 'is', null);

        if (presentationsError) {
          throw new Error(`Error fetching presentations: ${presentationsError.message}`);
        }

        // Fetch all subject classifications for the filter
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('subject_classifications')
          .select('*')
          .order('subject');

        if (subjectsError) {
          throw new Error(`Error fetching subject classifications: ${subjectsError.message}`);
        }

        setSubjectClassifications(subjectsData || []);
        setPresentations(presentationsData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

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
              document_type_id
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
        // Get all video source IDs from presentations
        const videoSourceIds = presentations
          .filter(p => p.video_source_id)
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
        p => p.expert_document?.title?.toLowerCase().includes(query) || 
             p.video_source?.name?.toLowerCase().includes(query)
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
    
    return filtered;
  }, [presentations, searchQuery, selectedSubjects, presentationClassifications]);

  // Format and display processed content (JSON or markdown)
  const formatContent = (content: any): string => {
    if (!content) return 'No content available';
    
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object') {
      // Check if there's a summary field
      if (content.summary) {
        return content.summary;
      }
      
      // Otherwise stringify the JSON
      return JSON.stringify(content, null, 2);
    }
    
    return 'Content format not supported';
  };

  // Toggle subject filter
  const toggleSubject = (subjectId: string) => {
    if (selectedSubjects.includes(subjectId)) {
      setSelectedSubjects(selectedSubjects.filter(id => id !== subjectId));
    } else {
      setSelectedSubjects([...selectedSubjects, subjectId]);
    }
  };

  // Handle presentation selection
  const handlePresentationSelect = (presentation: Presentation) => {
    setSelectedPresentation(presentation);
    setSelectedAsset(null);
  };

  // Add state for showing asset viewer
  const [showAssetViewer, setShowAssetViewer] = useState<boolean>(false);
  
  // Handle asset selection
  const handleAssetSelect = (asset: PresentationAsset) => {
    setSelectedAsset(asset);
    setShowAssetViewer(false);
  };
  
  // Handle asset double click to show the viewer
  const handleAssetDoubleClick = (asset: PresentationAsset) => {
    setSelectedAsset(asset);
    setShowAssetViewer(true);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left sidebar - Presentations and Filters */}
        <div className="lg:w-1/3 space-y-6">
          {/* Search Box */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="mb-4">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Presentations
              </label>
              <input
                type="text"
                id="search"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Search titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Subject Classification Pills */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Filter by Subject</h2>
            <div className="flex flex-wrap gap-2">
              {subjectClassifications.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => toggleSubject(subject.id)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedSubjects.includes(subject.id)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {subject.short_name || subject.subject}
                </button>
              ))}
            </div>
          </div>

          {/* Presentations List */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Presentations</h2>
            {loading ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-600 p-3 rounded">
                Error: {error}
              </div>
            ) : filteredPresentations.length === 0 ? (
              <div className="text-gray-500 text-center py-4">
                No presentations found
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
                    <div className="text-sm text-gray-500 mt-1">
                      {presentation.video_source?.name && (
                        <span className="inline-block mr-2">
                          {presentation.video_source.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="lg:w-2/3 space-y-6">
          {/* Video Player */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {selectedPresentation?.web_view_link ? (
              <div className="aspect-video bg-black">
                <iframe 
                  src={selectedPresentation.web_view_link}
                  className="w-full h-full"
                  title="Video Player"
                  allow="autoplay"
                />
              </div>
            ) : selectedPresentation ? (
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500">
                  No video available for this presentation
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

          {/* Video Summary */}
          {selectedPresentation?.expert_document?.processed_content && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                Video Summary
              </h2>
              <div className="prose prose-sm max-w-none">
                <p>{formatContent(selectedPresentation.expert_document.processed_content)}</p>
              </div>
            </div>
          )}

          {/* Selected Asset Content or Viewer */}
          {selectedAsset && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-medium text-gray-900">
                  {selectedAsset.source_file?.name || 'Selected Asset'}
                </h2>
                {selectedAsset.source_file?.web_view_link && (
                  <button
                    onClick={() => setShowAssetViewer(!showAssetViewer)}
                    className="text-sm px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                  >
                    {showAssetViewer ? 'Show Summary' : 'View File'}
                  </button>
                )}
              </div>
              
              {showAssetViewer && selectedAsset.source_file?.web_view_link ? (
                <div className="h-[400px] border rounded overflow-hidden">
                  <iframe 
                    src={selectedAsset.source_file.web_view_link}
                    className="w-full h-full"
                    title={selectedAsset.source_file.name || 'Asset Preview'}
                  />
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  {selectedAsset.expert_document?.processed_content ? (
                    <p>{formatContent(selectedAsset.expert_document.processed_content)}</p>
                  ) : (
                    <p>No content available for this asset</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Presentation Assets */}
          {selectedPresentation && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                Presentation Assets
              </h2>
              {presentationAssets.length === 0 ? (
                <p className="text-gray-500">No assets available for this presentation</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {presentationAssets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => handleAssetSelect(asset)}
                      onDoubleClick={() => handleAssetDoubleClick(asset)}
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
          )}
        </div>
      </div>
    </div>
  );
}