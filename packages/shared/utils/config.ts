import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { LogLevel } from './logger';

// Try to load environment variables from various files
const envFiles = ['.env', '.env.local', '.env.development'];

// Create a function to load environment variables
function loadEnvFiles() {
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment variables from ${filePath}`);
      
      const result = dotenv.config({ path: filePath });
      
      if (result.error) {
        console.error(`Error loading ${filePath}:`, result.error);
      }
    }
  }
}

// Load environment variables
loadEnvFiles();

/**
 * Configuration interface for the application
 */
export interface Config {
  // Environment
  nodeEnv: string;
  
  // Supabase
  supabaseUrl: string;
  supabaseKey: string;
  
  // Claude API
  claudeApiKey: string;
  claudeApiBaseUrl: string;
  claudeApiVersion: string;
  defaultModel: string;
  
  // Logging
  logLevel: LogLevel;
}

/**
 * Configuration object with environment variables
 */
const config: Config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Claude API
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  claudeApiBaseUrl: process.env.CLAUDE_API_BASE_URL || 'https://api.anthropic.com',
  claudeApiVersion: process.env.CLAUDE_API_VERSION || '2023-06-01',
  defaultModel: process.env.CLAUDE_DEFAULT_MODEL || 'claude-sonnet-4-20250514',
  
  // Logging
  logLevel: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
};

export default config;