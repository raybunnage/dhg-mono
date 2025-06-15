import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { Database } from '../../../../supabase/types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.development') });

// Create Supabase client directly for CLI usage
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Get singleton Supabase client
export const getSupabaseClient = () => {
  return supabase;
};

// Type aliases for our tables
export type RegistryService = Database['public']['Tables']['registry_services']['Row'];
export type RegistryApp = Database['public']['Tables']['registry_apps']['Row'];
export type RegistryPipeline = Database['public']['Tables']['sys_cli_pipelines']['Row'];
export type ServiceDependency = Database['public']['Tables']['service_dependencies']['Row'];
export type AnalysisRun = Database['public']['Tables']['service_dependency_analysis_runs']['Row'];

// Insert types
export type RegistryServiceInsert = Database['public']['Tables']['registry_services']['Insert'];
export type RegistryAppInsert = Database['public']['Tables']['registry_apps']['Insert'];
export type RegistryPipelineInsert = Database['public']['Tables']['sys_cli_pipelines']['Insert'];
export type ServiceDependencyInsert = Database['public']['Tables']['service_dependencies']['Insert'];
export type AnalysisRunInsert = Database['public']['Tables']['service_dependency_analysis_runs']['Insert'];

// Common database operations
export async function upsertService(service: RegistryServiceInsert) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('registry_services')
    .upsert(service, { onConflict: 'service_name' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function upsertApp(app: RegistryAppInsert) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('registry_apps')
    .upsert(app, { onConflict: 'app_name' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function upsertPipeline(pipeline: RegistryPipelineInsert) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sys_cli_pipelines')
    .upsert(pipeline, { onConflict: 'pipeline_name' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createAnalysisRun(runType: string, targetType: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('service_dependency_analysis_runs')
    .insert({
      run_type: runType,
      target_type: targetType,
      status: 'running'
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function updateAnalysisRun(
  runId: string, 
  updates: Partial<AnalysisRunInsert>
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('service_dependency_analysis_runs')
    .update({
      ...updates,
      completed_at: new Date().toISOString()
    })
    .eq('id', runId);
  
  if (error) throw error;
}

export async function getServiceByName(serviceName: string): Promise<RegistryService | null> {
  const supabase = getSupabaseClient();
  
  // Try the exact name first
  let { data, error } = await supabase
    .from('registry_services')
    .select('*')
    .eq('service_name', serviceName)
    .single();
  
  if (data) return data;
  
  // If not found, try variations (Phase 2 enhanced for complex patterns)
  const variations = generateServiceNameVariations(serviceName);
  
  for (const variation of variations) {
    const { data: varData } = await supabase
      .from('registry_services')
      .select('*')
      .eq('service_name', variation)
      .single();
    
    if (varData) return varData;
  }
  
  // If still not found, do a partial match search
  const { data: partialMatches } = await supabase
    .from('registry_services')
    .select('*')
    .ilike('service_name', `%${serviceName.split('-')[0]}%`);
  
  if (partialMatches && partialMatches.length > 0) {
    // Return the first match (could be improved with better scoring)
    return partialMatches[0];
  }
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return null;
}

// Phase 2: Generate comprehensive service name variations for better matching
function generateServiceNameVariations(serviceName: string): string[] {
  const variations = new Set<string>();
  
  // Basic suffix variations
  variations.add(serviceName.replace('-service', '')); // claude-service -> claude
  variations.add(serviceName.replace('-adapter', '')); // supabase-adapter -> supabase
  variations.add(serviceName + '-service');           // claude -> claude-service
  variations.add(serviceName + '-adapter');           // supabase -> supabase-adapter
  
  // Handle file vs directory naming (filter-service/filter-service pattern)
  if (serviceName.includes('-')) {
    const parts = serviceName.split('-');
    
    // Try removing last part if it's "service"
    if (parts[parts.length - 1] === 'service') {
      variations.add(parts.slice(0, -1).join('-'));
    }
    
    // Try first part only (document-classification-service -> document)
    variations.add(parts[0]);
    
    // Try first two parts (document-classification-service -> document-classification)  
    if (parts.length > 2) {
      variations.add(parts.slice(0, 2).join('-'));
    }
    
    // Try last part only (google-drive-browser -> browser)
    if (parts.length > 1) {
      variations.add(parts[parts.length - 1]);
    }
    
    // Try without first part (google-drive-browser -> drive-browser)
    if (parts.length > 2) {
      variations.add(parts.slice(1).join('-'));
    }
  }
  
  // Browser/CLI environment-specific patterns
  variations.add(serviceName.replace('browser-', ''));    // browser-auth -> auth
  variations.add(serviceName.replace('cli-', ''));        // cli-tracking -> tracking
  variations.add('browser-' + serviceName);               // auth -> browser-auth
  variations.add('cli-' + serviceName);                   // tracking -> cli-tracking
  
  // Handle compound service names
  if (serviceName.includes('-') && serviceName.split('-').length === 2) {
    const [first, second] = serviceName.split('-');
    variations.add(second + '-' + first);  // google-drive -> drive-google
    variations.add(first);                 // google-drive -> google
    variations.add(second);                // google-drive -> drive
  }
  
  // Handle specific patterns we've seen in the codebase
  
  // Pattern: service-name-service -> service-name
  if (serviceName.endsWith('-service')) {
    const base = serviceName.slice(0, -8);
    variations.add(base);
    variations.add(base + '-browser');     // Add browser variant
    variations.add(base + '-cli');         // Add CLI variant
  }
  
  // Pattern: parent-child-service naming (auth-service directory)
  const authPatterns = ['browser-auth', 'cli-auth', 'auth-browser', 'auth-cli'];
  if (serviceName.includes('auth')) {
    authPatterns.forEach(pattern => variations.add(pattern));
  }
  
  // Pattern: google-drive variations
  if (serviceName.includes('google') || serviceName.includes('drive')) {
    ['google-drive', 'google-drive-browser', 'google-drive-sync', 'google-auth'].forEach(pattern => {
      variations.add(pattern);
    });
  }
  
  // Pattern: tracking variations  
  if (serviceName.includes('tracking')) {
    ['tracking', 'cli-tracking-wrapper', 'shell-command-tracker', 'command-tracking'].forEach(pattern => {
      variations.add(pattern);
    });
  }
  
  // Remove invalid variations
  const filtered = Array.from(variations).filter(v => 
    v && 
    v !== serviceName && 
    v.length > 0 && 
    !v.endsWith('-') && 
    !v.startsWith('-') &&
    !v.includes('--')
  );
  
  return filtered;
}

export async function getAppByName(appName: string): Promise<RegistryApp | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('registry_apps')
    .select('*')
    .eq('app_name', appName)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getPipelineByName(pipelineName: string): Promise<RegistryPipeline | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sys_cli_pipelines')
    .select('*')
    .eq('pipeline_name', pipelineName)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}