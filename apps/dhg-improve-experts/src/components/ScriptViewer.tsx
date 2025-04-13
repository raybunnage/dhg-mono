import React, { useState, useEffect } from 'react';
import { scriptFileService } from '@/services/scriptFileService';

interface ScriptViewerProps {
  scriptPath: string;
}

function ScriptViewer({ scriptPath }: ScriptViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get language based on file extension
  const getLanguage = (path: string): string => {
    if (path.endsWith('.sh')) return 'bash';
    if (path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.py')) return 'python';
    return 'plaintext';
  };

  useEffect(() => {
    const fetchScriptContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (!scriptPath) {
          setError('No script path provided');
          setLoading(false);
          return;
        }
        
        const response = await scriptFileService.getFileContent(scriptPath);
        setContent(response.content);
      } catch (err: any) {
        console.error('Error fetching script content:', err);
        setError(`Failed to load script: ${err?.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchScriptContent();
  }, [scriptPath]);
  
  // Removed Prism.js dependency - Using simpler approach
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
        <span>Loading script content...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-md">
        <h3 className="font-bold mb-2">Error</h3>
        <p>{error}</p>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-900 p-4 overflow-auto h-full">
      <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  );
}

export default ScriptViewer;