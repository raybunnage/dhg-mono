/**
 * Type definitions for PromptManagementService
 */

import { Prompt, PromptRelationship } from '../prompt-service/prompt-service';

export interface PromptOutputTemplate {
  id: string;
  name: string;
  description: string | null;
  template: any;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplateAssociation {
  id: string;
  prompt_id: string;
  template_id: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentationFile {
  id: string;
  file_path: string;
  title: string;
  metadata?: {
    file_size?: number;
    size?: number;
    created?: string;
    modified?: string;
    isPrompt?: boolean;
  };
  last_modified_at?: string;
  created_at: string;
  updated_at: string;
  document_type_id?: string | null;
  status_recommendation?: string | null;
}

export interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  mime_type: string | null;
  category: string;
}

export interface PromptCategory {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelationshipSettings {
  relationship_type: string;
  relationship_context: string;
  description: string;
  document_type_id: string | null;
}

export interface PackageJsonRelationship {
  id: string;
  path: string;
  title: string;
  document_type_id: string | null;
  context: string;
  relationship_type: string;
  description: string;
  settings: RelationshipSettings;
}

export interface PromptMetadata {
  hash?: string;
  source?: {
    fileName?: string;
    createdAt?: string;
    lastModified?: string;
    gitInfo?: {
      branch: string;
      commitId: string;
    };
  };
  aiEngine?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  usage?: {
    inputSchema?: any;
    outputSchema?: any;
  };
  function?: {
    purpose?: string;
    successCriteria?: string;
    dependencies?: string[];
    estimatedCost?: string;
  };
  relatedAssets?: string[];
  databaseQuery?: string;
  databaseQuery2?: string;
  packageJsonFiles?: PackageJsonRelationship[];
}

export interface DatabasePrompt extends Prompt {
  document_type_id: string | null;
  category_id: string | null;
  version: string;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  author: string | null;
  tags: string[];
  file_path: string | null;
  metadata: PromptMetadata;
}

// Re-export base types
export { Prompt, PromptRelationship } from '../prompt-service/prompt-service';