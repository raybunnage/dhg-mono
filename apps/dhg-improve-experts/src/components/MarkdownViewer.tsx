import { useEffect, useState } from 'react';
import { marked } from 'marked'; // Using marked since it's already installed in the project
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type DocumentFile = Database['public']['Tables']['documentation_files']['Row'];

interface MarkdownViewerProps {
  documentId: string;
  className?: string;
}

/**
 * MarkdownViewer component for rendering markdown content from local files
 * 
 * This component fetches markdown content from the server API by document ID
 * and renders it using the marked library (already in the project).
 * 
 * @param {string} documentId - The ID of the document to display
 * @param {string} className - Optional CSS class name for styling
 */
function MarkdownViewer({ documentId, className = '' }: MarkdownViewerProps) {
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Helper function to get file content safely using local file server
  const getFileContent = async (filePath: string): Promise<string | null> => {
    try {
      // Try local markdown server first (for development) if it's running
      if (window.location.hostname === 'localhost') {
        try {
          // This is the local express server we created - simple and reliable
          console.log(`Trying local markdown server for ${filePath}`);
          
          // Use AbortController to set a timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 500);
          
          const response = await fetch(
            `http://localhost:3001/api/markdown-file?path=${encodeURIComponent(filePath)}`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.content) {
              console.log(`Successfully loaded content from local server for ${filePath}`);
              return data.content;
            }
          }
        } catch (localServerError) {
          if (localServerError.name !== 'AbortError') {
            console.log('Local markdown server not available, continuing with alternatives');
          }
        }
      }
      
      // Fallback to API endpoint
      try {
        console.log(`Trying API endpoint for ${filePath}`);
        const response = await fetch(`/api/documentation?path=${encodeURIComponent(filePath)}`);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data && data.content) {
            return data.content;
          }
        }
      } catch (apiError) {
        console.warn('API endpoint failed:', apiError);
      }
      
      // We couldn't get the content through any method
      return null;
    } catch (error) {
      console.error('Error fetching file content:', error);
      return null;
    }
  };

  useEffect(() => {
    async function fetchContent() {
      if (!documentId) {
        setError('No document ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        // Fallback to direct Supabase query - this is the most reliable approach
        const { data: doc, error } = await supabase
          .from('documentation_files')
          .select('file_path, title')
          .eq('id', documentId)
          .single();
          
        if (error || !doc) {
          throw new Error('Document not found in database');
        }
        
        // Get content using our helper function
        const content = await getFileContent(doc.file_path);
        
        if (content) {
          setContent(content);
          setTitle(doc.title || doc.file_path.split('/').pop() || '');
        } else {
          // Fallback: hardcoded content for when file can't be loaded
          const fileName = doc.file_path.split('/').pop() || 'unknown';
          const fileTitle = doc.title || fileName.replace(/\.\w+$/, '');
          
          setTitle(fileTitle);
          setContent(`# ${fileTitle}\n\nContent could not be loaded for this file: \`${doc.file_path}\`\n\nThis may be due to the file not being available in the development environment.`);
        }
      } catch (err) {
        console.error('Error fetching markdown:', err);
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, [documentId]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[200px] bg-gray-900">
        <div className="animate-pulse flex flex-col space-y-4 w-full">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-5/6"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 text-red-400 border border-red-800 rounded bg-gray-900">
        <h3 className="font-medium mb-2">Error</h3>
        <p>{error}</p>
      </div>
    );
  }
  
  // Render empty state
  if (!content) {
    return (
      <div className="p-4 text-gray-400 border border-gray-700 rounded bg-gray-900">
        <p>No content available for this document.</p>
      </div>
    );
  }
  
  // Render markdown content
  return (
    <div className={`markdown-container bg-gray-900 text-white p-6 rounded-lg ${className}`}>
      {title && <h1 className="text-2xl font-bold mb-4 text-white">{title}</h1>}
      <div 
        className="prose prose-invert max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ 
          __html: content ? marked.parse(content) : '<p>No content available</p>' 
        }} 
      />
    </div>
  );
}

export default MarkdownViewer;