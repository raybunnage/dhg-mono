import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

/**
 * Interface for expert document with source information
 */
interface ExpertDocWithSource {
  id: string;
  source_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  sources_google: {
    id: string;
    name: string;
    path?: string;
    mime_type: string;
    modified_at: string;
  };
}

/**
 * Service for working with expert documents and creating presentations from them
 */
export class ExpertDocumentService {
  private supabase = SupabaseClientService.getInstance().getClient();

  /**
   * Get expert documents for MP4 files in a folder without presentations
   */
  async getExpertDocsForMp4Files(options: {
    folderId: string;
    documentType?: string;
    limit?: number;
  }): Promise<{
    totalDocuments: number;
    docsInFolder: number;
    docsWithoutPresentations: number;
    documents: ExpertDocWithSource[];
  }> {
    const { folderId, documentType = 'Video Summary Transcript', limit } = options;
    
    try {
      // Step 1: Get folder info
      const { data: folderInfo, error: folderError } = await this.supabase
        .from('sources_google')
        .select('id, name, path')
        .eq('drive_id', folderId)
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .single();
      
      if (folderError) {
        Logger.error(`Error fetching folder info: ${folderError.message}`);
        throw new Error(`Failed to get folder info for ID ${folderId}`);
      }
      
      // Step 2: Get document type ID
      const { data: docTypeInfo, error: docTypeError } = await this.supabase
        .from('document_types')
        .select('id, document_type')
        .eq('document_type', documentType)
        .single();
      
      if (docTypeError) {
        Logger.error(`Error fetching document type: ${docTypeError.message}`);
        throw new Error(`Failed to get document type for "${documentType}"`);
      }
      
      // Step 3: Get expert documents
      let expertDocQuery = this.supabase
        .from('expert_documents')
        .select(`
          id, 
          source_id,
          status,
          created_at,
          updated_at,
          sources_google:source_id(
            id, 
            name, 
            path, 
            mime_type, 
            modified_at
          )
        `)
        .eq('document_type_id', docTypeInfo.id);
      
      // Add limit if specified
      if (limit) {
        expertDocQuery = expertDocQuery.limit(limit);
      }
      
      const { data: expertDocuments, error: expertDocError } = await expertDocQuery;
      
      if (expertDocError) {
        Logger.error(`Error fetching expert documents: ${expertDocError.message}`);
        throw new Error('Failed to get expert documents');
      }
      
      if (!expertDocuments || expertDocuments.length === 0) {
        return { 
          totalDocuments: 0, 
          docsInFolder: 0, 
          docsWithoutPresentations: 0, 
          documents: [] 
        };
      }
      
      // Step 4: Filter to only include expert documents for MP4 files in the folder
      const expertDocsInFolder = expertDocuments.filter(doc => {
        const source = doc.sources_google as any;
        if (!source) return false;
        
        // Check if path contains the folder name
        if (source.path && (
          source.path.includes(folderInfo.name) || 
          source.path.startsWith(folderInfo.name)
        )) {
          return true;
        }
        
        return false;
      }).map(doc => {
        return {
          id: doc.id,
          source_id: doc.source_id,
          status: doc.status,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          sources_google: doc.sources_google as any
        } as ExpertDocWithSource;
      });
      
      if (expertDocsInFolder.length === 0) {
        return { 
          totalDocuments: expertDocuments.length, 
          docsInFolder: 0, 
          docsWithoutPresentations: 0, 
          documents: [] 
        };
      }
      
      // Step 5: Get existing presentations
      const { data: existingPresentations, error: presentationError } = await this.supabase
        .from('presentations')
        .select('id, title, main_video_id')
        .not('main_video_id', 'is', null);
      
      if (presentationError) {
        Logger.error(`Error fetching existing presentations: ${presentationError.message}`);
        throw new Error('Failed to get existing presentations');
      }
      
      // Create a set of MP4 file IDs that already have presentations
      const existingVideoIds = new Set();
      if (existingPresentations) {
        existingPresentations.forEach(p => {
          if (p.main_video_id) {
            existingVideoIds.add(p.main_video_id);
          }
        });
      }
      
      // Step 6: Filter to only include expert documents for MP4 files without presentations
      const expertDocsToProcess = expertDocsInFolder.filter(doc => 
        !existingVideoIds.has(doc.source_id)
      );
      
      return {
        totalDocuments: expertDocuments.length,
        docsInFolder: expertDocsInFolder.length,
        docsWithoutPresentations: expertDocsToProcess.length,
        documents: expertDocsToProcess
      };
      
    } catch (error: any) {
      Logger.error(`Unexpected error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create presentations from expert documents
   */
  async createPresentationsFromExpertDocs(options: {
    expertDocs: ExpertDocWithSource[];
    isDryRun?: boolean;
  }): Promise<{
    total: number;
    created: number;
    details: any[];
  }> {
    const { expertDocs, isDryRun = true } = options;
    
    if (expertDocs.length === 0) {
      return { total: 0, created: 0, details: [] };
    }
    
    if (isDryRun) {
      // In dry run mode, just return the docs
      return {
        total: expertDocs.length,
        created: 0,
        details: expertDocs.map(doc => ({
          expertDocId: doc.id,
          sourceId: doc.source_id,
          sourceName: doc.sources_google.name,
          created: false,
          dryRun: true
        }))
      };
    }
    
    // Actually create presentations
    let createdCount = 0;
    const createdDetails: any[] = [];
    
    for (const doc of expertDocs) {
      try {
        const source = doc.sources_google;
        
        // Extract useful metadata for the presentation
        let folderPath = source.path || '/';
        
        // Make sure folder path starts with a slash
        if (!folderPath.startsWith('/')) {
          folderPath = '/' + folderPath;
        }
        
        // Try to parse a date from the filename or path
        let recordedDate = null;
        const datePattern = /\d{1,2}[-\._]\d{1,2}[-\._]\d{2,4}|\d{4}[-\._]\d{1,2}[-\._]\d{1,2}/;
        const dateMatch = source.name.match(datePattern) || source.path?.match(datePattern);
        
        if (dateMatch) {
          // Attempt to parse the date
          try {
            const dateStr = dateMatch[0].replace(/[-\._]/g, '-');
            recordedDate = new Date(dateStr).toISOString();
          } catch (e) {
            // If we can't parse the date, just use the file's modified time
            recordedDate = source.modified_at;
          }
        } else {
          // Use modified time as fallback
          recordedDate = source.modified_at;
        }
        
        // Try to extract a presenter name from the filename
        let presenterName = null;
        // Look for patterns like "Name.Topic" or similar
        const namePattern = /^([\w\s]+?)\./;
        const nameMatch = source.name.match(namePattern);
        
        if (nameMatch && nameMatch[1]) {
          presenterName = nameMatch[1].trim();
        }
        
        // Create presentation record
        const newPresentation = {
          main_video_id: source.id,
          filename: source.name,
          folder_path: folderPath,
          title: source.name.replace(/\.[^.]+$/, ''), // Remove file extension
          recorded_date: recordedDate,
          presenter_name: presenterName,
          is_public: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          transcript_status: 'completed' // Since we have a expert document
        };
        
        // Insert the presentation
        const { data: presentationData, error: presentationError } = await this.supabase
          .from('presentations')
          .insert(newPresentation)
          .select();
        
        if (presentationError) {
          Logger.error(`Error creating presentation for ${source.name}: ${presentationError.message}`);
          continue;
        }
        
        if (!presentationData || presentationData.length === 0) {
          Logger.error(`No presentation data returned for ${source.name}`);
          continue;
        }
        
        const presentationId = presentationData[0].id;
        Logger.info(`Created presentation for ${source.name} (ID: ${presentationId})`);
        
        // Create presentation_asset record linking to the expert document
        const newAsset = {
          presentation_id: presentationId,
          expert_document_id: doc.id,
          source_id: source.id,
          asset_type: 'transcript',
          asset_role: 'main',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { data: assetData, error: assetError } = await this.supabase
          .from('presentation_assets')
          .insert(newAsset)
          .select();
        
        if (assetError) {
          Logger.error(`Error creating presentation asset for ${source.name}: ${assetError.message}`);
          continue;
        }
        
        Logger.debug(`Created presentation asset linking presentation ${presentationId} to expert document ${doc.id}`);
        
        createdCount++;
        createdDetails.push({
          expertDocId: doc.id,
          presentationId: presentationId,
          sourceId: source.id,
          sourceName: source.name,
          created: true
        });
        
      } catch (error: any) {
        Logger.error(`Error processing expert document ${doc.id}: ${error.message}`);
      }
    }
    
    return {
      total: expertDocs.length,
      created: createdCount,
      details: createdDetails
    };
  }
}