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

  // Load content if not provided
  useEffect(() => {
    if (!content && document.file_path) {
      setLoading(true);
      // In a real implementation, this would fetch from your backend
      fetch(`/api/documents/${encodeURIComponent(document.file_path)}`)
        .then(res => res.text())
        .then(text => {
          setMarkdownContent(text);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading document:', err);
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
      <div className="flex-1 overflow-auto p-6">
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                
                return !inline && match ? (
                  <div className="relative group">
                    <button
                      onClick={() => copyToClipboard(codeString)}
                      className="absolute right-2 top-2 p-1 bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy code"
                    >
                      {copiedCode === codeString ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
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
              }
            }}
          >
            {markdownContent}
          </ReactMarkdown>
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