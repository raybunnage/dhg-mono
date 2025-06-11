import React, { useState, useEffect } from 'react';
import { audioServerSelector, AudioServerMode } from '../services/audio-server-selector';

export function AudioServerSwitch() {
  const [mode, setMode] = useState<AudioServerMode>(audioServerSelector.getMode());
  const [checking, setChecking] = useState(false);
  const [serverStatus, setServerStatus] = useState<Record<AudioServerMode, boolean>>({
    local: false,
    web: false
  });

  // Check server health on mount
  useEffect(() => {
    checkServers();
    
    // Listen for server changes
    const handleChange = (e: Event) => {
      const event = e as CustomEvent;
      setMode(event.detail.mode);
    };
    
    window.addEventListener('audioServerChanged', handleChange);
    return () => window.removeEventListener('audioServerChanged', handleChange);
  }, []);

  const checkServers = async () => {
    setChecking(true);
    const [localOk, webOk] = await Promise.all([
      audioServerSelector.checkServerHealth('local'),
      audioServerSelector.checkServerHealth('web')
    ]);
    setServerStatus({ local: localOk, web: webOk });
    setChecking(false);
  };

  const handleModeChange = (newMode: AudioServerMode) => {
    audioServerSelector.setMode(newMode);
    setMode(newMode);
  };

  const handleAutoSelect = async () => {
    setChecking(true);
    const selected = await audioServerSelector.autoSelectBestServer();
    setMode(selected);
    await checkServers();
  };

  const servers = audioServerSelector.getAvailableServers();
  const currentServer = audioServerSelector.getCurrentServer();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Audio Server</h3>
        <button
          onClick={checkServers}
          disabled={checking}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Check Status'}
        </button>
      </div>

      <div className="space-y-3">
        {servers.map((server) => (
          <label
            key={server.mode}
            className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
              mode === server.mode
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              type="radio"
              name="audioServer"
              value={server.mode}
              checked={mode === server.mode}
              onChange={() => handleModeChange(server.mode)}
              className="mt-1 mr-3"
            />
            <div className="flex-1">
              <div className="flex items-center">
                <span className="font-medium">
                  {server.mode === 'local' ? '🏠 Local' : '☁️ Web'} Server
                </span>
                <span className="ml-2 text-sm text-gray-500">
                  (Port {server.port})
                </span>
                {serverStatus[server.mode] !== undefined && (
                  <span
                    className={`ml-auto text-sm ${
                      serverStatus[server.mode]
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {serverStatus[server.mode] ? '✓ Online' : '✗ Offline'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {server.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <button
          onClick={handleAutoSelect}
          disabled={checking}
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium disabled:opacity-50"
        >
          Auto-Select Best Server
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Currently using: {currentServer.url}
      </div>
    </div>
  );
}