import { useState } from "react";
import { listDriveContents } from "@/lib/google-drive";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

export default function ExpertProfiles() {
  console.log('ExpertProfiles rendering');
  const [envInfo, setEnvInfo] = useState('');
  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchDriveContents = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listDriveContents();
      console.log('Drive items:', items);
      setDriveItems(items);
    } catch (err) {
      console.error('Error fetching drive contents:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          onClick={fetchDriveContents}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Fetch Drive Contents'}
        </button>

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

        {driveItems.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xl mb-2">Drive Contents:</h2>
            <div className="space-y-2">
              {driveItems.map(item => (
                <div key={item.id} className="p-2 border rounded">
                  {item.mimeType === 'application/vnd.google-apps.folder' ? '📁' : '📄'} {item.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 