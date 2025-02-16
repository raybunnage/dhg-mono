import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'react-hot-toast'

interface SourceFile {
  id: string;
  name: string;
  mime_type: string;
  web_view_link: string;
  path: string;
  deleted: boolean;
}

interface FolderStructure {
  files?: SourceFile[];
  subfolders: { [key: string]: FolderStructure };
}

// Add interface for selected file display
interface SelectedFileDisplay {
  id: string;
  name: string;
  mime_type: string;
}

export default function ExpertFolderAnalysis() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [folderStructure, setFolderStructure] = useState<FolderStructure>({ subfolders: {} })
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  // Add state for selected files display
  const [selectedFilesList, setSelectedFilesList] = useState<SelectedFileDisplay[]>([])

  useEffect(() => {
    loadSourceFiles()
  }, [])

  function getExtensionFromMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'application/pdf':
        return '.pdf';
      case 'application/vnd.google-apps.document':
        return '.docx';
      case 'video/mp4':
        return '.mp4';
      case 'video/x-m4a':
        return '.m4a';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '.docx';
      case 'application/msword':
        return '.doc';
      case 'application/vnd.google-apps.folder':
        return '';
      case 'application/octet-stream':
        return '.bin';
      default:
        console.warn('Unknown mime type:', mimeType);
        return '';
    }
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('document') || mimeType.includes('msword')) return '📄';
    if (mimeType.includes('video')) return '🎥';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('folder')) return '📁';
    return '📄';
  }

  async function loadSourceFiles() {
    setLoading(true)
    setError(null)
    try {
      const { data: files, error: loadError } = await supabase
        .from('sources_google')
        .select('*')
        .eq('deleted', false)
        .order('name')

      if (loadError) throw loadError

      const structure: FolderStructure = { subfolders: {} }

      // First, group files by their parent folder
      const filesByFolder = new Map<string, SourceFile[]>()

      files?.forEach(file => {
        // Extract the parent folder name from the file name
        const match = file.name.match(/^(\d{4}-\d{2}-\d{2}[^/]+)/)
        const parentFolder = match ? match[1] : 'Uncategorized'
        
        if (!filesByFolder.has(parentFolder)) {
          filesByFolder.set(parentFolder, [])
        }
        filesByFolder.get(parentFolder)?.push(file)
      })

      // Create folder structure
      filesByFolder.forEach((files, folderName) => {
        structure.subfolders[folderName] = {
          files: [],
          subfolders: {}
        }

        files.forEach(file => {
          // If file name contains additional folders after the date-based folder
          const remainingPath = file.name.substring(folderName.length).split('/')
            .filter(Boolean)
            .map(part => part.trim())

          let currentLevel = structure.subfolders[folderName]

          // Create subfolders if they exist
          if (remainingPath.length > 1) { // More than 1 means we have subfolders
            for (let i = 0; i < remainingPath.length - 1; i++) {
              const subfolder = remainingPath[i]
              currentLevel.subfolders[subfolder] = currentLevel.subfolders[subfolder] || {
                files: [],
                subfolders: {}
              }
              currentLevel = currentLevel.subfolders[subfolder]
            }
          }

          // Add file to the appropriate level
          currentLevel.files = currentLevel.files || []
          currentLevel.files.push({
            ...file,
            name: file.name.includes('.') 
              ? file.name.split('/').pop() || file.name // Get just the filename
              : `${file.name.split('/').pop()}${getExtensionFromMimeType(file.mime_type)}`
          })
        })
      })

      setFolderStructure(structure)
      
      // Expand all folders by default
      const allPaths = getAllFolderPaths(structure)
      setExpandedFolders(new Set(allPaths))

    } catch (err) {
      console.error('Error loading files:', err)
      setError(err instanceof Error ? err.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  function getAllFolderPaths(structure: FolderStructure, basePath: string = ''): string[] {
    let paths: string[] = []
    
    Object.entries(structure.subfolders).forEach(([name, content]) => {
      const currentPath = basePath ? `${basePath}/${name}` : name
      paths.push(currentPath)
      paths = paths.concat(getAllFolderPaths(content, currentPath))
    })
    
    return paths
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // Update renderFolder to sort folders
  function renderFolder(structure: FolderStructure, currentPath: string = '') {
    // Sort folders and files
    const sortedFolders = Object.entries(structure.subfolders)
      .sort(([a], [b]) => a.localeCompare(b));

    return (
      <div className="space-y-2">
        {sortedFolders.map(([name, content]) => {
          const folderPath = currentPath ? `${currentPath}/${name}` : name;
          const isExpanded = expandedFolders.has(folderPath);
          
          return (
            <div key={name} className="ml-4">
              <button 
                onClick={() => toggleFolder(folderPath)}
                className="flex items-center gap-2 hover:bg-gray-100 p-1 rounded"
              >
                <span>{isExpanded ? '📂' : '📁'}</span>
                <span>{name}</span>
              </button>
              
              {isExpanded && content.files && (
                <div className="ml-6 space-y-1 mt-1">
                  {content.files.map(file => (
                    <div key={file.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.id)}
                        onChange={() => toggleFile(file.id)}
                        className="rounded border-gray-300"
                      />
                      <span>{getFileIcon(file.mime_type)}</span>
                      <span>{file.name}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {isExpanded && renderFolder(content, folderPath)}
            </div>
          );
        })}
      </div>
    );
  }

  // Update toggleFile to immediately update the selected files list
  const toggleFile = (fileId: string) => {
    const file = findFileInStructure(folderStructure, fileId);
    if (!file) return;

    const fileName = file.name.includes('.') 
      ? file.name 
      : `${file.name}${getExtensionFromMimeType(file.mime_type)}`;

    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
        setSelectedFilesList(current => 
          current.filter(f => f.id !== fileId)
        );
      } else {
        next.add(fileId);
        setSelectedFilesList(current => [...current, {
          id: file.id,
          name: fileName,
          mime_type: file.mime_type
        }]);
      }
      return next;
    });
  };

  // Helper function to find a file in the folder structure
  function findFileInStructure(structure: FolderStructure, fileId: string): SourceFile | null {
    if (structure.files) {
      const file = structure.files.find(f => f.id === fileId);
      if (file) return file;
    }

    for (const subfolder of Object.values(structure.subfolders)) {
      const found = findFileInStructure(subfolder, fileId);
      if (found) return found;
    }

    return null;
  }

  // Update handleProcessSelected to add to expert_documents
  const handleProcessSelected = async () => {
    if (!selectedFiles.size) {
      toast.error('No files selected');
      return;
    }

    try {
      // Insert into expert_documents
      const { data: insertedDocs, error: insertError } = await supabase
        .from('expert_documents')
        .insert(
          Array.from(selectedFiles).map(fileId => ({
            source_id: fileId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))
        )
        .select();

      if (insertError) throw insertError;

      toast.success(`Added ${insertedDocs.length} documents for processing`);
      
      // Clear selections after successful processing
      setSelectedFiles(new Set());
      setSelectedFilesList([]);

    } catch (error) {
      console.error('Failed to process files:', error);
      toast.error('Failed to process selected files');
    }
  };

  const expandAll = () => {
    const allPaths = getAllFolderPaths(folderStructure)
    console.log('Expanding paths:', allPaths)
    setExpandedFolders(new Set(allPaths))
  }

  const collapseAll = () => {
    console.log('Collapsing all folders')
    setExpandedFolders(new Set())
  }

  if (loading) return <div>Loading files...</div>
  if (error) return <div className="text-red-500">Error: {error}</div>
  if (!Object.keys(folderStructure).length) return <div>No source files found</div>

  return (
    <div className="mt-8 p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Collapse All
          </button>
        </div>
        
        <button
          onClick={handleProcessSelected}
          disabled={!selectedFiles.size}
          className={`px-4 py-2 rounded text-white ${
            selectedFiles.size ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'
          }`}
        >
          Process {selectedFiles.size} Selected Files
        </button>
      </div>
      
      <div className="border rounded-lg p-4">
        {renderFolder(folderStructure)}
      </div>
    </div>
  )
} 