import { useState } from 'react';
import CodeAnalysisSystem from '@/utils/code-analysis/code-analysis-system';
import { toast } from 'react-hot-toast';
import ClassifyDocumentSource from '@/pages/ClassifyDocument.tsx?raw';
import promptTemplate from '@/../../docs/prompts/enhanced-analysis-prompt.md?raw';

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