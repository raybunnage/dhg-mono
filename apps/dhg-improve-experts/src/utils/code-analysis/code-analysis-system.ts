import { supabase } from '@/integrations/supabase/client';
import { processWithAI } from '@/utils/ai-processing';
import { v4 as uuidv4 } from 'uuid';

/**
 * Types for the code analysis system
 */

interface AIModelConfig {
  model_name: string;
  temperature?: number;
  max_tokens?: number;
  usage_pattern?: string;
}

interface PromptPatterns {
  system_prompts: string[];
  validation_schemas: string[];
  error_handling: string[];
}

interface ProcessingPatterns {
  batch_size: number | "dynamic";
  retry_logic: string;
  error_handling: string;
  optimization: string[];
}

interface AIProcessing {
  model_configs: AIModelConfig[];
  prompt_patterns: PromptPatterns;
  processing_patterns: ProcessingPatterns;
}

interface SupabaseOperation {
  table: string;
  operations: string[];
  query_patterns: string[];
  error_handling: string;
}

interface SupabaseOperations {
  tables_accessed: string[];
  operation_patterns: SupabaseOperation[];
  transaction_patterns: string[];
  optimization_strategies: string[];
}

interface GoogleDriveIntegration {
  operation_types: string[];
  authentication_pattern: string;
  content_handling: string[];
  error_handling: {
    retry_logic: boolean;
    token_refresh: boolean;
    content_validation: boolean;
  };
}

interface ErrorHandlingStrategy {
  scope: string;
  pattern: string;
  recovery: string;
  logging: string;
}

interface ErrorHandling {
  strategies: ErrorHandlingStrategy[];
  logging_patterns: string[];
  recovery_mechanisms: string[];
  user_feedback: {
    success_patterns: string;
    error_patterns: string;
    progress_tracking: string;
  };
}

interface PerformancePatterns {
  batch_operations: {
    implemented: boolean;
    batch_size: number | "dynamic";
    progress_tracking: boolean;
    cancellation: boolean;
  };
  optimization_strategies: string[];
  caching_implementation: string;
}

interface SecurityImplementations {
  auth_checks: string[];
  permission_patterns: string[];
  sensitive_data_handling: string[];
  token_management: {
    refresh_pattern: string;
    storage_method: string;
    validation: string;
  };
}

interface FunctionRelationships {
  depends_on: string[];
  called_by: string[];
  shares_state_with: string[];
}

interface CodeAnalysis {
  function_details: {
    name: string;
    category: string;
    description: string;
    location: string;
    implementation_notes: string;
  };
  ai_processing?: AIProcessing;
  supabase_operations?: SupabaseOperations;
  google_drive_integration?: GoogleDriveIntegration;
  error_handling: ErrorHandling;
  performance_patterns: PerformancePatterns;
  dependencies: {
    external: string[];
    internal: string[];
    environment_vars: string[];
  };
  security_implementations: SecurityImplementations;
  function_relationships: FunctionRelationships;
}

interface AnalysisRequest {
  filePath: string;
  content: string;
  repository: string;
  relativePath: string;
}

interface AnalysisOptions {
  dryRun?: boolean;
  updateExisting?: boolean;
  debugMode?: boolean;
}

/**
 * Core analysis functionality
 */
export class CodeAnalysisSystem {
  private promptTemplate: string;
  private debugMode: boolean;

  constructor(promptTemplate: string, debugMode = false) {
    this.promptTemplate = promptTemplate;
    this.debugMode = debugMode;
  }

  private log(...args: any[]) {
    if (this.debugMode) {
      console.log('[CodeAnalysis]', ...args);
    }
  }

