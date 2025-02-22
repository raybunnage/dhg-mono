import { supabase } from '@/integrations/supabase/client';
import { processWithAI } from '@/utils/ai-processing';
import { v4 as uuidv4 } from 'uuid';
import { determineAnalysisType } from './analysis-detector';

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

interface ReactAnalysis {
  component_overview: {
    name: string;
    type: string;
    purpose: string;
    complexity_level: string;
    reusability: string;
    key_dependencies: string[];
  };
  component_architecture: {
    props: Array<{
      name: string;
      type: string;
      required: boolean;
      default_value: any;
      validation: string;
      description: string;
      usage_pattern: string;
    }>;
    internal_state: Array<{
      name: string;
      type: string;
      initial_value: any;
      update_triggers: string[];
      dependencies: string[];
      persistence_requirements: string;
    }>;
    refs: Array<{
      name: string;
      target: string;
      purpose: string;
      initialization: string;
    }>;
  };
  component_lifecycle: {
    initialization: {
      props_processing: string[];
      state_initialization: string[];
      side_effects: string[];
    };
    mounting: {
      sequence: string[];
      effects: Array<{
        purpose: string;
        dependencies: string[];
        cleanup: string;
      }>;
      error_handling: string[];
    };
    updates: Array<{
      trigger: string;
      affected_state: string[];
      side_effects: string[];
      optimization: {
        memoization: boolean;
        strategy: string;
      };
    }>;
    unmounting: {
      cleanup_operations: string[];
      state_persistence: string[];
    };
  };
  render_logic: {
    conditions: Array<{
      description: string;
      dependencies: string[];
      branches: string[];
    }>;
    dynamic_content: Array<{
      location: string;
      data_source: string;
      update_trigger: string;
    }>;
    optimizations: Array<{
      type: string;
      target: string;
      strategy: string;
    }>;
  };
  state_management: {
    local_state: Array<{
      name: string;
      type: string;
      update_pattern: string;
      dependencies: string[];
      initialization: string;
    }>;
    derived_state: Array<{
      name: string;
      computation: string;
      dependencies: string[];
      caching_strategy: string;
    }>;
    handler_analysis: {
      event_handlers: Array<{
        name: string;
        trigger: string;
        purpose: string;
        parameters: Array<{
          name: string;
          type: string;
          purpose: string;
        }>;
        integrations: {
          supabase: {
            operations: Array<{
              type: string;
              table: string;
              purpose: string;
              error_handling: string;
            }>;
          };
          ai_calls: Array<{
            service: string;
            purpose: string;
            prompt_construction: string;
            response_handling: string;
          }>;
          external_apis: Array<{
            service: string;
            endpoint: string;
            purpose: string;
            data_flow: string;
          }>;
        };
        state_updates: Array<{
          target: string;
          trigger: string;
          side_effects: string[];
        }>;
        error_handling: {
          strategy: string;
          user_feedback: string;
          recovery: string;
        };
        performance: {
          debouncing: boolean;
          throttling: boolean;
          caching: string;
        };
      }>;
      effect_handlers: Array<{
        trigger: string;
        dependencies: string[];
        integrations: {
          supabase?: {
            operations: Array<{
              type: string;
              table: string;
              purpose: string;
              error_handling: string;
            }>;
          };
          ai_calls?: Array<{
            service: string;
            purpose: string;
            prompt_construction: string;
            response_handling: string;
          }>;
          external_apis?: Array<{
            service: string;
            endpoint: string;
            purpose: string;
            data_flow: string;
          }>;
        };
        cleanup: string;
        timing: string;
      }>;
    };
  };
}

