import { SupabaseClientService } from './supabase-client';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ArchiveDocumentOptions {
  originalPath: string;
  documentType: 'living_doc' | 'technical_spec' | 'guide' | 'report' | 'solution' | 'feature_doc' | 'other';
  archiveReason: string;
  supersededBy?: string;
  metadata?: Record<string, any>;
  archivedBy?: string;
}

export interface ArchivedDocument {
  id: string;
  original_path: string;
  file_name: string;
  document_type: string;
  archive_reason: string;
  superseded_by?: string;
  content?: string;
  metadata?: Record<string, any>;
  archive_date: string;
  archived_by: string;
}

export class DocumentArchivingService {
  private static instance: DocumentArchivingService;
  private supabase = SupabaseClientService.getInstance().getClient();

  private constructor() {}

  static getInstance(): DocumentArchivingService {
    if (!DocumentArchivingService.instance) {
      DocumentArchivingService.instance = new DocumentArchivingService();
    }
    return DocumentArchivingService.instance;
  }

  /**
   * Archive a document to the database and optionally move the file
   */
  async archiveDocument(options: ArchiveDocumentOptions): Promise<ArchivedDocument> {
    const { originalPath, documentType, archiveReason, supersededBy, metadata, archivedBy = 'system' } = options;
    
    // Read the document content
    let content: string | undefined;
    try {
      const fullPath = path.isAbsolute(originalPath) ? originalPath : path.join(process.cwd(), originalPath);
      content = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      console.warn(`Could not read file content for archiving: ${originalPath}`, error);
    }

    // Extract file name
    const fileName = path.basename(originalPath);

    // Insert into database
    const { data, error } = await this.supabase
      .from('sys_archived_documents')
      .insert({
        original_path: originalPath,
        file_name: fileName,
        document_type: documentType,
        archive_reason: archiveReason,
        superseded_by: supersededBy,
        content,
        metadata: metadata || {},
        archived_by: archivedBy
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to archive document: ${error.message}`);
    }

    return data;
  }

  /**
   * Archive multiple documents at once
   */
  async archiveDocuments(documents: ArchiveDocumentOptions[]): Promise<ArchivedDocument[]> {
    const results: ArchivedDocument[] = [];
    
    for (const doc of documents) {
      try {
        const archived = await this.archiveDocument(doc);
        results.push(archived);
      } catch (error) {
        console.error(`Failed to archive ${doc.originalPath}:`, error);
      }
    }

    return results;
  }

  /**
   * Move a physical file to an archive directory
   */
  async moveToArchiveDirectory(filePath: string, archiveDir?: string): Promise<string> {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);
    const fileName = path.basename(fullPath);
    
    // Create archive directory if it doesn't exist
    const archiveDirPath = archiveDir || path.join(dir, '.archive_docs');
    await fs.mkdir(archiveDirPath, { recursive: true });

    // Add date to filename
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const archivedFileName = `${baseName}.${date}${ext}`;
    const archivedPath = path.join(archiveDirPath, archivedFileName);

    // Move the file
    try {
      await fs.rename(fullPath, archivedPath);
      return archivedPath;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`File not found for archiving: ${fullPath}`);
        return '';
      }
      throw error;
    }
  }

  /**
   * Archive a living document with its metadata
   */
  async archiveLivingDocument(
    originalPath: string, 
    archiveReason: string,
    supersededBy?: string,
    moveFile: boolean = true
  ): Promise<ArchivedDocument> {
    // Extract metadata from the living doc if possible
    let metadata: Record<string, any> = {};
    try {
      const fullPath = path.isAbsolute(originalPath) ? originalPath : path.join(process.cwd(), originalPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Extract metadata from content
      const lastUpdatedMatch = content.match(/Last Updated:\s*(.+)/i);
      const statusMatch = content.match(/Status:\s*(.+)/i);
      const priorityMatch = content.match(/Priority:\s*(.+)/i);
      
      if (lastUpdatedMatch) metadata.last_updated = lastUpdatedMatch[1].trim();
      if (statusMatch) metadata.status = statusMatch[1].trim();
      if (priorityMatch) metadata.priority = priorityMatch[1].trim();
    } catch (error) {
      console.warn('Could not extract metadata from living doc:', error);
    }

    // Archive in database
    const archived = await this.archiveDocument({
      originalPath,
      documentType: 'living_doc',
      archiveReason,
      supersededBy,
      metadata,
      archivedBy: 'claude-code'
    });

    // Move physical file if requested
    if (moveFile) {
      try {
        const archivedPath = await this.moveToArchiveDirectory(originalPath);
        console.log(`Moved file to: ${archivedPath}`);
      } catch (error) {
        console.error('Failed to move file:', error);
      }
    }

    return archived;
  }

  /**
   * Get archived documents by type
   */
  async getArchivedDocuments(
    documentType?: string,
    limit: number = 100
  ): Promise<ArchivedDocument[]> {
    let query = this.supabase
      .from('sys_archived_documents')
      .select('*')
      .order('archive_date', { ascending: false })
      .limit(limit);

    if (documentType) {
      query = query.eq('document_type', documentType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to retrieve archived documents: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Search archived documents
   */
  async searchArchivedDocuments(searchTerm: string): Promise<ArchivedDocument[]> {
    const { data, error } = await this.supabase
      .from('sys_archived_documents')
      .select('*')
      .or(`file_name.ilike.%${searchTerm}%,archive_reason.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
      .order('archive_date', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to search archived documents: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get documents superseded by a specific document
   */
  async getSupersededDocuments(supersededBy: string): Promise<ArchivedDocument[]> {
    const { data, error } = await this.supabase
      .from('sys_archived_documents')
      .select('*')
      .eq('superseded_by', supersededBy)
      .order('archive_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to get superseded documents: ${error.message}`);
    }

    return data || [];
  }
}

// Export singleton instance
export const documentArchivingService = DocumentArchivingService.getInstance();