import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../utils/supabase-adapter';
import { GoogleDriveExplorerService, FileNode } from '@shared/services/google-drive-explorer';
import { FileTree, FileViewer } from '@shared/components/file-explorer';

function Viewer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRepairingPaths, setIsRepairingPaths] = useState(false);
  const [repairResult, setRepairResult] = useState<{fixed: number, errors: number} | null>(null);
  const [stats, setStats] = useState<any>(null);
  
  // Initialize explorer service
  const explorerService = new GoogleDriveExplorerService(supabase as any);
  
  // Fetch files from sources_google
  useEffect(() => {
    async function fetchFiles() {
      try {
        setLoading(true);
        
        // Fetch all files with expert document data
        const fetchedFiles = await explorerService.fetchAllFiles(true);
        setFiles(fetchedFiles);
        
        // Calculate stats
        const fileStats = await explorerService.getFileStats(fetchedFiles);
        setStats(fileStats);
        
        // Run relationship analysis
        setTimeout(() => {
          const analysis = explorerService.analyzeFileRelationships(fetchedFiles);
          console.log('File relationship analysis:', analysis);
        }, 1000);
      } catch (err: any) {
        console.error('Error fetching files:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchFiles();
  }, []);

  // Handle file selection
  const handleFileSelect = (fileIds: string[]) => {
    if (fileIds.length > 0) {
      const selectedFileId = fileIds[0];
      const file = files.find(f => f.id === selectedFileId);
      if (file) {
        setSelectedFile(file);
        setSearchParams({ fileId: selectedFileId });
      }
    } else {
      setSelectedFile(null);
      setSearchParams({});
    }
  };
  
  // Handle file click from the tree
  const handleFileClick = (file: FileNode) => {
    setSelectedFile(file);
    setSearchParams({ fileId: file.id });
  };
  
  // Repair file paths
  const repairChildrenPaths = async () => {
    try {
      setIsRepairingPaths(true);
      toast.loading('Repairing file paths in database...');
      
      const result = await explorerService.repairFilePaths();
      
      console.log(`Path repair completed: ${result.fixed} fixed, ${result.errors} errors`);
      toast.success(`Fixed ${result.fixed} path issues`);
      
      setRepairResult(result);
      
      // Refresh the files to show the fixed structure
      window.location.reload();
    } catch (err) {
      console.error('Error in path repair:', err);
      toast.error('Failed to repair paths');
    } finally {
      setIsRepairingPaths(false);
      toast.dismiss();
    }
  };
  
  // Debug function
  const analyzeFileRelationships = () => {
    const analysis = explorerService.analyzeFileRelationships(files);
    console.log('Detailed relationship analysis:', analysis);
    alert('Check browser console for detailed relationship analysis');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">DHG Admin Explorer</h1>
      
      {/* Stats and Controls */}
      <div className="bg-green-100 text-green-800 px-4 py-2 mb-4 rounded-lg shadow-sm border border-green-200">
        <div className="flex justify-between items-center">
          <div>
            {stats && (
              <>
                <span className="font-bold">Files:</span> {stats.totalFiles} total |{' '}
                <span className="font-bold">Root Folders:</span> {stats.rootFolders} |{' '}
                <span className="font-bold">Files:</span> {stats.filesOnly} |{' '}
                <span className="font-bold">Folders:</span> {stats.folders}
                {stats.orphanedFiles > 0 && (
                  <span className="text-red-600 ml-2">
                    | <span className="font-bold">Orphaned:</span> {stats.orphanedFiles}
                  </span>
                )}
              </>
            )}
            <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded-full">
              Updated {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              onClick={repairChildrenPaths}
              disabled={isRepairingPaths}
            >
              {isRepairingPaths ? 'Repairing Paths...' : 'EMERGENCY FIX: Repair File Paths'}
            </button>
            
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
              onClick={analyzeFileRelationships}
            >
              Debug Relationships
            </button>
          </div>
        </div>
      </div>
      
      {/* Show repair results if available */}
      {repairResult && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <h3 className="font-bold mb-1">Path Repair Results:</h3>
          <p>
            <span className="font-medium">Fixed:</span> <span className="text-green-700">{repairResult.fixed}</span> paths
            {repairResult.errors > 0 && 
              <span className="ml-3 text-red-700">Errors: {repairResult.errors}</span>
            }
          </p>
          <p className="mt-1 text-gray-700">
            {repairResult.fixed > 0 
              ? "File paths have been repaired. You should now see the complete folder hierarchy." 
              : "No paths needed repair."}
          </p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      
      <div className="flex">
        <div className={`w-1/2 ${selectedFile ? 'pr-4' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-blue-500 animate-pulse">Loading files...</div>
            </div>
          ) : (
            <>
              <div className="mb-2 text-sm bg-blue-50 p-2 rounded border border-blue-200">
                <p className="font-semibold">File Explorer</p>
                <p className="text-xs text-gray-600 mt-1">
                  Click on files to view details. Folders can be expanded/collapsed.
                </p>
              </div>
              <FileTree 
                files={files}
                onSelectionChange={handleFileSelect}
                onFileClick={handleFileClick}
              />
            </>
          )}
        </div>
        
        {selectedFile && (
          <FileViewer file={selectedFile} />
        )}
      </div>
    </div>
  );
}

export default Viewer;