/**
 * Google Drive Service for CLI
 * Connects the CLI to the shared Google Drive services
 */

import { 
  defaultGoogleAuth, 
  getGoogleDriveService, 
  getGoogleDriveSyncService, 
  getSourcesGoogleUpdateService 
} from '../../shared/services/google-drive';
import chalk from 'chalk';
import { SupabaseClientService } from '../../shared/services/supabase-client';

/**
 * This service connects the CLI to the shared Google Drive services
 * It provides an interface compatible with the older google-drive-service.js
 * while delegating all functionality to the centralized shared services
 */
class GoogleDriveCliService {
  private config: any;
  private supabaseClient: any;
  private driveService: any;
  private syncService: any;
  private updateService: any;

  constructor(config: any) {
    this.config = config;
    
    // Initialize Supabase client using the singleton service
    try {
      this.supabaseClient = SupabaseClientService.getInstance().getClient();
      
      // Initialize services with the centralized auth and Supabase client
      this.driveService = getGoogleDriveService(this.supabaseClient);
      this.syncService = getGoogleDriveSyncService(this.supabaseClient);
      this.updateService = getSourcesGoogleUpdateService(this.supabaseClient);
    } catch (error) {
      console.error(chalk.red('Failed to initialize Supabase client: ' + error));
      console.error(chalk.red('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are set.'));
    }
  }

  /**
   * Check if the service is ready to use
   */
  async isReady(): Promise<boolean> {
    if (!this.supabaseClient) {
      return false;
    }
    return defaultGoogleAuth.isReady();
  }

  /**
   * Get token expiration time
   */
  getTokenExpirationTime() {
    return defaultGoogleAuth.getTokenExpirationTime();
  }

  /**
   * Check if token is valid
   */
  async isTokenValid(): Promise<boolean> {
    try {
      const token = await defaultGoogleAuth.getAccessToken();
      return !!token;
    } catch (error) {
      console.error(chalk.red(`Token validation error: ${error}`));
      return false;
    }
  }

  /**
   * Authenticate with Google Drive
   */
  async authenticate(): Promise<boolean> {
    try {
      // First check if we already have a valid token
      if (await this.isTokenValid()) {
        console.log(chalk.green('Already authenticated with a valid token'));
        return true;
      }

      // If we don't have a valid token yet, log that we're initializing
      console.log(chalk.blue('Attempting to authenticate with Google...'));
      await defaultGoogleAuth.isReady(); // This triggers authentication if needed
      
      // Check again if we have a token now
      const token = await defaultGoogleAuth.getAccessToken();
      
      if (token) {
        console.log(chalk.green('Authentication successful'));
        return true;
      } else {
        console.log(chalk.red('Authentication failed - no token available'));
        return false;
      }
    } catch (error) {
      console.error(chalk.red(`Authentication error: ${error}`));
      return false;
    }
  }

