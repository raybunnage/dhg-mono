import { supabase } from '@/integrations/supabase/client';
import { processWithAI } from '@/utils/ai-processing';
import { v4 as uuidv4 } from 'uuid';

/**
 * Types for the code analysis system
 */

interface Overview {
  name: string;
  purpose: string;
  key_integrations: string[];
  technical_stack: string[];
}

interface FunctionParameter {
  name: string;
  type: string;
  purpose: string;
  validation: string;
}

interface UsageStatus {
  status: 'active' | 'deprecated' | 'unused';
  evidence: string;
  last_modified: string;
  usage_locations: string[];
}

interface Complexity {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  optimization_opportunities: string[];
}

interface FunctionDependencies {
  functions: string[];
  external_services: string[];
  state: string[];
  environment: string[];
}

interface FunctionDeclaration {
  name: string;
  type: string;
  purpose: string;
  parameters: FunctionParameter[];
  return_type: string;
  usage_status: UsageStatus;
  complexity: Complexity;
  dependencies: FunctionDependencies;
}

interface UIRelationship {
  function_name: string;
  trigger_type: string;
  ui_element: string;
  location: string;
  user_interaction: string;
  state_effects: string[];
  error_states: string[];
}

interface InterfaceProperty {
  name: string;
  type: string;
  optional: boolean;
  description: string;
  validation: string | null;
}

interface TypeDefinitions {
  interfaces: Array<{
    name: string;
    properties: InterfaceProperty[];
    usage: string[];
    extensions: string[];
  }>;
  types: Array<{
    name: string;
    definition: string;
    usage: string[];
    constraints: string[];
  }>;
}

interface AICall {
  location: string;
  function_context: string;
  purpose: string;
  prompt_details: {
    construction: string;
    model_config: {
      model: string;
      temperature: number;
      max_tokens: number;
    }
  };
  input_handling: string;
  response_handling: string;
  error_handling: string;
  retry_strategy: string;
}

interface DatabaseOperation {
  type: string;
  function_context: string;
  purpose: string;
  table: string;
  details: string;
  error_handling: string;
  usage_frequency: string;
  optimization: string;
}

interface APIEndpoint {
  path: string;
  method: string;
  request_format: string;
  response_format: string;
  error_handling: string;
}

interface ExternalIntegrations {
  ai_processing: {
    calls: AICall[];
  };
  database_operations: {
    tables_used: Array<{
      name: string;
      purpose: string;
      operations_count: number;
      schema_dependencies: string[];
    }>;
    operations: DatabaseOperation[];
  };
  api_integrations: Array<{
    service: string;
    purpose: string;
    endpoints_used: APIEndpoint[];
    auth_method: string;
    rate_limiting: string;
  }>;
}

interface ErrorHandling {
  strategies: Array<{
    pattern: string;
    location: string;
    error_types: string[];
    recovery_mechanism: string;
    user_feedback: string;
  }>;
  validation: Array<{
    type: string;
    schema: string;
    location: string;
    failure_handling: string;
  }>;
  global_handlers: Array<{
    type: string;
    coverage: string;
    implementation: string;
  }>;
}

interface CodeAnalysis {
  overview: Overview;
  functions: {
    declarations: FunctionDeclaration[];
    ui_relationships: UIRelationship[];
  };
  type_definitions: TypeDefinitions;
  external_integrations: ExternalIntegrations;
  error_handling: ErrorHandling;
  performance_considerations: {
    critical_paths: Array<{
      description: string;
      components_involved: string[];
      optimization_requirements: string[];
      monitoring_points: string[];
    }>;
    caching_strategies: Array<{
      data: string;
      strategy: string;
      invalidation_triggers: string[];
      storage_requirements: string;
    }>;
    optimization_opportunities: Array<{
      type: string;
      location: string;
      potential_impact: string;
      implementation_complexity: string;
    }>;
  };
  security_considerations: {
    authentication: {
      method: string;
      implementation: string;
      token_handling: string;
    };
    authorization: Array<{
      resource: string;
      checks: string[];
      implementation: string;
    }>;
    data_validation: Array<{
      input: string;
      method: string;
      sanitization: string;
    }>;
  };
  testing_requirements: {
    unit_tests: Array<{
      function: string;
      test_scenarios: string[];
      mocks_required: string[];
      edge_cases: string[];
    }>;
    integration_tests: Array<{
      flow: string;
      systems_involved: string[];
      test_requirements: string[];
      data_requirements: string[];
    }>;
  };
  documentation_requirements: {
    inline_documentation: Array<{
      location: string;
      required_elements: string[];
      examples_needed: string[];
    }>;
    type_documentation: Array<{
      type: string;
      required_details: string[];
      usage_examples: string[];
    }>;
  };
  environmental_requirements: {
    variables: Array<{
      name: string;
      purpose: string;
      type: string;
      default: string | null;
    }>;
    third_party_services: Array<{
      name: string;
      purpose: string;
      configuration: string;
      fallback: string;
    }>;
  };
  code_quality: {
    function_analysis: Array<{
      name: string;
      clarity: string;
      maintenance_needs: string[];
      error_coverage: string;
      documentation: string;
      test_coverage: string;
    }>;
    potential_issues: Array<{
      type: string;
      location: string;
      severity: string;
      suggestion: string;
      impact: string;
    }>;
  };
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

interface RegistryEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  repository: string;
  implementation_notes: string[];
  dependencies: string[];
  input_types: {
    ai_config?: any;
    environment?: string[];
  } | null;
  output_types: any | null;
  supabase_operations: any | null;
  created_at: string;
  updated_at: string;
  status: 'active' | 'deprecated' | 'archived';
  code_signature: string | null;
  similar_functions: any | null;
}

