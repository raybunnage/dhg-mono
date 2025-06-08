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
export type RegistryPipeline = Database['public']['Tables']['registry_cli_pipelines']['Row'];
export type ServiceDependency = Database['public']['Tables']['service_dependencies']['Row'];
export type AnalysisRun = Database['public']['Tables']['service_dependency_analysis_runs']['Row'];

// Insert types
export type RegistryServiceInsert = Database['public']['Tables']['registry_services']['Insert'];
export type RegistryAppInsert = Database['public']['Tables']['registry_apps']['Insert'];
export type RegistryPipelineInsert = Database['public']['Tables']['registry_cli_pipelines']['Insert'];
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
    .from('registry_cli_pipelines')
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
  const { data, error } = await supabase
    .from('registry_services')
    .select('*')
    .eq('service_name', serviceName)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
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
    .from('registry_cli_pipelines')
    .select('*')
    .eq('pipeline_name', pipelineName)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}