  /**
   * Sync a Google Drive folder
   */
  async syncFolder(folderId: string, options: any = {}): Promise<any> {
    try {
      if (!this.syncService) {
        throw new Error('Sync service not initialized');
      }

      console.log(chalk.blue(`Syncing folder with ID: ${folderId}`));
      
      const syncOptions = {
        recursive: true,
        maxDepth: this.config.sync?.maxDepth || 10,
        batchSize: this.config.sync?.batchSize || 50,
        dryRun: options.dryRun || false,
        ...options
      };

      // Use the shared sync service to sync the folder
      const result = await this.syncService.syncFolder(folderId, syncOptions);
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error(chalk.red(`Error syncing folder: ${error}`));
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * List root folders
   */
  async listRootFolders(): Promise<any[]> {
    try {
      if (!this.supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.supabaseClient
        .from('google_sources')
        .select('*')
        .eq('is_root', true)
        .eq('deleted', false)
        .order('name');
        
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error(chalk.red(`Error listing root folders: ${error}`));
      return [];
    }
  }

  /**
   * Add a root folder
   */
  async addRootFolder(folderId: string, name: string = ''): Promise<any> {
    try {
      if (!this.driveService) {
        throw new Error('Drive service not initialized');
      }

      // First check if the folder exists in Google Drive
      const fileInfo = await this.driveService.getFileInfo(folderId);
      
      if (!fileInfo) {
        throw new Error(`Folder with ID ${folderId} not found in Google Drive`);
      }
      
      if (fileInfo.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error(`ID ${folderId} is not a folder (${fileInfo.mimeType})`);
      }
      
      // Use name from Google Drive if not provided
      const folderName = name || fileInfo.name;
      
      // Check if folder already exists in database
      const { data: existingFolders, error: queryError } = await this.supabaseClient
        .from('google_sources')
        .select('id, drive_id, name')
        .eq('drive_id', folderId)
        .eq('deleted', false);
        
      if (queryError) {
        throw queryError;
      }
      
      // Update if exists, insert if not
      if (existingFolders && existingFolders.length > 0) {
        console.log(chalk.yellow(`Folder already exists with name "${existingFolders[0].name}", updating...`));
        
        const { data, error } = await this.supabaseClient
          .from('google_sources')
          .update({
            name: folderName,
            is_root: true,
            path: `/${folderName}`,
            parent_path: null,
            parent_folder_id: null,
            metadata: { 
              isRootFolder: true,
              lastUpdated: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          })
          .eq('drive_id', folderId)
          .select();
          
        if (error) {
          throw error;
        }
        
        return {
          success: true,
          action: 'updated',
          folder: data[0]
        };
      }
      
      // Insert new root folder
      const now = new Date().toISOString();
      const { data, error } = await this.supabaseClient
        .from('google_sources')
        .insert({
          drive_id: folderId,
          name: folderName,
          is_root: true,
          mime_type: 'application/vnd.google-apps.folder',
          path: `/${folderName}`,
          parent_path: null,
          parent_folder_id: null,
          metadata: { 
            isRootFolder: true,
            createdAt: now
          },
          created_at: now,
          updated_at: now,
          deleted: false
        })
        .select();
        
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        action: 'inserted',
        folder: data[0]
      };
    } catch (error) {
      console.error(chalk.red(`Error adding root folder: ${error}`));
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Remove a root folder
   */
  async removeRootFolder(folderId: string, options: { hard?: boolean } = {}): Promise<any> {
    try {
      if (!this.supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      // First check if the folder exists
      const { data, error } = await this.supabaseClient
        .from('google_sources')
        .select('id, name, drive_id')
        .eq(options.hard ? 'drive_id' : 'id', folderId)
        .eq('deleted', false)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error('Root folder not found');
      }
      
      if (options.hard) {
        // Hard delete - mark as deleted
        const { error: deleteError } = await this.supabaseClient
          .from('google_sources')
          .update({ 
            deleted: true, 
            updated_at: new Date().toISOString() 
          })
          .eq('drive_id', folderId);
          
        if (deleteError) {
          throw deleteError;
        }
        
        return {
          success: true,
          action: 'deleted',
          folder: data
        };
      } else {
        // Soft delete - just unmark as root
        const { error: updateError } = await this.supabaseClient
          .from('google_sources')
          .update({ 
            is_root: false, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', folderId);
          
        if (updateError) {
          throw updateError;
        }
        
        return {
          success: true,
          action: 'unmarked',
          folder: data
        };
      }
    } catch (error) {
      console.error(chalk.red(`Error removing root folder: ${error}`));
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(folderId: string | null = null): Promise<any> {
    try {
      if (!this.supabaseClient) {
        throw new Error('Supabase client not initialized');
      }

      let query = this.supabaseClient
        .from('google_sources')
        .select('*')
        .eq('deleted', false);
        
      if (folderId) {
        query = query.eq('parent_folder_id', folderId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Calculate statistics
      const stats: {
        totalFiles: number;
        totalFolders: number;
        totalSize: number;
        syncedFiles: number;
        failedFiles: number;
        fileTypes: Record<string, number>;
      } = {
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        syncedFiles: 0,
        failedFiles: 0,
        fileTypes: {}
      };
      
      data.forEach((file: any) => {
        if (file.mime_type === 'application/vnd.google-apps.folder') {
          stats.totalFolders++;
        } else {
          stats.totalFiles++;
        }
        
        if (file.size_bytes) {
          stats.totalSize += file.size_bytes;
        }
        
        if (file.sync_status === 'synced') {
          stats.syncedFiles++;
        } else if (file.sync_status === 'error') {
          stats.failedFiles++;
        }
        
        // Track file types
        const fileType = file.mime_type || 'unknown';
        stats.fileTypes[fileType] = (stats.fileTypes[fileType] || 0) + 1;
      });
      
      return stats;
    } catch (error) {
      console.error(chalk.red(`Error getting sync stats: ${error}`));
      return {
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        syncedFiles: 0,
        failedFiles: 0,
        fileTypes: {}
      };
    }
  }

  /**
   * Test connections to Google Drive and Supabase
   */
  async testConnections(): Promise<any> {
    try {
      // Test Google Drive connection
      const googleReady = await defaultGoogleAuth.isReady();
      const googleToken = await defaultGoogleAuth.getAccessToken();
      
      // Test Supabase connection
      let supabaseReady = false;
      let supabaseError = null;
      
      if (this.supabaseClient) {
        try {
          const { error } = await this.supabaseClient.from('google_sources').select('count').limit(1);
          supabaseReady = !error;
          supabaseError = error;
        } catch (e) {
          supabaseError = e;
        }
      }
      
      return {
        google: {
          ready: googleReady,
          hasToken: !!googleToken
        },
        supabase: {
          ready: supabaseReady,
          error: supabaseError ? String(supabaseError) : null
        },
        allReady: googleReady && supabaseReady
      };
    } catch (error) {
      console.error(chalk.red(`Error testing connections: ${error}`));
      return {
        google: { ready: false },
        supabase: { ready: false },
        allReady: false,
        error: String(error)
      };
    }
  }
}

export default GoogleDriveCliService;