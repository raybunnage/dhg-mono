/**
 * Standalone Document Service
 * 
 * A service for managing documentation files, now using the SupabaseClientService
 * singleton pattern for consistent database access.
 */
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
const envPaths = ['.env', '.env.local', '.env.development'];
for (const envPath of envPaths) {
  const fullPath = path.resolve(process.cwd(), envPath);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
  }
}

// Simple Logger
class Logger {
  static info(message: string) {
    console.log(`[INFO] ${message}`);
  }
  
  static error(message: string, error?: any) {
    console.error(`[ERROR] ${message}`, error || '');
  }
  
  static warn(message: string) {
    console.warn(`[WARN] ${message}`);
  }
  
  static debug(message: string) {
    if (process.env.DEBUG) {
      console.debug(`[DEBUG] ${message}`);
    }
  }
}

// Config object
const config = {
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
};

// Document Service
class DocumentService {
  private supabaseService: SupabaseClientService;
  private rootDir: string;
  
  constructor() {
    this.rootDir = process.cwd();
    
    // Initialize Supabase client service
    this.supabaseService = SupabaseClientService.getInstance();
    Logger.info('Document Service initialized with SupabaseClientService');
  }
  
  // Get Supabase client
  private get supabase(): SupabaseClient {
    return this.supabaseService.getClient();
  }
  
  // Test connection to Supabase
  public async testConnection(): Promise<boolean> {
    try {
      // Use the SupabaseClientService's testConnection method
      Logger.info('Testing connection to Supabase using SupabaseClientService...');
      const connectionResult = await this.supabaseService.testConnection();
      
      if (!connectionResult.success) {
        Logger.error(`Failed to connect to Supabase: ${connectionResult.error}`, connectionResult.details);
        return false;
      }
      
      // Also test our specific table access
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) {
        Logger.error('Failed to connect to documentation_files table', error);
        return false;
      }
      
      Logger.info('✅ Successfully connected to Supabase and documentation_files table');
      return true;
    } catch (error) {
      Logger.error('Error connecting to Supabase', error);
      return false;
    }
  }
  
  // Show recent files
  public async showRecentFiles(limit: number = 20): Promise<boolean> {
    try {
      Logger.info(`Fetching ${limit} recent files...`);
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select(`
          id, 
          file_path, 
          title, 
          language, 
          document_type_id,
          created_at, 
          updated_at
        `)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        Logger.error('Error fetching recent files:', error);
        return false;
      }
      
      if (!data || data.length === 0) {
        Logger.info('No recent files found.');
        return true;
      }
      
      Logger.info(`Found ${data.length} recent document files:`);
      Logger.info('----------------------------------------------');
      
      // Format the data as a table
      console.log('ID         | Title                    | Type                     | Path                                    | Updated At');
      console.log('-----------|--------------------------|--------------------------|----------------------------------------|------------------');
      
      data.forEach((file) => {
        const id = file.id ? file.id.substring(0, 8) + '...' : 'No ID';
        const title = (file.title || 'No title').padEnd(24).substring(0, 24);
        const type = (file.document_type_id || 'Untyped').padEnd(24).substring(0, 24);
        const path = (file.file_path || 'No path').padEnd(39).substring(0, 39);
        const updated = file.updated_at ? new Date(file.updated_at).toISOString().split('T')[0] : 'No date';
        
        console.log(`${id} | ${title} | ${type} | ${path} | ${updated}`);
      });
      
      Logger.info('----------------------------------------------');
      Logger.info(`Total: ${data.length} recent documents`);
      
      return true;
    } catch (error) {
      Logger.error('Error in showRecentFiles:', error);
      return false;
    }
  }
}

// Create instance and expose it
export const documentService = new DocumentService();

// If run directly, test the service
if (require.main === module) {
  async function runTest() {
    try {
      // Test connection
      await documentService.testConnection();
      
      // Show recent files
      await documentService.showRecentFiles();
      
      Logger.info('Test completed successfully');
    } catch (error) {
      Logger.error('Test failed:', error);
    }
  }
  
  runTest();
}