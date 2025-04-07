import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';

interface PresentationReviewOptions {
  presentationId?: string;
  expertId?: string;
  status?: string;
  limit?: number;
  createAssets?: boolean;
  folderId?: string;
}

interface ProfessionalDocumentsCheckOptions {
  presentationId?: string;
  expertId?: string;
  documentType?: string;
  limit?: number;
  missingOnly?: boolean;
}

interface ProfessionalDocument {
  id: string;
  type: string;
  status: 'available' | 'missing';
  created_at?: string;
  updated_at?: string;
}

interface PresentationWithProfessionalDocs {
  id: string;
  title: string;
  expert_id?: string;
  expert_name?: string;
  cv?: ProfessionalDocument;
  bio?: ProfessionalDocument;
  announcement?: ProfessionalDocument;
  hasAnyProfessionalDocument: boolean;
}

interface PresentationAsset {
  id: string;
  type: string;
  status: string;
  file_path?: string;
  justCreated?: boolean;
}

interface ExpertDocument {
  id: string;
  document_type: string;
  document_type_id: string;
  document_types?: {name: string};
  has_raw_content: boolean;
  has_processed_content: boolean;
  raw_content_preview?: string;
  linked_through_asset?: string | null;
  asset_type?: string | null;
  created_at: string;
  updated_at: string;
  ai_summary_status?: 'pending' | 'processing' | 'completed' | 'error';
}

interface PresentationReview {
  id: string;
  title: string;
  expert_id?: string;
  expert_name?: string;
  created_at?: string;
  updated_at?: string;
  status: string;
  assets: PresentationAsset[];
  expert_documents: ExpertDocument[];
  next_steps: string[];
  has_raw_content: boolean;
}

interface PresentationWithTranscript {
  id: string;
  title: string;
  expert_id: string;
  transcript: string;
}

interface SaveSummaryOptions {
  expertId: string;
  presentationId: string;
  summary: string;
  existingSummaryId?: string;
}

interface SaveExpertBioOptions {
  expertId: string;
  bio: string;
  existingBioId?: string;
}

interface ExpertDetails {
  id: string;
  name: string;
}

interface ExpertSourceContent {
  transcript: string;
}

export class PresentationService {
  private static instance: PresentationService;
  private _supabaseClient: any;
  
  private constructor() {
    this._supabaseClient = SupabaseClientService.getInstance().getClient();
  }
  
  public static getInstance(): PresentationService {
    if (!PresentationService.instance) {
      PresentationService.instance = new PresentationService();
    }
    return PresentationService.instance;
  }
  
  /**
   * Get the Supabase client instance
   */
  get supabaseClient(): any {
    return this._supabaseClient;
  }
  
  /**
   * Get presentation details including its transcript
   */
  public async getPresentationWithTranscript(presentationId: string): Promise<PresentationWithTranscript | null> {
    try {
      // Get the presentation
      const { data: presentation, error } = await this._supabaseClient
        .from('presentations')
        .select('id, title, expert_id')
        .eq('id', presentationId)
        .single();
      
      if (error || !presentation) {
        Logger.error('Error fetching presentation:', error);
        return null;
      }
      
      // Get the transcript asset
      const { data: assets, error: assetsError } = await this.supabaseClient
        .from('presentation_assets')
        .select('file_path')
        .eq('presentation_id', presentationId)
        .eq('asset_type', 'transcript');
      
      if (assetsError) {
        Logger.error('Error fetching transcript asset:', assetsError);
        return null;
      }
      
      if (!assets || assets.length === 0 || !assets[0].file_path) {
        Logger.error('Transcript not found for presentation');
        return null;
      }
      
      // Read the transcript file
      const transcriptPath = assets[0].file_path;
      
      if (!fs.existsSync(transcriptPath)) {
        Logger.error(`Transcript file not found at path: ${transcriptPath}`);
        return null;
      }
      
      const transcript = fs.readFileSync(transcriptPath, 'utf8');
      
      return {
        id: presentation.id,
        title: presentation.title,
        expert_id: presentation.expert_id,
        transcript
      };
    } catch (error) {
      Logger.error('Error getting presentation with transcript:', error);
      return null;
    }
  }
  
  /**
   * Get existing summary document for an expert
   */
  public async getExistingSummary(expertId: string) {
    try {
      // Get document type ID for summary
      const { data: docType, error: docTypeError } = await this._supabaseClient
        .from('document_types')
        .select('id')
        .eq('document_type', 'summary')
        .single();
      
      if (docTypeError || !docType) {
        // If not found, it's not necessarily an error - there may not be a summary type yet
        if (docTypeError && docTypeError.code === 'PGRST116') {
          Logger.debug('No summary document type found, returning null');
          return null;
        }
        
        Logger.error('Error fetching summary document type:', docTypeError);
        return null;
      }
      
      // Get existing summary document
      const { data: summary, error: summaryError } = await this._supabaseClient
        .from('expert_documents')
        .select('id, raw_content, processed_content')
        .eq('expert_id', expertId)
        .eq('document_type_id', docType.id)
        .single();
      
      if (summaryError) {
        Logger.error('Error fetching existing summary:', summaryError);
        return null;
      }
      
      return summary;
    } catch (error) {
      Logger.error('Error getting existing summary:', error);
      return null;
    }
  }
  
