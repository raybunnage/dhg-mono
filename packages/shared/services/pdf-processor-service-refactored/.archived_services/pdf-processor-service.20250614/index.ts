/**
 * PDF Processor Service
 * 
 * A singleton service for processing PDF files
 * - Extracts text content from PDFs using Claude AI
 * - Downloads and caches PDFs from Google Drive
 * - Handles chunking for large PDFs
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../supabase-client';
import { GoogleDriveService } from '../google-drive';
import { claudeService } from '@shared/services/claude-service';

/**
 * PDF processing result
 */
export interface PDFProcessingResult {
  success: boolean;
  content?: string;
  error?: string;
  sourceId?: string;
  fileName?: string;
  numPages?: number;
  fileSize?: number;
}

/**
 * PDF Processor Service Singleton
 */
export class PDFProcessorService {
  private static instance: PDFProcessorService;
  private supabaseService: SupabaseClientService;
  
  // Cache directory for downloaded PDFs
  private cacheDir = './document-analysis-results';
  
  // Maximum PDF size to process (100MB)
  private maxFileSize = 100 * 1024 * 1024;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.supabaseService = SupabaseClientService.getInstance();
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PDFProcessorService {
    if (!PDFProcessorService.instance) {
      PDFProcessorService.instance = new PDFProcessorService();
    }
    return PDFProcessorService.instance;
  }
  
  /**
   * Set the cache directory for downloaded PDFs
   * @param dir Directory path for caching PDFs
   */
  public setCacheDirectory(dir: string): void {
    this.cacheDir = dir;
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Process a PDF file from Google Drive
   * @param driveId Google Drive file ID
   * @param maxPages Maximum number of pages to process (0 for all pages)
   * @param keepFile Whether to keep the downloaded file after processing
   */
  public async processPDFFromDrive(
    driveId: string,
    maxPages = 0,
    keepFile = false
  ): Promise<PDFProcessingResult> {
    try {
      // Get Supabase client
      const supabase = this.supabaseService.getClient();
      
      // Get Google Drive service
      const { GoogleAuthService } = require('../google-drive/google-auth-service');
      const auth = GoogleAuthService.getDefaultInstance();
      const driveService = GoogleDriveService.getInstance(auth, supabase);
      
      // Get file metadata from Google Drive
      const file = await driveService.getFile(driveId);
      
      if (!file || !file.name) {
        return {
          success: false,
          error: `File not found in Google Drive: ${driveId}`
        };
      }
      
      // Check if file is a PDF
      if (file.mimeType !== 'application/pdf') {
        return {
          success: false,
          error: `File is not a PDF: ${file.name} (${file.mimeType})`
        };
      }
      
      // Use Google Drive API directly since the service methods for direct downloads aren't fully implemented
      const { google } = require('googleapis');
      const { JWT } = require('google-auth-library');
      
      // Get service account key file path from environment or default location
      const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 
                      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                      path.resolve(process.cwd(), '.service-account.json');
      
      // Read and parse the service account key file
      const keyFileData = fs.readFileSync(keyFilePath, 'utf8');
      const keyFile = JSON.parse(keyFileData);
      
      // Create JWT auth client with the service account
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
        const stats = fs.statSync(tempFilePath);
        const fileSize = stats.size;
        
        // Check if file is too large
        if (fileSize > this.maxFileSize) {
          // Clean up the file if it's too large
          if (!keepFile) {
            try {
              fs.unlinkSync(tempFilePath);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          
          return {
            success: false,
            error: `PDF file too large: ${fileSize} bytes (max ${this.maxFileSize} bytes)`,
            fileName: file.name,
            fileSize
          };
        }
        
        // Read the file as binary data
        const fileBuffer = fs.readFileSync(tempFilePath);
        
        // Process with Claude to extract text
        const extractResult = await this.extractTextFromPDF(
          fileBuffer,
          file.name,
          maxPages
        );
        
        // Clean up the file if not keeping it
        if (!keepFile) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        if (!extractResult.success) {
          return {
            success: false,
            error: extractResult.error,
            fileName: file.name,
            fileSize
          };
        }
        
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
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        
        throw error;
      }
    } catch (error) {
      return {
        success: false,
        error: `Error processing PDF: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Extract text from a PDF file using Claude
   * @param pdfData Buffer containing PDF data
   * @param fileName Optional file name for better results
   * @param maxPages Maximum number of pages to process (0 for all pages)
   */
  public async extractTextFromPDF(
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
      
      // Use Claude to extract text from PDF
      const result = await claudeService.analyzePdf(
        base64PDF,
        `Please extract all the text content from this PDF${fileName ? ` titled "${fileName}"` : ''} in a well-formatted way that preserves paragraphs, headings, and any important structural elements. Do not analyze or summarize, just extract the raw text.`,
        maxPages
      );
      
      if (!result) {
        return {
          success: false,
          error: 'Failed to extract text from PDF (no result from Claude)'
        };
      }
      
      return {
        success: true,
        content: result.content,
        numPages: result.numPages || -1
      };
    } catch (error) {
      return {
        success: false,
        error: `Error extracting text from PDF: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Process a PDF file from a local file path
   * @param filePath Local file path
   * @param maxPages Maximum number of pages to process (0 for all pages)
   */
  public async processPDFFromFile(
    filePath: string,
    maxPages = 0
  ): Promise<PDFProcessingResult> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }
      
      // Get file size
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Check if file is too large
      if (fileSize > this.maxFileSize) {
        return {
          success: false,
          error: `PDF file too large: ${fileSize} bytes (max ${this.maxFileSize} bytes)`,
          fileName: path.basename(filePath),
          fileSize
        };
      }
      
      // Read the file as binary data
      const fileBuffer = fs.readFileSync(filePath);
      
      // Get file name
      const fileName = path.basename(filePath);
      
      // Process with Claude to extract text
      const extractResult = await this.extractTextFromPDF(
        fileBuffer,
        fileName,
        maxPages
      );
      
      if (!extractResult.success) {
        return {
          success: false,
          error: extractResult.error,
          fileName,
          fileSize
        };
      }
      
      return {
        success: true,
        content: extractResult.content,
        fileName,
        numPages: extractResult.numPages,
        fileSize
      };
    } catch (error) {
      return {
        success: false,
        error: `Error processing PDF: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Export singleton instance
export const pdfProcessorService = PDFProcessorService.getInstance();