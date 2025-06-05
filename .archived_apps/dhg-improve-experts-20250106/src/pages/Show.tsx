import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FileViewer } from '@/components/FileViewer';
import type { FileNode } from '@/components/FileTree';
import { getFileType, FILE_TYPE_COLORS } from '@/components/FileTree';

// Define types for data models
type Presentation = {
  id: string;
  title: string | null;
  filename: string;
  folder_path: string;
  presenter_name: string | null;
  recorded_date: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  main_video_id: string | null;
  metadata: any | null;
  is_public: boolean | null;
  view_count: number | null;
  sourceFile?: SourceGoogle | null;
  relatedPresentations?: Presentation[];
  assets?: PresentationAsset[];
  tags?: PresentationTag[];
  themes?: PresentationTheme[];
};

type PresentationAsset = {
  id: string;
  presentation_id: string | null;
  source_id: string | null;
  expert_document_id: string | null;
  asset_type_id: string | null;
  asset_type: 'document' | 'video' | 'audio' | 'image' | 'presentation' | null;
  asset_role: 'reference' | 'supporting' | 'related' | 'source' | null;
  importance_level: number | null;
  timestamp_start: number | null;
  timestamp_end: number | null;
  user_notes: string | null;
  metadata: any | null;
  sourceFile?: SourceGoogle | null;
  expertDocument?: ExpertDocument | null;
};

type PresentationTag = {
  id: string;
  name: string;
  color: string | null;
};

type PresentationTheme = {
  id: string;
  name: string;
  description: string | null;
  ai_confidence: number | null;
};

type SourceGoogle = {
  id: string;
  name: string;
  drive_id: string;
  mime_type: string | null;
  web_view_link: string | null;
  is_folder: boolean | null;
  folder_path: string | null;
  file_extension: string | null;
  metadata: any | null;
};

type ExpertDocument = {
  id: string;
  source_id: string;
  document_type_id: string | null;
  raw_content: string | null;
  processed_content: any | null;
  processing_status: string | null;
  summary_complete: boolean | null;
  key_insights: string[] | null;
  topics: string[] | null;
};

