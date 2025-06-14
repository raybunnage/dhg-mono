/**
 * Audio Proxy Service - Refactored
 * 
 * Provides audio streaming capabilities from Google Drive, both via API
 * and local file system access. This is a server-only service due to
 * Node.js dependencies (fs, path, os).
 * 
 * Refactored to extend SingletonService for proper resource management
 * and lifecycle handling.
 */

import { SingletonService } from '../base-classes/SingletonService';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Readable } from 'stream';
import type { drive_v3 } from 'googleapis';

// Re-export types for backward compatibility
export interface AudioFileMetadata {
  name: string;
  mimeType: string;
  size: string;
  fileId: string;
}

export interface StreamOptions {
  start?: number;
  end?: number;
}

// Enhanced types for refactored service
export interface AudioServiceConfig {
  serviceAccountPath?: string;
  googleDrivePath?: string;
  cacheEnabled?: boolean;
  maxCacheSize?: number;
  connectionTimeout?: number;
}

export interface StreamResult {
  stream: Readable;
  metadata: AudioFileMetadata | LocalFileMetadata;
  headers: Record<string, string>;
}

export interface LocalFileMetadata {
  name: string;
  mimeType: string;
  size: number;
}

export interface ServiceStatus {
  googleApiConfigured: boolean;
  localDriveFound: boolean;
  localDrivePath?: string;
  cacheSize?: number;
  activeStreams?: number;
  totalStreamsServed?: number;
}

/**
 * Audio Proxy Service for streaming audio files from Google Drive
 */
export class AudioProxyService extends SingletonService {
  private static instance: AudioProxyService;
  private authClient: JWT | null = null;
  private drive: drive_v3.Drive | null = null;
  private googleDriveBasePath: string | null = null;
  private config: AudioServiceConfig;
  
  // Enhanced tracking
  private activeStreams = new Set<string>();
  private totalStreamsServed = 0;
  private metadataCache = new Map<string, { data: AudioFileMetadata; timestamp: number }>();
  private readonly cacheDuration = 3600000; // 1 hour
  
  // Common Google Drive local paths
  private readonly GOOGLE_DRIVE_PATHS = [
    // macOS paths
    path.join(os.homedir(), 'Google Drive'),
    path.join(os.homedir(), 'Library/CloudStorage/GoogleDrive-*'),
    path.join(os.homedir(), 'My Drive'),
    // Windows paths
    path.join(os.homedir(), 'Google Drive'),
    path.join('G:', 'My Drive'),
    // Linux paths
    path.join(os.homedir(), 'GoogleDrive'),
  ];

