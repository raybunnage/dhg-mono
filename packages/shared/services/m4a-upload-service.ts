import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils';

export interface M4AUploadConfig {
  sourceMP4DriveId: string;     // Drive ID of source MP4
  localM4APath: string;         // Local path to M4A file
  parentFolderId: string;       // Google Drive folder ID
  sourceId: string;             // UUID of google_sources record
}

export class M4AUploadService {
  private drive: any;
  private supabase: SupabaseClient<any>;
  private logger = Logger;

  constructor(supabase: SupabaseClient<any>) {
    this.supabase = supabase;
    try {
      this.initializeGoogleDrive();
    } catch (error: any) {
      this.logger.warn(`Google Drive initialization failed: ${error.message}`);
      this.logger.warn('M4A upload functionality will be disabled');
    }
  }

  private initializeGoogleDrive(): void {
    try {
      // Load service account credentials
      const serviceAccountPath = path.join(process.cwd(), '.service-account.json');
      
      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error('Service account file not found at .service-account.json');
      }

      const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      
      // Create auth client
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });

      // Initialize Drive API
      this.drive = google.drive({ version: 'v3', auth });
      
      this.logger.info('Google Drive API initialized successfully');
    } catch (error: any) {
      this.logger.error(`Failed to initialize Google Drive API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Upload M4A file to Google Drive and update database
   */
  public async upload(config: M4AUploadConfig): Promise<string> {
    if (!this.drive) {
      throw new Error('Google Drive API not initialized. Please check service account configuration.');
    }
    
    try {
      this.logger.info(`Starting M4A upload for ${path.basename(config.localM4APath)}`);

      // Step 1: Check if M4A already exists in the target folder
      const m4aFilename = path.basename(config.localM4APath);
      const existingFile = await this.checkExistingFile(m4aFilename, config.parentFolderId);
      
      if (existingFile) {
        this.logger.info(`M4A file already exists in Google Drive: ${existingFile.id}`);
        await this.updateDatabase(existingFile.id, config);
        return existingFile.id;
      }

      // Step 2: Upload the M4A file
      const m4aDriveId = await this.uploadFile(config.localM4APath, config.parentFolderId);
      
      // Step 3: Create database entry for the M4A file
      await this.createSourceEntry(m4aDriveId, config);
      
      // Step 4: Update media processing status
      await this.updateProcessingStatus(config.sourceId, m4aDriveId);
      
      // Step 5: Link M4A to expert document
      await this.linkToDocument(m4aDriveId, config.sourceMP4DriveId);
      
      this.logger.info(`Successfully uploaded M4A file with Drive ID: ${m4aDriveId}`);
      return m4aDriveId;

    } catch (error: any) {
      this.logger.error(`Failed to upload M4A file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if file already exists in Google Drive folder
   */
  private async checkExistingFile(filename: string, folderId: string): Promise<any> {
    try {
      const response = await this.drive.files.list({
        q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 1
      });

      return response.data.files?.[0] || null;
    } catch (error: any) {
      this.logger.error(`Error checking existing file: ${error.message}`);
      return null;
    }
  }

  /**
   * Upload file to Google Drive
   */
  private async uploadFile(filePath: string, parentFolderId: string): Promise<string> {
    const filename = path.basename(filePath);
    const mimeType = 'audio/x-m4a';

    // Create file metadata
    const fileMetadata = {
      name: filename,
      parents: [parentFolderId],
      mimeType: mimeType
    };

    // Create media upload stream
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };

    try {
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink'
      });

      this.logger.info(`Uploaded ${filename} to Google Drive with ID: ${response.data.id}`);
      return response.data.id;

    } catch (error: any) {
      this.logger.error(`Failed to upload file to Google Drive: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create google_sources entry for M4A file
   */
  private async createSourceEntry(m4aDriveId: string, config: M4AUploadConfig): Promise<void> {
    const filename = path.basename(config.localM4APath);
    
    // Get the MP4 source record to copy metadata
    const { data: mp4Source, error: fetchError } = await this.supabase
      .from('google_sources')
      .select('*')
      .eq('drive_id', config.sourceMP4DriveId)
      .single();

    if (fetchError || !mp4Source) {
      throw new Error(`Failed to fetch MP4 source record: ${fetchError?.message || 'Not found'}`);
    }

    // Create M4A source entry
    const { error: insertError } = await this.supabase
      .from('google_sources')
      .insert({
        drive_id: m4aDriveId,
        name: filename,
        mime_type: 'audio/x-m4a',
        parent_folder_id: config.parentFolderId,
        path_depth: mp4Source.path_depth,
        folder_path: mp4Source.folder_path,
        is_folder: false,
        is_deleted: false,
        file_extension: 'm4a',
        size: fs.statSync(config.localM4APath).size,
        web_view_link: `https://drive.google.com/file/d/${m4aDriveId}/view`,
        created_time: new Date().toISOString(),
        modified_time: new Date().toISOString()
      });

    if (insertError) {
      throw new Error(`Failed to create google_sources entry: ${insertError.message}`);
    }

    this.logger.info(`Created google_sources entry for M4A file`);
  }

  /**
   * Update media processing status with M4A info
   */
  private async updateProcessingStatus(sourceId: string, m4aDriveId: string): Promise<void> {
    const { error } = await this.supabase
      .from('media_processing_status')
      .update({
        m4a_drive_id: m4aDriveId,
        m4a_uploaded_at: new Date().toISOString(),
        status: 'completed'
      })
      .eq('source_id', sourceId);

    if (error) {
      this.logger.error(`Failed to update media processing status: ${error.message}`);
    }
  }

  /**
   * Link M4A file to expert document
   */
  private async linkToDocument(m4aDriveId: string, mp4DriveId: string): Promise<void> {
    // Get the source ID for the M4A file
    const { data: m4aSource, error: m4aError } = await this.supabase
      .from('google_sources')
      .select('id')
      .eq('drive_id', m4aDriveId)
      .single();

    if (m4aError || !m4aSource) {
      this.logger.error('Failed to get M4A source ID');
      return;
    }

    // Find the expert document linked to the MP4
    const { data: mp4Source, error: mp4Error } = await this.supabase
      .from('google_sources')
      .select('id')
      .eq('drive_id', mp4DriveId)
      .single();

    if (mp4Error || !mp4Source) {
      this.logger.error('Failed to get MP4 source ID');
      return;
    }

    const { data: expertDoc, error: docError } = await this.supabase
      .from('google_expert_documents')
      .select('id')
      .eq('source_id', mp4Source.id)
      .single();

    if (docError || !expertDoc) {
      this.logger.error('No expert document found for MP4');
      return;
    }

    // Create media_content_files entry for the M4A
    const { error: linkError } = await this.supabase
      .from('media_content_files')
      .insert({
        presentation_id: expertDoc.id,
        source_id: m4aSource.id,
        file_type: 'audio',
        display_order: 1
      });

    if (linkError) {
      this.logger.error(`Failed to create media_content_files entry: ${linkError.message}`);
    } else {
      this.logger.info('Successfully linked M4A to expert document');
    }
  }

  /**
   * Update database for existing M4A file
   */
  private async updateDatabase(m4aDriveId: string, config: M4AUploadConfig): Promise<void> {
    // Update processing status
    await this.updateProcessingStatus(config.sourceId, m4aDriveId);
    
    // Link to document if not already linked
    await this.linkToDocument(m4aDriveId, config.sourceMP4DriveId);
  }

  /**
   * Batch upload multiple M4A files
   */
  public async batchUpload(configs: M4AUploadConfig[]): Promise<void> {
    this.logger.info(`Starting batch upload of ${configs.length} M4A files`);
    
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };

    for (const config of configs) {
      try {
        // Check if file exists locally
        if (!fs.existsSync(config.localM4APath)) {
          this.logger.warn(`Local M4A file not found: ${config.localM4APath}`);
          results.skipped++;
          continue;
        }

        await this.upload(config);
        results.success++;

      } catch (error: any) {
        this.logger.error(`Failed to upload ${path.basename(config.localM4APath)}: ${error.message}`);
        results.failed++;
      }
    }

    this.logger.info(`Batch upload complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);
  }
}