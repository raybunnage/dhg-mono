export interface Script {
  id: string;
  file_path: string;
  title: string;
  summary: ScriptSummary | null;
  language: string;
  ai_generated_tags: string[];
  manual_tags: string[] | null;
  last_modified_at: string | null;
  last_indexed_at: string | null;
  file_hash: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  script_type_id: string | null;
  package_json_references: PackageReference[] | null;
  ai_assessment: ScriptAssessment | null;
  assessment_quality_score: number | null;
  assessment_created_at: string | null;
  assessment_updated_at: string | null;
  assessment_model: string | null;
  assessment_version: number | null;
  assessment_date: string | null;
  document_type_id: string | null;
}

export interface ScriptSummary {
  description: string;
  purpose: string;
  dependencies?: string[];
  inputs?: string[];
  outputs?: string[];
  key_functions?: string[];
  // New detailed summary fields
  recommendation?: string;
  integration?: string;
  importance?: string;
}

export interface PackageReference {
  name: string;
  version?: string;
  path?: string;
}

export interface ScriptAssessment {
  quality: 'high' | 'medium' | 'low';
  complexity: 'high' | 'medium' | 'low';
  security_issues?: string[];
  improvement_suggestions?: string[];
  documentation_quality?: 'high' | 'medium' | 'low';
  maintainability?: 'high' | 'medium' | 'low';
}

export interface ScriptTypeDefinition {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface ScriptFile {
  file_path: string;
  title: string;
  language: string;
  last_modified_at: string;
  file_hash: string;
}

export interface AIResponse {
  text: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ClassificationResult {
  scriptTypeId: string | null;
  summary: ScriptSummary | null;
  aiGeneratedTags: string[];
  aiAssessment: ScriptAssessment | null;
  metadata?: Record<string, any>; // Add metadata field for additional information
}

export interface SummaryOptions {
  limit: number;
}