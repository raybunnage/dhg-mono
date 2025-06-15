/**
 * Environment Configuration Service Types
 */

export interface EnvConfig {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  
  // Claude AI
  CLAUDE_API_KEY?: string;
  
  // App Config
  APP_NAME?: string;
  APP_ENV?: string;
  API_URL?: string;
  FEATURE_FLAGS?: string;
  
  // Auth
  TEST_USER_EMAIL?: string;
  TEST_USER_PASSWORD?: string;
  
  // Google Services
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  
  // Additional dynamic keys
  [key: string]: string | undefined;
}

export interface EnvConfigServiceMetrics {
  totalGets: number;
  totalValidations: number;
  missingKeys: string[];
  lastAccessTime?: Date;
}

export interface EnvDiagnostics {
  environment: string;
  isBrowser: boolean;
  hasSupabaseConfig: boolean;
  hasClaudeConfig: boolean;
  hasGoogleConfig: boolean;
  missingRequired: string[];
}