// Update CombinedAnalysis to use the proper type
interface CombinedAnalysis {
  enhanced: CodeAnalysis;
  react?: ReactAnalysis;
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
  async analyzeFile(request: AnalysisRequest, options: AnalysisOptions = {}): Promise<CombinedAnalysis> {
    this.log('Starting analysis:', {
      filePath: request.filePath,
      contentLength: request.content.length,
      options
    });

    try {
      // Determine analysis type needed
      const analysisType = determineAnalysisType({
        path: request.filePath,
        content: request.content,
        extension: request.filePath.split('.').pop() || ''
      });

      this.log('Analysis type determined:', analysisType);

      const result: CombinedAnalysis = {
        enhanced: await this.runEnhancedAnalysis(request)
      };

      if (analysisType.needsReactAnalysis) {
        this.log('React analysis needed, running additional analysis');
        result.react = await this.runReactAnalysis(request);
      }

      return result;

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

  // Add new private method for React analysis
  private async runReactAnalysis(request: AnalysisRequest): Promise<ReactAnalysis> {
    const reactPrompt = `${this.reactPrompt}\n\n${request.content}`;
    
    this.log('Running React analysis with prompt:', {
      promptLength: this.reactPrompt.length,
      contentLength: request.content.length
    });

    const result = await processWithAI({
      systemPrompt: `You are a specialized React component analysis system. Analyze the component and provide detailed analysis.
Your response must be a JSON object with this exact structure:
{
  "component_overview": {
    "name": "string",
    "type": "string",
    "purpose": "string",
    "complexity_level": "string",
    "reusability": "string",
    "key_dependencies": []
  },
  "component_architecture": {
    "props": [],
    "internal_state": [],
    "refs": []
  },
  "component_lifecycle": {...},
  "render_logic": {...},
  "state_management": {
    "local_state": [],
    "derived_state": [],
    "handler_analysis": {
      "event_handlers": [],
      "effect_handlers": []
    }
  }
}`,
      userMessage: reactPrompt,
      temperature: 0.1,
      requireJsonOutput: true,
      validateResponse: (response) => {
        try {
          let data = typeof response === 'string' ? JSON.parse(response) : response;
          this.log('React analysis raw response:', data);
          return {
            component_overview: {
              name: data.component_overview?.name || '',
              type: data.component_overview?.type || '',
              purpose: data.component_overview?.purpose || '',
              complexity_level: data.component_overview?.complexity_level || '',
              reusability: data.component_overview?.reusability || '',
              key_dependencies: data.component_overview?.key_dependencies || []
            },
            component_architecture: {
              props: data.component_architecture?.props || [],
              internal_state: data.component_architecture?.internal_state || [],
              refs: data.component_architecture?.refs || []
            },
            component_lifecycle: {
              initialization: {
                props_processing: data.component_lifecycle?.initialization?.props_processing || [],
                state_initialization: data.component_lifecycle?.initialization?.state_initialization || [],
                side_effects: data.component_lifecycle?.initialization?.side_effects || []
              },
              mounting: {
                sequence: data.component_lifecycle?.mounting?.sequence || [],
                effects: data.component_lifecycle?.mounting?.effects || [],
                error_handling: data.component_lifecycle?.mounting?.error_handling || []
              },
              updates: data.component_lifecycle?.updates || [],
              unmounting: {
                cleanup_operations: data.component_lifecycle?.unmounting?.cleanup_operations || [],
                state_persistence: data.component_lifecycle?.unmounting?.state_persistence || []
              }
            },
            render_logic: {
              conditions: data.render_logic?.conditions || [],
              dynamic_content: data.render_logic?.dynamic_content || [],
              optimizations: data.render_logic?.optimizations || []
            },
            state_management: {
              local_state: data.state_management?.local_state || [],
              derived_state: data.state_management?.derived_state || [],
              handler_analysis: {
                event_handlers: data.state_management?.handler_analysis?.event_handlers?.map(handler => ({
                  name: handler.name || '',
                  trigger: handler.trigger || '',
                  purpose: handler.purpose || '',
                  parameters: handler.parameters || [],
                  integrations: {
                    supabase: {
                      operations: handler.integrations?.supabase?.operations || []
                    },
                    ai_calls: handler.integrations?.ai_calls || [],
                    external_apis: handler.integrations?.external_apis || []
                  },
                  state_updates: handler.state_updates || [],
                  error_handling: {
                    strategy: handler.error_handling?.strategy || '',
                    user_feedback: handler.error_handling?.user_feedback || '',
                    recovery: handler.error_handling?.recovery || ''
                  },
                  performance: {
                    debouncing: handler.performance?.debouncing || false,
                    throttling: handler.performance?.throttling || false,
                    caching: handler.performance?.caching || ''
                  }
                })) || [],
                effect_handlers: data.state_management?.handler_analysis?.effect_handlers?.map(effect => ({
                  trigger: effect.trigger || '',
                  dependencies: effect.dependencies || [],
                  integrations: effect.integrations || {},
                  cleanup: effect.cleanup || '',
                  timing: effect.timing || ''
                })) || []
              }
            }
          };
        } catch (error) {
          this.log('React validation error:', error);
          throw error;
        }
      }
    });

    return result;
  }

  private async runEnhancedAnalysis(request: AnalysisRequest): Promise<CodeAnalysis> {
    const analysisPrompt = `${this.enhancedPrompt}\n\n${request.content}`;
    
    this.log('Running enhanced analysis with prompt:', {
      promptLength: this.enhancedPrompt.length,
      contentLength: request.content.length
    });

    return processWithAI({
      systemPrompt: "You are a specialized code analysis system. Analyze the code and provide a detailed analysis matching the CodeAnalysis interface structure. Return only valid JSON.",
      userMessage: analysisPrompt,
      temperature: 0.1,
      requireJsonOutput: true,
      validateResponse: (response) => {
        try {
          let data = typeof response === 'string' ? JSON.parse(response) : response;
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
            performance_considerations: data.performance_considerations || {
              critical_paths: [],
              caching_strategies: [],
              optimization_opportunities: []
            },
            security_considerations: data.security_considerations || {
              authentication: { method: '', implementation: '', token_handling: '' },
              authorization: [],
              data_validation: []
            },
            testing_requirements: data.testing_requirements || {
              unit_tests: [],
              integration_tests: []
            },
            documentation_requirements: data.documentation_requirements || {
              inline_documentation: [],
              type_documentation: []
            },
            environmental_requirements: data.environmental_requirements || {
              variables: [],
              third_party_services: []
            },
            code_quality: data.code_quality || {
              function_analysis: [],
              potential_issues: []
            }
          };
        } catch (error) {
          this.log('Validation error:', error);
          throw error;
        }
      }
    });
  }
}

export default CodeAnalysisSystem;