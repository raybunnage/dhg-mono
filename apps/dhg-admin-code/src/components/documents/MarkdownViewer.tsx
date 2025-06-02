import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { X, Copy, Check, Search, ExternalLink } from 'lucide-react';
// Define types locally until we have proper type imports
interface DocFile {
  id: string;
  file_path: string;
  title: string;
  file_hash?: string | null;
  file_size?: number | null;
  language?: string | null;
  document_type_id?: string | null;
  is_deleted?: boolean | null;
  created_at: string;
  updated_at: string;
  last_modified_at?: string | null;
  last_synced_at?: string | null;
  auto_update_enabled?: boolean | null;
  update_frequency?: string | null;
  update_source?: string | null;
  importance_score?: number | null;
  view_count?: number | null;
  tags?: string[] | null;
}

interface MarkdownViewerProps {
  document: DocFile;
  content?: string;
  onClose?: () => void;
  onEdit?: () => void;
  mode?: 'modal' | 'side';
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  document,
  content = '',
  onClose,
  onEdit,
  mode = 'modal'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(!content);
  const [markdownContent, setMarkdownContent] = useState(content);
  const [showServerError, setShowServerError] = useState(false);

  // Load content if not provided
  useEffect(() => {
    if (!content && document.file_path) {
      setLoading(true);
      // Fetch from the markdown server
      fetch(`/api/markdown-file?path=${encodeURIComponent(document.file_path)}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to load: ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          setMarkdownContent(data.content || '');
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading document:', err);
          setShowServerError(true);
          setLoading(false);
        });
    }
  }, [content, document.file_path]);

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyServerCommands = async () => {
    const commands = `cd /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-admin-code && pnpm run markdown-server`;
    try {
      await navigator.clipboard.writeText(commands);
      alert('Commands copied to clipboard! Paste them in your terminal to start the markdown server.');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const highlightSearch = (text: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading document...</div>
      </div>
    );
  }

  if (showServerError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="max-w-2xl bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-4">Markdown Server Not Running</h2>
          
          <div className="space-y-4 text-gray-700">
            <p>The markdown server is required to view documentation files. Please start it by following these steps:</p>
            
            <div className="bg-white border border-gray-200 rounded p-4">
              <h3 className="font-semibold mb-2">Option 1: Start both servers together (recommended)</h3>
              <code className="block bg-gray-100 p-2 rounded text-sm">
                cd /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-admin-code<br/>
                pnpm run dev:full
              </code>
            </div>
            
            <div className="bg-white border border-gray-200 rounded p-4">
              <h3 className="font-semibold mb-2">Option 2: Start markdown server separately</h3>
              <code className="block bg-gray-100 p-2 rounded text-sm mb-2">
                cd /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-admin-code<br/>
                pnpm run markdown-server
              </code>
              <p className="text-sm text-gray-600">Then keep the dhg-admin-code dev server running in another terminal</p>
            </div>
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={copyServerCommands}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Copy className="w-4 h-4 inline mr-2" />
                Copy Commands to Clipboard
              </button>
              
              <button
                onClick={() => {
                  setShowServerError(false);
                  setLoading(true);
                  // Retry loading
                  fetch(`/api/markdown-file?path=${encodeURIComponent(document.file_path)}`)
                    .then(res => {
                      if (!res.ok) {
                        throw new Error(`Failed to load: ${res.statusText}`);
                      }
                      return res.json();
                    })
                    .then(data => {
                      setMarkdownContent(data.content || '');
                      setLoading(false);
                    })
                    .catch(err => {
                      console.error('Error loading document:', err);
                      setShowServerError(true);
                      setLoading(false);
                    });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Retry Loading
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <p className="font-semibold text-yellow-800">File attempting to load:</p>
              <code className="text-xs">{document.file_path}</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const viewerContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{document.title}</h2>
          <p className="text-sm text-gray-500">{document.file_path}</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          
          {/* Actions */}
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Edit in VSCode"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <article className="prose prose-base prose-gray max-w-none 
            prose-headings:scroll-mt-4
            prose-h1:text-3xl prose-h1:font-bold
            prose-h2:text-2xl prose-h2:font-semibold prose-h2:border-b prose-h2:pb-2 prose-h2:mb-4
            prose-h3:text-xl prose-h3:font-semibold
            prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:overflow-x-auto
            prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-lg prose-img:shadow-lg
            prose-table:overflow-x-auto
            prose-th:bg-gray-100 prose-th:font-semibold
            prose-td:border prose-td:border-gray-300
            prose-ul:list-disc prose-ul:pl-6
            prose-ol:list-decimal prose-ol:pl-6
            prose-li:my-1
            prose-hr:border-gray-300">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');
                  
                  return !inline && match ? (
                    <div className="relative group my-4">
                      <div className="absolute top-0 right-0 flex items-center space-x-2 p-2">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">
                          {match[1]}
                        </span>
                        <button
                          onClick={() => copyToClipboard(codeString)}
                          className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === codeString ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: '0.5rem',
                          padding: '1.5rem',
                          paddingTop: '3rem',
                          fontSize: '0.875rem',
                          lineHeight: '1.5rem',
                        }}
                        {...props}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
                // Tables with better styling
                table({ children, ...props }) {
                  return (
                    <div className="overflow-x-auto my-6">
                      <table className="min-w-full divide-y divide-gray-300" {...props}>
                        {children}
                      </table>
                    </div>
                  );
                },
                // Better blockquote styling
                blockquote({ children, ...props }) {
                  return (
                    <blockquote className="border-l-4 border-gray-300 pl-4 my-6 italic text-gray-700" {...props}>
                      {children}
                    </blockquote>
                  );
                },
                // Enhanced image rendering
                img({ src, alt, ...props }) {
                  return (
                    <figure className="my-6">
                      <img 
                        src={src} 
                        alt={alt} 
                        className="rounded-lg shadow-lg max-w-full h-auto"
                        {...props} 
                      />
                      {alt && (
                        <figcaption className="text-center text-sm text-gray-600 mt-2">
                          {alt}
                        </figcaption>
                      )}
                    </figure>
                  );
                },
                // Highlight search terms in text
                p({ children, ...props }) {
                  if (typeof children === 'string' && searchTerm) {
                    return (
                      <p
                        {...props}
                        dangerouslySetInnerHTML={{ __html: highlightSearch(children) }}
                      />
                    );
                  }
                  return <p {...props}>{children}</p>;
                },
                // Better heading anchors
                h1: ({children, ...props}) => {
                  const id = typeof children === 'string' 
                    ? children.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
                    : undefined;
                  return <h1 id={id} {...props}>{children}</h1>;
                },
                h2: ({children, ...props}) => {
                  const id = typeof children === 'string' 
                    ? children.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
                    : undefined;
                  return <h2 id={id} {...props}>{children}</h2>;
                },
                h3: ({children, ...props}) => {
                  const id = typeof children === 'string' 
                    ? children.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
                    : undefined;
                  return <h3 id={id} {...props}>{children}</h3>;
                },
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl w-4/5 h-4/5 max-w-6xl">
          {viewerContent}
        </div>
      </div>
    );
  }

  return <div className="h-full bg-white border-l">{viewerContent}</div>;
};