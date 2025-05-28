/**
 * Prompt Service Index
 * 
 * Exports the PromptService, PromptManagementService, CLI interface, and related interfaces
 */
export * from './prompt-service';
export * from './prompt-cli-interface';

// Export specific items from modules that have conflicts
export { 
  PromptManagementService, 
  promptManagementService,
  type DocumentationFile,
  type DocumentType,
  type PromptCategory,
  type RelationshipSettings,
  type PackageJsonRelationship,
  type PromptMetadata,
  type DatabasePrompt
} from './prompt-management-service';

export { 
  PromptOutputTemplateService,
  promptOutputTemplateService,
  type TemplateWithAssociation,
  // Use aliases for conflicting types
  type PromptOutputTemplate as OutputTemplate,
  type PromptTemplateAssociation as TemplateAssociation
} from './prompt-output-templates';