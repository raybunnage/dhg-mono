/**
 * Direct Supabase Service
 * 
 * A workaround service that uses direct fetch calls to Supabase REST API
 * instead of using the Supabase client library. Use this as a temporary
 * solution until the client library authentication issues are resolved.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

/**
 * Simplified response type for Supabase operations
 */
export interface SupabaseResponse<T> {
  data: T | null;
  error: { message: string } | null;
  status: number;
  statusText: string;
}

/**
 * Direct Supabase Service implementation
 */
export class SupabaseDirectService {
  private static instance: SupabaseDirectService;
  private supabaseUrl: string = '';
  private supabaseKey: string = '';
  private debugMode: boolean = false;
  private initialized: boolean = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): SupabaseDirectService {
    if (!SupabaseDirectService.instance) {
      SupabaseDirectService.instance = new SupabaseDirectService();
    }
    return SupabaseDirectService.instance;
  }

  /**
   * Enable debug mode for more verbose logging
   */
  public enableDebug(enabled: boolean = true): void {
    this.debugMode = enabled;
    console.log(`Supabase Direct Service debug mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Initialize the service with credentials
   */
  public initialize(): void {
    if (this.initialized) return;
    
    const { supabaseUrl, supabaseKey } = this.loadEnvironmentVariables();
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Unable to find Supabase credentials in environment variables. Please make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined in your .env file.');
    }
    
    console.log(`Supabase Direct Service initialized with URL: ${this.supabaseUrl.substring(0, 15)}...`);
    this.initialized = true;
  }

  /**
   * Load environment variables from .env files
   */
  private loadEnvironmentVariables(): { supabaseUrl: string, supabaseKey: string } {
    // Try to load environment variables from various files
    const envFiles = ['.env', '.env.local', '.env.development'];
    
    for (const file of envFiles) {
      const filePath = path.resolve(process.cwd(), file);
      
      if (fs.existsSync(filePath)) {
        if (this.debugMode) {
          console.log(`SupabaseDirectService: Loading environment variables from ${filePath}`);
        }
        
        try {
          dotenv.config({ path: filePath });
        } catch (err) {
          console.error('Error reading env file:', err);
        }
      }
    }
    
    // Check for environment variables
    const supabaseUrl = process.env.SUPABASE_URL || '';
    
    // Try SERVICE_ROLE_KEY first, then fall back to ANON_KEY
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                         process.env.SUPABASE_ANON_KEY || 
                         process.env.SUPABASE_KEY || '';
                         
    if (this.debugMode) {
      console.log(`SupabaseDirectService found URL: ${supabaseUrl ? supabaseUrl.substring(0, 15) + '...' : 'none'}`);
      if (supabaseKey) {
        console.log(`SupabaseDirectService found key: ${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 5)}`);
      } else {
        console.log('SupabaseDirectService found no valid key');
      }
    }
    
    return { supabaseUrl, supabaseKey };
  }

  /**
   * Get default headers for Supabase API requests
   */
  private getHeaders(contentType: string = 'application/json'): Record<string, string> {
    if (!this.initialized) {
      this.initialize();
    }
    
    // Make sure headers are properly formatted exactly as the Supabase docs require
    // Some clients might be case-sensitive, so use exact capitalization
    return {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': contentType,
      'Prefer': 'return=representation'
    };
  }

  /**
   * Find items in a table
   */
  public async select<T = any>(
    table: string, 
    options: {
      columns?: string;
      filter?: Record<string, any>;
      limit?: number;
      order?: string;
      ascending?: boolean;
    } = {}
  ): Promise<SupabaseResponse<T[]>> {
    if (!this.initialized) {
      this.initialize();
    }
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      // Add columns
      if (options.columns) {
        params.set('select', options.columns);
      }
      
      // Add limit
      if (options.limit) {
        params.set('limit', options.limit.toString());
      }
      
      // Add order
      if (options.order) {
        params.set('order', options.order + (options.ascending === false ? '.desc' : ''));
      }
      
      // Build URL
      const url = `${this.supabaseUrl}/rest/v1/${table}?${params.toString()}`;
      
      if (this.debugMode) {
        console.log(`Making select request to: ${url}`);
      }
      
      // Make the request
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      // Handle response
      let data: T[] | null = null;
      let error = null;
      
      if (response.ok) {
        const responseData = await response.json();
        data = responseData as T[];
      } else {
        let errorMessage = '';
        try {
          const errorBody = await response.text();
          errorMessage = errorBody;
        } catch (e) {
          errorMessage = 'Could not read error body';
        }
        error = { message: errorMessage };
      }
      
      return {
        data,
        error,
        status: response.status,
        statusText: response.statusText
      };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e.message || 'Unknown error' },
        status: 500,
        statusText: 'Error'
      };
    }
  }

  /**
   * Get documents from sources_google that need classification
   */
  public async getDocumentsNeedingClassification(limit: number = 10): Promise<SupabaseResponse<any[]>> {
    if (!this.initialized) {
      this.initialize();
    }
    
    try {
      // Build filter for documents needing classification
      const url = `${this.supabaseUrl}/rest/v1/sources_google?select=id,name,mime_type,path,drive_id&is_deleted=eq.false&document_type_id=is.null&or=(mime_type.eq.application/vnd.openxmlformats-officedocument.wordprocessingml.document,mime_type.eq.text/plain)&limit=${limit}`;
      
      if (this.debugMode) {
        console.log(`Getting documents needing classification: ${url}`);
      }
      
      // Make the request
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      // Handle response
      let data: any[] | null = null;
      let error = null;
      
      if (response.ok) {
        const responseData = await response.json();
        data = responseData as any[];
        if (this.debugMode) {
          console.log(`Found ${data.length} documents needing classification`);
        }
      } else {
        let errorMessage = '';
        try {
          const errorBody = await response.text();
          errorMessage = errorBody;
        } catch (e) {
          errorMessage = 'Could not read error body';
        }
        error = { message: errorMessage };
      }
      
      return {
        data,
        error,
        status: response.status,
        statusText: response.statusText
      };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e.message || 'Unknown error' },
        status: 500,
        statusText: 'Error'
      };
    }
  }

  /**
   * Update document classification
   */
  public async updateDocumentType(
    id: string, 
    documentTypeId: string
  ): Promise<SupabaseResponse<any>> {
    if (!this.initialized) {
      this.initialize();
    }
    
    try {
      const url = `${this.supabaseUrl}/rest/v1/sources_google?id=eq.${id}`;
      
      if (this.debugMode) {
        console.log(`Updating document type for ${id} to ${documentTypeId}`);
      }
      
      // Make the request
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ document_type_id: documentTypeId })
      });
      
      // Handle response
      let data = null;
      let error = null;
      
      if (response.ok) {
        data = { success: true };
      } else {
        let errorMessage = '';
        try {
          const errorBody = await response.text();
          errorMessage = errorBody;
        } catch (e) {
          errorMessage = 'Could not read error body';
        }
        error = { message: errorMessage };
      }
      
      return {
        data,
        error,
        status: response.status,
        statusText: response.statusText
      };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e.message || 'Unknown error' },
        status: 500,
        statusText: 'Error'
      };
    }
  }

  /**
   * Insert record into expert_documents
   */
  public async insertExpertDocument(
    data: {
      source_id: string;
      document_type_id: string;
      classification_confidence?: number;
      classification_metadata?: any;
    }
  ): Promise<SupabaseResponse<any>> {
    if (!this.initialized) {
      this.initialize();
    }
    
    try {
      const url = `${this.supabaseUrl}/rest/v1/expert_documents`;
      
      // Prepare data with required fields
      const expertDoc = {
        id: uuidv4(),
        source_id: data.source_id,
        document_type_id: data.document_type_id,
        classification_confidence: data.classification_confidence || 0.75,
        classification_metadata: data.classification_metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (this.debugMode) {
        console.log(`Inserting expert document for source ${data.source_id}`);
      }
      
      // Make the request
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(expertDoc)
      });
      
      // Handle response
      let responseData = null;
      let error = null;
      
      if (response.ok) {
        responseData = { success: true, id: expertDoc.id };
      } else {
        let errorMessage = '';
        try {
          const errorBody = await response.text();
          errorMessage = errorBody;
        } catch (e) {
          errorMessage = 'Could not read error body';
        }
        error = { message: errorMessage };
      }
      
      return {
        data: responseData,
        error,
        status: response.status,
        statusText: response.statusText
      };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e.message || 'Unknown error' },
        status: 500,
        statusText: 'Error'
      };
    }
  }
  
  /**
   * Test connection
   */
  public async testConnection(): Promise<{ success: boolean; error?: string; }> {
    if (!this.initialized) {
      this.initialize();
    }
    
    try {
      const url = `${this.supabaseUrl}/rest/v1/sources_google?select=count`;
      
      if (this.debugMode) {
        console.log(`Testing connection with GET request to: ${url}`);
      }
      
      // Make the request
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        return {
          success: false,
          error: `Connection test failed: HTTP ${response.status} ${response.statusText}`
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: `Error testing connection: ${e.message || 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const supabaseDirect = SupabaseDirectService.getInstance();