import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Folder, File, Search, Home, ChevronRight, ExternalLink } from 'lucide-react';

const PROXY_URL = 'http://localhost:8080';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: string | null;
  path: string;
}

export function TestHtmlFileBrowserProxy() {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  useEffect(() => {
    loadDirectory('');
  }, []);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setFileContent(null);
    
    try {
      const response = await fetch(`${PROXY_URL}/api/list-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath: path })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load directory');
      }
      
      const data = await response.json();
      setItems(data);
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      loadDirectory(item.path);
    } else {
      loadFile(item.path);
    }
  };

  const loadFile = async (filePath: string) => {
    setSelectedFile(filePath);
    setFileContent(null);
    
    try {
      const response = await fetch(`${PROXY_URL}/api/read-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to read file');
      }
      
      const data = await response.json();
      setFileContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${PROXY_URL}/api/search-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          searchTerm,
          searchPath: currentPath 
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Search failed');
      }
      
      const results = await response.json();
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    loadDirectory(parts.join('/'));
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>HTML File Browser Proxy Test</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`${PROXY_URL}/file-browser.html`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Web UI
            </Button>
            <Badge variant="secondary">Port 8080</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Navigation bar */}
        <div className="flex items-center gap-2 text-sm">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadDirectory('')}
          >
            <Home className="h-4 w-4" />
          </Button>
          
          {currentPath && (
            <>
              <ChevronRight className="h-4 w-4" />
              <Button
                size="sm"
                variant="ghost"
                onClick={navigateUp}
              >
                ..
              </Button>
            </>
          )}
          
          {currentPath.split('/').filter(Boolean).map((part, index, arr) => (
            <React.Fragment key={index}>
              <ChevronRight className="h-4 w-4" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => loadDirectory(arr.slice(0, index + 1).join('/'))}
              >
                {part}
              </Button>
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2">
            <h3 className="font-medium">Search Results ({searchResults.length})</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {searchResults.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer rounded text-sm"
                  onClick={() => handleItemClick(item)}
                >
                  {item.type === 'directory' ? (
                    <Folder className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="truncate">{item.path}</span>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSearchResults([])}
            >
              Clear Results
            </Button>
          </div>
        )}

        {/* File list */}
        <div className="border rounded-lg divide-y">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center text-gray-500">Empty directory</div>
          ) : (
            items.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleItemClick(item)}
              >
                <div className="flex items-center gap-2">
                  {item.type === 'directory' ? (
                    <Folder className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm">{item.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{item.type === 'file' && formatSize(item.size)}</span>
                  <span>{formatDate(item.mtime)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* File content preview */}
        {selectedFile && fileContent !== null && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{selectedFile}</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedFile(null);
                  setFileContent(null);
                }}
              >
                Close
              </Button>
            </div>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">
              {fileContent.substring(0, 1000)}
              {fileContent.length > 1000 && '\n... (truncated)'}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}