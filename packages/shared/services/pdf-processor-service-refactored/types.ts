/**
 * PDF Processor Service Types
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

export interface PDFProcessorServiceConfig {
  cacheDirectory?: string;
  maxFileSize?: number;
  cleanupOnShutdown?: boolean;
}

export interface PDFProcessorServiceMetrics {
  totalProcessed: number;
  successfulProcessed: number;
  failedProcessed: number;
  totalBytesProcessed: number;
  averageProcessingTime?: number;
  cacheHits: number;
  cacheMisses: number;
  lastProcessedTime?: Date;
}