import { useState } from "react";
import { listDriveContents, getFileContent } from "@/lib/google-drive";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

interface FolderBreadcrumb {
  id: string;
  name: string;
}

interface FilePreview {
  id: string;
  name: string;
  content: string;
  mimeType: string;
}

export default function ExpertProfiles() {
  console.log('ExpertProfiles rendering');
  const [envInfo, setEnvInfo] = useState('');
  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([
    { id: import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID, name: 'Root' }
  ]);
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);

  const testEnv = () => {
    const info = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.slice(0, 10) + '...',
      clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET ? 'present' : 'missing',
      redirectUri: import.meta.env.VITE_REDIRECT_URI,
      accessToken: import.meta.env.VITE_GOOGLE_ACCESS_TOKEN?.slice(0, 10) + '...',
      refreshToken: import.meta.env.VITE_GOOGLE_REFRESH_TOKEN ? 'present' : 'missing',
      folderId: import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID
    };
    
    console.log('Environment Variables:', info);
    setEnvInfo(JSON.stringify(info, null, 2));
  };

  const fetchDriveContents = async (folderId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const items = await listDriveContents(folderId);
      console.log('Drive items:', items);
      setDriveItems(items);
    } catch (err) {
      console.error('Error fetching drive contents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: DriveItem) => {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
      await fetchDriveContents(item.id);
    } else {
      // Check if file is previewable
      const previewableTypes = [
        'text/plain',
        'text/markdown',
        'text/html',
        'application/json',
        'text/csv',
        'application/pdf'
      ];

      if (previewableTypes.includes(item.mimeType)) {
        try {
          setLoading(true);
          const content = await getFileContent(item.id);
          setSelectedFile({
            id: item.id,
            name: item.name,
            content,
            mimeType: item.mimeType
          });
        } catch (err) {
          console.error('Error fetching file content:', err);
          setError('Failed to load file content');
        } finally {
          setLoading(false);
        }
      } else if (item.webViewLink) {
        // For non-previewable files, open in new tab
        window.open(item.webViewLink, '_blank');
      }
    }
  };

  const handleBreadcrumbClick = async (breadcrumb: FolderBreadcrumb, index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    await fetchDriveContents(breadcrumb.id);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Google Drive Test</h1>
      <div className="space-y-4">
        <button 
          className="bg-blue-500 text-white px-4 py-2 rounded mr-4"
          onClick={testEnv}
        >
          Test Environment Variables
        </button>

        <button 
          className="bg-green-500 text-white px-4 py-2 rounded"
          onClick={() => fetchDriveContents()}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Fetch Drive Contents'}
        </button>

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mt-4">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id} className="flex items-center">
                {index > 0 && <span className="mx-2">/</span>}
                <button
                  onClick={() => handleBreadcrumbClick(crumb, index)}
                  className="hover:text-blue-500"
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {envInfo && (
          <pre className="bg-gray-100 p-4 rounded mt-4 whitespace-pre-wrap">
            {envInfo}
          </pre>
        )}

        {error && (
          <div className="text-red-500 mt-4">
            Error: {error}
          </div>
        )}

        <div className="flex gap-8">
          {/* File/Folder List */}
          <div className="flex-1">
            {driveItems.length > 0 && (
              <div className="mt-4">
                <h2 className="text-xl mb-2">Drive Contents:</h2>
                <div className="space-y-2">
                  {driveItems.map(item => (
                    <div 
                      key={item.id} 
                      className={`p-2 border rounded flex items-center ${
                        item.mimeType === 'application/vnd.google-apps.folder' || 
                        !item.mimeType.includes('video/')
                          ? 'cursor-pointer hover:bg-gray-50' 
                          : ''
                      }`}
                      onClick={() => handleItemClick(item)}
                    >
                      {item.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄'} 
                      <span className="ml-2">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File Preview */}
          {selectedFile && (
            <div className="flex-1">
              <div className="sticky top-4">
                <h2 className="text-xl mb-2">
                  {selectedFile.name}
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="ml-2 text-sm text-gray-500 hover:text-red-500"
                  >
                    ✕
                  </button>
                </h2>
                <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[600px] whitespace-pre-wrap">
                  {selectedFile.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 