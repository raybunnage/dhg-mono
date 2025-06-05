import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { markdownFileService } from '@/services/markdownFileService';

interface TableData {
  files: any[];
  sections: any[];
  relations: any[];
  queue: any[];
  isLoading: boolean;
  error: string | null;
}

const DocumentationTableViewer: React.FC = () => {
  const [data, setData] = useState<TableData>({
    files: [],
    sections: [],
    relations: [],
    queue: [],
    isLoading: false,
    error: null
  });
  
  const [testFilePath, setTestFilePath] = useState('docs/test-documentation.md');
  const [syncResult, setSyncResult] = useState<any>(null);
  const [processResult, setProcessResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('files');
  
  // Function to fetch data from all tables
  const fetchAllData = async () => {
    setData(prevData => ({ ...prevData, isLoading: true, error: null }));
    
    try {
      // Fetch files
      const { data: files, error: filesError } = await supabase
        .from('documentation_files')
        .select('*')
        .order('last_modified_at', { ascending: false });
      
      if (filesError) throw new Error(`Error fetching files: ${filesError.message}`);
      
      // Fetch sections
      const { data: sections, error: sectionsError } = await supabase
        .from('documentation_sections')
        .select('*')
        .order('position', { ascending: true });
      
      if (sectionsError) throw new Error(`Error fetching sections: ${sectionsError.message}`);
      
      // Fetch relations
      const { data: relations, error: relationsError } = await supabase
        .from('documentation_relations')
        .select('*');
      
      if (relationsError) throw new Error(`Error fetching relations: ${relationsError.message}`);
      
      // Fetch queue
      const { data: queue, error: queueError } = await supabase
        .from('documentation_processing_queue')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (queueError) throw new Error(`Error fetching queue: ${queueError.message}`);
      
      setData({
        files: files || [],
        sections: sections || [],
        relations: relations || [],
        queue: queue || [],
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      setData(prevData => ({ 
        ...prevData, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  };
  
  // Function to run the sync process
  const runSync = async () => {
    setData(prevData => ({ ...prevData, isLoading: true }));
    setSyncResult(null);
    
    try {
      const result = await markdownFileService.syncDocumentationFiles();
      setSyncResult(result);
      
      // Refresh data after sync
      await fetchAllData();
    } catch (error) {
      console.error('Error running sync:', error);
      setData(prevData => ({ 
        ...prevData, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  };
  
  // Function to process the next queue item
  const processNextItem = async () => {
    setData(prevData => ({ ...prevData, isLoading: true }));
    setProcessResult(null);
    
    try {
      const result = await markdownFileService.processNextQueueItem();
      setProcessResult(result);
      
      // Refresh data after processing
      await fetchAllData();
    } catch (error) {
      console.error('Error processing queue item:', error);
      setData(prevData => ({ 
        ...prevData, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, []);
  
  // Function to render the currently active tab
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'files':
        return (
          <div className="overflow-auto max-h-[400px]">
            <h2 className="text-lg font-bold mb-2">Files ({data.files.length})</h2>
            <table className="w-full border-collapse table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border">ID</th>
                  <th className="px-4 py-2 border">File Path</th>
                  <th className="px-4 py-2 border">Title</th>
                  <th className="px-4 py-2 border">Summary</th>
                  <th className="px-4 py-2 border">Tags</th>
                  <th className="px-4 py-2 border">Last Modified</th>
                </tr>
              </thead>
              <tbody>
                {data.files.map(file => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '200px' }}>{file.id}</td>
                    <td className="px-4 py-2 border">{file.file_path}</td>
                    <td className="px-4 py-2 border">{file.title}</td>
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '300px' }}>{file.summary}</td>
                    <td className="px-4 py-2 border">
                      {file.ai_generated_tags && file.ai_generated_tags.map((tag: string, index: number) => (
                        <span key={index} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 text-xs rounded-full mr-1 mb-1">
                          {tag}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2 border">
                      {new Date(file.last_modified_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      case 'sections':
        return (
          <div className="overflow-auto max-h-[400px]">
            <h2 className="text-lg font-bold mb-2">Sections ({data.sections.length})</h2>
            <table className="w-full border-collapse table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border">ID</th>
                  <th className="px-4 py-2 border">File ID</th>
                  <th className="px-4 py-2 border">Heading</th>
                  <th className="px-4 py-2 border">Level</th>
                  <th className="px-4 py-2 border">Position</th>
                  <th className="px-4 py-2 border">Summary</th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map(section => (
                  <tr key={section.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '200px' }}>{section.id}</td>
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '200px' }}>{section.file_id}</td>
                    <td className="px-4 py-2 border">{section.heading}</td>
                    <td className="px-4 py-2 border">{section.level}</td>
                    <td className="px-4 py-2 border">{section.position}</td>
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '300px' }}>{section.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      case 'relations':
        return (
          <div className="overflow-auto max-h-[400px]">
            <h2 className="text-lg font-bold mb-2">Relations ({data.relations.length})</h2>
            <table className="w-full border-collapse table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border">ID</th>
                  <th className="px-4 py-2 border">Source ID</th>
                  <th className="px-4 py-2 border">Target ID</th>
                  <th className="px-4 py-2 border">Relation Type</th>
                </tr>
              </thead>
              <tbody>
                {data.relations.map(relation => (
                  <tr key={relation.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '200px' }}>{relation.id}</td>
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '200px' }}>{relation.source_id}</td>
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '200px' }}>{relation.target_id}</td>
                    <td className="px-4 py-2 border">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        relation.relation_type === 'link' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {relation.relation_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      case 'queue':
        return (
          <div className="overflow-auto max-h-[400px]">
            <h2 className="text-lg font-bold mb-2">Processing Queue ({data.queue.length})</h2>
            <table className="w-full border-collapse table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border">ID</th>
                  <th className="px-4 py-2 border">File ID</th>
                  <th className="px-4 py-2 border">Status</th>
                  <th className="px-4 py-2 border">Priority</th>
                  <th className="px-4 py-2 border">Attempts</th>
                  <th className="px-4 py-2 border">Created At</th>
                </tr>
              </thead>
              <tbody>
                {data.queue.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '200px' }}>{item.id}</td>
                    <td className="px-4 py-2 border truncate" style={{ maxWidth: '200px' }}>{item.file_id}</td>
                    <td className="px-4 py-2 border">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        item.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : item.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : item.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 border">{item.priority}</td>
                    <td className="px-4 py-2 border">{item.attempts}</td>
                    <td className="px-4 py-2 border">
                      {item.created_at && new Date(item.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        
      default:
        return <div>Select a tab</div>;
    }
  };
  
  return (
    <div className="container mx-auto p-4 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">Documentation Tables Viewer</h1>
      
      {/* Test Controls */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center mb-4">
          <label className="mr-2 font-medium">Test File Path:</label>
          <input 
            type="text" 
            value={testFilePath}
            onChange={(e) => setTestFilePath(e.target.value)}
            className="border rounded px-2 py-1 flex-grow"
          />
        </div>
        
        <div className="flex space-x-4">
          <button 
            onClick={runSync} 
            disabled={data.isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {data.isLoading ? 'Syncing...' : 'Sync Test File'}
          </button>
          
          <button 
            onClick={processNextItem} 
            disabled={data.isLoading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {data.isLoading ? 'Processing...' : 'Process Next Queue Item'}
          </button>
          
          <button 
            onClick={fetchAllData} 
            disabled={data.isLoading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {data.isLoading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>
      
      {/* Result display */}
      {syncResult && (
        <div className={`mb-6 p-4 rounded-lg ${syncResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <h3 className="font-bold mb-2">Sync Result:</h3>
          <div className="text-sm">
            <p><strong>Success:</strong> {syncResult.success ? 'Yes' : 'No'}</p>
            <p><strong>Message:</strong> {syncResult.message}</p>
            {syncResult.details && (
              <div>
                <p><strong>Files Found:</strong> {syncResult.details.totalFound}</p>
                <p><strong>Files Processed:</strong> {syncResult.details.totalProcessed}</p>
                <p>
                  <strong>Results:</strong> Added: {syncResult.details.stats.added}, 
                  Updated: {syncResult.details.stats.updated}, 
                  Unchanged: {syncResult.details.stats.unchanged}, 
                  Failed: {syncResult.details.stats.failed}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {processResult && (
        <div className={`mb-6 p-4 rounded-lg ${processResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <h3 className="font-bold mb-2">Process Result:</h3>
          <div className="text-sm">
            <p><strong>Success:</strong> {processResult.success ? 'Yes' : 'No'}</p>
            <p><strong>Message:</strong> {processResult.message}</p>
          </div>
        </div>
      )}
      
      {/* Error display */}
      {data.error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
          <h3 className="font-bold mb-2">Error:</h3>
          <p>{data.error}</p>
        </div>
      )}
      
      {/* Tab navigation */}
      <div className="flex border-b mb-4">
        <button 
          className={`px-4 py-2 ${activeTab === 'files' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files ({data.files.length})
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === 'sections' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('sections')}
        >
          Sections ({data.sections.length})
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === 'relations' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('relations')}
        >
          Relations ({data.relations.length})
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === 'queue' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          Queue ({data.queue.length})
        </button>
      </div>
      
      {/* Table content */}
      {data.isLoading ? (
        <div className="flex justify-center items-center h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        renderActiveTabContent()
      )}
    </div>
  );
};

export default DocumentationTableViewer;