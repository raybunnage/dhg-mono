/**
 * PDF Processor Service - Refactored
 * 
 * A singleton service for processing PDF files with proper lifecycle management
 * - Extracts text content from PDFs using Claude AI
 * - Downloads and caches PDFs from Google Drive
 * - Handles chunking for large PDFs
 * 
 * @module PDFProcessorService
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { SingletonService } from '../base-classes/SingletonService';
import { SupabaseClient } from '@supabase/supabase-js';
import { GoogleDriveService } from '../google-drive';
import { claudeService } from '../claude-service';

// Promisified fs functions
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

// Types
export interface PDFProcessingResult {
  success: boolean;
  content?: string;
  error?: string;
  sourceId?: string;
  fileName?: string;
  numPages?: number;
  fileSize?: number;
}

interface PDFProcessorServiceConfig {
  cacheDirectory?: string;
  maxFileSize?: number;
  cleanupOnShutdown?: boolean;
}

interface PDFProcessorServiceMetrics {
  totalProcessed: number;
  successfulProcessed: number;
  failedProcessed: number;
  totalBytesProcessed: number;
  averageProcessingTime?: number;
  cacheHits: number;
  cacheMisses: number;
  lastProcessedTime?: Date;
}

export class PDFProcessorService extends SingletonService {
  private static instance: PDFProcessorService;
  private cacheDir: string;
  private maxFileSize: number;
  private cleanupOnShutdown: boolean;
  private metrics: PDFProcessorServiceMetrics = {
    totalProcessed: 0,
    successfulProcessed: 0,
    failedProcessed: 0,
    totalBytesProcessed: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  private processingFiles = new Set<string>();
  private cachedFiles = new Map<string, string>();

  protected constructor(
    private supabase: SupabaseClient,
    config: PDFProcessorServiceConfig = {}
  ) {
    super('PDFProcessorService');
    this.cacheDir = config.cacheDirectory || './document-analysis-results';
    this.maxFileSize = config.maxFileSize || 100 * 1024 * 1024; // 100MB default
    this.cleanupOnShutdown = config.cleanupOnShutdown ?? false;
  }

  public static getInstance(
    supabase: SupabaseClient,
    config?: PDFProcessorServiceConfig
  ): PDFProcessorService {
    if (!PDFProcessorService.instance) {
      PDFProcessorService.instance = new PDFProcessorService(supabase, config);
    }
    return PDFProcessorService.instance;
  }

  // BaseService requirements
  protected async initialize(): Promise<void> {
    this.logger?.info('PDFProcessorService initializing...');
    
    try {
      // Create cache directory if it doesn't exist
      await mkdir(this.cacheDir, { recursive: true });
      
      // Test write access
      const testFile = path.join(this.cacheDir, '.test');
      await fs.promises.writeFile(testFile, 'test');
      await unlink(testFile);
      
      this.logger?.info(`PDFProcessorService initialized with cache at ${this.cacheDir}`);
    } catch (error) {
      this.logger?.error('Failed to initialize PDFProcessorService:', error);
      throw new Error(`Cannot access cache directory: ${this.cacheDir}`);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger?.info('PDFProcessorService cleaning up...');
    
    // Wait for any active processing to complete
    if (this.processingFiles.size > 0) {
      this.logger?.warn(`Waiting for ${this.processingFiles.size} files to finish processing...`);
      
      // Give operations 30 seconds to complete
      const timeout = 30000;
      const start = Date.now();
      
      while (this.processingFiles.size > 0 && Date.now() - start < timeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (this.processingFiles.size > 0) {
        this.logger?.error(`${this.processingFiles.size} files did not complete processing`);
      }
    }
    
    // Clean up cache if configured
    if (this.cleanupOnShutdown) {
      try {
        const files = await fs.promises.readdir(this.cacheDir);
        for (const file of files) {
          await unlink(path.join(this.cacheDir, file)).catch(() => {});
        }
        this.logger?.info('Cache directory cleaned');
      } catch (error) {
        this.logger?.error('Error cleaning cache directory:', error);
      }
    }
    
    this.logger?.info('PDFProcessorService cleanup completed');
  }

  // SingletonService requirement
  protected async releaseResources(): Promise<void> {
    // Clear cache tracking
    this.cachedFiles.clear();
    this.processingFiles.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    const startTime = Date.now();
    let healthy = true;
    const details: any = {
      metrics: { ...this.metrics },
      activeProcessing: this.processingFiles.size,
      cacheSize: this.cachedFiles.size,
      cacheDirectory: this.cacheDir,
      cacheAccess: 'unknown',
      claudeAvailable: 'unknown'
    };

    try {
      // Test cache directory access
      await stat(this.cacheDir);
      details.cacheAccess = 'accessible';
      
      // Test Claude service availability
      try {
        // Just check if service exists, don't make actual API calls
        details.claudeAvailable = claudeService ? 'available' : 'unavailable';
      } catch {
        details.claudeAvailable = 'error';
      }
      
      details.responseTime = `${Date.now() - startTime}ms`;
    } catch (error) {
      healthy = false;
      details.error = error instanceof Error ? error.message : 'Unknown error';
      details.cacheAccess = 'error';
    }

    return {
      healthy,
      details,
      timestamp: new Date()
    };
  }

  // Public API methods

  /**
   * Set the cache directory for downloaded PDFs
   */
  async setCacheDirectory(dir: string): Promise<void> {
    this.cacheDir = dir;
    
    // Create cache directory if it doesn't exist
    await mkdir(this.cacheDir, { recursive: true });
    
    // Clear cached files tracking since directory changed
    this.cachedFiles.clear();
    
    this.logger?.info(`Cache directory set to: ${dir}`);
  }

  /**
   * Process a PDF file from Google Drive
   */
  async processPDFFromDrive(
    driveId: string,
    maxPages = 0,
    keepFile = false
  ): Promise<PDFProcessingResult> {
    const startTime = Date.now();
    this.metrics.totalProcessed++;
    this.metrics.lastProcessedTime = new Date();
    
    // Check cache first
    const cacheKey = `${driveId}_${maxPages}`;
    if (this.cachedFiles.has(cacheKey)) {
      this.metrics.cacheHits++;
      this.logger?.debug(`Cache hit for PDF ${driveId}`);
      
      try {
        const cachedContent = await readFile(this.cachedFiles.get(cacheKey)!, 'utf8');
        return {
          success: true,
          content: cachedContent,
          sourceId: driveId
        };
      } catch {
        // Cache file missing, continue with processing
        this.cachedFiles.delete(cacheKey);
      }
    }
    
    this.metrics.cacheMisses++;
    this.processingFiles.add(driveId);
    
    try {
      // Get Google Drive service
      const { GoogleAuthService } = require('../google-drive/google-auth-service');
      const auth = GoogleAuthService.getDefaultInstance();
      const driveService = GoogleDriveService.getInstance(auth, this.supabase);
      
      // Get file metadata from Google Drive
      const file = await driveService.getFile(driveId);
      
      if (!file || !file.name) {
        throw new Error(`File not found in Google Drive: ${driveId}`);
      }
      
      // Check if file is a PDF
      if (file.mimeType !== 'application/pdf') {
        throw new Error(`File is not a PDF: ${file.name} (${file.mimeType})`);
      }
      
      // Set up Google Drive API for direct download
      const { google } = require('googleapis');
      const { JWT } = require('google-auth-library');
      
      const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                      path.resolve(process.cwd(), '.service-account.json');
      
      const keyFileData = await readFile(keyFilePath, 'utf8');
      const keyFile = JSON.parse(keyFileData);
      
      const authClient = new JWT({
        email: keyFile.client_email,
        key: keyFile.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });
      
      const drive = google.drive({ version: 'v3', auth: authClient });
      
      // Temporary file path for downloaded PDF
      const tempFileName = `temp-${file.name}-${driveId.substring(0, 8)}.pdf`;
      const tempFilePath = path.join(this.cacheDir, tempFileName);
      
      // Download the PDF file
      const dest = fs.createWriteStream(tempFilePath);
      
      try {
        const response = await drive.files.get(
          { fileId: driveId, alt: 'media' },
          { responseType: 'stream' }
        );
        
        // Save the file
        await new Promise<void>((resolve, reject) => {
          response.data
            .on('end', () => resolve())
            .on('error', (err: Error) => reject(err))
            .pipe(dest);
        });
        
        // Get the file size
        const stats = await stat(tempFilePath);
        const fileSize = stats.size;
        
        // Check if file is too large
        if (fileSize > this.maxFileSize) {
          if (!keepFile) {
            await unlink(tempFilePath).catch(() => {});
          }
          
          throw new Error(
            `PDF file too large: ${fileSize} bytes (max ${this.maxFileSize} bytes)`
          );
        }
        
        this.metrics.totalBytesProcessed += fileSize;
        
        // Read the file as binary data
        const fileBuffer = await readFile(tempFilePath);
        
        // Process with Claude to extract text
        const extractResult = await this.extractTextFromPDF(
          fileBuffer,
          file.name,
          maxPages
        );
        
        // Clean up the file if not keeping it
        if (!keepFile) {
          await unlink(tempFilePath).catch(() => {});
        }
        
        if (!extractResult.success) {
          throw new Error(extractResult.error || 'Failed to extract text');
        }
        
        // Cache the result
        if (extractResult.content) {
          const cacheFile = path.join(this.cacheDir, `cache-${cacheKey}.txt`);
          await fs.promises.writeFile(cacheFile, extractResult.content, 'utf8');
          this.cachedFiles.set(cacheKey, cacheFile);
        }
        
        // Update metrics
        this.metrics.successfulProcessed++;
        const duration = Date.now() - startTime;
        if (this.metrics.averageProcessingTime) {
          this.metrics.averageProcessingTime = 
            (this.metrics.averageProcessingTime + duration) / 2;
        } else {
          this.metrics.averageProcessingTime = duration;
        }
        
        this.logger?.info(
          `Successfully processed PDF ${file.name} (${fileSize} bytes) in ${duration}ms`
        );
        
        return {
          success: true,
          content: extractResult.content,
          fileName: file.name,
          numPages: extractResult.numPages,
          fileSize,
          sourceId: driveId
        };
      } catch (error) {
        // Clean up file on error
        await unlink(tempFilePath).catch(() => {});
        throw error;
      }
    } catch (error) {
      this.metrics.failedProcessed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Error processing PDF from Drive:`, error);
      
      return {
        success: false,
        error: `Error processing PDF: ${errorMessage}`
      };
    } finally {
      this.processingFiles.delete(driveId);
    }
  }

  /**
   * Extract text from a PDF file using Claude
   */
  async extractTextFromPDF(
    pdfData: Buffer,
    fileName?: string,
    maxPages = 0
  ): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    numPages?: number;
  }> {
    try {
      const base64PDF = pdfData.toString('base64');
      
      this.logger?.debug(`Extracting text from PDF${fileName ? ` "${fileName}"` : ''}`);
      
      // Use Claude to extract text from PDF
      const result = await claudeService.analyzePdf(
        base64PDF,
        `Please extract all the text content from this PDF${fileName ? ` titled "${fileName}"` : ''} in a well-formatted way that preserves paragraphs, headings, and any important structural elements. Do not analyze or summarize, just extract the raw text.`,
        maxPages
      );
      
      if (!result) {
        throw new Error('No result from Claude');
      }
      
      this.logger?.debug(`Extracted ${result.content?.length || 0} characters from PDF`);
      
      return {
        success: true,
        content: result.content,
        numPages: result.numPages || -1
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Error extracting text from PDF:`, error);
      
      return {
        success: false,
        error: `Error extracting text from PDF: ${errorMessage}`
      };
    }
  }

  /**
   * Process a PDF file from a local file path
   */
  async processPDFFromFile(
    filePath: string,
    maxPages = 0
  ): Promise<PDFProcessingResult> {
    const startTime = Date.now();
    this.metrics.totalProcessed++;
    this.metrics.lastProcessedTime = new Date();
    
    const fileName = path.basename(filePath);
    this.processingFiles.add(fileName);
    
    try {
      // Check if file exists
      const stats = await stat(filePath);
      const fileSize = stats.size;
      
      // Check if file is too large
      if (fileSize > this.maxFileSize) {
        throw new Error(
          `PDF file too large: ${fileSize} bytes (max ${this.maxFileSize} bytes)`
        );
      }
      
      this.metrics.totalBytesProcessed += fileSize;
      
      // Read the file as binary data
      const fileBuffer = await readFile(filePath);
      
      // Process with Claude to extract text
      const extractResult = await this.extractTextFromPDF(
        fileBuffer,
        fileName,
        maxPages
      );
      
      if (!extractResult.success) {
        throw new Error(extractResult.error || 'Failed to extract text');
      }
      
      // Update metrics
      this.metrics.successfulProcessed++;
      const duration = Date.now() - startTime;
      if (this.metrics.averageProcessingTime) {
        this.metrics.averageProcessingTime = 
          (this.metrics.averageProcessingTime + duration) / 2;
      } else {
        this.metrics.averageProcessingTime = duration;
      }
      
      this.logger?.info(
        `Successfully processed PDF ${fileName} (${fileSize} bytes) in ${duration}ms`
      );
      
      return {
        success: true,
        content: extractResult.content,
        fileName,
        numPages: extractResult.numPages,
        fileSize
      };
    } catch (error) {
      this.metrics.failedProcessed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger?.error(`Error processing PDF from file:`, error);
      
      return {
        success: false,
        error: `Error processing PDF: ${errorMessage}`,
        fileName
      };
    } finally {
      this.processingFiles.delete(fileName);
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(): PDFProcessorServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalProcessed: 0,
      successfulProcessed: 0,
      failedProcessed: 0,
      totalBytesProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    this.logger?.info('PDFProcessorService metrics reset');
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cachedFiles.clear();
    
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      const cacheFiles = files.filter(f => f.startsWith('cache-'));
      
      for (const file of cacheFiles) {
        await unlink(path.join(this.cacheDir, file)).catch(() => {});
      }
      
      this.logger?.info(`Cleared ${cacheFiles.length} cached files`);
    } catch (error) {
      this.logger?.error('Error clearing cache:', error);
    }
  }
}

export default PDFProcessorService;