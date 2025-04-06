import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as fs from 'fs';

interface PresentationReviewOptions {
  presentationId?: string;
  expertId?: string;
  status?: string;
  limit?: number;
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
}

interface ExpertDocument {
  id: string;
  document_type: string;
  document_type_id: string;
  has_raw_content: boolean;
  has_processed_content: boolean;
  created_at: string;
  updated_at: string;
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
  private supabaseClient: any;
  
  private constructor() {
    this.supabaseClient = SupabaseClientService.getInstance().getClient();
  }
  
  public static getInstance(): PresentationService {
    if (!PresentationService.instance) {
      PresentationService.instance = new PresentationService();
    }
    return PresentationService.instance;
  }
  
  /**
   * Get presentation details including its transcript
   */
  public async getPresentationWithTranscript(presentationId: string): Promise<PresentationWithTranscript | null> {
    try {
      // Get the presentation
      const { data: presentation, error } = await this.supabaseClient
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
      const { data: docType, error: docTypeError } = await this.supabaseClient
        .from('document_types')
        .select('id')
        .eq('name', 'summary')
        .single();
      
      if (docTypeError || !docType) {
        Logger.error('Error fetching summary document type:', docTypeError);
        return null;
      }
      
      // Get existing summary document
      const { data: summary, error: summaryError } = await this.supabaseClient
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
      // Get document type ID for summary
      const { data: docType, error: docTypeError } = await this.supabaseClient
        .from('document_types')
        .select('id')
        .eq('name', 'summary')
        .single();
      
      if (docTypeError || !docType) {
        Logger.error('Error fetching summary document type:', docTypeError);
        return false;
      }
      
      if (options.existingSummaryId) {
        // Update existing summary
        const { error: updateError } = await this.supabaseClient
          .from('expert_documents')
          .update({
            processed_content: options.summary,
            updated_at: new Date().toISOString()
          })
          .eq('id', options.existingSummaryId);
        
        if (updateError) {
          Logger.error('Error updating summary:', updateError);
          return false;
        }
      } else {
        // Create new summary document
        const { error: insertError } = await this.supabaseClient
          .from('expert_documents')
          .insert({
            expert_id: options.expertId,
            document_type_id: docType.id,
            processed_content: options.summary,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          Logger.error('Error creating summary:', insertError);
          return false;
        }
        
        // Associate summary with presentation in presentation_assets
        const { error: assetError } = await this.supabaseClient
          .from('presentation_assets')
          .insert({
            presentation_id: options.presentationId,
            asset_type: 'summary',
            created_at: new Date().toISOString()
          });
        
        if (assetError) {
          Logger.error('Error creating presentation asset for summary:', assetError);
          // Continue anyway as the document was created
        }
      }
      
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
      
      // Get presentation reviews with detailed information
      const presentationReviews = await Promise.all(
        filteredPresentations.map(async (presentation: any) => {
          // Get presentation assets
          const { data: assets, error: assetsError } = await this.supabaseClient
            .from('presentation_assets')
            .select('id, asset_type, created_at')
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
          
          // Get expert documents related to this presentation's expert
          let expertDocuments: any[] = [];
          
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
                source_id
              `)
              .eq('expert_id', expertId);
            
            if (docsError) {
              Logger.error('Error fetching expert documents:', docsError);
            } else if (docs) {
              expertDocuments = docs;
            }
          }
          
          // Check if we have the specific expert document for this presentation's source_id
          const hasTranscriptDocument = expertDocuments.some(doc => 
            doc.source_id === presentation.main_video_id && 
            doc.raw_content !== null && 
            doc.raw_content !== undefined
          );
          
          // Transform expert documents for review
          const transformedDocs = expertDocuments.map((doc: any) => ({
            id: doc.id,
            document_type: doc.document_types?.name || 'Unknown',
            document_type_id: doc.document_type_id || 'Unknown',
            has_raw_content: !!doc.raw_content,
            has_processed_content: !!doc.processed_content,
            created_at: doc.created_at,
            updated_at: doc.updated_at
          }));
          
          // Transform assets for review
          const transformedAssets = (assets || []).map((asset: any) => ({
            id: asset.id,
            type: asset.asset_type,
            status: 'Available' // Since we don't have file_path to check
          }));
          
          // Determine presentation status
          const status = hasTranscriptDocument ? 
            'has-transcript' : 
            this.determinePresentationStatus(transformedAssets, transformedDocs);
          
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
            has_raw_content: hasTranscriptDocument
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
    // Check if transcript exists
    const hasTranscript = assets.some(asset => 
      asset.asset_type === 'transcript' && asset.file_path
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