  /**
   * Save or update a summary document
   */
  public async saveSummary(options: SaveSummaryOptions): Promise<boolean> {
    try {
      // Get document type ID for summary or create it if doesn't exist
      let documentTypeId = null;
      
      const { data: docType, error: docTypeError } = await this._supabaseClient
        .from('document_types')
        .select('id')
        .eq('document_type', 'summary')
        .single();
      
      if (docTypeError) {
        if (docTypeError.code === 'PGRST116') {
          // Create the summary document type if it doesn't exist
          Logger.info('Creating summary document type as it does not exist');
          const { data: newDocType, error: createError } = await this._supabaseClient
            .from('document_types')
            .insert({
              document_type: 'summary',
              category: 'Presentation',
              is_ai_generated: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();
            
          if (createError || !newDocType) {
            Logger.error('Error creating summary document type:', createError);
            return false;
          }
          
          documentTypeId = newDocType.id;
          Logger.info(`Created summary document type with ID: ${documentTypeId}`);
        } else {
          Logger.error('Error fetching summary document type:', docTypeError);
          return false;
        }
      } else {
        documentTypeId = docType.id;
      }
      
      if (options.existingSummaryId) {
        // Update existing summary
        const { error: updateError } = await this._supabaseClient
          .from('expert_documents')
          .update({
            processed_content: options.summary,
            ai_summary_status: 'completed', // Set the status to completed
            updated_at: new Date().toISOString()
          })
          .eq('id', options.existingSummaryId);
        
        if (updateError) {
          Logger.error('Error updating summary:', updateError);
          
          // Update status to error
          await this.updateAiSummaryStatus(options.existingSummaryId, 'error');
          return false;
        }
      } else {
        // Create new summary document
        const { data: newDocument, error: insertError } = await this._supabaseClient
          .from('expert_documents')
          .insert({
            expert_id: options.expertId,
            document_type_id: documentTypeId,
            processed_content: options.summary,
            ai_summary_status: 'completed', // Set the status to completed
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
        
        if (insertError || !newDocument) {
          Logger.error('Error creating summary:', insertError);
          return false;
        }
        
        // Associate summary with presentation in presentation_assets
        const { error: assetError } = await this._supabaseClient
          .from('presentation_assets')
          .insert({
            presentation_id: options.presentationId,
            asset_type: 'summary',
            expert_document_id: newDocument.id, // Link to the new expert document
            created_at: new Date().toISOString()
          });
        
        if (assetError) {
          Logger.error('Error creating presentation asset for summary:', assetError);
          // Continue anyway as the document was created
        }
      }
      
      Logger.info(`Successfully saved summary for presentation ${options.presentationId}`);
      return true;
    } catch (error) {
      Logger.error('Error saving summary:', error);
      return false;
    }
  }
  
  /**
   * Get expert details by ID
   */
  public async getExpertDetails(expertId: string): Promise<ExpertDetails | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('experts')
        .select('id, name')
        .eq('id', expertId)
        .single();
      
      if (error || !data) {
        Logger.error('Error fetching expert details:', error);
        return null;
      }
      
      return {
        id: data.id,
        name: data.name,
      };
    } catch (error) {
      Logger.error('Error getting expert details:', error);
      return null;
    }
  }
  
  /**
   * Get expert source content for bio generation
   */
  public async getExpertSourceContent(
    expertId: string,
    presentationId?: string
  ): Promise<ExpertSourceContent | null> {
    try {
      // Get presentations by the expert
      let presentationsQuery = this.supabaseClient
        .from('presentations')
        .select('id')
        .eq('expert_id', expertId);
      
      if (presentationId) {
        presentationsQuery = presentationsQuery.eq('id', presentationId);
      } else {
        // Get the most recent presentation if no specific ID provided
        presentationsQuery = presentationsQuery.order('created_at', { ascending: false }).limit(1);
      }
      
      const { data: presentations, error: presentationsError } = await presentationsQuery;
      
      if (presentationsError || !presentations || presentations.length === 0) {
        Logger.error('Error fetching presentations for expert:', presentationsError);
        return null;
      }
      
      // Get transcript for the presentation
      const selectedPresentationId = presentations[0].id;
      const { data: assets, error: assetsError } = await this.supabaseClient
        .from('presentation_assets')
        .select('file_path')
        .eq('presentation_id', selectedPresentationId)
        .eq('asset_type', 'transcript');
      
      if (assetsError || !assets || assets.length === 0 || !assets[0].file_path) {
        Logger.error('Transcript not found for presentation');
        return null;
      }
      
      // Read the transcript file
      const transcriptPath = assets[0].file_path;
      
      if (!fs.existsSync(transcriptPath)) {
        Logger.error(`Transcript file not found at path: ${transcriptPath}`);
        return null;
      }
      
      const transcript = fs.readFileSync(transcriptPath, 'utf8');
      
      return {
        transcript
      };
    } catch (error) {
      Logger.error('Error getting expert source content:', error);
      return null;
    }
  }
  
  /**
   * Get existing expert bio document
   */
  public async getExistingExpertBio(expertId: string) {
    try {
      // Get document type ID for expert_bio
      const { data: docType, error: docTypeError } = await this.supabaseClient
        .from('document_types')
        .select('id')
        .eq('name', 'expert_bio')
        .single();
      
      if (docTypeError || !docType) {
        Logger.error('Error fetching expert_bio document type:', docTypeError);
        return null;
      }
      
      // Get existing bio document
      const { data: bio, error: bioError } = await this.supabaseClient
        .from('expert_documents')
        .select('id, raw_content, processed_content')
        .eq('expert_id', expertId)
        .eq('document_type_id', docType.id)
        .single();
      
      if (bioError) {
        Logger.error('Error fetching existing expert bio:', bioError);
        return null;
      }
      
      return bio;
    } catch (error) {
      Logger.error('Error getting existing expert bio:', error);
      return null;
    }
  }
  
  /**
   * Save or update an expert bio document
   */
  public async saveExpertBio(options: SaveExpertBioOptions): Promise<boolean> {
    try {
      // Get document type ID for expert_bio
      const { data: docType, error: docTypeError } = await this.supabaseClient
        .from('document_types')
        .select('id')
        .eq('name', 'expert_bio')
        .single();
      
      if (docTypeError || !docType) {
        Logger.error('Error fetching expert_bio document type:', docTypeError);
        return false;
      }
      
      if (options.existingBioId) {
        // Update existing bio
        const { error: updateError } = await this.supabaseClient
          .from('expert_documents')
          .update({
            processed_content: options.bio,
            updated_at: new Date().toISOString()
          })
          .eq('id', options.existingBioId);
        
        if (updateError) {
          Logger.error('Error updating expert bio:', updateError);
          return false;
        }
      } else {
        // Create new bio document
        const { error: insertError } = await this.supabaseClient
          .from('expert_documents')
          .insert({
            expert_id: options.expertId,
            document_type_id: docType.id,
            processed_content: options.bio,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          Logger.error('Error creating expert bio:', insertError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      Logger.error('Error saving expert bio:', error);
      return false;
    }
  }
  
  /**
   * Review presentations and their related expert documents and assets
   */
  public async reviewPresentations(options: PresentationReviewOptions = {}): Promise<PresentationReview[]> {
    try {
      Logger.debug(`Reviewing presentations with options: ${JSON.stringify(options)}`);
      
      // Get presentations with filters
      let query = this.supabaseClient
        .from('presentations')
        .select(`
          id,
          title,
          main_video_id,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });
      
      // Apply filters
      if (options.presentationId) {
        query = query.eq('id', options.presentationId);
      }
      
      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      const { data: presentations, error } = await query;
      
      if (error) {
        Logger.error('Error fetching presentations:', error);
        throw error;
      }
      
      if (!presentations || presentations.length === 0) {
        return [];
      }
      
      // Filter by expert_id if requested
      let filteredPresentations = presentations;
      if (options.expertId) {
        // Get presentations that are associated with the specified expert through sources_google
        const { data: sourcesWithExpert, error: sourcesError } = await this.supabaseClient
          .from('sources_google')
          .select('id')
          .eq('expert_id', options.expertId);
        
        if (sourcesError) {
          Logger.error('Error fetching sources for expert:', sourcesError);
        } else if (sourcesWithExpert && sourcesWithExpert.length > 0) {
          const sourceIds = sourcesWithExpert.map((s: any) => s.id);
          filteredPresentations = presentations.filter((p: any) => 
            p.main_video_id && sourceIds.includes(p.main_video_id)
          );
        } else {
          // No sources found for this expert
          return [];
        }
      }
      
      // Filter by folder_id if requested
      if (options.folderId) {
        // Get all sources related to Dynamic Healing Discussion Group, including those not directly in the folder
        // but whose path indicates they're part of the group
        const { data: dhgSources, error: dhgError } = await this.supabaseClient
          .from('sources_google')
          .select('id, name, parent_path, drive_id')
          .or(`parent_path.like.%Dynamic Healing Discussion Group%,drive_id.eq.${options.folderId}`);
        
        if (dhgError) {
          Logger.error('Error fetching Dynamic Healing Discussion Group sources:', dhgError);
        } else if (dhgSources && dhgSources.length > 0) {
          const dhgSourceIds = dhgSources.map((s: any) => s.id);
          filteredPresentations = filteredPresentations.filter((p: any) => 
            p.main_video_id && dhgSourceIds.includes(p.main_video_id)
          );
          
          Logger.info(`Filtered to ${filteredPresentations.length} presentations from Dynamic Healing Discussion Group`);
          
          // Make sure we enforce the limit after filtering
          if (options.limit && filteredPresentations.length > options.limit) {
            filteredPresentations = filteredPresentations.slice(0, options.limit);
            Logger.info(`Limited to ${filteredPresentations.length} presentations`);
          }
        } else {
          Logger.info('No files found in Dynamic Healing Discussion Group');
          return [];
        }
      }
      
      // No need to fetch document types - we can work with the existing data
      let videoSummaryTranscriptTypeId: string | null = null;
      
      // We'll identify video summary transcripts by checking the document type name
      // in the expert_documents query results instead
      
      // Get presentation reviews with detailed information
      const presentationReviews = await Promise.all(
        filteredPresentations.map(async (presentation: any) => {
          // Get presentation assets with linked expert_documents
          let { data: assets, error: assetsError } = await this.supabaseClient
            .from('presentation_assets')
            .select(`
              id, 
              asset_type, 
              created_at,
              expert_document_id,
              expert_documents(
                id, 
                document_type_id, 
                raw_content, 
                processed_content, 
                status, 
                created_at, 
                updated_at
              )
            `)
            .eq('presentation_id', presentation.id);
          
          if (assetsError) {
            Logger.error('Error fetching assets for presentation:', assetsError);
          }
          
          // Get linked source_google info to find the expert
          let expertId = null;
          let expertName = null;
          
          if (presentation.main_video_id) {
            const { data: source, error: sourceError } = await this.supabaseClient
              .from('sources_google')
              .select('expert_id')
              .eq('id', presentation.main_video_id)
              .single();
              
            if (!sourceError && source && source.expert_id) {
              expertId = source.expert_id;
              
              // Now get the expert name
              const { data: expert, error: expertError } = await this.supabaseClient
                .from('experts')
                .select('expert_name')
                .eq('id', expertId)
                .single();
                
              if (!expertError && expert) {
                expertName = expert.expert_name;
              }
            }
          }
          
          // Create an array to store newly created assets
          const newlyCreatedAssets: string[] = [];
          
          // Collect expert documents from assets
          let expertDocuments: any[] = [];
          
          // First, collect expert documents linked through presentation_assets
          if (assets && assets.length > 0) {
            // Prepare array of assets with expert_documents
            const assetsWithDocuments = assets
              .filter((asset: any) => asset.expert_documents && asset.expert_document_id);
            
            // Process each asset with expert_document
            for (const asset of assetsWithDocuments) {
              // Get document type name separately
              const { data: docTypeData, error: docTypeError } = await this.supabaseClient
                .from('expert_documents')
                .select(`
                  document_type_id,
                  document_types(name),
                  raw_content
                `)
                .eq('id', asset.expert_document_id)
                .single();
                
              if (!docTypeError && docTypeData && docTypeData.document_types) {
                expertDocuments.push({
                  ...asset.expert_documents,
                  document_types: docTypeData.document_types,
                  linked_through_asset: asset.id,
                  asset_type: asset.asset_type
                });
              } else {
                expertDocuments.push({
                  ...asset.expert_documents,
                  document_types: { name: 'Unknown' },
                  linked_through_asset: asset.id,
                  asset_type: asset.asset_type
                });
              }
            }
          }
          
          // Also get expert documents related to this presentation's expert if available
          if (expertId) {
            const { data: docs, error: docsError } = await this.supabaseClient
              .from('expert_documents')
              .select(`
                id, 
                document_type_id,
                document_types(name),
                created_at,
                updated_at,
                raw_content,
                processed_content,
                source_id,
                status
              `)
              .eq('expert_id', expertId);
            
            if (docsError) {
              Logger.error('Error fetching expert documents:', docsError);
            } else if (docs) {
              // Add docs that aren't already in expertDocuments
              docs.forEach((doc: any) => {
                if (!expertDocuments.some(existingDoc => existingDoc.id === doc.id)) {
                  expertDocuments.push(doc);
                }
              });
            }
          }
          
          // Check if we have a 'Video Summary Transcript' document with raw_content
          const videoSummaryTranscript = expertDocuments.find(doc => 
            doc.document_types?.name === 'Video Summary Transcript' && 
            doc.source_id === presentation.main_video_id &&
            doc.raw_content && 
            doc.status === 'Completed'
          );
          
          // Check if we need to create a presentation_asset record
          if (options.createAssets && expertId && videoSummaryTranscript) {
            // Check if there's already a transcript asset for this presentation
            const hasTranscriptAsset = assets?.some((asset: {asset_type: string}) => asset.asset_type === 'transcript');
            
            if (!hasTranscriptAsset) {
              // Create a new presentation_asset record
              const { data: newAsset, error: assetError } = await this.supabaseClient
                .from('presentation_assets')
                .insert({
                  presentation_id: presentation.id,
                  asset_type: 'transcript',
                  expert_document_id: videoSummaryTranscript.id,
                  created_at: new Date().toISOString()
                })
                .select();
                
              if (assetError) {
                Logger.error('Error creating presentation_asset record:', assetError);
              } else {
                Logger.info(`Created presentation_asset (transcript) for presentation ${presentation.id}`);
                
                // Track the newly created asset ID
                if (newAsset && newAsset.length > 0) {
                  newlyCreatedAssets.push(newAsset[0].id);
                }
                
                // Refresh assets
                const { data: refreshedAssets } = await this.supabaseClient
                  .from('presentation_assets')
                  .select('id, asset_type, created_at')
                  .eq('presentation_id', presentation.id);
                  
                if (refreshedAssets) {
                  assets = refreshedAssets;
                }
              }
            }
          }
          
          // Check if we have the specific expert document for this presentation's source_id
          const hasTranscriptDocument = expertDocuments.some(doc => 
            doc.source_id === presentation.main_video_id && 
            doc.raw_content !== null && 
            doc.raw_content !== undefined
          );
          
          // Transform expert documents for review
          const transformedDocs = expertDocuments.map((doc: any) => {
            // Try to get document type name from different possible locations
            let documentTypeName = 'Unknown';
            if (typeof doc.document_types === 'object') {
              if (doc.document_types?.name) {
                documentTypeName = doc.document_types.name;
              }
            }
            
            return {
              id: doc.id,
              document_type: documentTypeName,
              document_types: doc.document_types, // Keep the original for reference
              document_type_id: doc.document_type_id || 'Unknown',
              has_raw_content: !!doc.raw_content,
              has_processed_content: !!doc.processed_content,
              raw_content_preview: doc.raw_content ? doc.raw_content.substring(0, 50).replace(/\n/g, ' ') + '...' : '',
              linked_through_asset: doc.linked_through_asset || null,
              asset_type: doc.asset_type || null,
              created_at: doc.created_at,
              updated_at: doc.updated_at
            };
          });
          
          // Transform assets for review
          const transformedAssets = (assets || []).map((asset: any) => ({
            id: asset.id,
            type: asset.asset_type,
            status: 'Available', // Since we don't have file_path to check
            justCreated: newlyCreatedAssets.includes(asset.id)
          }));
          
          // Determine presentation status
          let status = this.determinePresentationStatus(transformedAssets, transformedDocs);
          
          // Check for Video Summary Transcript with raw_content and Completed status
          if (videoSummaryTranscript && videoSummaryTranscript.status === 'Completed') {
            status = 'make-ai-summary';
          } else if (hasTranscriptDocument && status === 'missing-transcript') {
            status = 'has-transcript';
          }
          
          // Determine next steps
          const nextSteps = this.determineNextSteps(status, transformedAssets, transformedDocs);
          
          return {
            id: presentation.id,
            title: presentation.title,
            expert_id: expertId,
            expert_name: expertName,
            created_at: presentation.created_at,
            updated_at: presentation.updated_at,
            status,
            assets: transformedAssets,
            expert_documents: transformedDocs,
            next_steps: nextSteps,
            has_raw_content: hasTranscriptDocument || (videoSummaryTranscript !== undefined)
          };
        })
      );
      
      return presentationReviews;
    } catch (error) {
      Logger.error('Error in reviewPresentations:', error);
      throw error;
    }
  }
  
  /**
   * Determine the overall status of a presentation based on its assets and documents
   */
  private determinePresentationStatus(
    assets: any[],
    expertDocuments: ExpertDocument[]
  ): string {
    // Check if there are any documents that need AI summary processing
    const needsAiSummary = expertDocuments.some(doc => 
      doc.has_raw_content && 
      (doc.ai_summary_status === 'pending' || doc.ai_summary_status === undefined)
    );
    
    if (needsAiSummary) {
      return 'make-ai-summary';
    }
    
    // Check if any documents are currently being processed
    const aiProcessing = expertDocuments.some(doc => 
      doc.ai_summary_status === 'processing'
    );
    
    if (aiProcessing) {
      return 'ai-summary-processing';
    }
    
    // Check legacy condition for backward compatibility
    const hasVideoSummaryTranscript = expertDocuments.some(doc => 
      doc.document_type === 'Video Summary Transcript' && 
      doc.has_raw_content &&
      !doc.has_processed_content
    );
    
    if (hasVideoSummaryTranscript) {
      return 'make-ai-summary';
    }
    
    // Check if transcript exists
    const hasTranscript = assets.some(asset => 
      asset.type === 'transcript' && asset.status === 'Available'
    );
    
    if (!hasTranscript) {
      return 'missing-transcript';
    }
    
    // Check if summary exists
    const hasSummary = expertDocuments.some(doc => 
      doc.document_type === 'summary' && doc.has_processed_content
    );
    
    if (!hasSummary) {
      return 'missing-summary';
    }
    
    // Check if expert bio exists
    const hasExpertBio = expertDocuments.some(doc => 
      doc.document_type === 'expert_bio' && doc.has_processed_content
    );
    
    if (!hasExpertBio) {
      return 'missing-expert-bio';
    }
    
    // If all essential components exist
    return 'complete';
  }
  
  /**
   * Determine the next steps for a presentation based on its status
   */
  private determineNextSteps(
    status: string,
    assets: any[],
    expertDocuments: ExpertDocument[]
  ): string[] {
    const nextSteps: string[] = [];
    
    switch (status) {
      case 'missing-transcript':
        nextSteps.push('Create transcript from audio or video file');
        nextSteps.push('Run transcription process using media-processing pipeline');
        break;
      
      case 'make-ai-summary':
        nextSteps.push('Generate AI summary from existing transcript');
        nextSteps.push('Run "generate-summary" command to process transcript');
        break;
      
      case 'ai-summary-processing':
        nextSteps.push('AI summary generation is in progress');
        nextSteps.push('Wait for AI processing to complete');
        break;
      
      case 'has-transcript':
        nextSteps.push('Generate AI summary from transcript');
        nextSteps.push('Run "generate-summary" command to process transcript');
        break;
      
      case 'missing-summary':
        nextSteps.push('Generate AI summary from transcript');
        nextSteps.push('Run "generate-summary" command to process transcript');
        break;
      
      case 'missing-expert-bio':
        nextSteps.push('Generate AI expert profile from available documents');
        nextSteps.push('Run "generate-expert-bio" command to create expert profile');
        break;
      
      case 'complete':
        nextSteps.push('Review generated documents for quality');
        nextSteps.push('Consider generating additional content types');
        break;
    }
    
    return nextSteps;
  }

  /**
   * Update the AI summary status for an expert document
   */
  public async updateAiSummaryStatus(
    expertDocumentId: string, 
    status: 'pending' | 'processing' | 'completed' | 'error'
  ): Promise<boolean> {
    try {
      const { error } = await this._supabaseClient
        .from('expert_documents')
        .update({ 
          ai_summary_status: status,
          updated_at: new Date().toISOString() 
        })
        .eq('id', expertDocumentId);
      
      if (error) {
        Logger.error(`Error updating AI summary status for document ${expertDocumentId}:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      Logger.error(`Error updating AI summary status for document ${expertDocumentId}:`, error);
      return false;
    }
  }
  
  /**
   * Update the AI summary status for multiple expert documents at once
   * This batch method helps avoid request size limitations
   */
  public async updateMultipleAiSummaryStatus(
    expertDocumentIds: string[], 
    status: 'pending' | 'processing' | 'completed' | 'error'
  ): Promise<{success: number, failed: number}> {
    try {
      let success = 0;
      let failed = 0;
      
      // Process in batches of 50 to avoid request size limitations
      const batchSize = 50;
      for (let i = 0; i < expertDocumentIds.length; i += batchSize) {
        const batch = expertDocumentIds.slice(i, i + batchSize);
        Logger.info(`Processing batch ${i/batchSize + 1} of ${Math.ceil(expertDocumentIds.length/batchSize)}, size: ${batch.length}`);
        
        const { error } = await this._supabaseClient
          .from('expert_documents')
          .update({ 
            ai_summary_status: status,
            updated_at: new Date().toISOString() 
          })
          .in('id', batch);
        
        if (error) {
          Logger.error(`Error updating AI summary status for batch:`, error);
          failed += batch.length;
        } else {
          success += batch.length;
          Logger.info(`Successfully updated ${batch.length} documents to status "${status}"`);
        }
      }
      
      return { success, failed };
    } catch (error) {
      Logger.error(`Error in batch update of AI summary status:`, error);
      return { success: 0, failed: expertDocumentIds.length };
    }
  }
  
  /**
   * Reset Video Summary Transcript documents with raw content to have 'pending' or null status
   * Filters by specified folder ID and completed status
   */
  public async resetAllVideoSummaryTranscriptsStatus(status: 'pending' | 'processing' | 'completed' | 'error' | null = null, folderId: string = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'): Promise<{success: number, failed: number}> {
    try {
      // First get the document type ID for "Video Summary Transcript"
      const videoSummaryTypeId = await this.getVideoSummaryTranscriptTypeId();
      
      if (!videoSummaryTypeId) {
        Logger.error('Could not find document type ID for "Video Summary Transcript"');
        return { success: 0, failed: 0 };
      }
      
      // Use the specified folder ID
      Logger.info(`Using folder ID: ${folderId}`);
      
      // Get sources from the specified folder
      // Limiting to 100 sources to avoid exceeding request limits
      const { data: folderSources, error: folderError } = await this._supabaseClient
        .from('sources_google')
        .select('id')
        .eq('drive_id', folderId)
        .limit(100);
      
      if (folderError) {
        Logger.error(`Error fetching sources for folder ${folderId}:`, folderError);
        return { success: 0, failed: 0 };
      }
      
      if (!folderSources || folderSources.length === 0) {
        Logger.info(`No sources found in folder ${folderId}`);
        return { success: 0, failed: 0 };
      }
      
      const sourceIds = folderSources.map((s: any) => s.id);
      Logger.info(`Found ${sourceIds.length} sources in folder ${folderId}`);
      
      Logger.info(`Filtering for Video Summary Transcript documents with raw content in the specified folder`);
      
      // Process the source IDs in smaller batches to avoid request size limits
      Logger.info(`Processing source IDs in batches and filtering for Video Summary Transcript documents`);
      
      let allDocsWithContent: any[] = [];
      const batchSize = 20;
      let success = 0;
      let failed = 0;
      
      for (let i = 0; i < sourceIds.length; i += batchSize) {
        const batchSourceIds = sourceIds.slice(i, i + batchSize);
        Logger.info(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(sourceIds.length/batchSize)} (${batchSourceIds.length} source IDs)`);
        
        try {
          const { data: docsInBatch, error: batchError } = await this._supabaseClient
            .from('expert_documents')
            .select('id')
            .eq('document_type_id', videoSummaryTypeId)
            .not('raw_content', 'is', null)
            .in('source_id', batchSourceIds);
            
          if (batchError) {
            Logger.error(`Error in batch ${Math.floor(i/batchSize) + 1}:`, batchError);
            failed += batchSourceIds.length;
          } else if (docsInBatch && docsInBatch.length > 0) {
            Logger.info(`Found ${docsInBatch.length} documents in batch ${Math.floor(i/batchSize) + 1}`);
            allDocsWithContent = [...allDocsWithContent, ...docsInBatch];
            
            // Directly update these documents in this batch
            const docIds = docsInBatch.map((doc: any) => doc.id);
            const { success: batchSuccess, failed: batchFailed } = await this.updateMultipleAiSummaryStatus(docIds, status as any);
            success += batchSuccess;
            failed += batchFailed;
          }
        } catch (error) {
          Logger.error(`Error processing batch ${Math.floor(i/batchSize) + 1}:`, error);
          failed += batchSourceIds.length;
        }
      }
      
      Logger.info(`Successfully reset ${success} Video Summary Transcript documents to ${status === null ? 'NULL' : status} status`);
      if (failed > 0) {
        Logger.warn(`Failed to reset ${failed} documents`);
      }
      
      return { success, failed };
      
      // This implementation uses a simpler approach without RPC functions
    } catch (error) {
      Logger.error('Error resetting Video Summary Transcript documents:', error);
      return { success: 0, failed: 0 };
    }
  }
  
  /**
   * Get the document type ID for "Video Summary Transcript"
   */
  public async getVideoSummaryTranscriptTypeId(): Promise<string | null> {
    try {
      const { data, error } = await this._supabaseClient
        .from('document_types')
        .select('id')
        .eq('document_type', 'Video Summary Transcript')
        .single();
      
      if (error || !data) {
        Logger.error('Error fetching Video Summary Transcript document type:', error);
        return null;
      }
      
      return data.id;
    } catch (error) {
      Logger.error('Error fetching Video Summary Transcript document type:', error);
      return null;
    }
  }

  /**
   * Get expert documents that need AI summary processing
   * Only includes documents of type "Video Summary Transcript"
   * that are associated with the specified folder
   * and have completed audio processing (raw_content available)
   * and have status "Completed"
   */
  public async getDocumentsNeedingAiSummary(limit: number = 50, folderId: string = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV'): Promise<any[]> {
    try {
      // First get the document type ID for "Video Summary Transcript"
      const videoSummaryTypeId = await this.getVideoSummaryTranscriptTypeId();
      
      if (!videoSummaryTypeId) {
        Logger.error('Could not find document type ID for "Video Summary Transcript"');
        return [];
      }
      
      Logger.info(`Using document type ID for Video Summary Transcript: ${videoSummaryTypeId}`);
      
      // Get the folder ID from parameter or use default
      Logger.info(`Using folder ID: ${folderId}`);
      
      // Get sources from the specified folder (limit to reasonable number)
      const { data: folderSources, error: folderError } = await this._supabaseClient
        .from('sources_google')
        .select('id')
        .eq('drive_id', folderId)
        .limit(200); // Increased limit to 200 sources to catch more documents
      
      if (folderError) {
        Logger.error(`Error fetching sources from folder ${folderId}:`, folderError);
        return [];
      }
      
      if (!folderSources || folderSources.length === 0) {
        Logger.info(`No sources found in folder ${folderId}`);
        return [];
      }
      
      const sourceIds = folderSources.map((s: any) => s.id);
      Logger.info(`Using ${sourceIds.length} sources for document query`);
      
      // First try to find documents that match using SQL query with direct db function 
      // (this might be more effective for complex conditions)
      const { data: sqlResult, error: sqlError } = await this._supabaseClient.rpc(
        'find_documents_needing_ai_summary',
        {
          doc_type_id: videoSummaryTypeId,
          source_ids: sourceIds,
          max_results: limit
        }
      );
      
      if (!sqlError && sqlResult && sqlResult.length > 0) {
        Logger.info(`Found ${sqlResult.length} documents via SQL function that need AI summary processing`);
        return sqlResult;
      }
      
      if (sqlError) {
        Logger.info('SQL function not available, falling back to filter API...');
      } else {
        Logger.info('SQL function returned no results, falling back to filter API...');
      }
      
      // Query for documents that meet ALL these criteria:
      // 1. Document type = "Video Summary Transcript"
      // 2. Has raw_content (not null) 
      // 3. Source is in Dynamic Healing Discussion Group
      // 4. Status is 'Completed'
      // 5. AI summary status is pending or null
      const { data, error } = await this._supabaseClient
        .from('expert_documents')
        .select(`
          id,
          document_type_id,
          document_types(document_type),
          expert_id,
          ai_summary_status,
          source_id,
          status
        `)
        .eq('document_type_id', videoSummaryTypeId)
        .not('raw_content', 'is', null)
        .eq('status', 'Completed')
        .in('source_id', sourceIds)
        .or('ai_summary_status.eq.pending,ai_summary_status.is.null')
        .limit(limit);
      
      if (error) {
        Logger.error('Error fetching documents needing AI summary:', error);
        
        // Try one more time with a simplified query that doesn't check status
        Logger.info('Trying simplified query without status checks as last resort...');
        const { data: basicData, error: basicError } = await this._supabaseClient
          .from('expert_documents')
          .select(`
            id,
            document_type_id,
            document_types(document_type),
            expert_id,
            ai_summary_status,
            source_id,
            status
          `)
          .eq('document_type_id', videoSummaryTypeId)
          .not('raw_content', 'is', null)
          .in('source_id', sourceIds)
          .limit(limit);
          
        if (basicError) {
          Logger.error('Even simplified query failed:', basicError);
          return [];
        }
        
        // Filter the results manually
        const filteredData = basicData.filter((doc: {status: string, ai_summary_status: string | null}) => 
          doc.status === 'Completed' && 
          (doc.ai_summary_status === 'pending' || doc.ai_summary_status === null)
        );
        
        Logger.info(`Found ${filteredData.length} documents via simplified query + manual filtering`);
        return filteredData;
      }
      
      Logger.info(`Found ${data?.length || 0} documents needing AI summary that match all criteria`);
      
      // Log the first few document IDs for debugging
      if (data && data.length > 0) {
        const sampleSize = Math.min(5, data.length);
        Logger.info(`Sample document IDs: ${data.slice(0, sampleSize).map((d: any) => d.id).join(', ')}`);
      }
      
      return data || [];
    } catch (error) {
      Logger.error('Error fetching documents needing AI summary:', error);
      return [];
    }
  }
  
  /**
   * Check for professional documents (CV, bio, announcement) associated with presentations
   */
  public async checkProfessionalDocuments(
    options: ProfessionalDocumentsCheckOptions = {}
  ): Promise<PresentationWithProfessionalDocs[]> {
    try {
      Logger.debug(`Checking professional documents with options: ${JSON.stringify(options)}`);
      
      // Get presentations with filters
      let query = this.supabaseClient
        .from('presentations')
        .select(`
          id,
          title,
          main_video_id
        `)
        .order('created_at', { ascending: false });
      
      // Apply filters
      if (options.presentationId) {
        query = query.eq('id', options.presentationId);
      }
      
      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      const { data: presentations, error } = await query;
      
      if (error) {
        Logger.error('Error fetching presentations:', error);
        throw error;
      }
      
      if (!presentations || presentations.length === 0) {
        return [];
      }
      
      // Filter by expert_id if requested
      let filteredPresentations = presentations;
      if (options.expertId) {
        // Get presentations that are associated with the specified expert through sources_google
        const { data: sourcesWithExpert, error: sourcesError } = await this.supabaseClient
          .from('sources_google')
          .select('id')
          .eq('expert_id', options.expertId);
        
        if (sourcesError) {
          Logger.error('Error fetching sources for expert:', sourcesError);
        } else if (sourcesWithExpert && sourcesWithExpert.length > 0) {
          const sourceIds = sourcesWithExpert.map((s: any) => s.id);
          filteredPresentations = presentations.filter((p: any) => 
            p.main_video_id && sourceIds.includes(p.main_video_id)
          );
        } else {
          // No sources found for this expert
          return [];
        }
      }
      
      // Get document type IDs for professional documents
      const { data: documentTypes, error: docTypesError } = await this.supabaseClient
        .from('document_types')
        .select('id, name')
        .in('name', ['curriculum vitae', 'professional biography', 'Presentation Announcement']);
      
      if (docTypesError) {
        Logger.error('Error fetching document types:', docTypesError);
        throw docTypesError;
      }
      
      // Create a map of document type names to IDs
      const docTypeMap = documentTypes.reduce((map: any, docType: any) => {
        map[docType.name.toLowerCase()] = docType.id;
        return map;
      }, {});
      
      // Check professional documents for each presentation
      const presentationsWithDocs = await Promise.all(
        filteredPresentations.map(async (presentation: any) => {
          // Get linked source_google info to find the expert
          let expertId = null;
          let expertName = null;
          
          if (presentation.main_video_id) {
            const { data: source, error: sourceError } = await this.supabaseClient
              .from('sources_google')
              .select('expert_id')
              .eq('id', presentation.main_video_id)
              .single();
              
            if (!sourceError && source && source.expert_id) {
              expertId = source.expert_id;
              
              // Now get the expert name
              const { data: expert, error: expertError } = await this.supabaseClient
                .from('experts')
                .select('expert_name')
                .eq('id', expertId)
                .single();
                
              if (!expertError && expert) {
                expertName = expert.expert_name;
              }
            }
          }
          
          // Get expert documents for this expert if found
          let expertDocuments: any[] = [];
          if (expertId) {
            const { data: docs, error: docsError } = await this.supabaseClient
              .from('expert_documents')
              .select(`
                id, 
                document_type_id,
                document_types(name),
                created_at,
                updated_at
              `)
              .eq('expert_id', expertId)
              .in('document_type_id', Object.values(docTypeMap));
            
            if (docsError) {
              Logger.error('Error fetching expert documents:', docsError);
            } else if (docs) {
              expertDocuments = docs;
            }
          }
          
          // Find CV document
          const cvDoc = expertDocuments.find((doc: any) => 
            doc.document_types?.name?.toLowerCase() === 'curriculum vitae'
          );
          
          // Find bio document
          const bioDoc = expertDocuments.find((doc: any) => 
            doc.document_types?.name?.toLowerCase() === 'professional biography'
          );
          
          // Find announcement document
          const announcementDoc = expertDocuments.find((doc: any) => 
            doc.document_types?.name?.toLowerCase() === 'presentation announcement'
          );
          
          // Prepare result object
          const result: PresentationWithProfessionalDocs = {
            id: presentation.id,
            title: presentation.title,
            expert_id: expertId,
            expert_name: expertName,
            hasAnyProfessionalDocument: !!(cvDoc || bioDoc || announcementDoc)
          };
          
          // Add CV if available
          if (cvDoc) {
            result.cv = {
              id: cvDoc.id,
              type: 'curriculum vitae',
              status: 'available',
              created_at: cvDoc.created_at,
              updated_at: cvDoc.updated_at
            };
          }
          
          // Add bio if available
          if (bioDoc) {
            result.bio = {
              id: bioDoc.id,
              type: 'professional biography',
              status: 'available',
              created_at: bioDoc.created_at,
              updated_at: bioDoc.updated_at
            };
          }
          
          // Add announcement if available
          if (announcementDoc) {
            result.announcement = {
              id: announcementDoc.id,
              type: 'Presentation Announcement',
              status: 'available',
              created_at: announcementDoc.created_at,
              updated_at: announcementDoc.updated_at
            };
          }
          
          return result;
        })
      );
      
      // Filter by document type if specified
      let filteredResults = presentationsWithDocs;
      
      if (options.documentType) {
        const docType = options.documentType.toLowerCase();
        filteredResults = presentationsWithDocs.filter(presentation => {
          if (docType === 'cv' && presentation.cv) return true;
          if (docType === 'bio' && presentation.bio) return true;
          if (docType === 'announcement' && presentation.announcement) return true;
          return false;
        });
      }
      
      // Filter missing documents if specified
      if (options.missingOnly) {
        filteredResults = filteredResults.filter(presentation => 
          !presentation.hasAnyProfessionalDocument
        );
      }
      
      return filteredResults;
    } catch (error) {
      Logger.error('Error checking professional documents:', error);
      throw error;
    }
  }
}