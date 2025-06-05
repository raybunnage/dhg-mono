import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getActiveFilterProfile } from '../get-active-filter-profile';

interface PresentationReviewOptions {
  presentationId?: string;
  expertId?: string;
  status?: string;
  limit?: number;
  createAssets?: boolean;
  folderId?: string;
  skipFolderFilter?: boolean;
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
  document_types?: {document_type: string};
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
        .from('media_presentations')
        .select('id, title, expert_id')
        .eq('id', presentationId)
        .single();
      
      if (error || !presentation) {
        Logger.error('Error fetching presentation:', error);
        return null;
      }
      
      // Get the transcript asset
      const { data: assets, error: assetsError } = await this.supabaseClient
        .from('media_presentation_assets')
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
        .from('google_expert_documents')
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
          .from('google_expert_documents')
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
          .from('google_expert_documents')
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
          .from('media_presentation_assets')
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
        .from('expert_profiles')
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
        .from('media_presentations')
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
        .from('media_presentation_assets')
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
        .eq('document_type', 'expert_bio')
        .single();
      
      if (docTypeError || !docType) {
        Logger.error('Error fetching expert_bio document type:', docTypeError);
        return null;
      }
      
      // Get existing bio document
      const { data: bio, error: bioError } = await this.supabaseClient
        .from('google_expert_documents')
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
        .eq('document_type', 'expert_bio')
        .single();
      
      if (docTypeError || !docType) {
        Logger.error('Error fetching expert_bio document type:', docTypeError);
        return false;
      }
      
