import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Readable } from 'stream';

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

export class AudioProxyService {
  private static instance: AudioProxyService;
  private authClient: JWT | null = null;
  private drive: any = null;
  private googleDriveBasePath: string | null = null;

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

  private constructor() {
    this.initializeGoogleAuth();
    this.findGoogleDriveBasePath();
  }

  static getInstance(): AudioProxyService {
    if (!AudioProxyService.instance) {
      AudioProxyService.instance = new AudioProxyService();
    }
    return AudioProxyService.instance;
  }

  /**
   * Initialize Google authentication
   */
  private initializeGoogleAuth(): void {
    try {
      const keyFilePath = this.findServiceAccountKeyFile();
      if (!keyFilePath) {
        console.error('Google service account key file not found');
        return;
      }

      console.log(`Using service account key file: ${keyFilePath}`);
      
      // Read and parse the service account key file
      const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
      const keyFile = JSON.parse(keyFileData);
      
      // Create JWT auth client with the service account
      this.authClient = new JWT({
        email: keyFile.client_email,
        key: keyFile.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });

      // Initialize Google Drive API
      this.drive = google.drive({ version: 'v3', auth: this.authClient });
    } catch (error) {
      console.error('Error setting up Google auth client:', error);
    }
  }

  /**
   * Find service account key file
   */
  private findServiceAccountKeyFile(): string | null {
    const possiblePaths = [
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

    // Check standard paths
    for (const basePath of this.GOOGLE_DRIVE_PATHS) {
      // Handle glob patterns (for macOS CloudStorage)
      if (basePath.includes('*')) {
        try {
          const glob = require('glob');
          const matches = glob.sync(basePath);
          if (matches.length > 0 && fs.existsSync(matches[0])) {
            this.googleDriveBasePath = matches[0];
            console.log(`Found Google Drive at: ${this.googleDriveBasePath}`);
            return;
          }
        } catch (error) {
          // glob not available, skip
        }
      } else if (fs.existsSync(basePath)) {
        this.googleDriveBasePath = basePath;
        console.log(`Found Google Drive at: ${this.googleDriveBasePath}`);
        return;
      }
    }

    // Check environment variable
    if (process.env.GOOGLE_DRIVE_PATH && fs.existsSync(process.env.GOOGLE_DRIVE_PATH)) {
      this.googleDriveBasePath = process.env.GOOGLE_DRIVE_PATH;
      console.log(`Found Google Drive from env at: ${this.googleDriveBasePath}`);
      return;
    }

    console.warn('Google Drive local folder not found');
  }

  /**
   * Get audio file metadata
   */
  async getFileMetadata(fileId: string): Promise<AudioFileMetadata> {
    if (!this.drive) {
      throw new Error('Google Drive API not initialized');
    }

    const response = await this.drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType,size'
    });

    return {
      fileId,
      name: response.data.name,
      mimeType: response.data.mimeType,
      size: response.data.size
    };
  }

  /**
   * Stream audio file from Google Drive
   */
  async streamAudioFile(fileId: string, options?: StreamOptions): Promise<{
    stream: Readable;
    metadata: AudioFileMetadata;
    headers: Record<string, string>;
  }> {
    if (!this.drive) {
      throw new Error('Google Drive API not initialized');
    }

    // Get file metadata
    const metadata = await this.getFileMetadata(fileId);
    const fileSize = parseInt(metadata.size);

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': metadata.mimeType,
      'Content-Disposition': `inline; filename="${metadata.name}"`,
      'X-Served-From': 'google-drive-api'
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

    return {
      stream: response.data,
      metadata,
      headers
    };
  }

  /**
   * Check if a file exists locally in Google Drive
   */
  async checkLocalFile(relativePath: string): Promise<string | null> {
    if (!this.googleDriveBasePath) {
      return null;
    }

    const fullPath = path.join(this.googleDriveBasePath, relativePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }

    return null;
  }

  /**
   * Stream local audio file
   */
  async streamLocalFile(filePath: string, options?: StreamOptions): Promise<{
    stream: Readable;
    metadata: { name: string; mimeType: string; size: number };
    headers: Record<string, string>;
  }> {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const mimeType = this.getMimeType(fileName);

    const headers: Record<string, string> = {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'X-Served-From': 'local-file'
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

    return {
      stream,
      metadata: {
        name: fileName,
        mimeType,
        size: stats.size
      },
      headers
    };
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
  isConfigured(): boolean {
    return this.authClient !== null && this.drive !== null;
  }

  /**
   * Get configuration status
   */
  getStatus(): {
    googleApiConfigured: boolean;
    localDriveFound: boolean;
    localDrivePath?: string;
  } {
    return {
      googleApiConfigured: this.isConfigured(),
      localDriveFound: this.googleDriveBasePath !== null,
      localDrivePath: this.googleDriveBasePath || undefined
    };
  }
}