import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import { ExpertMetadataModal } from '@/components/ExpertMetadataModal';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

// Icons for the dashboard
const ProcessingIcon = () => <span className="text-blue-500 text-xl">⚙️</span>;
const SyncIcon = () => <span className="text-green-500 text-xl">🔄</span>;
const ContentIcon = () => <span className="text-purple-500 text-xl">📄</span>;
const AIIcon = () => <span className="text-yellow-500 text-xl">🤖</span>;

// Interface for folder options
interface FolderOption {
  id: string;
  name: string;
}

// Status Card Component
interface StatusCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, icon, trend }) => (
  <div className="bg-white rounded-lg shadow p-6 flex flex-col">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-gray-700 font-medium">{title}</h3>
      <div className="p-2 rounded-full bg-gray-100">{icon}</div>
    </div>
    <div className="flex items-end">
      <span className="text-2xl font-bold">{value}</span>
      {trend && (
        <span className={`ml-2 text-sm ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </span>
      )}
    </div>
  </div>
);

// Activity Item Component
interface Activity {
  id: string;
  type: 'upload' | 'process' | 'sync' | 'analyze';
  description: string;
  time: string;
}

const ActivityItem: React.FC<{ activity: Activity }> = ({ activity }) => {
  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'upload': return '📤';
      case 'process': return '⚙️';
      case 'sync': return '🔄';
      case 'analyze': return '🔍';
      default: return '📝';
    }
  };

  return (
    <div className="flex items-start mb-4">
      <div className="p-2 rounded-full bg-gray-100 mr-4">{getIcon(activity.type)}</div>
      <div>
        <p className="text-gray-800">{activity.description}</p>
        <span className="text-sm text-gray-500">{activity.time}</span>
      </div>
    </div>
  );
};

// Activity Timeline Component
const ActivityTimeline: React.FC<{ activities: Activity[] }> = ({ activities }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
    <div className="space-y-4">
      {activities.map(activity => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  </div>
);

// Metrics Chart Component (Mock)
const MetricsChart: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-gray-500 text-sm mb-4">{description}</p>
    <div className="h-40 bg-gray-100 rounded flex items-center justify-center">
      <p className="text-gray-400">[Chart Visualization]</p>
    </div>
  </div>
);

// Action Button Component
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  color?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  label, 
  onClick, 
  icon, 
  color = 'bg-blue-500 hover:bg-blue-600' 
}) => (
  <button
    onClick={onClick}
    className={`${color} text-white px-4 py-3 rounded-lg shadow flex items-center justify-center`}
  >
    {icon && <span className="mr-2">{icon}</span>}
    {label}
  </button>
);

// Dashboard Page Component
function Dashboard() {
  // State for folders and modal
  const [folderOptions, setFolderOptions] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  // Mock data
  const activeJobs = 12;
  const syncStatus = "Healthy";
  const contentCount = 523;
  const aiCredits = "3,750";

  const recentActivities: Activity[] = [
    {
      id: '1',
      type: 'process',
      description: 'Completed batch processing of 15 audio files',
      time: '10 minutes ago'
    },
    {
      id: '2',
      type: 'upload',
      description: 'Uploaded 5 new research documents',
      time: '45 minutes ago'
    },
    {
      id: '3',
      type: 'analyze',
      description: 'AI analysis completed for presentation "DHG Leadership Meeting"',
      time: '2 hours ago'
    },
    {
      id: '4',
      type: 'sync',
      description: 'Google Drive sync completed successfully',
      time: '3 hours ago'
    }
  ];

  // Fetch root folders from sources_google
  useEffect(() => {
    async function fetchRootFolders() {
      try {
        const { data, error } = await supabase
          .from('google_sources')
          .select('id, name, drive_id')
          .is('parent_path', null)
          .eq('mime_type', 'application/vnd.google-apps.folder')
          .order('name');
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          // Create unique folder options
          const folders = new Map<string, FolderOption>();
          
          data.forEach(folder => {
            const folderId = folder.drive_id || folder.id;
            folders.set(folderId, {
              id: folderId,
              name: folder.name
            });
          });
          
          // Convert map to array
          const folderArray = Array.from(folders.values());
          
          // Sort by name
          folderArray.sort((a, b) => a.name.localeCompare(b.name));
          
          setFolderOptions(folderArray);
        }
      } catch (err) {
        console.error('Error fetching root folders:', err);
      }
    }
    
    fetchRootFolders();
  }, []);

  // Handle folder selection change
  const handleFolderChange = (folderId: string) => {
    setSelectedFolderId(folderId);
    
    // Find the folder name for the toast
    const selectedFolder = folderOptions.find(folder => folder.id === folderId);
    if (selectedFolder) {
      toast.success(`Selected folder: ${selectedFolder.name}\nFolder ID: ${folderId}`);
    }
  };

  // Mock handlers
  const handleNewSync = () => console.log('New sync initiated');
  const handleProcessAudio = () => console.log('Process audio clicked');
  const handleCreatePresentation = () => console.log('Create presentation clicked');
  const handleViewReports = () => console.log('View reports clicked');

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button 
          onClick={() => setShowMetadataModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          View Expert Metadata
        </button>
      </div>
      
      {/* Expert Metadata Modal */}
      <ExpertMetadataModal 
        isOpen={showMetadataModal} 
        onClose={() => setShowMetadataModal(false)} 
      />
      
      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatusCard 
          title="Processing Jobs" 
          value={activeJobs} 
          icon={<ProcessingIcon />} 
          trend={{ value: 5, isPositive: true }}
        />
        <StatusCard 
          title="Sync Status" 
          value={syncStatus} 
          icon={<SyncIcon />} 
        />
        <StatusCard 
          title="Content Items" 
          value={contentCount} 
          icon={<ContentIcon />} 
          trend={{ value: 12, isPositive: true }}
        />
        <StatusCard 
          title="AI Credits" 
          value={aiCredits} 
          icon={<AIIcon />} 
          trend={{ value: 3, isPositive: false }}
        />
      </div>
      
      {/* Activity Timeline and Metrics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <ActivityTimeline activities={recentActivities} />
        </div>
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricsChart 
              title="Processing Performance" 
              description="Average processing time by content type"
            />
            <MetricsChart 
              title="Content Growth" 
              description="New content added over time"
            />
          </div>
        </div>
      </div>
      
      {/* Quick Action Panel */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionButton 
            label="New Sync" 
            onClick={handleNewSync} 
            icon="🔄"
          />
          <ActionButton 
            label="Process Audio" 
            onClick={handleProcessAudio} 
            icon="🎙️" 
            color="bg-purple-500 hover:bg-purple-600"
          />
          <ActionButton 
            label="Create Presentation" 
            onClick={handleCreatePresentation} 
            icon="📊" 
            color="bg-green-500 hover:bg-green-600"
          />
          <ActionButton 
            label="View Reports" 
            onClick={handleViewReports} 
            icon="📈" 
            color="bg-indigo-500 hover:bg-indigo-600"
          />
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 