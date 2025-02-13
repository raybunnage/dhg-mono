import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SourceGoogle {
  id: string;
  drive_id: string;
  name: string;
  mime_type: string;
  web_view_link: string;
  parent_folder_id: string | null;
  is_root: boolean;
  path: string[];
  expert_id: string;
  sync_status: string;
  content_extracted: boolean;
  metadata: any;
}

export function SourcesView() {
  const [viewMode, setViewMode] = useState<'folder' | 'raw'>('folder');
  const [sources, setSources] = useState<SourceGoogle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMimeType, setSelectedMimeType] = useState<string>('all');

  // Get unique mime types from sources
  const mimeTypes = useMemo(() => {
    const types = new Set(sources.map(source => source.mime_type));
    return ['all', ...Array.from(types)].sort();
  }, [sources]);

  // Filter sources based on search and mime type
  const filteredSources = useMemo(() => {
    return sources.filter(source => {
      const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMimeType = selectedMimeType === 'all' || source.mime_type === selectedMimeType;
      return matchesSearch && matchesMimeType;
    });
  }, [sources, searchTerm, selectedMimeType]);

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sources_google')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching sources:', error);
      return;
    }
    
    setSources(data || []);
    setLoading(false);
  }

  function FolderView() {
    // Group by parent_folder_id
    const folderMap = filteredSources.reduce((acc, source) => {
      const parentId = source.parent_folder_id || 'root';
      if (!acc[parentId]) acc[parentId] = [];
      acc[parentId].push(source);
      return acc;
    }, {} as Record<string, SourceGoogle[]>);

    function renderFolder(folderId: string, depth = 0) {
      const items = folderMap[folderId] || [];
      return (
        <div style={{ marginLeft: `${depth * 20}px` }}>
          {items.map(item => (
            <div key={item.id} className="py-1">
              <div className="flex items-center">
                <span className="mr-2">
                  {item.mime_type.includes('folder') ? '📁' : '📄'}
                </span>
                <span>{item.name}</span>
                <span className="ml-2 text-sm text-gray-500">
                  ({item.sync_status})
                </span>
              </div>
              {item.mime_type.includes('folder') && 
                renderFolder(item.drive_id, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return renderFolder('root');
  }

  function RawView() {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Path</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSources.map(source => (
              <tr key={source.id} className="border-t">
                <td className="px-4 py-2">{source.name}</td>
                <td className="px-4 py-2">{source.mime_type}</td>
                <td className="px-4 py-2">{source.sync_status}</td>
                <td className="px-4 py-2">{source.path?.join(' / ')}</td>
                <td className="px-4 py-2">
                  <a 
                    href={source.web_view_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Updated top bar with search */}
      <div className="flex items-center mb-4 space-x-4">
        {/* View toggle */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-700">Folder View</span>
          <button 
            className={`w-12 h-6 rounded-full p-1 ${
              viewMode === 'raw' ? 'bg-gray-300' : 'bg-blue-500'
            }`}
            onClick={() => setViewMode(viewMode === 'folder' ? 'raw' : 'folder')}
          >
            <div 
              className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                viewMode === 'raw' ? 'translate-x-6' : ''
              }`}
            />
          </button>
          <span className="text-gray-700">Raw View</span>
        </div>

        {/* Search input */}
        <div className="flex-1 flex items-center space-x-2 max-w-lg">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files..."
            className="px-4 py-2 border rounded-md w-full"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-600 whitespace-nowrap">
          {filteredSources.length} of {sources.length}
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchSources}
          className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap"
        >
          Refresh
        </button>
      </div>

      {/* MIME Type Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {mimeTypes.map(type => (
          <button
            key={type}
            onClick={() => setSelectedMimeType(type)}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedMimeType === type
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {type === 'all' ? 'All Types' : type.split('/')[1] || type}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        viewMode === 'folder' ? <FolderView /> : <RawView />
      )}
    </div>
  );
} 