function Show() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedPresentations, setRelatedPresentations] = useState<Presentation[]>([]);
  const [assets, setAssets] = useState<PresentationAsset[]>([]);
  const [tags, setTags] = useState<PresentationTag[]>([]);
  const [themes, setThemes] = useState<PresentationTheme[]>([]);

  const presentationId = searchParams.get('id');

  useEffect(() => {
    // Since we don't have real data yet, let's mock up a presentation
    if (!presentationId) {
      // Set a default mock presentation if no ID is provided
      const mockPresentation: Presentation = {
        id: 'mock-presentation-1',
        title: 'Introduction to AI Ethics',
        filename: 'intro-ai-ethics.mp4',
        folder_path: '/presentations/ethics',
        presenter_name: 'Dr. Jane Smith',
        recorded_date: '2024-03-15',
        duration_seconds: 2145, // 35:45
        transcript: 'This is a mock transcript of the presentation about AI ethics...',
        main_video_id: 'video-1',
        metadata: { keywords: ['AI', 'ethics', 'introduction'] },
        is_public: true,
        view_count: 126,
        sourceFile: {
          id: 'video-1',
          name: 'intro-ai-ethics.mp4',
          drive_id: '1OnhPxKj1TizBUmrCCjGkNn30qHyqbnst',
          mime_type: 'video/mp4',
          web_view_link: 'https://drive.google.com/file/d/1OnhPxKj1TizBUmrCCjGkNn30qHyqbnst/view?usp=drivesdk',
          is_folder: false,
          folder_path: '/presentations/ethics',
          file_extension: 'mp4',
          metadata: {
            size: 12345678
          }
        }
      };

      // Mock related presentations
      const mockRelatedPresentations: Presentation[] = [
        {
          id: 'mock-presentation-2',
          title: 'AI Bias in Machine Learning Models',
          filename: 'ai-bias.mp4',
          folder_path: '/presentations/ethics',
          presenter_name: 'Dr. Michael Chen',
          recorded_date: '2024-03-20',
          duration_seconds: 1830, // 30:30
          transcript: null,
          main_video_id: 'video-2',
          metadata: null,
          is_public: true,
          view_count: 87,
          sourceFile: {
            id: 'video-2',
            name: 'ai-bias.mp4',
            drive_id: '1OnhPxKj1TizBUmrCCjGkNn30qHyqbnst',
            mime_type: 'video/mp4',
            web_view_link: 'https://drive.google.com/file/d/1OnhPxKj1TizBUmrCCjGkNn30qHyqbnst/view?usp=drivesdk',
            is_folder: false,
            folder_path: '/presentations/ethics',
            file_extension: 'mp4',
            metadata: {
              size: 12345678
            }
          }
        },
        {
          id: 'mock-presentation-3',
          title: 'Regulatory Frameworks for AI Systems',
          filename: 'regulatory-frameworks.mp4',
          folder_path: '/presentations/legal',
          presenter_name: 'Sarah Johnson, J.D.',
          recorded_date: '2024-02-28',
          duration_seconds: 2760, // 46:00
          transcript: null,
          main_video_id: 'video-3',
          metadata: null,
          is_public: true,
          view_count: 53,
          sourceFile: {
            id: 'video-3',
            name: 'regulatory-frameworks.mp4',
            drive_id: '1OnhPxKj1TizBUmrCCjGkNn30qHyqbnst',
            mime_type: 'video/mp4',
            web_view_link: 'https://drive.google.com/file/d/1OnhPxKj1TizBUmrCCjGkNn30qHyqbnst/view?usp=drivesdk',
            is_folder: false,
            folder_path: '/presentations/legal',
            file_extension: 'mp4',
            metadata: {
              size: 12345678
            }
          }
        }
      ];

      // Mock assets (supporting documents)
      const mockAssets: PresentationAsset[] = [
        {
          id: 'asset-1',
          presentation_id: 'mock-presentation-1',
          source_id: 'doc-1',
          expert_document_id: 'expert-doc-1',
          asset_type_id: null,
          asset_type: 'document',
          asset_role: 'reference',
          importance_level: 5,
          timestamp_start: null,
          timestamp_end: null,
          user_notes: 'Key reference paper cited in the presentation',
          metadata: null,
          sourceFile: {
            id: 'doc-1',
            name: 'AI Ethics Framework.pdf',
            drive_id: 'mock-drive-id-4',
            mime_type: 'application/pdf',
            web_view_link: 'https://drive.google.com/file/d/1JbV6IWzNY6hJXnSrMM8RwOL9ZyVMOCiA/preview',
            is_folder: false,
            folder_path: '/documents/research',
            file_extension: 'pdf',
            metadata: {}
          },
          expertDocument: {
            id: 'expert-doc-1',
            source_id: 'doc-1',
            document_type_id: 'pdf',
            raw_content: null,
            processed_content: {
              summary: "This comprehensive framework outlines ethical considerations for AI development, including fairness, transparency, accountability, and privacy. It provides specific guidelines for researchers and developers to follow throughout the AI lifecycle.",
              key_points: [
                "AI systems should be designed to be fair and avoid perpetuating biases",
                "Transparency in how AI systems make decisions is essential",
                "Clear accountability structures must be established for AI outcomes",
                "Privacy considerations should be built into AI systems from the start"
              ]
            },
            processing_status: 'completed',
            summary_complete: true,
            key_insights: [
              "Establish ethical review boards for AI projects",
              "Conduct regular bias audits of AI systems",
              "Document decision-making processes for transparency"
            ],
            topics: ['AI Ethics', 'Fairness', 'Transparency', 'Accountability']
          }
        },
        {
          id: 'asset-2',
          presentation_id: 'mock-presentation-1',
          source_id: 'doc-2',
          expert_document_id: 'expert-doc-2',
          asset_type_id: null,
          asset_type: 'document',
          asset_role: 'supporting',
          importance_level: 3,
          timestamp_start: null,
          timestamp_end: null,
          user_notes: 'Supplementary reading on fairness metrics',
          metadata: null,
          sourceFile: {
            id: 'doc-2',
            name: 'Fairness Metrics in ML.docx',
            drive_id: 'mock-drive-id-5',
            mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            web_view_link: 'https://drive.google.com/file/d/1JvP1IwzNY6hJXASrMM8RwOL9ZyVMOCiA/preview',
            is_folder: false,
            folder_path: '/documents/research',
            file_extension: 'docx',
            metadata: {}
          },
          expertDocument: {
            id: 'expert-doc-2',
            source_id: 'doc-2',
            document_type_id: 'docx',
            raw_content: null,
            processed_content: {
              summary: "This document reviews various fairness metrics used in machine learning, including demographic parity, equal opportunity, and counterfactual fairness. It analyzes the tradeoffs between different metrics and when each is most appropriate to use.",
              key_points: [
                "Many fairness metrics cannot be simultaneously satisfied",
                "Context determines which fairness metric is most appropriate",
                "Statistical measures of fairness have important limitations",
                "Fairness should be considered throughout the ML pipeline"
              ]
            },
            processing_status: 'completed',
            summary_complete: true,
            key_insights: [
              "No universal fairness metric exists for all contexts",
              "Stakeholder involvement is crucial for determining appropriate fairness metrics",
              "Regular auditing using multiple metrics provides more complete fairness assessment"
            ],
            topics: ['Machine Learning', 'Fairness Metrics', 'Algorithmic Bias', 'Ethics']
          }
        },
        {
          id: 'asset-3',
          presentation_id: 'mock-presentation-1',
          source_id: 'slide-1',
          expert_document_id: 'expert-doc-3',
          asset_type_id: null,
          asset_type: 'presentation',
          asset_role: 'source',
          importance_level: 5,
          timestamp_start: null,
          timestamp_end: null,
          user_notes: 'Slides used in the presentation',
          metadata: null,
          sourceFile: {
            id: 'slide-1',
            name: 'AI Ethics Presentation Slides.pptx',
            drive_id: 'mock-drive-id-6',
            mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            web_view_link: 'https://drive.google.com/file/d/1JpV6IwzNY6hJXnSrMM8RwOL9ZyVMOCiA/preview',
            is_folder: false,
            folder_path: '/presentations/slides',
            file_extension: 'pptx',
            metadata: {}
          },
          expertDocument: {
            id: 'expert-doc-3',
            source_id: 'slide-1',
            document_type_id: 'pptx',
            raw_content: null,
            processed_content: {
              slide_contents: [
                "Title: Introduction to AI Ethics - Dr. Jane Smith",
                "Agenda: Key ethical principles, Current challenges, Case studies, Best practices",
                "Ethical Principles: Fairness, Transparency, Accountability, Privacy, Safety",
                "Challenges in AI Ethics: Bias, Black box algorithms, Privacy concerns",
                "Case Studies: Facial recognition bias, Hiring algorithms, Healthcare predictive models",
                "Best Practices: Diverse teams, Regular audits, Stakeholder engagement"
              ]
            },
            processing_status: 'completed',
            summary_complete: true,
            key_insights: [
              "The presentation covers 5 core ethical principles for AI",
              "Real-world case studies illustrate ethical failures",
              "Best practices focus on proactive measures rather than remediation"
            ],
            topics: ['AI Ethics', 'Presentation', 'Best Practices', 'Case Studies']
          }
        }
      ];

      // Mock tags
      const mockTags: PresentationTag[] = [
        { id: 'tag-1', name: 'AI Ethics', color: '#3498db' },
        { id: 'tag-2', name: 'Fairness', color: '#2ecc71' },
        { id: 'tag-3', name: 'Research', color: '#9b59b6' }
      ];

      // Mock themes
      const mockThemes: PresentationTheme[] = [
        { 
          id: 'theme-1', 
          name: 'Ethical AI Development', 
          description: 'Approaches and methodologies for developing AI systems that adhere to ethical principles',
          ai_confidence: 0.92
        },
        { 
          id: 'theme-2', 
          name: 'Fairness in Machine Learning', 
          description: 'Methods for ensuring machine learning systems produce fair and unbiased outcomes',
          ai_confidence: 0.87
        }
      ];

      setPresentation(mockPresentation);
      setRelatedPresentations(mockRelatedPresentations);
      setAssets(mockAssets);
      setTags(mockTags);
      setThemes(mockThemes);
      setLoading(false);

      // Set the main video as the default selected asset
      if (mockPresentation.sourceFile) {
        // Convert to FileNode format for FileViewer
        const fileNode: FileNode = {
          id: mockPresentation.sourceFile.id,
          name: mockPresentation.sourceFile.name,
          mime_type: mockPresentation.sourceFile.mime_type || '',
          web_view_link: mockPresentation.sourceFile.web_view_link,
          drive_id: mockPresentation.sourceFile.drive_id,
          metadata: mockPresentation.sourceFile.metadata
        };
        setSelectedAsset(fileNode);
      }
    } else {
      // In a real implementation, we would fetch actual data from Supabase here
      // For now, we'll use the mock data regardless of the ID
      // This would be replaced with real data fetching in production
      
      // fetchPresentation(presentationId);
    }
  }, [presentationId]);

  // Function to handle asset selection
  const handleAssetSelect = (asset: PresentationAsset) => {
    if (asset.sourceFile) {
      // Convert to FileNode format for FileViewer
      const fileNode: FileNode = {
        id: asset.sourceFile.id,
        name: asset.sourceFile.name,
        mime_type: asset.sourceFile.mime_type || '',
        web_view_link: asset.sourceFile.web_view_link,
        drive_id: asset.sourceFile.drive_id,
        metadata: asset.sourceFile.metadata,
        expertDocument: asset.expertDocument
      };
      setSelectedAsset(fileNode);
    }
  };

  // Function to handle related presentation selection
  const handleRelatedPresentationSelect = (relatedPresentation: Presentation) => {
    if (relatedPresentation.sourceFile) {
      // Convert to FileNode format for FileViewer
      const fileNode: FileNode = {
        id: relatedPresentation.sourceFile.id,
        name: relatedPresentation.sourceFile.name,
        mime_type: relatedPresentation.sourceFile.mime_type || '',
        web_view_link: relatedPresentation.sourceFile.web_view_link,
        drive_id: relatedPresentation.sourceFile.drive_id,
        metadata: relatedPresentation.sourceFile.metadata
      };
      setSelectedAsset(fileNode);
    }
    
    // In a real implementation, we would update the URL and fetch the new presentation
    // setSearchParams({ id: relatedPresentation.id });
  };

  // Helper function to format duration
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'Unknown';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-screen">
        <div className="text-blue-500 animate-pulse text-xl">Loading presentation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          No presentation found. Please select a valid presentation.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Presentation Header */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{presentation.title || presentation.filename}</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map(tag => (
              <span 
                key={tag.id} 
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: tag.color || '#e2e8f0', color: '#ffffff' }}
              >
                {tag.name}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-6 text-gray-600">
            {presentation.presenter_name && (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{presentation.presenter_name}</span>
              </div>
            )}
            {presentation.recorded_date && (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{new Date(presentation.recorded_date).toLocaleDateString()}</span>
              </div>
            )}
            {presentation.duration_seconds && (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatDuration(presentation.duration_seconds)}</span>
              </div>
            )}
            {presentation.view_count !== null && (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>{presentation.view_count} views</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Assets and Supporting Materials */}
          <div className="lg:col-span-1">
            {/* Supporting Documents */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Supporting Materials</h2>
              
              <div className="space-y-3">
                {assets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => handleAssetSelect(asset)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      selectedAsset?.id === asset.sourceFile?.id 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'hover:bg-gray-50 border border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`${FILE_TYPE_COLORS[getFileType(asset.sourceFile?.mime_type || '')].icon.bg} 
                        ${FILE_TYPE_COLORS[getFileType(asset.sourceFile?.mime_type || '')].icon.text} p-2 rounded`}
                      >
                        {FILE_TYPE_COLORS[getFileType(asset.sourceFile?.mime_type || '')].emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{asset.sourceFile?.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {asset.asset_role && asset.asset_role.charAt(0).toUpperCase() + asset.asset_role.slice(1)} • {getFileType(asset.sourceFile?.mime_type || '')}
                        </p>
                        {asset.user_notes && (
                          <p className="text-sm text-gray-600 mt-2 italic">"{asset.user_notes}"</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {asset.importance_level && (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                            asset.importance_level >= 4 ? 'bg-blue-100 text-blue-800' :
                            asset.importance_level >= 2 ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-50 text-gray-600'
                          }`}>
                            {asset.importance_level}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Themes */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Key Themes</h2>
              <div className="space-y-4">
                {themes.map(theme => (
                  <div key={theme.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">{theme.name}</h3>
                      {theme.ai_confidence && (
                        <span className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded">
                          {Math.round(theme.ai_confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    {theme.description && (
                      <p className="text-sm text-gray-600">{theme.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area - Video/Document Viewer */}
          <div className="lg:col-span-2">
            {/* Viewer */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
              {selectedAsset && selectedAsset.mime_type?.includes('video') ? (
                <div className="aspect-video bg-black">
                  <iframe 
                    src={`https://drive.google.com/file/d/${selectedAsset.drive_id}/preview`}
                    className="w-full h-full rounded-lg"
                    title="Video Preview"
                    allow="autoplay"
                  />
                </div>
              ) : selectedAsset ? (
                <div className="h-[60vh]">
                  <FileViewer file={selectedAsset} />
                </div>
              ) : (
                <div className="h-[60vh] flex items-center justify-center text-gray-500">
                  Select a file to view
                </div>
              )}
            </div>

            {/* Transcript or Summary Section */}
            {presentation.transcript && (
              <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Transcript</h2>
                <div className="max-h-80 overflow-y-auto prose prose-sm">
                  <p className="whitespace-pre-wrap text-gray-700">{presentation.transcript}</p>
                </div>
              </div>
            )}

            {/* Related Presentations */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Related Presentations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedPresentations.map(relatedPres => (
                  <button
                    key={relatedPres.id}
                    onClick={() => handleRelatedPresentationSelect(relatedPres)}
                    className="text-left border border-gray-100 hover:border-gray-200 rounded-lg overflow-hidden transition hover:shadow-md"
                  >
                    <div className="aspect-video bg-gray-100 relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 line-clamp-1">{relatedPres.title || relatedPres.filename}</h3>
                      <div className="flex gap-3 text-xs text-gray-500 mt-1">
                        {relatedPres.presenter_name && (
                          <span>{relatedPres.presenter_name}</span>
                        )}
                        {relatedPres.duration_seconds && (
                          <span>{formatDuration(relatedPres.duration_seconds)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Show;