      if (options.existingBioId) {
        // Update existing bio
        const { error: updateError } = await this.supabaseClient
          .from('google_expert_documents')
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
          .from('google_expert_documents')
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
      
      // Check for active filter profile
      const activeFilter = await getActiveFilterProfile();
      let rootDriveIdFilter: string | null = null;
      if (activeFilter && activeFilter.rootDriveId) {
        Logger.info(`🔍 Active filter: "${activeFilter.profile.name}"`);
        Logger.info(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n`);
        rootDriveIdFilter = activeFilter.rootDriveId;
      }
      
      // Get presentations with filters
      let query = this.supabaseClient
        .from('media_presentations')
        .select(`
          id,
          title,
          video_source_id,
          created_at,
          updated_at,
          root_drive_id
        `)
        .order('created_at', { ascending: false });
      
      // Apply root_drive_id filter if active
      if (rootDriveIdFilter && !options.skipFolderFilter) {
        query = query.eq('root_drive_id', rootDriveIdFilter);
      }
      
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
        // Get presentations that are associated with the specified expert through google_sources_experts
        const { data: sourcesWithExpert, error: sourcesError } = await this.supabaseClient
          .from('google_sources_experts')
          .select('source_id')
          .eq('expert_id', options.expertId);
        
        if (sourcesError) {
          Logger.error('Error fetching sources for expert:', sourcesError);
        } else if (sourcesWithExpert && sourcesWithExpert.length > 0) {
          const sourceIds = sourcesWithExpert.map((s: any) => s.source_id);
          filteredPresentations = presentations.filter((p: any) => 
            p.video_source_id && sourceIds.includes(p.video_source_id)
          );
        } else {
          // No sources found for this expert
          return [];
        }
      }
      
      // Filter by folder_id if requested and skipFolderFilter is not true
      if (options.folderId && !options.skipFolderFilter) {
        // Get all sources related to Dynamic Healing Discussion Group, including those not directly in the folder
        // but whose path indicates they're part of the group
        let dhgQuery = this.supabaseClient
          .from('google_sources')
          .select('id, name, path, drive_id, root_drive_id');
        
        // If we have a root_drive_id filter, use that instead of the path-based filtering
        if (rootDriveIdFilter) {
          dhgQuery = dhgQuery.eq('root_drive_id', rootDriveIdFilter);
        } else {
          dhgQuery = dhgQuery.or(`path.like.%Dynamic Healing Discussion Group%,drive_id.eq.${options.folderId}`);
        }
        
        const { data: dhgSources, error: dhgError } = await dhgQuery;
        
        if (dhgError) {
          Logger.error('Error fetching Dynamic Healing Discussion Group sources:', dhgError);
        } else if (dhgSources && dhgSources.length > 0) {
          const dhgSourceIds = dhgSources.map((s: any) => s.id);
          filteredPresentations = filteredPresentations.filter((p: any) => 
            p.video_source_id && dhgSourceIds.includes(p.video_source_id)
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
            .from('media_presentation_assets')
            .select(`
              id, 
              asset_type, 
              created_at,
              expert_document_id,
              google_expert_documents(
                id, 
                document_type_id, 
                raw_content, 
                processed_content, 
                status,
                ai_summary_status,
                created_at, 
                updated_at
              )
            `)
            .eq('presentation_id', presentation.id);
          
          if (assetsError) {
            Logger.error('Error fetching assets for presentation:', assetsError);
          }
          
          // Get linked source_google info to find all associated experts
          let expertId = null;
          let expertName = null;
          let experts: { id: string, name: string }[] = [];
          
          if (presentation.video_source_id) {
            // Get all experts associated with this source
            const { data: sourceExperts, error: sourceError } = await this.supabaseClient
              .from('google_sources_experts')
              .select(`
                expert_id, 
                experts(id, expert_name, full_name)
              `)
              .eq('source_id', presentation.video_source_id);
              
            if (!sourceError && sourceExperts && sourceExperts.length > 0) {
              // Extract expert info from each record
              experts = sourceExperts.map((record: { expert_id: string, experts: any }) => {
                const expertRecord = record.experts as any;
                return {
                  id: record.expert_id,
                  name: expertRecord?.expert_name || expertRecord?.full_name || 'Unknown'
                };
              }).filter((e: { id?: string }) => e.id); // Filter out any without IDs
              
              // For backward compatibility, use the first expert for existing fields
              if (experts.length > 0) {
                expertId = experts[0].id;
                expertName = experts[0].name;
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
                .from('google_expert_documents')
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
                  document_types: { document_type: 'Unknown' },
                  linked_through_asset: asset.id,
                  asset_type: asset.asset_type
                });
              }
            }
          }
          
          // Also get expert documents related to this presentation's expert if available
          if (expertId) {
            const { data: docs, error: docsError } = await this.supabaseClient
              .from('google_expert_documents')
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
            doc.document_types?.document_type === 'Video Summary Transcript' && 
            doc.source_id === presentation.video_source_id &&
            doc.raw_content && 
            doc.processing_status === 'completed'
          );
          
          // Check if we need to create a presentation_asset record
          if (options.createAssets && expertId && videoSummaryTranscript) {
            // Check if there's already a transcript asset for this presentation
            const hasTranscriptAsset = assets?.some((asset: {asset_type: string}) => asset.asset_type === 'transcript');
            
            if (!hasTranscriptAsset) {
              // Create a new presentation_asset record
              const { data: newAsset, error: assetError } = await this.supabaseClient
                .from('media_presentation_assets')
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
                  .from('media_presentation_assets')
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
            doc.source_id === presentation.video_source_id && 
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
              updated_at: doc.updated_at,
              ai_summary_status: doc.ai_summary_status || 'pending'
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
          
          // Check for Video Summary Transcript with raw_content and completed processing_status
          if (videoSummaryTranscript && videoSummaryTranscript.processing_status === 'completed') {
            status = 'make-ai-summary';
          } else if (hasTranscriptDocument && status === 'missing-transcript') {
            status = 'has-transcript';
          }
          
          // Determine next steps
          const nextSteps = this.determineNextSteps(status, transformedAssets, transformedDocs);
          
          // Create a list of expert names for display
          const expertNamesList = experts.length > 1 
            ? experts.map(e => e.name).join(', ')
            : expertName || '';
          
          return {
            id: presentation.id,
            title: presentation.title,
            expert_id: expertId,
            expert_name: expertName,
            expert_names: expertNamesList, // Added for multi-expert support
            experts: experts, // Full experts array for more detailed access
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
   * Get non-transcript expert documents from the database
   */
  public async getNonTranscriptDocuments(options: {
    limit?: number;
    folderId?: string;
    documentType?: string;
  }): Promise<any[]> {
    try {
      // First get the document type ID for "Video Summary Transcript"
      const { data: videoSummaryType, error: typeError } = await this._supabaseClient
        .from('document_types')
        .select('id')
        .eq('document_type', 'Video Summary Transcript')
        .single();
      
      if (typeError || !videoSummaryType) {
        Logger.error('Error finding Video Summary Transcript document type:', typeError);
        return [];
      }
      
      // Get sources in the specified folder - use a broader approach
      let folderQuery;
      
      if (options.folderId) {
        // Try to find sources in the specified folder
        folderQuery = this._supabaseClient
          .from('google_sources')
          .select('id, name, path, drive_id')
          .eq('drive_id', options.folderId);
      } else {
        // Fall back to a broader search if no folder ID provided
        folderQuery = this._supabaseClient
          .from('google_sources')
          .select('id, name, path, drive_id')
          .ilike('path', '%Dynamic Healing Discussion Group%');
      }
      
      const { data: folderSources, error: sourcesError } = await folderQuery;
      
      if (sourcesError) {
        Logger.error('Error finding sources in folder:', sourcesError);
        return [];
      }
      
      if (!folderSources || folderSources.length === 0) {
        Logger.debug('No sources found in specified folder, trying alternative approach');
        
        // Try a broader folder name search as fallback
        const { data: altSources, error: altError } = await this._supabaseClient
          .from('google_sources')
          .select('id, name, path, drive_id')
          .limit(10);
        
        if (altError || !altSources || altSources.length === 0) {
          Logger.error('Error finding any sources:', altError);
          return [];
        }
        
        Logger.info(`Found ${altSources.length} sources using alternative approach`);
        const sourceIds = altSources.map((source: { id: string }) => source.id);
        return sourceIds;
      }
      
      Logger.info(`Found ${folderSources.length} sources in specified folder`);
      const sourceIds = folderSources.map((source: { id: string }) => source.id);
      
      // Debug log to check source IDs
      Logger.info(`Source IDs: ${JSON.stringify(sourceIds.slice(0, 5))}... (truncated)`);
      
      // Build the query for expert documents that are not Video Summary Transcripts
      let query = this._supabaseClient
        .from('google_expert_documents')
        .select(`
          id,
          document_type_id,
          document_types(document_type),
          source_id,
          sources_google(id, name, parent_id, path, drive_id),
          created_at,
          updated_at
        `)
        .neq('document_type_id', videoSummaryType.id);
      
      // For troubleshooting, let's skip the source filtering initially to see if we can find any documents at all
      Logger.info("DEBUG: Temporarily skipping source filtering to find any available non-transcript documents");
      
      // Add a limit to keep the result set manageable during testing
      query = query.limit(options.limit || 5);
      
      // Original source filtering code (commented out for testing)
      /*
      if (sourceIds.length > 0) {
        // Due to potential query size limitations, use LIKE on parent_path instead of IN on source_id
        // for large source lists
        if (sourceIds.length > 20) {
          Logger.info(`Using path filter instead of source_id list due to large number of sources (${sourceIds.length})`);
          query = query.or('sources_google.path.ilike.%Dynamic Healing Discussion Group%');
        } else {
          query = query.in('source_id', sourceIds);
        }
      } else {
        Logger.warn("No source IDs to filter by - query may return all expert documents");
      }
      */
      
      // Add document type filter if specified
      if (options.documentType) {
        // Get the document type ID
        const { data: docType, error: docTypeError } = await this._supabaseClient
          .from('document_types')
          .select('id')
          .eq('document_type', options.documentType)
          .single();
        
        if (!docTypeError && docType) {
          query = query.eq('document_type_id', docType.id);
        }
      }
      
      // Add limit
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      const { data: documents, error: docsError } = await query;
      
      if (docsError) {
        Logger.error('Error finding non-transcript expert documents:', docsError);
        return [];
      }
      
      return documents || [];
    } catch (error) {
      Logger.error('Error in getNonTranscriptDocuments:', error);
      return [];
    }
  }
  
  /**
   * Match documents with presentations based on folder structure
   */
  public async matchDocumentsWithPresentations(documents: any[]): Promise<any[]> {
    try {
      const matches: any[] = [];
      
      // Process each document
      for (const doc of documents) {
        const documentSource = doc.sources_google;
        if (!documentSource) {
          continue;
        }
        
        // Get document parent folder
        const parentId = documentSource.parent_id;
        const parentPath = documentSource.path;
        
        if (!parentId && !parentPath) {
          continue;
        }
        
        // Look for other sources in the same folder
        const folderCondition = parentId 
          ? `parent_id.eq.${parentId}` 
          : `path.eq.${parentPath}`;
        
        const { data: folderSources, error: sourcesError } = await this._supabaseClient
          .from('google_sources')
          .select('id, name, mime_type')
          .or(folderCondition);
        
        if (sourcesError || !folderSources || folderSources.length === 0) {
          continue;
        }
        
        // Find video files in the folder
        const videoSources = folderSources.filter((source: any) => 
          source.mime_type?.includes('video') || 
          source.name?.toLowerCase().endsWith('.mp4')
        );
        
        if (videoSources.length === 0) {
          // If no video in the same folder, try to find presentations based on name similarity
          matches.push(await this.matchByNameSimilarity(doc, documentSource));
          continue;
        }
        
        // For each video, check if there's a presentation
        for (const videoSource of videoSources) {
          const { data: presentations, error: presError } = await this._supabaseClient
            .from('media_presentations')
            .select('id, title')
            .eq('video_source_id', videoSource.id);
          
          if (presError || !presentations || presentations.length === 0) {
            continue;
          }
          
          // Check if a presentation asset already exists for this document
          const { data: existingAssets, error: assetError } = await this._supabaseClient
            .from('media_presentation_assets')
            .select('id')
            .eq('presentation_id', presentations[0].id)
            .eq('expert_document_id', doc.id);
          
          const assetExists = !assetError && existingAssets && existingAssets.length > 0;
          
          // Calculate confidence based on various factors
          let confidence: 'high' | 'medium' | 'low' = 'low';
          let reason = 'Same folder';
          
          // Check name similarity for higher confidence
          const docName = documentSource.name || '';
          const videoName = videoSource.name || '';
          const presentation = presentations[0];
          
          if (this.areNamesRelated(docName, videoName)) {
            confidence = 'high';
            reason = 'Name similarity and same folder';
          } else if (videoSources.length === 1) {
            confidence = 'medium';
            reason = 'Only one video in folder';
          }
          
          // Add to matches
          matches.push({
            expertDocumentId: doc.id,
            documentName: documentSource.name,
            documentType: doc.document_types?.document_type || 'Unknown',
            presentationId: presentation.id,
            presentationTitle: presentation.title,
            confidence,
            reason,
            assetExists,
            folderPath: documentSource.path || 'Unknown'
          });
        }
      }
      
      return matches;
    } catch (error) {
      Logger.error('Error in matchDocumentsWithPresentations:', error);
      return [];
    }
  }
  
  /**
   * Create a presentation asset linking a document to a presentation
   */
  public async createPresentationAsset(options: {
    presentationId: string;
    expertDocumentId: string;
    assetType: string;
  }): Promise<boolean> {
    try {
      // Check if asset already exists
      const { data: existingAsset, error: checkError } = await this._supabaseClient
        .from('media_presentation_assets')
        .select('id')
        .eq('presentation_id', options.presentationId)
        .eq('expert_document_id', options.expertDocumentId);
      
      if (checkError) {
        Logger.error('Error checking for existing asset:', checkError);
        return false;
      }
      
      if (existingAsset && existingAsset.length > 0) {
        Logger.info(`Presentation asset already exists for document ${options.expertDocumentId}`);
        return true;
      }
      
      // Create the presentation asset
      const { error: insertError } = await this._supabaseClient
        .from('media_presentation_assets')
        .insert({
          presentation_id: options.presentationId,
          expert_document_id: options.expertDocumentId,
          asset_type: options.assetType,
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        Logger.error('Error creating presentation asset:', insertError);
        return false;
      }
      
      Logger.info(`Created presentation asset for document ${options.expertDocumentId}`);
      return true;
    } catch (error) {
      Logger.error('Error in createPresentationAsset:', error);
      return false;
    }
  }
  
  /**
   * Match document with presentations based on name similarity
   */
  private async matchByNameSimilarity(doc: any, documentSource: any): Promise<any> {
    const docName = documentSource.name || '';
    
    // Get all presentations
    const { data: presentations, error: presError } = await this._supabaseClient
      .from('media_presentations')
      .select('id, title, video_source_id');
    
    if (presError || !presentations || presentations.length === 0) {
      return {
        expertDocumentId: doc.id,
        documentName: docName,
        documentType: doc.document_types?.document_type || 'Unknown',
        presentationId: null,
        presentationTitle: null,
        confidence: 'low',
        reason: 'No presentations found',
        assetExists: false,
        folderPath: documentSource.path || 'Unknown'
      };
    }
    
    // Get video sources for presentations
    const videoIds = presentations
      .map((p: any) => p.video_source_id)
      .filter((id: string) => id);
    
    if (videoIds.length === 0) {
      return {
        expertDocumentId: doc.id,
        documentName: docName,
        documentType: doc.document_types?.document_type || 'Unknown',
        presentationId: null,
        presentationTitle: null,
        confidence: 'low',
        reason: 'No video sources found',
        assetExists: false,
        folderPath: documentSource.path || 'Unknown'
      };
    }
    
    const { data: videoSources, error: videoError } = await this._supabaseClient
      .from('google_sources')
      .select('id, name')
      .in('id', videoIds);
    
    if (videoError || !videoSources) {
      return {
        expertDocumentId: doc.id,
        documentName: docName,
        documentType: doc.document_types?.document_type || 'Unknown',
        presentationId: null,
        presentationTitle: null,
        confidence: 'low',
        reason: 'Error fetching video sources',
        assetExists: false,
        folderPath: documentSource.path || 'Unknown'
      };
    }
    
    // Create a map of video IDs to names
    const videoNames: Record<string, string> = {};
    videoSources.forEach((v: any) => {
      videoNames[v.id] = v.name || '';
    });
    
    // Find the best match based on name similarity
    let bestMatch = null;
    let bestScore = 0;
    
    for (const presentation of presentations) {
      const videoName = videoNames[presentation.video_source_id] || '';
      const score = this.calculateNameSimilarity(docName, videoName);
      
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = presentation;
      }
    }
    
    if (!bestMatch) {
      return {
        expertDocumentId: doc.id,
        documentName: docName,
        documentType: doc.document_types?.document_type || 'Unknown',
        presentationId: null,
        presentationTitle: null,
        confidence: 'low',
        reason: 'No name match found',
        assetExists: false,
        folderPath: documentSource.path || 'Unknown'
      };
    }
    
    // Check if a presentation asset already exists
    const { data: existingAssets, error: assetError } = await this._supabaseClient
      .from('media_presentation_assets')
      .select('id')
      .eq('presentation_id', bestMatch.id)
      .eq('expert_document_id', doc.id);
    
    const assetExists = !assetError && existingAssets && existingAssets.length > 0;
    
    // Determine confidence based on similarity score
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (bestScore > 0.8) {
      confidence = 'high';
    } else if (bestScore > 0.6) {
      confidence = 'medium';
    }
    
    return {
      expertDocumentId: doc.id,
      documentName: docName,
      documentType: doc.document_types?.document_type || 'Unknown',
      presentationId: bestMatch.id,
      presentationTitle: bestMatch.title,
      confidence,
      reason: `Name similarity score: ${bestScore.toFixed(2)}`,
      assetExists,
      folderPath: documentSource.path || 'Unknown'
    };
  }
  
  /**
   * Check if two file names are related
   */
  private areNamesRelated(name1: string, name2: string): boolean {
    // Clean and normalize the names
    const clean1 = name1.toLowerCase().replace(/\.[^/.]+$/, ''); // Remove extension
    const clean2 = name2.toLowerCase().replace(/\.[^/.]+$/, ''); // Remove extension
    
    // Check if one is a substring of the other
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      return true;
    }
    
    // Calculate similarity score
    return this.calculateNameSimilarity(clean1, clean2) > 0.7;
  }
  
  /**
   * Calculate similarity score between two strings
   */
  private calculateNameSimilarity(str1: string, str2: string): number {
    // Implement a similarity algorithm
    // Simple implementation: check for common words
    const words1 = str1.toLowerCase().split(/[^a-z0-9]+/);
    const words2 = str2.toLowerCase().split(/[^a-z0-9]+/);
    
    // Filter out short words and common words
    const commonWords = ['the', 'and', 'of', 'in', 'to', 'for', 'a', 'on', 'with'];
    const filteredWords1 = words1.filter(w => w.length > 2 && !commonWords.includes(w));
    const filteredWords2 = words2.filter(w => w.length > 2 && !commonWords.includes(w));
    
    // Calculate intersection
    const intersection = filteredWords1.filter(w => filteredWords2.includes(w));
    
    // Calculate Jaccard similarity
    const union = new Set([...filteredWords1, ...filteredWords2]);
    
    if (union.size === 0) {
      return 0;
    }
    
    return intersection.length / union.size;
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
        .from('google_expert_documents')
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
          .from('google_expert_documents')
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
        .from('google_sources')
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
            .from('google_expert_documents')
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
   * Update AI summary status for expert documents matching the DHG criteria
   * Uses similar filters to SQL query for documents in Dynamic Healing Discussion Group
   */
  public async updateDhgExpertDocumentsStatus(
    status: 'pending' | 'processing' | 'completed' | 'error',
    documentTypeId: string
  ): Promise<{success: number, failed: number}> {
    try {
      Logger.info(`Using document type ID: ${documentTypeId}`);
      Logger.info('Fetching sources from Dynamic Healing Discussion Group...');
      
      // Get sources from the specified folder and its paths
      const { data: folderSources, error: folderError } = await this._supabaseClient
        .from('google_sources')
        .select('id')
        .or(`drive_id.eq.1wriOM2j2IglnMcejplqG_XcCxSIfoRMV,path.like.%/1wriOM2j2IglnMcejplqG_XcCxSIfoRMV/%,path.like.%Dynamic Healing Discussion Group%`);
      
      if (folderError) {
        Logger.error(`Error fetching sources:`, folderError);
        return { success: 0, failed: 0 };
      }
      
      if (!folderSources || folderSources.length === 0) {
        Logger.info(`No matching sources found`);
        return { success: 0, failed: 0 };
      }
      
      const sourceIds = folderSources.map((s: any) => s.id);
      Logger.info(`Found ${sourceIds.length} matching sources`);
      
      // Process source IDs in batches to avoid Supabase limitations
      const batchSize = 50;
      let allDocIds: string[] = [];
      
      for (let i = 0; i < sourceIds.length; i += batchSize) {
        const batchSourceIds = sourceIds.slice(i, i + batchSize);
        Logger.info(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(sourceIds.length/batchSize)} (${batchSourceIds.length} source IDs)`);
        
        const { data: docsInBatch, error: batchError } = await this._supabaseClient
          .from('google_expert_documents')
          .select('id')
          .eq('document_type_id', documentTypeId)
          .eq('processing_status', 'completed')
          .in('source_id', batchSourceIds);
          
        if (batchError) {
          Logger.error(`Error in batch ${Math.floor(i/batchSize) + 1}:`, batchError);
        } else if (docsInBatch && docsInBatch.length > 0) {
          Logger.info(`Found ${docsInBatch.length} documents in batch ${Math.floor(i/batchSize) + 1}`);
          const docIds = docsInBatch.map((doc: any) => doc.id);
          allDocIds = [...allDocIds, ...docIds];
        }
      }
      
      if (allDocIds.length === 0) {
        Logger.info('No documents found that match all criteria');
        return { success: 0, failed: 0 };
      }
      
      Logger.info(`Found ${allDocIds.length} total documents to update`);
      
      // Update the documents using our batch method
      return await this.updateMultipleAiSummaryStatus(allDocIds, status);
    } catch (error) {
      Logger.error('Error updating DHG expert documents status:', error);
      return { success: 0, failed: 0 };
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
        .from('google_sources')
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
      // 4. Processing status is 'completed' (lowercase)
      // 5. AI summary status is pending or null
      const { data, error } = await this._supabaseClient
        .from('google_expert_documents')
        .select(`
          id,
          document_type_id,
          document_types(document_type),
          expert_id,
          ai_summary_status,
          source_id,
          processing_status
        `)
        .eq('document_type_id', videoSummaryTypeId)
        .not('raw_content', 'is', null)
        .eq('processing_status', 'completed')
        .in('source_id', sourceIds)
        .or('ai_summary_status.eq.pending,ai_summary_status.is.null')
        .limit(limit);
      
      if (error) {
        Logger.error('Error fetching documents needing AI summary:', error);
        
        // Try one more time with a simplified query that doesn't check status
        Logger.info('Trying simplified query without status checks as last resort...');
        const { data: basicData, error: basicError } = await this._supabaseClient
          .from('google_expert_documents')
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
        const filteredData = basicData.filter((doc: {processing_status: string, ai_summary_status: string | null}) => 
          doc.processing_status === 'completed' && 
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
        .from('media_presentations')
        .select(`
          id,
          title,
          video_source_id
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
        // Get presentations that are associated with the specified expert through google_sources_experts
        const { data: sourcesWithExpert, error: sourcesError } = await this.supabaseClient
          .from('google_sources_experts')
          .select('source_id')
          .eq('expert_id', options.expertId);
        
        if (sourcesError) {
          Logger.error('Error fetching sources for expert:', sourcesError);
        } else if (sourcesWithExpert && sourcesWithExpert.length > 0) {
          const sourceIds = sourcesWithExpert.map((s: any) => s.source_id);
          filteredPresentations = presentations.filter((p: any) => 
            p.video_source_id && sourceIds.includes(p.video_source_id)
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
          
          if (presentation.video_source_id) {
            const { data: source, error: sourceError } = await this.supabaseClient
              .from('google_sources_experts')
              .select('expert_id')
              .eq('source_id', presentation.video_source_id)
              .single();
              
            if (!sourceError && source && source.expert_id) {
              expertId = source.expert_id;
              
              // Now get the expert name
              const { data: expert, error: expertError } = await this.supabaseClient
                .from('expert_profiles')
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
              .from('google_expert_documents')
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

  /**
   * Find top-level folders with main_video_id but no presentations
   * @param options Optional parameters for the search
   * @returns Array of folder objects that need presentations
   */
  async findFoldersWithoutPresentations(options?: {
    limit?: number;
  }): Promise<any[]> {
    try {
      process.stdout.write('Finding top-level folders with main_video_id...\n');
      
      // Step 1: Find top-level folders (path_depth = 0) with main_video_id not null
      const { data: topLevelFolders, error: foldersError } = await this._supabaseClient
        .from('google_sources')
        .select('id, name, drive_id, path, main_video_id, path_depth')
        .eq('path_depth', 0)
        .not('main_video_id', 'is', null)
        .order('name')
        .limit(options?.limit || 1000);
      
      if (foldersError) {
        process.stdout.write(`ERROR fetching top-level folders: ${foldersError.message}\n`);
        throw foldersError;
      }
      
      if (!topLevelFolders || topLevelFolders.length === 0) {
        process.stdout.write('No top-level folders with main_video_id found.\n');
        return [];
      }
      
      process.stdout.write(`Found ${topLevelFolders.length} top-level folders with main_video_id.\n`);
      
      // Step 2: Check which folders don't have presentations
      const missingPresentations = [];
      
      for (const folder of topLevelFolders) {
        // Check if there's a presentation for this folder
        const { data: presentations, error: presError } = await this._supabaseClient
          .from('media_presentations')
          .select('id, title')
          .eq('high_level_folder_source_id', folder.id);
        
        if (presError) {
          process.stdout.write(`ERROR checking presentations for folder ${folder.id}: ${presError.message}\n`);
          continue;
        }
        
        // If no presentations, add to missing list
        if (!presentations || presentations.length === 0) {
          missingPresentations.push({
            id: folder.id,
            name: folder.name,
            drive_id: folder.drive_id,
            main_video_id: folder.main_video_id,
            path: folder.path
          });
        }
      }
      
      return missingPresentations;
    } catch (error) {
      Logger.error('Error in findFoldersWithoutPresentations:', error);
      throw error;
    }
  }

  /**
   * Find videos that need text extraction/processing
   * @param options Optional parameters for the search
   * @returns Array of video objects that need processing
   */
  async findVideosNeedingProcessing(options?: {
    includeProcessed?: boolean;
    limit?: number;
    folderIds?: string[];
    searchName?: string;
    forceUnprocessed?: boolean;
  }): Promise<any[]> {
    try {
      process.stdout.write('Searching for videos that need processing...\n');
      const videosNeedingProcessing = [];
      
      // Build the query for folders with main_video_id
      let query = this._supabaseClient
        .from('google_sources')
        .select('id, name, drive_id, path, main_video_id')
        .not('main_video_id', 'is', null);
        
      // If searchName is provided, filter by folder name
      if (options?.searchName) {
        process.stdout.write(`Filtering for folders containing: ${options.searchName}\n`);
        query = query.ilike('name', `%${options.searchName}%`);
      }
      
      // Execute query with limit and order
      const { data: folders, error: foldersError } = await query
        .order('name')
        .limit(options?.limit || 1000);
      
      if (foldersError) {
        process.stdout.write(`ERROR fetching folders with main_video_id: ${foldersError.message}\n`);
        throw foldersError;
      }
      
      if (!folders || folders.length === 0) {
        process.stdout.write('No folders with main_video_id found.\n');
        return [];
      }
      
      process.stdout.write(`Found ${folders.length} folders with main_video_id to check.\n`);
      
      // Filter by folder IDs if provided
      const filteredFolders = options?.folderIds 
        ? folders.filter((folder: any) => options.folderIds?.includes(folder.id))
        : folders;
      
      for (const folder of filteredFolders) {
        if (!folder.main_video_id) continue;
        
        // Check if the main video needs text extraction (raw_content is null)
        const { data: expertDocuments, error: docsError } = await this._supabaseClient
          .from('google_expert_documents')
          .select('id, raw_content')
          .eq('source_id', folder.main_video_id);
        
        if (docsError) {
          process.stdout.write(`ERROR checking expert documents for video ${folder.main_video_id}: ${docsError.message}\n`);
          continue;
        }
        
        const needsProcessing = !expertDocuments || 
                               expertDocuments.length === 0 || 
                               expertDocuments.every((doc: any) => doc.raw_content === null);
        
        // Debug info about why a file does/doesn't need processing
        if (options?.searchName) {
          if (needsProcessing) {
            process.stdout.write(`Video ${folder.main_video_id} needs processing because: `);
            if (!expertDocuments) {
              process.stdout.write('No expert documents found\n');
            } else if (expertDocuments.length === 0) {
              process.stdout.write('Expert documents array is empty\n');
            } else {
              process.stdout.write('All expert documents have null raw_content\n');
              expertDocuments.forEach((doc: any, index: number) => {
                process.stdout.write(`  Doc ${index + 1}: ID=${doc.id}, raw_content=${doc.raw_content === null ? 'null' : 'present'}\n`);
              });
            }
          } else {
            process.stdout.write(`Video ${folder.main_video_id} (${folder.name}) already processed: `);
            process.stdout.write(`${expertDocuments.length} expert documents found with content\n`);
            expertDocuments.forEach((doc: any, index: number) => {
              process.stdout.write(`  Doc ${index + 1}: ID=${doc.id}, raw_content=${doc.raw_content === null ? 'null' : 'present'}\n`);
            });
          }
        }
        
        // Include the video if it needs processing, or if include-processed flag is set,
        // or if force-unprocessed is set
        if (needsProcessing || options?.includeProcessed || options?.forceUnprocessed) {
          // Get the video details
          const { data: videoDetails, error: videoError } = await this._supabaseClient
            .from('google_sources')
            .select('id, name, mime_type')
            .eq('id', folder.main_video_id)
            .single();
            
          if (videoError || !videoDetails) {
            process.stdout.write(`ERROR fetching video details for ${folder.main_video_id}: ${videoError?.message || 'No details found'}\n`);
            continue;
          }
          
          videosNeedingProcessing.push({
            id: videoDetails.id,
            name: videoDetails.name,
            folder_name: folder.name,
            folder_id: folder.id,
            mime_type: videoDetails.mime_type,
            needs_processing: options?.forceUnprocessed ? true : needsProcessing
          });
        }
      }
      
      process.stdout.write(`Found ${videosNeedingProcessing.length} videos that need processing.\n`);
      return videosNeedingProcessing;
    } catch (error) {
      process.stdout.write(`ERROR in findVideosNeedingProcessing: ${error instanceof Error ? error.message : String(error)}\n`);
      throw error;
    }
  }
  
  /**
   * Create presentations for missing high-level folders
   * @param folders Array of folder objects that need presentations
   * @param options Optional parameters for the operation
   * @returns Information about created presentations
   */
  async createMissingPresentations(folders: any[], options?: {
    dryRun?: boolean;
    batchSize?: number;
    verbose?: boolean;
    createAssets?: boolean;
  }): Promise<{
    success: boolean;
    created: any[];
    failed: any[];
    message?: string;
    assets?: any;
  }> {
    try {
      // Only run in dry run mode if explicitly set to true or if not specified
      const dryRun = options?.dryRun === undefined ? true : options.dryRun;
      const batchSize = options?.batchSize || 10;
      const verbose = options?.verbose || false;
      
      process.stdout.write(`${dryRun ? '[DRY RUN] ' : ''}Creating presentations for ${folders.length} folders (batch size: ${batchSize})\n`);
      
      // Limit to batch size
      const foldersToProcess = folders.slice(0, batchSize);
      
      if (foldersToProcess.length === 0) {
        return {
          success: true,
          created: [],
          failed: [],
          message: 'No folders to process'
        };
      }
      
      const created: any[] = [];
      const failed: any[] = [];
      
      for (const folder of foldersToProcess) {
        try {
          process.stdout.write(`${dryRun ? '[DRY RUN] ' : ''}Processing folder: ${folder.name} (${folder.id})\n`);
          
          if (!folder.main_video_id) {
            process.stdout.write(`Skipping folder ${folder.name} - no main_video_id\n`);
            failed.push({
              folder: folder,
              reason: 'No main_video_id'
            });
            continue;
          }
          
          // Get video details from main_video_id
          const { data: videoDetails, error: videoError } = await this._supabaseClient
            .from('google_sources')
            .select('id, name, mime_type, drive_id, created_at, modified_at')
            .eq('id', folder.main_video_id)
            .single();
          
          if (videoError || !videoDetails) {
            process.stdout.write(`Error getting video details for ${folder.main_video_id}: ${videoError?.message || 'Not found'}\n`);
            failed.push({
              folder: folder,
              reason: `Video details error: ${videoError?.message || 'Not found'}`
            });
            continue;
          }
          
          process.stdout.write(`Found video: ${videoDetails.name} (${videoDetails.id})\n`);
          
          // Get expert document for the video
          let expertDocumentId = null;
          const { data: videoDocuments, error: videoDocError } = await this._supabaseClient
            .from('google_expert_documents')
            .select('id')
            .eq('source_id', folder.main_video_id);
            
          if (!videoDocError && videoDocuments && videoDocuments.length > 0) {
            expertDocumentId = videoDocuments[0].id;
            process.stdout.write(`Found expert document for video: ${expertDocumentId}\n`);
          } else {
            process.stdout.write(`No expert document found for video ${folder.main_video_id}\n`);
          }
          
          // Prepare the new presentation data
          // Only include fields that exist in the presentations table schema
          const newPresentation = {
            id: uuidv4(), // Generate a UUID for the new presentation
            title: folder.name,
            video_source_id: folder.main_video_id,
            high_level_folder_source_id: folder.id,
            root_drive_id: folder.drive_id,
            web_view_link: `https://drive.google.com/drive/folders/${folder.drive_id}`,
            duration_seconds: 0, // We'll update this when we get actual video duration
            expert_document_id: expertDocumentId, // Set from the video's expert document
            view_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Try to get video metadata for duration
          try {
            const { data: videoMetadata } = await this._supabaseClient
              .from('video_metadata')
              .select('duration_seconds')
              .eq('source_id', folder.main_video_id)
              .single();
              
            if (videoMetadata?.duration_seconds) {
              newPresentation.duration_seconds = videoMetadata.duration_seconds;
              process.stdout.write(`Found video duration: ${videoMetadata.duration_seconds} seconds\n`);
            }
          } catch (metadataError) {
            process.stdout.write(`No video metadata found. Setting default duration.\n`);
          }
          
          // Try to find an expert based on the folder name or video name
          const folderNameLower = folder.name.toLowerCase();
          const videoNameLower = videoDetails.name.toLowerCase();
          
          // Common expert names to look for
          const expertKeywords = [
            'porges', 'clawson', 'carter', 'wager', 'naviaux', 'hanscom', 
            'lederman', 'lustig', 'pennebaker', 'aria', 'garland', 'simonsson',
            'germer', 'wilkinson', 'luskin', 'panda', 'sutphin'
          ];
          
          // Look for expert in folder name
          const matchingExpertKeyword = expertKeywords.find(keyword => 
            folderNameLower.includes(keyword) || videoNameLower.includes(keyword)
          );
          
          if (matchingExpertKeyword) {
            process.stdout.write(`Found potential expert keyword: ${matchingExpertKeyword}\n`);
            
            // Try to find the expert ID from the keyword
            const { data: expertData, error: expertError } = await this._supabaseClient
              .from('expert_profiles')
              .select('id, expert_name')
              .ilike('expert_name', `%${matchingExpertKeyword}%`)
              .limit(1);
            
            if (!expertError && expertData && expertData.length > 0) {
              process.stdout.write(`Found expert: ${expertData[0].expert_name} (${expertData[0].id})\n`);
              
              // Try to find an expert document for this expert to link
              try {
                // First try to find a bio document
                const { data: bioDocuments, error: bioError } = await this._supabaseClient
                  .from('google_expert_documents')
                  .select('id, document_type_id, expert_id')
                  .eq('expert_id', expertData[0].id)
                  .eq('document_type_id', '4') // Bio type (4 = Bio)
                  .order('created_at', { ascending: false })
                  .limit(1);
                
                if (!bioError && bioDocuments && bioDocuments.length > 0) {
                  // Found a bio document
                  newPresentation.expert_document_id = bioDocuments[0].id;
                  process.stdout.write(`Found expert bio document: ${bioDocuments[0].id}\n`);
                } else {
                  // If no bio, try CV or Profile
                  const { data: otherDocs, error: docsError } = await this._supabaseClient
                    .from('google_expert_documents')
                    .select('id, document_type_id, expert_id')
                    .eq('expert_id', expertData[0].id)
                    .in('document_type_id', ['21', '22']) // 21 = CV, 22 = Profile
                    .order('created_at', { ascending: false })
                    .limit(1);
                  
                  if (!docsError && otherDocs && otherDocs.length > 0) {
                    newPresentation.expert_document_id = otherDocs[0].id;
                    process.stdout.write(`Found expert ${otherDocs[0].document_type_id === '21' ? 'CV' : 'Profile'} document: ${otherDocs[0].id}\n`);
                  } else {
                    // If no appropriate document found, try any expert document
                    const { data: anyDocs, error: anyError } = await this._supabaseClient
                      .from('google_expert_documents')
                      .select('id, document_type_id, expert_id')
                      .eq('expert_id', expertData[0].id)
                      .order('created_at', { ascending: false })
                      .limit(1);
                    
                    if (!anyError && anyDocs && anyDocs.length > 0) {
                      newPresentation.expert_document_id = anyDocs[0].id;
                      process.stdout.write(`Found expert document (type ${anyDocs[0].document_type_id}): ${anyDocs[0].id}\n`);
                    } else {
                      process.stdout.write(`No expert documents found for expert ${expertData[0].expert_name}\n`);
                    }
                  }
                }
              } catch (docFindError) {
                process.stdout.write(`Error finding expert document: ${docFindError instanceof Error ? docFindError.message : String(docFindError)}\n`);
              }
            } else {
              process.stdout.write(`No expert found for keyword: ${matchingExpertKeyword}\n`);
            }
          }
          
          if (dryRun) {
            process.stdout.write(`[DRY RUN] Would create presentation: ${JSON.stringify(newPresentation, null, 2)}\n`);
            created.push({
              folder: folder,
              presentation: newPresentation
            });
          } else {
            // Actually create the presentation
            const { data: insertedPresentation, error: insertError } = await this._supabaseClient
              .from('media_presentations')
              .insert(newPresentation)
              .select();
            
            if (insertError) {
              process.stdout.write(`Error creating presentation for folder ${folder.name}: ${insertError.message}\n`);
              failed.push({
                folder: folder,
                reason: `Insert error: ${insertError.message}`
              });
            } else {
              process.stdout.write(`Created presentation: ${newPresentation.title} (${newPresentation.id})\n`);
              created.push({
                folder: folder,
                presentation: insertedPresentation[0]
              });
            }
          }
        } catch (folderError) {
          process.stdout.write(`Error processing folder ${folder.name}: ${folderError instanceof Error ? folderError.message : String(folderError)}\n`);
          failed.push({
            folder: folder,
            reason: `Processing error: ${folderError instanceof Error ? folderError.message : String(folderError)}`
          });
        }
      }
      
      const message = dryRun
        ? `[DRY RUN] Would create ${created.length} presentations (${failed.length} would fail)`
        : `Created ${created.length} presentations (${failed.length} failed)`;
      
      process.stdout.write(`${message}\n`);
      
      // Create presentation assets if requested
      let assetsResult = null;
      if (options?.createAssets && created.length > 0) {
        process.stdout.write(`\nCreating presentation assets for ${created.length} new presentations...\n`);
        
        // Get the presentation IDs from the created presentations
        const presentationIds = created.map(c => c.presentation.id);
        
        try {
          // We can't directly use createPresentationAssetsCommand in dry-run mode
          // because the presentations don't actually exist yet,
          // so we'll simulate the asset creation process for dry-run
          
          // Loop through presentations and create assets for each
          const assetsResults = [];
          
          for (const createdItem of created) {
            const presentationId = createdItem.presentation.id;
            const folderId = createdItem.folder.id;
            process.stdout.write(`Creating assets for presentation ${presentationId}...\n`);
            
            if (dryRun) {
              // In dry-run mode, we'll do our own asset discovery
              process.stdout.write(`[DRY RUN] Finding assets for folder ${createdItem.folder.name} (${folderId})...\n`);
              
              // Get files in the high-level folder
              const { data: folderFiles, error: filesError } = await this._supabaseClient
                .from('google_sources')
                .select('id, name, mime_type, drive_id, parent_folder_id')
                .eq('parent_folder_id', createdItem.folder.drive_id)
                .not('mime_type', 'eq', 'application/vnd.google-apps.folder');
              
              if (filesError) {
                process.stdout.write(`Error fetching files for folder: ${filesError.message}\n`);
                assetsResults.push({
                  presentationId,
                  result: {
                    success: false,
                    message: `Error fetching files: ${filesError.message}`
                  }
                });
                continue;
              }
              
              if (!folderFiles || folderFiles.length === 0) {
                process.stdout.write(`No files found in folder.\n`);
              } else {
                process.stdout.write(`[DRY RUN] Found ${folderFiles.length} files in folder. Would create assets for:\n`);
                
                // Show files that would become assets
                for (const file of folderFiles) {
                  if (file.id !== createdItem.folder.main_video_id) { // Skip the main video
                    process.stdout.write(`  - ${file.name} (${file.id}) - ${file.mime_type}\n`);
                  }
                }
              }
              
              // Get subfolders to check for more files
              const { data: subfolders, error: subfolderError } = await this._supabaseClient
                .from('google_sources')
                .select('id, name, drive_id')
                .eq('parent_folder_id', createdItem.folder.drive_id)
                .eq('mime_type', 'application/vnd.google-apps.folder');
              
              if (!subfolderError && subfolders && subfolders.length > 0) {
                process.stdout.write(`[DRY RUN] Found ${subfolders.length} subfolders. Would search for files in each.\n`);
              }
              
              assetsResults.push({
                presentationId,
                result: {
                  success: true,
                  message: `[DRY RUN] Would create assets for ${folderFiles ? folderFiles.length - 1 : 0} files and search ${subfolders ? subfolders.length : 0} subfolders`
                }
              });
            } else {
              // In non-dry-run mode, use the actual command
              const createPresentationAssetsCommand = require('../commands/create-presentation-assets').createPresentationAssetsCommand;
              
              // Call create-presentation-assets command for this presentation
              const assetResult = await createPresentationAssetsCommand({
                presentationId: presentationId,
                dryRun: false,
                depth: 6, // Search up to 6 levels deep
                skipExisting: false // Don't skip, as this is a new presentation
              });
              
              assetsResults.push({
                presentationId,
                result: assetResult
              });
            }
          }
          
          assetsResult = assetsResults;
        } catch (assetsError) {
          process.stdout.write(`Error creating presentation assets: ${assetsError instanceof Error ? assetsError.message : String(assetsError)}\n`);
          assetsResult = {
            success: false,
            error: assetsError instanceof Error ? assetsError.message : String(assetsError)
          };
        }
      }
      
      return {
        success: true,
        created,
        failed,
        message,
        assets: assetsResult
      };
    } catch (error) {
      process.stdout.write(`ERROR in createMissingPresentations: ${error instanceof Error ? error.message : String(error)}\n`);
      return {
        success: false,
        created: [],
        failed: [],
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}