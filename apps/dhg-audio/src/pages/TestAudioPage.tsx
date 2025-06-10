import { useState } from 'react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { AudioServerDebug } from '@/components/AudioServerDebug';

export const TestAudioPage = () => {
  const [testUrl, setTestUrl] = useState('');
  const [showPlayer, setShowPlayer] = useState(false);
  
  // Some test Google Drive URLs for audio files
  const testUrls = [
    {
      title: 'Test Audio 1',
      url: 'https://drive.google.com/file/d/1exampleid1/view',
      description: 'Replace with a real Google Drive audio file URL'
    },
    {
      title: 'Test Audio 2', 
      url: 'https://drive.google.com/file/d/1exampleid2/view',
      description: 'Replace with a real Google Drive audio file URL'
    }
  ];

  const handleTestUrl = () => {
    if (testUrl.trim()) {
      setShowPlayer(true);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Audio Server Test Page</h1>
      
      {/* Server Status */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Server Status</h2>
        <AudioServerDebug />
      </div>

      {/* Manual URL Test */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Custom URL</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Drive Audio URL
            </label>
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/YOUR_FILE_ID/view"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter a Google Drive link to an audio file (mp3, m4a, etc.)
            </p>
          </div>
          <button
            onClick={handleTestUrl}
            disabled={!testUrl.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Test Audio
          </button>
        </div>
      </div>

      {/* Audio Player */}
      {showPlayer && testUrl && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Audio Player</h2>
          <AudioPlayer 
            url={testUrl}
            title="Test Audio File"
          />
        </div>
      )}

      {/* Server Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How the Audio Server Works</h3>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          <li>The enhanced server (port 3006) checks for local Google Drive files first</li>
          <li>If found locally, it serves directly from disk (10-100x faster)</li>
          <li>If not found locally, it falls back to Google Drive API</li>
          <li>The AudioSourceDebug component shows which source is being used</li>
          <li>Make sure to run <code className="bg-blue-100 px-1">pnpm servers</code> to start the enhanced server</li>
        </ul>
      </div>

      {/* Troubleshooting */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">Troubleshooting</h3>
        <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
          <li>If audio won't play, check the server status above</li>
          <li>Ensure the enhanced server is running on port 3006</li>
          <li>Check browser console for CORS or network errors</li>
          <li>Verify the Google Drive file is accessible (not private)</li>
          <li>For local files, ensure Google Drive desktop is synced</li>
        </ul>
      </div>
    </div>
  );
};