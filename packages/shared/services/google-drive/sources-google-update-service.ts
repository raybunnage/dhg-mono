/**
 * Service for updating Google Drive metadata in sources_google table
 * Used by both UI components and CLI tools
 */

import { createClient } from '@supabase/supabase-js';
import GoogleDriveService, { GoogleDriveFile } from './google-drive-service';

// Update options
export interface UpdateOptions {
  limit?: number;
  dryRun?: boolean;
  updateFields?: string[];
  verbose?: boolean;
}

// Update result
export interface UpdateResult {
  records: number;
  updated: number;
  skipped: number;
  errors: Error[];
  startTime: Date;
  endTime: Date;
}

/**
 * Service for updating Google Drive metadata in sources_google table
 */
export class SourcesGoogleUpdateService {
  private static instance: SourcesGoogleUpdateService;
  private driveService: GoogleDriveService;
  private supabaseClient: any;

  private constructor(driveService: GoogleDriveService, supabaseClient: any) {
    this.driveService = driveService;
    this.supabaseClient = supabaseClient;
  }

  /**
   * Get singleton instance
   * @param driveService Google Drive service
   * @param supabaseClient Supabase client
   */
  public static getInstance(
    driveService: GoogleDriveService,
    supabaseClient: any
  ): SourcesGoogleUpdateService {
    if (!SourcesGoogleUpdateService.instance) {
      SourcesGoogleUpdateService.instance = new SourcesGoogleUpdateService(driveService, supabaseClient);
    }
    return SourcesGoogleUpdateService.instance;
  }

  /**
   * Get records from sources_google table
   * @param folderId Folder ID to filter by
   * @param options Query options
   */
  public async getSourcesGoogleRecords(
    folderId: string,
    options: {
      limit?: number;
      order?: string;
      filter?: string;
    } = {}
  ): Promise<GoogleDriveFile[]> {
    const { limit = 10, order = 'created_at', filter = '' } = options;

    try {
      // Query sources_google table
      const query = this.supabaseClient
        .from('sources_google')
        .select('*')
        .eq('deleted', false);

      // Apply folder filter
      if (folderId) {
        query.or(`parent_folder_id.eq.${folderId},drive_id.eq.${folderId}`);
      }

      // Apply additional filters
      if (filter) {
        query.or(filter);
      }

      // Apply order and limit
      query.order(order, { ascending: false }).limit(limit);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting sources_google records:', error);
      throw error;
    }
  }

  /**
   * Update metadata for sources_google records
   * @param records Records to update
   * @param options Update options
   */
  public async updateMetadata(
    records: GoogleDriveFile[],
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    const {
      dryRun = false,
      verbose = false,
      updateFields = ['modifiedTime', 'size', 'thumbnailLink']
    } = options;

    const result: UpdateResult = {
      records: records.length,
      updated: 0,
      skipped: 0,
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
    };

    try {
      console.log(`${dryRun ? 'DRY RUN: ' : ''}Updating metadata for ${records.length} records`);

      // Process each record
      for (const record of records) {
        try {
          if (verbose) {
            console.log(`Processing record: ${record.name} (${record.drive_id})`);
          }

          // Skip records without drive_id
          if (!record.drive_id) {
            if (verbose) {
              console.log(`Skipping record without drive_id: ${record.id}`);
            }
            result.skipped++;
            continue;
          }

          // Get current file metadata from Google Drive
          const fileData = await this.driveService.getFile(
            record.drive_id,
            'id, name, mimeType, webViewLink, parents, modifiedTime, size, thumbnailLink'
          );

          if (!fileData) {
            if (verbose) {
              console.log(`No data found for file: ${record.drive_id}`);
            }
            result.skipped++;
            continue;
          }

          // Prepare update data
          const updateData: Partial<GoogleDriveFile> = {
            metadata: {
              ...record.metadata,
            }
          };

          // Update metadata fields
          updateFields.forEach(field => {
            if (fileData[field] !== undefined) {
              updateData.metadata[field] = fileData[field];
            }
          });

          // Update fields that have dedicated columns
          if (fileData.size !== undefined) {
            updateData.size = parseInt(fileData.size, 10) || null;
          }
          
          if (fileData.thumbnailLink !== undefined) {
            updateData.thumbnail_link = fileData.thumbnailLink;
          }
          
          if (fileData.modifiedTime !== undefined) {
            updateData.modified_time = fileData.modifiedTime;
          }

          // Update record in database (if not dry run)
          if (!dryRun) {
            const { data, error } = await this.supabaseClient
              .from('sources_google')
              .update({
                ...updateData,
                updated_at: new Date().toISOString()
              })
              .eq('id', record.id)
              .select();

            if (error) {
              throw error;
            }

            if (verbose) {
              console.log(`Updated record: ${record.name}`);
            }
          } else if (verbose) {
            console.log(`Would update record: ${record.name}`);
            console.log('Update data:', updateData);
          }

          result.updated++;
        } catch (error) {
          console.error(`Error updating record ${record.id}:`, error);
          result.errors.push(error as Error);
          result.skipped++;
        }
      }
    } catch (error) {
      console.error('Error updating metadata:', error);
      result.errors.push(error as Error);
    }

    result.endTime = new Date();
    return result;
  }

  /**
   * Update metadata for files in a specific folder
   * @param folderId Folder ID
   * @param options Update options
   */
  public async updateFolderMetadata(
    folderId: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    const { limit = 10, verbose = false } = options;

    try {
      if (verbose) {
        console.log(`Fetching records for folder ${folderId} (limit: ${limit})`);
      }

      // Get records
      const records = await this.getSourcesGoogleRecords(folderId, { limit });

      if (verbose) {
        console.log(`Found ${records.length} records`);
      }

      // Update metadata
      return this.updateMetadata(records, options);
    } catch (error) {
      console.error('Error updating folder metadata:', error);
      return {
        records: 0,
        updated: 0,
        skipped: 0,
        errors: [error as Error],
        startTime: new Date(),
        endTime: new Date(),
      };
    }
  }
}

export default SourcesGoogleUpdateService;