  private constructor(config: AudioServiceConfig = {}) {
    super('AudioProxyService');
    this.config = {
      cacheEnabled: true,
      maxCacheSize: 100,
      connectionTimeout: 30000,
      ...config
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: AudioServiceConfig): AudioProxyService {
    if (!AudioProxyService.instance) {
      AudioProxyService.instance = new AudioProxyService(config);
    }
    return AudioProxyService.instance;
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    try {
      // Initialize Google authentication
      await this.initializeGoogleAuth();
      
      // Find Google Drive base path
      this.findGoogleDriveBasePath();
      
      // Start cache cleanup interval
      if (this.config.cacheEnabled) {
        setInterval(() => this.cleanupCache(), 300000); // Clean every 5 minutes
      }
      
      this.logger.info('AudioProxyService initialized successfully', {
        googleApiConfigured: this.isConfigured(),
        localDriveFound: this.googleDriveBasePath !== null
      });
    } catch (error) {
      this.logger.error('Failed to initialize AudioProxyService:', error);
      throw error;
    }
  }

  /**
   * Initialize Google authentication
   */
  private async initializeGoogleAuth(): Promise<void> {
    try {
      const keyFilePath = this.findServiceAccountKeyFile();
      if (!keyFilePath) {
        this.logger.warn('Google service account key file not found');
        return;
      }

      this.logger.info(`Using service account key file: ${keyFilePath}`);
      
      // Read and parse the service account key file
      const keyFileData = await fs.promises.readFile(keyFilePath, 'utf8');
      const keyFile = JSON.parse(keyFileData);
      
      // Create JWT auth client with the service account
      this.authClient = new JWT({
        email: keyFile.client_email,
        key: keyFile.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });

      // Authorize the client
      await this.authClient.authorize();

      // Initialize Google Drive API
      this.drive = google.drive({ version: 'v3', auth: this.authClient });
      
      this.logger.info('Google Drive API initialized successfully');
    } catch (error) {
      this.logger.error('Error setting up Google auth client:', error);
      // Don't throw - service can still work with local files
    }
  }

  /**
   * Find service account key file
   */
  private findServiceAccountKeyFile(): string | null {
    const possiblePaths = [
      this.config.serviceAccountPath,
      path.resolve(process.cwd(), '.service-account.json'),
      path.resolve(process.cwd(), '../.service-account.json'),
      path.resolve(process.cwd(), '../../.service-account.json'),
      process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    ].filter(Boolean) as string[];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  /**
   * Find Google Drive base path
   */
  private findGoogleDriveBasePath(): void {
    if (this.googleDriveBasePath) {
      return;
    }

    // Check config first
    if (this.config.googleDrivePath && fs.existsSync(this.config.googleDrivePath)) {
      this.googleDriveBasePath = this.config.googleDrivePath;
      this.logger.info(`Found Google Drive from config at: ${this.googleDriveBasePath}`);
      return;
    }

    // Check standard paths
    for (const basePath of this.GOOGLE_DRIVE_PATHS) {
      // Handle glob patterns (for macOS CloudStorage)
      if (basePath.includes('*')) {
        try {
          const glob = require('glob');
          const matches = glob.sync(basePath);
          if (matches.length > 0 && fs.existsSync(matches[0])) {
            this.googleDriveBasePath = matches[0];
            this.logger.info(`Found Google Drive at: ${this.googleDriveBasePath}`);
            return;
          }
        } catch (error) {
          // glob not available, skip
        }
      } else if (fs.existsSync(basePath)) {
        this.googleDriveBasePath = basePath;
        this.logger.info(`Found Google Drive at: ${this.googleDriveBasePath}`);
        return;
      }
    }

    // Check environment variable
    if (process.env.GOOGLE_DRIVE_PATH && fs.existsSync(process.env.GOOGLE_DRIVE_PATH)) {
      this.googleDriveBasePath = process.env.GOOGLE_DRIVE_PATH;
      this.logger.info(`Found Google Drive from env at: ${this.googleDriveBasePath}`);
      return;
    }

    this.logger.warn('Google Drive local folder not found');
  }

  /**
   * Get audio file metadata with caching
   */
  public async getFileMetadata(fileId: string): Promise<AudioFileMetadata> {
    await this.ensureInitialized();
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = this.metadataCache.get(fileId);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        this.logger.debug(`Returning cached metadata for file: ${fileId}`);
        return cached.data;
      }
    }
    
    if (!this.drive) {
      throw new Error('Google Drive API not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'name,mimeType,size'
      });

      const metadata: AudioFileMetadata = {
        fileId,
        name: response.data.name || 'Unknown',
        mimeType: response.data.mimeType || 'audio/mpeg',
        size: response.data.size || '0'
      };
      
      // Cache the result
      if (this.config.cacheEnabled) {
        this.metadataCache.set(fileId, {
          data: metadata,
          timestamp: Date.now()
        });
      }
      
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to get metadata for file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Stream audio file from Google Drive
   */
  public async streamAudioFile(
    fileId: string,
    options?: StreamOptions
  ): Promise<StreamResult> {
    await this.ensureInitialized();
    
    if (!this.drive) {
      throw new Error('Google Drive API not initialized');
    }

    const streamId = `api-${fileId}-${Date.now()}`;
    this.activeStreams.add(streamId);
    
    try {
      // Get file metadata
      const metadata = await this.getFileMetadata(fileId);
      const fileSize = parseInt(metadata.size);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': metadata.mimeType,
        'Content-Disposition': `inline; filename="${metadata.name}"`,
        'X-Served-From': 'google-drive-api',
        'X-Stream-Id': streamId
      };

      // Handle range requests
      let requestOptions: any = {
        fileId: fileId,
        alt: 'media'
      };

      if (options?.start !== undefined || options?.end !== undefined) {
        const start = options.start || 0;
        const end = options.end || fileSize - 1;
        const chunkSize = (end - start) + 1;

        headers['Accept-Ranges'] = 'bytes';
        headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
        headers['Content-Length'] = String(chunkSize);

        requestOptions.headers = {
          Range: `bytes=${start}-${end}`
        };
      } else {
        headers['Content-Length'] = String(fileSize);
      }

      // Get the file stream
      const response = await this.drive.files.get(requestOptions, { responseType: 'stream' });
      const stream = response.data as Readable;
      
      // Track stream completion
      stream.on('end', () => {
        this.activeStreams.delete(streamId);
        this.totalStreamsServed++;
        this.logger.debug(`Stream completed: ${streamId}`);
      });
      
      stream.on('error', (error) => {
        this.activeStreams.delete(streamId);
        this.logger.error(`Stream error: ${streamId}`, error);
      });

      return {
        stream,
        metadata,
        headers
      };
    } catch (error) {
      this.activeStreams.delete(streamId);
      this.logger.error(`Failed to stream file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists locally in Google Drive
   */
  public async checkLocalFile(relativePath: string): Promise<string | null> {
    await this.ensureInitialized();
    
    if (!this.googleDriveBasePath) {
      return null;
    }

    const fullPath = path.join(this.googleDriveBasePath, relativePath);
    
    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
      return fullPath;
    } catch {
      return null;
    }
  }

  /**
   * Stream local audio file
   */
  public async streamLocalFile(
    filePath: string,
    options?: StreamOptions
  ): Promise<StreamResult> {
    await this.ensureInitialized();
    
    const streamId = `local-${path.basename(filePath)}-${Date.now()}`;
    this.activeStreams.add(streamId);
    
    try {
      const stats = await fs.promises.stat(filePath);
      const fileName = path.basename(filePath);
      const mimeType = this.getMimeType(fileName);

      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'X-Served-From': 'local-file',
        'X-Stream-Id': streamId
      };

      let stream: Readable;
      
      if (options?.start !== undefined || options?.end !== undefined) {
        const start = options.start || 0;
        const end = options.end || stats.size - 1;
        const chunkSize = (end - start) + 1;

        headers['Accept-Ranges'] = 'bytes';
        headers['Content-Range'] = `bytes ${start}-${end}/${stats.size}`;
        headers['Content-Length'] = String(chunkSize);

        stream = fs.createReadStream(filePath, { start, end });
      } else {
        headers['Content-Length'] = String(stats.size);
        stream = fs.createReadStream(filePath);
      }
      
      // Track stream completion
      stream.on('end', () => {
        this.activeStreams.delete(streamId);
        this.totalStreamsServed++;
        this.logger.debug(`Local stream completed: ${streamId}`);
      });
      
      stream.on('error', (error) => {
        this.activeStreams.delete(streamId);
        this.logger.error(`Local stream error: ${streamId}`, error);
      });

      return {
        stream,
        metadata: {
          name: fileName,
          mimeType,
          size: stats.size
        },
        headers
      };
    } catch (error) {
      this.activeStreams.delete(streamId);
      this.logger.error(`Failed to stream local file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.mp4': 'audio/mp4',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac'
    };
    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * Check if service is properly configured
   */
  public isConfigured(): boolean {
    return this.authClient !== null && this.drive !== null;
  }

  /**
   * Get configuration status
   */
  public getStatus(): ServiceStatus {
    return {
      googleApiConfigured: this.isConfigured(),
      localDriveFound: this.googleDriveBasePath !== null,
      localDrivePath: this.googleDriveBasePath || undefined,
      cacheSize: this.metadataCache.size,
      activeStreams: this.activeStreams.size,
      totalStreamsServed: this.totalStreamsServed
    };
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.metadataCache.entries()) {
      if (now - entry.timestamp > this.cacheDuration) {
        this.metadataCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, any>;
  }> {
    const status = this.getStatus();
    
    // Test Google Drive API if configured
    let apiHealthy = true;
    if (this.drive) {
      try {
        await this.drive.about.get({ fields: 'user' });
      } catch (error) {
        apiHealthy = false;
        this.logger.error('Google Drive API health check failed:', error);
      }
    }
    
    return {
      healthy: this.initialized && (status.googleApiConfigured ? apiHealthy : true),
      details: {
        ...status,
        apiHealthy,
        initialized: this.initialized,
        cacheEnabled: this.config.cacheEnabled,
        maxCacheSize: this.config.maxCacheSize
      }
    };
  }

  /**
   * Shutdown the service
   */
  protected async shutdown(): Promise<void> {
    // Clear cache
    this.metadataCache.clear();
    
    // Wait for active streams to complete (with timeout)
    const timeout = 5000; // 5 seconds
    const start = Date.now();
    
    while (this.activeStreams.size > 0 && Date.now() - start < timeout) {
      this.logger.info(`Waiting for ${this.activeStreams.size} active streams to complete...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.activeStreams.size > 0) {
      this.logger.warn(`Force closing ${this.activeStreams.size} active streams`);
    }
    
    this.activeStreams.clear();
    
    // Clear Google Drive client
    this.drive = null;
    this.authClient = null;
    
    this.logger.info('AudioProxyService shut down successfully');
  }
}