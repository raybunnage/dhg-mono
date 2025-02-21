import { useState } from 'react';
import CodeAnalysisSystem from '@/utils/code-analysis/code-analysis-system';
import { toast } from 'react-hot-toast';
import ClassifyDocumentSource from '@/pages/ClassifyDocument.tsx?raw';

interface AnalysisResult {
  filePath: string;
  analysis: any;
  error?: string;
}

export function Analyze() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyzeClassifyDocument = async () => {
    setLoading(true);
    try {
      const filePath = 'apps/dhg-improve-experts/src/pages/ClassifyDocument.tsx';
      console.log('📁 Starting analysis of:', filePath);

      // Use the actual source code
      const fileContent = ClassifyDocumentSource;
      
      // Validate file content
      if (!fileContent) {
        throw new Error('Failed to load ClassifyDocument.tsx content');
      }

      // Check for key indicators that we have the right file
      const hasExpectedContent = fileContent.includes('export function ClassifyDocument')
        && fileContent.includes('processWithAI')
        && fileContent.includes('supabase');

      if (!hasExpectedContent) {
        throw new Error('Loaded content does not match expected ClassifyDocument.tsx file');
      }

      console.log('📄 File content validation:', {
        length: fileContent.length,
        preview: fileContent.slice(0, 100),
        hasExpectedContent,
        containsClassifyDocument: fileContent.includes('ClassifyDocument'),
        containsSupabase: fileContent.includes('supabase'),
        firstLine: fileContent.split('\n')[0]
      });

      const promptTemplate = `
        You are a code analysis system. Analyze the following React component and return a JSON object that exactly matches this structure:

        {
          "function_details": {
            "name": "string - The component name",
            "category": "string - e.g. 'Component', 'Hook', 'Utility'",
            "description": "string - Brief description of purpose",
            "location": "string - File path",
            "implementation_notes": "string - Key implementation details"
          },
          "dependencies": {
            "external": ["array of external package imports"],
            "internal": ["array of internal imports"],
            "environment_vars": ["array of used env vars"]
          },
          "error_handling": {
            "strategies": ["array of error handling approaches"],
            "logging_patterns": ["array of logging methods"],
            "recovery_mechanisms": ["array of recovery strategies"],
            "user_feedback": {
              "success_patterns": "string - How success is communicated",
              "error_patterns": "string - How errors are shown",
              "progress_tracking": "string - Loading state handling"
            }
          },
          "performance_patterns": {
            "batch_operations": {
              "implemented": boolean,
              "batch_size": "string - 'dynamic' or number",
              "progress_tracking": boolean,
              "cancellation": boolean
            },
            "optimization_strategies": ["array of optimizations used"],
            "caching_implementation": "string - Caching approach"
          },
          "security_implementations": {
            "auth_checks": ["array of auth validations"],
            "permission_patterns": ["array of permission checks"],
            "sensitive_data_handling": ["array of data protection methods"],
            "token_management": {
              "refresh_pattern": "string - Token refresh approach",
              "storage_method": "string - Token storage location",
              "validation": "string - Token validation method"
            }
          },
          "function_relationships": {
            "depends_on": ["array of dependencies"],
            "called_by": ["array of callers"],
            "shares_state_with": ["array of components sharing state"]
          },
          "supabase_operations": {
            "queries": [{
              "table": "string - Table being queried",
              "operation": "string - select/insert/update/delete",
              "filters": ["array of filter conditions"],
              "returned_columns": ["array of columns selected"],
              "error_handling": "string - How errors are handled"
            }],
            "mutations": [{
              "table": "string - Table being modified",
              "operation": "string - insert/update/delete",
              "validation": "string - Data validation approach",
              "error_handling": "string - Error handling strategy",
              "rollback_strategy": "string - How failures are handled"
            }],
            "real_time": {
              "subscriptions": ["array of real-time subscriptions"],
              "channels": ["array of channel names"],
              "cleanup": "string - How subscriptions are cleaned up"
            },
            "transaction_patterns": {
              "uses_transactions": boolean,
              "tables_in_transaction": ["array of tables in single transaction"],
              "rollback_handling": "string - Transaction rollback approach"
            },
            "data_validation": {
              "pre_mutation": ["array of pre-save validations"],
              "post_query": ["array of post-fetch validations"],
              "type_checking": "string - Runtime type validation approach"
            },
            "error_recovery": {
              "retry_logic": "string - Query retry approach",
              "fallback_behavior": "string - What happens on failure",
              "user_feedback": "string - How errors are communicated"
            }
          },
          "core_operations": {
            "document_processing": {
              "stages": [{
                "name": "string - Stage name (e.g., 'Initial Upload', 'Content Extraction')",
                "description": "string - Detailed description of what happens",
                "components_involved": ["array of components/functions involved"],
                "error_handling": "string - Stage-specific error handling"
              }],
              "flow_sequence": "string - Step by step operation sequence",
              "state_management": "string - How state changes through process"
            },
            "ai_processing": {
              "operations": [{
                "purpose": "string - What this AI operation does",
                "prompt_construction": "string - How the prompt is built",
                "model_config": {
                  "model": "string - AI model used",
                  "temperature": "number - Temperature setting",
                  "max_tokens": "number - Token limit"
                },
                "error_handling": "string - AI-specific error handling",
                "retry_strategy": "string - How retries are managed"
              }],
              "response_handling": "string - How AI responses are processed",
              "validation": "string - How responses are validated"
            },
            "google_drive": {
              "operations": [{
                "type": "string - Operation type (read/write/delete)",
                "auth_flow": "string - Authentication process",
                "error_handling": "string - Drive-specific error handling",
                "retry_logic": "string - Retry approach for Drive ops"
              }],
              "file_management": "string - How files are managed",
              "cleanup_strategy": "string - Temporary file handling"
            }
          },
          "integration_points": {
            "supabase_to_ai": {
              "data_flow": "string - How data moves from DB to AI",
              "transformation": "string - Data transformations needed",
              "error_handling": "string - Cross-system error handling"
            },
            "drive_to_supabase": {
              "sync_process": "string - How sync works",
              "validation": "string - Cross-system validation",
              "error_recovery": "string - Recovery strategy"
            },
            "ai_to_supabase": {
              "storage_process": "string - How AI results are stored",
              "validation": "string - Result validation",
              "rollback": "string - Failed operation handling"
            }
          },
          "operational_flow": {
            "sequence": ["array of operations in order"],
            "critical_paths": [{
              "path": "string - Critical operation sequence",
              "failure_points": ["array of potential failure points"],
              "recovery_strategies": ["array of recovery approaches"]
            }],
            "state_transitions": [{
              "from_state": "string - Starting state",
              "to_state": "string - Ending state",
              "triggers": ["array of triggering events"],
              "side_effects": ["array of side effects"]
            }]
          }
        }

        Important:
        1. Return ONLY valid JSON
        2. Fill ALL fields - use empty arrays [] or empty strings "" rather than null
        3. Include ALL sections shown above
        4. Be specific and detailed in your analysis
        5. Base analysis ONLY on the actual code provided
        6. Focus especially on:
           - How Supabase, AI, and Google Drive operations are coordinated
           - The complete flow from file upload to processed result
           - Error handling and recovery at each stage
           - State management throughout the process
           - Integration points between systems
           - Validation and safety checks at each step

        Code to analyze:
        ${fileContent}
      `;

      const analyzer = new CodeAnalysisSystem(promptTemplate, true);
      console.log('🔄 Analyzer created, processing file...');

      const analysis = await analyzer.analyzeFile({
        filePath,
        content: fileContent,
        repository: 'dhg-mono',
        relativePath: filePath
      });

      console.log('✅ Analysis complete:', {
        hasResult: !!analysis,
        resultKeys: Object.keys(analysis),
        dependencies: analysis.dependencies
      });

      setAnalysisResult({
        filePath,
        analysis
      });
      
      toast.success('Analysis complete');

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
      setAnalysisResult({
        filePath: 'ClassifyDocument.tsx',
        analysis: null,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Code Analysis</h1>
      
      <button
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mb-4"
        onClick={analyzeClassifyDocument}
        disabled={loading}
      >
        <span>🔍</span>
        {loading ? 'Analyzing...' : 'Analyze ClassifyDocument'}
      </button>

      {analysisResult && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Analysis Results</h2>
          {analysisResult.error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg">
              Error: {analysisResult.error}
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-[80vh]">
              <div className="mb-2 text-gray-600">
                File: {analysisResult.filePath}
              </div>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(analysisResult.analysis, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Analyze;