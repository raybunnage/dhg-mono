/**
 * Type definitions for the Unified Classification Service
 */

import { Database } from '../../../../supabase/types';

// File types we support for classification
export type SupportedFileType = 'pdf' | 'docx' | 'doc' | 'txt' | 'md' | 'pptx' | 'ppt' | 
  'xlsx' | 'xls' | 'audio' | 'video' | 'image' | 'google-doc' | 'google-slides' | 'google-sheets';

// Options for classification
export interface ClassificationOptions {
  types?: SupportedFileType[];        // File types to process
  limit?: number;                      // Max files to process
  concurrency?: number;                // Parallel processing limit (default: 3)
  force?: boolean;                     // Force reclassification
  dryRun?: boolean;                    // Preview mode
  verbose?: boolean;                   // Detailed output
  filterProfile?: string;              // Active filter profile name
  status?: Database['public']['Enums']['document_processing_status']; // Pipeline status filter
  expertName?: string;                 // Filter by expert name
  skipClassified?: boolean;            // Skip already classified files
  customPrompt?: string;               // Override default prompt selection
}

// Classification result structure
export interface ClassificationResult {
  sourceId: string;
  fileName: string;
  mimeType: string;
  documentTypeId: string;
  documentTypeName: string;
  confidence: number;
  reasoning: string;
  summary?: string;
  keyInsights?: string[];
  concepts?: Concept[];
  metadata?: Record<string, any>;
  processingTime?: number;
  error?: string;
  success: boolean;
}

// Concept extracted from document
export interface Concept {
  name: string;
  weight: number;
  description?: string;
}

// Source file information
export interface SourceFile {
  id: string;
  drive_id: string;
  name: string;
  mime_type: string;
  size?: number;
  path?: string;
  web_view_link?: string;
  document_type_id?: string;
  is_deleted?: boolean;
  expert_id?: string;
  expert_document_id?: string;
  pipeline_status?: Database['public']['Enums']['document_processing_status'];
}

// Batch processing result
export interface BatchClassificationResult {
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  skippedFiles: number;
  results: ClassificationResult[];
  processingTime: number;
  errors: Array<{
    fileName: string;
    error: string;
  }>;
}

// Mime type to prompt mapping
export interface MimeTypePromptMap {
  [mimeType: string]: string;
}

// Content extraction result
export interface ContentExtractionResult {
  content: string;
  metadata?: Record<string, any>;
  error?: string;
  success: boolean;
}