  /**
   * Analyze a single code file
   */
  async analyzeFile(request: AnalysisRequest, options: AnalysisOptions = {}): Promise<CodeAnalysis> {
    this.log('Starting analysis:', {
      filePath: request.filePath,
      contentLength: request.content.length,
      options
    });

    try {
      // Prepare analysis prompt
      const analysisPrompt = `${this.promptTemplate}\n\n${request.content}`;
      this.log('Prompt prepared:', {
        templateLength: this.promptTemplate.length,
        contentLength: request.content.length,
        totalLength: analysisPrompt.length,
        promptPreview: this.promptTemplate.slice(0, 100)
      });

      // Process with AI
      this.log('Calling AI processor with options:', {
        temperature: 0.1,
        requireJsonOutput: true
      });

      const analysisResult = await processWithAI({
        systemPrompt: "You are a specialized code analysis system. Analyze the code and provide a detailed analysis matching the CodeAnalysis interface structure. Return only valid JSON.",
        userMessage: analysisPrompt,
        temperature: 0.1,
        requireJsonOutput: true,
        validateResponse: (response) => {
          this.log('Validating AI response:', {
            responseType: typeof response,
            responseLength: response?.length,
            isString: typeof response === 'string'
          });

          try {
            // Parse response if it's a string
            let data = typeof response === 'string' ? JSON.parse(response) : response;
            
            this.log('Parsed response data:', {
              hasData: !!data,
              keys: Object.keys(data || {}),
              hasFunctionDetails: !!data?.function_details
            });

            // Return with defaults
            return {
              function_details: {
                name: data.function_details?.name || 'Unknown',
                category: data.function_details?.category || 'Component',
                description: data.function_details?.description || '',
                location: request.relativePath,
                implementation_notes: data.function_details?.implementation_notes || ''
              },
              dependencies: {
                external: data.dependencies?.external || [],
                internal: data.dependencies?.internal || [],
                environment_vars: data.dependencies?.environment_vars || []
              },
              error_handling: data.error_handling || {
                strategies: [],
                logging_patterns: [],
                recovery_mechanisms: [],
                user_feedback: {
                  success_patterns: '',
                  error_patterns: '',
                  progress_tracking: ''
                }
              },
              performance_patterns: data.performance_patterns || {
                batch_operations: {
                  implemented: false,
                  batch_size: "dynamic",
                  progress_tracking: false,
                  cancellation: false
                },
                optimization_strategies: [],
                caching_implementation: ''
              },
              security_implementations: data.security_implementations || {
                auth_checks: [],
                permission_patterns: [],
                sensitive_data_handling: [],
                token_management: {
                  refresh_pattern: '',
                  storage_method: '',
                  validation: ''
                }
              },
              function_relationships: data.function_relationships || {
                depends_on: [],
                called_by: [],
                shares_state_with: []
              }
            };
          } catch (error) {
            this.log('Validation error:', {
              error,
              message: error.message,
              response: typeof response === 'string' ? response.slice(0, 200) : 'non-string response'
            });
            throw error;
          }
        }
      });

      this.log('Analysis complete:', {
        hasResult: !!analysisResult,
        resultKeys: Object.keys(analysisResult || {})
      });

      return analysisResult;

    } catch (error) {
      this.log('Analysis failed:', {
        error,
        message: error.message,
        stack: error.stack
      });
      throw new Error(`Analysis failed for ${request.filePath}: ${error.message}`);
    }
  }

  /**
   * Enhance the analysis with additional information
   */
  private enhanceAnalysis(analysis: any, request: AnalysisRequest): CodeAnalysis {
    return {
      ...analysis,
      function_details: {
        ...analysis.function_details,
        location: request.relativePath
      }
    };
  }

  /**
   * Write analysis results to the function registry
   */
  private async writeToRegistry(
    analysis: CodeAnalysis,
    repository: string,
    options: AnalysisOptions
  ) {
    try {
      const functionEntry = {
        id: uuidv4(),
        name: analysis.function_details.name,
        category: analysis.function_details.category,
        description: analysis.function_details.description,
        location: analysis.function_details.location,
        repository: repository,
        implementation_notes: analysis.function_details.implementation_notes,
        dependencies: analysis.dependencies.external.concat(analysis.dependencies.internal),
        input_types: analysis.ai_processing ? {
          ai_config: analysis.ai_processing.model_configs,
          environment: analysis.dependencies.environment_vars
        } : null,
        output_types: null,
        supabase_operations: analysis.supabase_operations || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        code_signature: null,
        similar_functions: analysis.function_relationships || null
      };

      // Check for existing entry
      const { data: existingFunc } = await supabase
        .from('function_registry')
        .select('id')
        .eq('name', functionEntry.name)
        .eq('location', functionEntry.location)
        .single();

      if (existingFunc && options.updateExisting) {
        await supabase
          .from('function_registry')
          .update({
            ...functionEntry,
            id: existingFunc.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFunc.id);

        await this.updateRelationships(existingFunc.id, analysis.function_relationships);
      } else {
        await supabase
          .from('function_registry')
          .insert(functionEntry);

        await this.updateRelationships(functionEntry.id, analysis.function_relationships);
      }

    } catch (error) {
      this.log('Registry write failed:', error);
      throw error;
    }
  }

  /**
   * Update function relationships in the database
   */
  private async updateRelationships(
    functionId: string,
    relationships: FunctionRelationships
  ) {
    try {
      // Remove existing relationships
      await supabase
        .from('function_relationships')
        .delete()
        .eq('source_function_id', functionId);

      const relationshipEntries = [];

      // Process all relationship types
      for (const dependsOn of relationships.depends_on) {
        relationshipEntries.push({
          id: uuidv4(),
          source_function_id: functionId,
          target_function_id: dependsOn,
          relationship_type: 'depends_on',
          created_at: new Date().toISOString()
        });
      }

      for (const calledBy of relationships.called_by) {
        relationshipEntries.push({
          id: uuidv4(),
          source_function_id: calledBy,
          target_function_id: functionId,
          relationship_type: 'calls',
          created_at: new Date().toISOString()
        });
      }

      for (const sharesState of relationships.shares_state_with) {
        relationshipEntries.push({
          id: uuidv4(),
          source_function_id: functionId,
          target_function_id: sharesState,
          relationship_type: 'shares_state',
          created_at: new Date().toISOString()
        });
      }

      // Insert new relationships
      if (relationshipEntries.length > 0) {
        await supabase
          .from('function_relationships')
          .insert(relationshipEntries);
      }

    } catch (error) {
      this.log('Relationship update failed:', error);
      throw error;
    }
  }
}

export default CodeAnalysisSystem;