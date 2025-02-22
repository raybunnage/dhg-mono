import React, { useState, useEffect } from 'react';
import CodeAnalysisSystem from '@/utils/code-analysis/code-analysis-system';
import { toast } from 'react-hot-toast';
import { SourceButtons } from '@/components/SourceButtons';

interface FileInfo {
  path: string;
  lastModified: string;
  content: string;
  size: number;
}

interface AnalysisResult {
  filePath: string;
  lastModified: string;
  analysis: any;
  error?: string;
}

export function Analyze() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [reactPrompt, setReactPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    // Load both prompts
    Promise.all([
      fetch('/prompts/enhanced-analysis-prompt.md').then(r => r.text()),
      fetch('/prompts/react-component-analysis-prompt.md').then(r => r.text())
    ]).then(([enhancedText, reactText]) => {
      setEnhancedPrompt(enhancedText);
      setReactPrompt(reactText);
    }).catch(error => {
      console.error('Failed to load prompts:', error);
      toast.error('Failed to load analysis prompts');
    });

    // Comment out auto file loading
    // loadSourceFiles();
  }, []);

  // Add SourceButtons content directly
  useEffect(() => {
    // Fetch the source code directly
    fetch('/src/components/SourceButtons.tsx')
      .then(r => r.text())
      .then(sourceCode => {
        const filePath = 'components/SourceButtons.tsx';
        
        console.log('📄 Loading SourceButtons content:', {
          content: sourceCode.slice(0, 200) + '...',  // Log first 200 chars
          size: sourceCode.length
        });

        setFiles([{
          path: filePath,
          content: sourceCode,
          lastModified: new Date().toISOString(),
          size: sourceCode.length
        }]);

        // Auto-select the file
        setSelectedFile(filePath);
      })
      .catch(error => {
        console.error('Failed to load source code:', error);
        toast.error('Failed to load source code');
      });
  }, []);

  const loadSourceFiles = async () => {
    console.log('🔄 Starting to load source files...');
    try {
      console.log('📡 Fetching from /api/source-files...');
      const response = await fetch('/api/source-files', {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('📥 Response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        type: response.type,
        url: response.url
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText.slice(0, 500) + '...' // Show first 500 chars
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseText = await response.text();
      console.log('📄 Raw response:', responseText.slice(0, 500));
      
      const data = JSON.parse(responseText);
      console.log('✅ Parsed data:', {
        hasFiles: !!data.files,
        fileCount: data.files?.length
      });
      
      const { files } = data;
      
      console.log('📁 Files loaded:', {
        count: files.length,
        paths: files.map(f => f.path)
      });
      
      setFiles(files.sort((a, b) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      ));
      
      toast.success(`Loaded ${files.length} source files`);

    } catch (error) {
      console.error('❌ Failed to load source files:', {
        error,
        message: error.message,
        stack: error.stack
      });
      toast.error(`Failed to load source files: ${error.message}`);
    }
  };

  const analyzeFile = async (fileInfo: FileInfo) => {
    setLoading(true);
    try {
      const analyzer = new CodeAnalysisSystem(enhancedPrompt, true);
      
      console.log('🔍 Starting analysis of:', fileInfo.path);
      const analysis = await analyzer.analyzeFile({
        filePath: fileInfo.path,
        content: fileInfo.content,
        repository: 'dhg-mono',
        relativePath: fileInfo.path
      });
      
      console.log('✅ Analysis complete:', {
        path: fileInfo.path,
        analysis: analysis
      });

      setAnalysisResults(prev => [...prev, {
        filePath: fileInfo.path,
        lastModified: fileInfo.lastModified,
        analysis
      }]);
      
      toast.success(`Analyzed ${fileInfo.path}`);

    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
      setAnalysisResults(prev => [...prev, {
        filePath: fileInfo.path,
        lastModified: fileInfo.lastModified,
        analysis: null,
        error: error.message
      }]);
    } finally {
      setLoading(false);
    }
  };

  const analyzeAllFiles = async () => {
    for (const file of files) {
      await analyzeFile(file);
    }
  };

  const analyzeSelected = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }
    const fileInfo = files.find(f => f.path === selectedFile);
    if (fileInfo) {
      await analyzeFile(fileInfo);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Code Analysis</h1>
      
      <div className="flex gap-4 mb-6">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          onClick={analyzeSelected}
          disabled={loading || !selectedFile}
        >
          {loading ? 'Analyzing...' : 'Analyze Selected'}
        </button>
        
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          onClick={analyzeAllFiles}
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Analyze All Files'}
        </button>
        
        <button
          className="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg cursor-not-allowed"
          disabled={true}
        >
          Refresh File List (Disabled)
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* File List */}
        <div className="col-span-4 bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Source Files</h2>
          <div className="space-y-2 max-h-[70vh] overflow-auto">
            {files.map(file => (
              <div 
                key={file.path}
                className={`p-2 rounded cursor-pointer hover:bg-gray-200 ${
                  selectedFile === file.path ? 'bg-gray-200' : ''
                }`}
                onClick={() => setSelectedFile(file.path)}
              >
                <div className="font-medium">{file.path}</div>
                <div className="text-sm text-gray-600">
                  Last modified: {new Date(file.lastModified).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  Size: {(file.size / 1024).toFixed(1)}kb
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Results */}
        <div className="col-span-8">
          {selectedFile && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">Analysis Results</h2>
              {analysisResults
                .filter(result => result.filePath === selectedFile)
                .map(result => (
                  <div key={result.filePath} className="space-y-4">
                    <div className="text-sm text-gray-600">
                      File: {result.filePath}
                      <br />
                      Last Modified: {new Date(result.lastModified).toLocaleString()}
                    </div>
                    {result.error ? (
                      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                        Error: {result.error}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded-lg overflow-auto max-h-[60vh]">
                        {JSON.stringify(result.analysis, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analyze;