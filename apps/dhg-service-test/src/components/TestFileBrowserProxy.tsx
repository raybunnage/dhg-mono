import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ChevronRight, ChevronDown, File, Folder, Search, X } from 'lucide-react';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: string | null;
  path: string;
}

interface TestResult {
  endpoint: string;
  success: boolean;
  data?: any;
  error?: string;
}

export function TestFileBrowserProxy() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [directoryItems, setDirectoryItems] = useState<FileItem[]>([]);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const PROXY_URL = 'http://localhost:9880';

  const runTests = async () => {
    setLoading(true);
    setResults([]);

    const tests = [
      {
        name: 'List root directory',
        endpoint: '/api/list-directory',
        method: 'POST',
        body: { dirPath: '' }
      },
      {
        name: 'Search for TypeScript files',
        endpoint: '/api/search-files',
        method: 'POST',
        body: { searchTerm: '.ts', searchPath: 'packages' }
      },
      {
        name: 'Check if package.json exists',
        endpoint: '/api/path-exists',
        method: 'POST',
        body: { filePath: 'package.json' }
      },
      {
        name: 'Get package.json stats',
        endpoint: '/api/file-stats',
        method: 'POST',
        body: { filePath: 'package.json' }
      }
    ];

    for (const test of tests) {
      try {
        const response = await fetch(`${PROXY_URL}${test.endpoint}`, {
          method: test.method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(test.body)
        });

        const data = await response.json();
        
        setResults(prev => [...prev, {
          endpoint: test.name,
          success: response.ok,
          data: response.ok ? data : undefined,
          error: !response.ok ? data.error : undefined
        }]);

        // Store directory listing for interactive view
        if (test.name === 'List root directory' && response.ok) {
          setDirectoryItems(data);
        }

      } catch (error: any) {
        setResults(prev => [...prev, {
          endpoint: test.name,
          success: false,
          error: error.message
        }]);
      }
    }

    setLoading(false);
  };

  const loadDirectory = async (path: string) => {
    try {
      const response = await fetch(`${PROXY_URL}/api/list-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath: path })
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error loading directory:', error);
    }
    return [];
  };

  const toggleDirectory = async (path: string) => {
    if (expandedPaths.has(path)) {
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } else {
      const items = await loadDirectory(path);
      setExpandedPaths(prev => new Set(prev).add(path));
      
      // Update directory items with children
      setDirectoryItems(prev => {
        const addChildren = (items: FileItem[], targetPath: string, children: FileItem[]): FileItem[] => {
          return items.map(item => {
            if (item.path === targetPath) {
              return { ...item, children } as any;
            }
            if ((item as any).children) {
              return { ...item, children: addChildren((item as any).children, targetPath, children) };
            }
            return item;
          });
        };
        return addChildren(prev, path, items);
      });
    }
  };

  const readFile = async (path: string) => {
    setSelectedFile(path);
    setFileContent(null);
    
    try {
      const response = await fetch(`${PROXY_URL}/api/read-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path })
      });

      if (response.ok) {
        const data = await response.json();
        setFileContent(data.content);
      } else {
        const error = await response.json();
        setFileContent(`Error: ${error.error}`);
      }
    } catch (error: any) {
      setFileContent(`Error: ${error.message}`);
    }
  };

  const searchFiles = async () => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`${PROXY_URL}/api/search-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm, searchPath: '' })
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const renderFileTree = (items: FileItem[], level = 0) => {
    return items.map((item, index) => {
      const isExpanded = expandedPaths.has(item.path);
      const children = (item as any).children;

      return (
        <div key={`${item.path}-${index}`} style={{ marginLeft: `${level * 20}px` }}>
          <div
            className={`flex items-center gap-2 p-1 hover:bg-gray-100 cursor-pointer ${
              selectedFile === item.path ? 'bg-blue-100' : ''
            }`}
            onClick={() => {
              if (item.type === 'directory') {
                toggleDirectory(item.path);
              } else {
                readFile(item.path);
              }
            }}
          >
            {item.type === 'directory' ? (
              <>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Folder size={16} className="text-blue-500" />
              </>
            ) : (
              <>
                <div className="w-4" />
                <File size={16} className="text-gray-500" />
              </>
            )}
            <span className="text-sm">{item.name}</span>
            {item.mtime && (
              <span className="text-xs text-gray-500 ml-auto">
                {new Date(item.mtime).toLocaleDateString()}
              </span>
            )}
          </div>
          {isExpanded && children && renderFileTree(children, level + 1)}
        </div>
      );
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>File Browser Proxy Test</CardTitle>
          <CardDescription>
            Test the file browser proxy server on port 9880
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={runTests} 
              disabled={loading}
              className="mb-4"
            >
              {loading ? 'Running Tests...' : 'Run All Tests'}
            </Button>

            {/* Test Results */}
            {results.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Test Results:</h3>
                {results.map((result, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded border ${
                      result.success 
                        ? 'border-green-300 bg-green-50' 
                        : 'border-red-300 bg-red-50'
                    }`}
                  >
                    <div className="font-medium">{result.endpoint}</div>
                    {result.error && (
                      <div className="text-sm text-red-600 mt-1">Error: {result.error}</div>
                    )}
                    {result.data && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-600">
                          View Response
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Interactive File Browser */}
            {directoryItems.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Interactive File Browser</h3>
                
                {/* Search */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchFiles()}
                    placeholder="Search files..."
                    className="flex-1 px-3 py-2 border rounded"
                  />
                  <Button onClick={searchFiles} size="sm">
                    <Search size={16} />
                  </Button>
                  {searchResults.length > 0 && (
                    <Button 
                      onClick={() => {
                        setSearchResults([]);
                        setSearchTerm('');
                      }} 
                      size="sm" 
                      variant="outline"
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
                    <h4 className="font-medium mb-2">Search Results ({searchResults.length})</h4>
                    <div className="max-h-40 overflow-auto">
                      {searchResults.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-1 hover:bg-yellow-100 cursor-pointer"
                          onClick={() => item.type === 'file' && readFile(item.path)}
                        >
                          {item.type === 'directory' ? (
                            <Folder size={14} className="text-blue-500" />
                          ) : (
                            <File size={14} className="text-gray-500" />
                          )}
                          <span className="text-sm">{item.path}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* File Tree */}
                  <div className="border rounded p-3 h-96 overflow-auto">
                    <h4 className="font-medium mb-2">File Tree</h4>
                    {renderFileTree(directoryItems)}
                  </div>

                  {/* File Content */}
                  <div className="border rounded p-3 h-96 overflow-auto">
                    <h4 className="font-medium mb-2">
                      {selectedFile ? `File: ${selectedFile}` : 'Select a file'}
                    </h4>
                    {fileContent && (
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {fileContent}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}