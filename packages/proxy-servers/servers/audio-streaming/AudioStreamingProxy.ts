import { Request, Response, NextFunction } from 'express';
import { BaseProxyServer } from '../../BaseProxyServer';
import { AudioProxyService } from '../../../shared/services/audio-proxy/AudioProxyService';
import { SupabaseClientService } from '../../../shared/services/supabase-client';

interface AudioRequest extends Request {
  params: {
    fileId: string;
  };
  headers: {
    range?: string;
  };
}

export class AudioStreamingProxy extends BaseProxyServer {
  private audioService: AudioProxyService;
  private supabase: any;

  constructor() {
    super('AudioStreamingProxy', 9883);
    this.audioService = AudioProxyService.getInstance();
    
    try {
      // Initialize Supabase for local file lookup
      this.supabase = SupabaseClientService.getInstance().getClient();
      console.log('Supabase client initialized for local file lookup');
    } catch (error) {
      console.warn('Supabase client not available - local file lookup disabled');
      this.supabase = null;
    }
  }

  protected setupRoutes(): void {
    // Main audio streaming endpoint
    this.app.get('/api/audio/:fileId', this.handleError(this.streamAudio.bind(this)));

    // Configuration status endpoint
    this.app.get('/api/audio-status', this.handleError(async (req: Request, res: Response) => {
      const status = this.audioService.getStatus();
      res.json({
        ...status,
        supabaseConfigured: this.supabase !== null,
        proxy: this.name,
        port: this.port
      });
    }));

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const status = this.audioService.getStatus();
      res.json({ 
        status: 'healthy', 
        proxy: this.name,
        port: this.port,
        googleApiConfigured: status.googleApiConfigured,
        localDriveFound: status.localDriveFound,
        uptime: process.uptime()
      });
    });

    // Info endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        proxy: this.name,
        port: this.port,
        endpoints: [
          'GET /api/audio/:fileId - Stream audio file from Google Drive',
          'GET /api/audio-status - Get service configuration status',
          'GET /health - Health check'
        ],
        features: [
          'Google Drive API streaming',
          'Local Google Drive file support',
          'Range request support for seeking',
          'Automatic MIME type detection'
        ]
      });
    });
  }

  /**
   * Stream audio file
   */
  private async streamAudio(req: AudioRequest, res: Response): Promise<void> {
    const fileId = req.params.fileId;
    
    if (!fileId) {
      res.status(400).json({ error: 'File ID is required' });
      return;
    }
    
    console.log(`[${new Date().toISOString()}] Proxying audio file: ${fileId}`);
    
    try {
      // First, try to find the file locally if Supabase is available
      let localPath: string | null = null;
      
      if (this.supabase) {
        try {
          // Query sources_google table for the file
          const { data: fileData } = await this.supabase
            .from('sources_google')
            .select('name, relative_path')
            .eq('google_id', fileId)
            .single();
          
          if (fileData && fileData.relative_path) {
            localPath = await this.audioService.checkLocalFile(fileData.relative_path);
            if (localPath) {
              console.log(`Found local file: ${localPath}`);
            }
          }
        } catch (error) {
          console.log('Local file lookup failed, falling back to API');
        }
      }

      // Parse range header if present
      let streamOptions: { start?: number; end?: number } | undefined;
      
      if (req.headers.range) {
        const parts = req.headers.range.replace(/bytes=/, '').split('-');
        streamOptions = {
          start: parseInt(parts[0], 10),
          end: parts[1] ? parseInt(parts[1], 10) : undefined
        };
      }

      // Stream the file (local or API)
      let result;
      
      if (localPath) {
        result = await this.audioService.streamLocalFile(localPath, streamOptions);
      } else {
        result = await this.audioService.streamAudioFile(fileId, streamOptions);
      }

      // Set response headers
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Set status code for range requests
      if (req.headers.range) {
        res.status(206);
      }

      // Pipe the stream
      result.stream.pipe(res);
      
      // Handle stream errors
      result.stream.on('error', (error: Error) => {
        console.error('Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error occurred' });
        }
      });
      
    } catch (error: any) {
      console.error('[ERROR] Error proxying audio file:', error);
      
      if (error.message && error.message.includes('not initialized')) {
        res.status(500).json({ 
          error: 'Server configuration error',
          message: 'Google service account key file not found. Please ensure .service-account.json exists in the project root.',
          details: error.message
        });
        return;
      }
      
      if (error.response && error.response.status === 404) {
        res.status(404).json({ 
          error: 'File not found',
          message: `Google Drive file with ID ${fileId} not found or not accessible`
        });
        return;
      }
      
      if (error.response && error.response.status === 403) {
        res.status(403).json({ 
          error: 'Access denied',
          message: 'Service account does not have permission to access this file'
        });
        return;
      }
      
      res.status(500).json({ 
        error: 'Error fetching audio file',
        message: error.message || 'Unknown error occurred',
        fileId: fileId
      });
    }
  }

  /**
   * Helper to wrap async route handlers
   */
  private handleError(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

// Export for use
export default AudioStreamingProxy;