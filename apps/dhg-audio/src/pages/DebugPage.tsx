import { AudioServerDebug } from '@/components/AudioServerDebug';
import { DriveFilterDebug } from '@/components/DriveFilterDebug';
import { CompareSupabaseClients } from '@/components/CompareSupabaseClients';
import { CheckRLS } from '@/components/CheckRLS';
import { FilterServiceTest } from '@/components/FilterServiceTest';
import { MediaTrackingDebug } from '@/components/MediaTrackingDebug';
import { AudioServerSwitch } from '@/components/AudioServerSwitch';
import { useState } from 'react';

export const DebugPage = () => {
  const [activeTab, setActiveTab] = useState('server');

  const tabs = [
    { id: 'server', label: 'Audio Server', icon: '🎵' },
    { id: 'tracking', label: 'Media Tracking', icon: '📊' },
    { id: 'drive', label: 'Drive Filters', icon: '📁' },
    { id: 'supabase', label: 'Supabase Clients', icon: '🔌' },
    { id: 'rls', label: 'RLS Check', icon: '🔒' },
    { id: 'audio', label: 'Audio URLs', icon: '🔗' },
    { id: 'filter', label: 'Filter Service', icon: '🔍' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Debug Dashboard</h1>
        <p className="text-gray-600">
          Comprehensive debugging tools for the DHG Audio application. Check server connectivity, 
          database connections, and service status.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'server' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Audio Server Configuration</h2>
            
            {/* Server Selection */}
            <div className="mb-6">
              <AudioServerSwitch />
            </div>
            
            {/* Server Debug Info */}
            <h3 className="text-lg font-semibold mb-3">Server Debug Information</h3>
            <AudioServerDebug />
            
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">Server Requirements:</h3>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                <li>Audio servers must be running (Web on port 3006, Local on port 3007)</li>
                <li>Run <code className="bg-yellow-100 px-1">pnpm servers</code> from the main directory</li>
                <li>Service account file (.service-account.json) must exist in project root</li>
                <li>Google Drive API must be enabled for the service account</li>
                <li>For local server: Google Drive Desktop must be installed and synced</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'drive' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Drive Filter Configuration</h2>
            <DriveFilterDebug />
          </div>
        )}

        {activeTab === 'supabase' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Supabase Client Comparison</h2>
            <CompareSupabaseClients />
          </div>
        )}

        {activeTab === 'rls' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Row Level Security Check</h2>
            <CheckRLS />
          </div>
        )}

        {activeTab === 'audio' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Audio URL Testing</h2>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p>To test audio URLs, please select an audio file from the home page and click on the debug icon.</p>
              <p className="mt-2">This tab requires an audio file to be selected for testing.</p>
            </div>
          </div>
        )}

        {activeTab === 'tracking' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Media Tracking Status</h2>
            <MediaTrackingDebug />
          </div>
        )}

        {activeTab === 'filter' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Filter Service Test</h2>
            <FilterServiceTest />
          </div>
        )}
      </div>

      {/* Overall Status Summary */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-3">Quick Status Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatusIndicator 
            label="Audio Server" 
            status="Check the Audio Server tab"
            icon="🎵"
          />
          <StatusIndicator 
            label="Database" 
            status="Check RLS and Supabase tabs"
            icon="🗄️"
          />
          <StatusIndicator 
            label="Google Drive" 
            status="Check Drive Filters tab"
            icon="📁"
          />
        </div>
      </div>
    </div>
  );
};

// Helper component for status indicators
const StatusIndicator = ({ label, status, icon }: { label: string; status: string; icon: string }) => (
  <div className="bg-white p-3 rounded border border-gray-200">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-lg">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
    </div>
    <p className="text-xs text-gray-600">{status}</p>
  </div>
);