interface FunctionRelationships {
  depends_on: string[];
  called_by: string[];
  shares_state_with: string[];
}

/**
 * Core analysis functionality
 */
export class CodeAnalysisSystem {
  private enhancedPrompt: string;
  private reactPrompt: string;
  private debugMode: boolean;

  constructor(enhancedPrompt: string, reactPrompt: string, debugMode = false) {
    this.enhancedPrompt = enhancedPrompt;
    this.reactPrompt = reactPrompt;
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
      const analysisPrompt = `${this.enhancedPrompt}\n\n${request.content}`;
      this.log('Prompt prepared:', {
        templateLength: this.enhancedPrompt.length,
        contentLength: request.content.length,
        totalLength: analysisPrompt.length,
        promptPreview: this.enhancedPrompt.slice(0, 100)
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
            let data = typeof response === 'string' ? JSON.parse(response) : response;
            
            this.log('Parsed response data:', {
              hasData: !!data,
              keys: Object.keys(data || {})
            });

            // Return complete structure matching new prompt
            return {
              overview: {
                name: data.overview?.name || 'Unknown',
                purpose: data.overview?.purpose || '',
                key_integrations: data.overview?.key_integrations || [],
                technical_stack: data.overview?.technical_stack || []
              },
              functions: {
                declarations: data.functions?.declarations || [],
                ui_relationships: data.functions?.ui_relationships || []
              },
              type_definitions: {
                interfaces: data.type_definitions?.interfaces || [],
                types: data.type_definitions?.types || []
              },
              external_integrations: {
                ai_processing: {
                  calls: data.external_integrations?.ai_processing?.calls || []
                },
                database_operations: {
                  tables_used: data.external_integrations?.database_operations?.tables_used || [],
                  operations: data.external_integrations?.database_operations?.operations || []
                },
                api_integrations: data.external_integrations?.api_integrations || []
              },
              error_handling: {
                strategies: data.error_handling?.strategies || [],
                validation: data.error_handling?.validation || [],
                global_handlers: data.error_handling?.global_handlers || []
              },
              performance_considerations: {
                critical_paths: data.performance_considerations?.critical_paths || [],
                caching_strategies: data.performance_considerations?.caching_strategies || [],
                optimization_opportunities: data.performance_considerations?.optimization_opportunities || []
              },
              security_considerations: {
                authentication: data.security_considerations?.authentication || {
                  method: '',
                  implementation: '',
                  token_handling: ''
                },
                authorization: data.security_considerations?.authorization || [],
                data_validation: data.security_considerations?.data_validation || []
              },
              testing_requirements: {
                unit_tests: data.testing_requirements?.unit_tests || [],
                integration_tests: data.testing_requirements?.integration_tests || []
              },
              documentation_requirements: {
                inline_documentation: data.documentation_requirements?.inline_documentation || [],
                type_documentation: data.documentation_requirements?.type_documentation || []
              },
              environmental_requirements: {
                variables: data.environmental_requirements?.variables || [],
                third_party_services: data.environmental_requirements?.third_party_services || []
              },
              code_quality: {
                function_analysis: data.code_quality?.function_analysis || [],
                potential_issues: data.code_quality?.potential_issues || []
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
      const functionEntry: RegistryEntry = {
        id: uuidv4(),
        name: analysis.overview.name,
        category: 'function', // Default category
        description: analysis.overview.purpose,
        location: analysis.overview.key_integrations.join(', '),
        repository,
        implementation_notes: analysis.overview.technical_stack,
        dependencies: analysis.functions.declarations.map(d => d.name),
        input_types: {
          ai_config: analysis.external_integrations.ai_processing,
          environment: analysis.environmental_requirements.variables.map(v => v.name)
        },
        output_types: null,
        supabase_operations: analysis.external_integrations.database_operations || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        code_signature: null,
        similar_functions: null
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