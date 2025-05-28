import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SourceButtons } from './SourceButtons';
import toast from 'react-hot-toast';

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
    console.log('SourcesView mounted');
    fetchSources();
  }, []);

  async function fetchSources() {
    console.log('Fetching sources...');
    setLoading(true);
    const { data, error } = await supabase
      .from('google_sources')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching sources:', error);
      return;
    }
    
    console.log('Fetched sources:', data?.length || 0, 'items');
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
    <div className="p-4 bg-white">
      {/* Top Controls Bar */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4">
        {/* Source Buttons */}
        <SourceButtons />

        {/* Search Bar */}
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files..."
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border">
          <button 
            onClick={() => setViewMode('folder')}
            className={`px-3 py-1 rounded ${viewMode === 'folder' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
          >
            Folder View
          </button>
          <button 
            onClick={() => setViewMode('raw')}
            className={`px-3 py-1 rounded ${viewMode === 'raw' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
          >
            Raw View
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchSources}
          className="px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center gap-2"
        >
          <span>Refresh</span>
          <span className="text-sm text-gray-500">({filteredSources.length} of {sources.length})</span>
        </button>
      </div>

      {/* MIME Type Tabs */}
      <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg mb-4">
        {mimeTypes.map(type => (
          <button
            key={type}
            onClick={() => setSelectedMimeType(type)}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedMimeType === type
                ? 'bg-blue-500 text-white'
                : 'bg-white border hover:bg-gray-50'
            }`}
          >
            {type === 'all' ? 'All Types' : type.split('/')[1] || type}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          viewMode === 'folder' ? <FolderView /> : <RawView />
        )}
      </div>
    </div>
  );
} 