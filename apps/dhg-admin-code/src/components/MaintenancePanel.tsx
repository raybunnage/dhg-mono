import React, { useState } from 'react';
import { Archive, AlertTriangle, CheckCircle, Info, RefreshCw, Trash2, FileSearch, Clock, TrendingDown } from 'lucide-react';

export interface MaintenanceStats {
  totalItems: number;
  lastUsed30Days: number;
  lastUsed90Days: number;
  neverUsed: number;
  duplicates: number;
  outdated: number;
  oversized: number;
  archived: number;
}

export interface MaintenanceAction {
  id: string;
  type: 'archive' | 'delete' | 'update' | 'review';
  itemId: string;
  itemPath: string;
  reason: string;
  confidence: number;
  metadata?: any;
}

interface MaintenancePanelProps {
  type: 'scripts' | 'documents';
  stats: MaintenanceStats;
  onRunAnalysis: () => Promise<MaintenanceAction[]>;
  onExecuteAction: (action: MaintenanceAction) => Promise<void>;
  onBulkArchive: (itemIds: string[]) => Promise<void>;
}

export const MaintenancePanel: React.FC<MaintenancePanelProps> = ({
  type,
  stats,
  onRunAnalysis,
  onExecuteAction,
  onBulkArchive
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [actions, setActions] = useState<MaintenanceAction[]>([]);
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [executingActions, setExecutingActions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const results = await onRunAnalysis();
      setActions(results);
      setShowDetails(true);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const executeSelectedActions = async () => {
    setExecutingActions(true);
    const actionsToExecute = actions.filter(a => selectedActions.has(a.id));
    
    try {
      for (const action of actionsToExecute) {
        await onExecuteAction(action);
      }
      
      // Archive items if needed
      const archiveActions = actionsToExecute.filter(a => a.type === 'archive');
      if (archiveActions.length > 0) {
        await onBulkArchive(archiveActions.map(a => a.itemId));
      }
      
      // Clear selections and refresh
      setSelectedActions(new Set());
      setActions([]);
      setShowDetails(false);
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setExecutingActions(false);
    }
  };

  const toggleActionSelection = (actionId: string) => {
    const newSelection = new Set(selectedActions);
    if (newSelection.has(actionId)) {
      newSelection.delete(actionId);
    } else {
      newSelection.add(actionId);
    }
    setSelectedActions(newSelection);
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'archive':
        return <Archive className="w-4 h-4" />;
      case 'delete':
        return <Trash2 className="w-4 h-4" />;
      case 'update':
        return <RefreshCw className="w-4 h-4" />;
      case 'review':
        return <FileSearch className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Archive className="w-5 h-5 text-gray-600" />
            Maintenance & Archival
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            AI-assisted analysis for {type} deprecation and archival
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={isAnalyzing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <FileSearch className="w-4 h-4" />
              Run Analysis
            </>
          )}
        </button>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
          <div className="text-sm text-gray-600">Total {type}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">{stats.neverUsed}</div>
          <div className="text-sm text-yellow-700">Never Used</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-700">{stats.outdated}</div>
          <div className="text-sm text-orange-700">Outdated</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">{stats.archived}</div>
          <div className="text-sm text-green-700">Archived</div>
        </div>
      </div>

      {/* Usage Timeline */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Usage Timeline</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Last 30 days</span>
                <span className="text-gray-900 font-medium">{stats.lastUsed30Days}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${(stats.lastUsed30Days / stats.totalItems) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Last 90 days</span>
                <span className="text-gray-900 font-medium">{stats.lastUsed90Days}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full"
                  style={{ width: `${(stats.lastUsed90Days / stats.totalItems) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Criteria */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Maintenance Criteria</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-gray-400" />
            <span>No usage in 90+ days</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-gray-400" />
            <span>Duplicate functionality detected</span>
          </div>
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-gray-400" />
            <span>Superseded by newer versions</span>
          </div>
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-gray-400" />
            <span>Already marked for deprecation</span>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {showDetails && actions.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Recommended Actions ({actions.length})
            </h3>
            <button
              onClick={executeSelectedActions}
              disabled={selectedActions.size === 0 || executingActions}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {executingActions ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Execute Selected ({selectedActions.size})
                </>
              )}
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {actions.map((action) => (
              <div
                key={action.id}
                className={`border rounded-lg p-4 transition-colors ${
                  selectedActions.has(action.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedActions.has(action.id)}
                    onChange={() => toggleActionSelection(action.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getActionIcon(action.type)}
                      <span className="font-medium text-gray-900 capitalize">{action.type}</span>
                      <span className={`text-sm ${getConfidenceColor(action.confidence)}`}>
                        ({Math.round(action.confidence * 100)}% confidence)
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 font-mono">{action.itemPath}</div>
                    <div className="text-sm text-gray-600 mt-1">{action.reason}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};