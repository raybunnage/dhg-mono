import { useState } from 'react';
import { Calendar, RefreshCw, CheckCircle, AlertCircle, Clock, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface SyncStatus {
  isRunning: boolean;
  lastSync: Date | null;
  emailsProcessed: number;
  emailsTotal: number;
  errors: string[];
}

function EmailSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isRunning: false,
    lastSync: new Date('2024-01-15T08:00:00'),
    emailsProcessed: 0,
    emailsTotal: 0,
    errors: [],
  });

  const [dateRange, setDateRange] = useState({
    from: format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const [importanceFilter, setImportanceFilter] = useState(1);

  const startSync = () => {
    setSyncStatus(prev => ({ ...prev, isRunning: true, emailsProcessed: 0, emailsTotal: 100 }));
    
    // Simulate sync progress
    const interval = setInterval(() => {
      setSyncStatus(prev => {
        if (prev.emailsProcessed >= prev.emailsTotal) {
          clearInterval(interval);
          return { 
            ...prev, 
            isRunning: false, 
            lastSync: new Date(),
            emailsProcessed: prev.emailsTotal 
          };
        }
        return { ...prev, emailsProcessed: prev.emailsProcessed + 10 };
      });
    }, 500);
  };

  const progress = syncStatus.emailsTotal > 0 
    ? (syncStatus.emailsProcessed / syncStatus.emailsTotal) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Sync Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-background-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm">Last Sync</p>
              <p className="text-2xl font-semibold text-text-primary mt-1">
                {syncStatus.lastSync 
                  ? format(syncStatus.lastSync, 'MMM d, h:mm a')
                  : 'Never'
                }
              </p>
            </div>
            <Clock className="text-text-muted" size={24} />
          </div>
        </div>

        <div className="card bg-background-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm">Emails Processed</p>
              <p className="text-2xl font-semibold text-text-primary mt-1">
                {syncStatus.emailsProcessed.toLocaleString()}
              </p>
            </div>
            <CheckCircle className="text-success" size={24} />
          </div>
        </div>

        <div className="card bg-background-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm">Sync Status</p>
              <p className="text-2xl font-semibold text-text-primary mt-1">
                {syncStatus.isRunning ? 'Running' : 'Idle'}
              </p>
            </div>
            <Activity 
              className={syncStatus.isRunning ? 'text-primary-500 animate-pulse' : 'text-text-muted'} 
              size={24} 
            />
          </div>
        </div>
      </div>

      {/* Sync Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">Sync Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="input"
              />
              <span className="text-text-muted">to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Minimum Importance Level
            </label>
            <select
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(Number(e.target.value))}
              className="input"
            >
              <option value={1}>All emails (Level 1+)</option>
              <option value={2}>Important emails (Level 2+)</option>
              <option value={3}>Critical emails (Level 3)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={startSync}
            disabled={syncStatus.isRunning}
            className="btn btn-primary"
          >
            <RefreshCw className={syncStatus.isRunning ? 'animate-spin' : ''} size={18} />
            <span>{syncStatus.isRunning ? 'Syncing...' : 'Start Sync'}</span>
          </button>

          {syncStatus.isRunning && (
            <button className="btn btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Sync Progress */}
      {syncStatus.isRunning && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Sync Progress</span>
            <span className="text-text-primary">
              {syncStatus.emailsProcessed} / {syncStatus.emailsTotal} emails
            </span>
          </div>
          <div className="w-full bg-background-elevated rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Recent Sync Activity */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">Recent Activity</h3>
        
        <div className="space-y-2">
          {[
            { time: '10:30 AM', message: 'Synced 45 emails from researcher@university.edu', type: 'success' },
            { time: '9:15 AM', message: 'Processed 23 emails with AI analysis', type: 'success' },
            { time: '8:45 AM', message: 'Failed to process 2 emails - invalid content', type: 'error' },
            { time: 'Yesterday', message: 'Synced 156 emails from 12 senders', type: 'success' },
          ].map((activity, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-background-elevated rounded-lg">
              {activity.type === 'success' ? (
                <CheckCircle className="text-success mt-0.5" size={18} />
              ) : (
                <AlertCircle className="text-error mt-0.5" size={18} />
              )}
              <div className="flex-1">
                <p className="text-text-primary text-sm">{activity.message}</p>
                <p className="text-text-muted text-xs mt-0.5">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default EmailSync;