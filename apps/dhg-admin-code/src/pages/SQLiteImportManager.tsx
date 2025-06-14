import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { ImportActionButtons } from '../components/ImportActionButtons';
import { 
  Database, 
  RefreshCw, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Info,
  Filter,
  Download,
  FileText,
  BarChart3
} from 'lucide-react';

interface SQLiteTableImport {
  id: number;
  table_name: string;
  record_count: number;
  column_count: number;
  primary_key: string | null;
  sample_columns: string | null;
  has_autoincrement: boolean | null;
  table_size_category: string;
  import_status: string | null;
  supabase_table_name: string | null;
  import_priority: string | null;
  import_notes: string | null;
  last_checked: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const SQLiteImportManager: React.FC = () => {
  const [imports, setImports] = useState<SQLiteTableImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImport, setSelectedImport] = useState<SQLiteTableImport | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    inProgress: 0,
    skipped: 0,
    error: 0,
    totalRecords: 0
  });

  useEffect(() => {
    loadImports();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [imports]);

  const loadImports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('import_dynamic_healing_sqlite')
        .select('*')
        .order('table_name');

      if (error) throw error;
      setImports(data || []);
    } catch (err) {
      console.error('Error loading imports:', err);
      setError(err instanceof Error ? err.message : 'Failed to load imports');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const stats = imports.reduce((acc, imp) => {
      acc.total++;
      acc.totalRecords += imp.record_count;
      
      switch (imp.import_status) {
        case 'pending':
          acc.pending++;
          break;
        case 'completed':
          acc.completed++;
          break;
        case 'in_progress':
          acc.inProgress++;
          break;
        case 'skipped':
          acc.skipped++;
          break;
        case 'error':
          acc.error++;
          break;
        default:
          acc.pending++;
      }
      
      return acc;
    }, {
      total: 0,
      pending: 0,
      completed: 0,
      inProgress: 0,
      skipped: 0,
      error: 0,
      totalRecords: 0
    });
    
    setStats(stats);
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'skipped':
        return <Info className="w-5 h-5 text-gray-400" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'in_progress':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'skipped':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    switch (priority) {
      case 'high':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'medium':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'low':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getSizeBadge = (size: string) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    switch (size) {
      case 'very_large':
        return `${baseClasses} bg-purple-100 text-purple-800`;
      case 'large':
        return `${baseClasses} bg-indigo-100 text-indigo-800`;
      case 'medium':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'small':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'empty':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const updateImportStatus = async (id: number, status: string, notes?: string) => {
    try {
      const updates: any = {
        import_status: status,
        updated_at: new Date().toISOString()
      };
      
      if (notes) {
        updates.import_notes = notes;
      }

      const { error } = await supabase
        .from('import_dynamic_healing_sqlite')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      // Reload data
      await loadImports();
    } catch (err) {
      console.error('Error updating import status:', err);
      alert('Failed to update import status');
    }
  };

  const getFilteredImports = () => {
    return imports.filter(imp => {
      // Status filter
      if (statusFilter !== 'all' && (imp.import_status || 'pending') !== statusFilter) {
        return false;
      }
      
      // Priority filter
      if (priorityFilter !== 'all' && imp.import_priority !== priorityFilter) {
        return false;
      }
      
      // Size filter
      if (sizeFilter !== 'all' && imp.table_size_category !== sizeFilter) {
        return false;
      }
      
      // Search filter
      if (searchTerm && !imp.table_name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !(imp.supabase_table_name?.toLowerCase().includes(searchTerm.toLowerCase()))) {
        return false;
      }
      
      return true;
    });
  };

  const runImportScan = async () => {
    try {
      const confirmed = window.confirm('This will re-scan the SQLite database. Continue?');
      if (!confirmed) return;
      
      alert('Please run: ./scripts/cli-pipeline/utilities/utilities-cli.sh import-sqlite-tables');
      // In a real implementation, this could trigger a backend API
    } catch (err) {
      console.error('Error running import scan:', err);
    }
  };

  const openImportDetails = (imp: SQLiteTableImport) => {
    setSelectedImport(imp);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Database className="w-8 h-8" />
              SQLite Import Manager
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and track imports from Dynamic Healing SQLite database
            </p>
          </div>
          <button
            onClick={runImportScan}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-scan SQLite
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tables</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.totalRecords.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tables..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size
              </label>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Sizes</option>
                <option value="empty">Empty</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="very_large">Very Large</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setSizeFilter('all');
                }}
                className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <Filter className="w-4 h-4 inline mr-1" />
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Import Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Table Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Records
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supabase Table
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredImports().map((imp) => (
                  <tr key={imp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(imp.import_status)}
                        <span className={`ml-2 ${getStatusBadge(imp.import_status)}`}>
                          {imp.import_status || 'pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{imp.table_name}</div>
                      <div className="text-sm text-gray-500">{imp.column_count} columns</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {imp.record_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getSizeBadge(imp.table_size_category)}>
                        {imp.table_size_category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getPriorityBadge(imp.import_priority)}>
                        {imp.import_priority || 'unset'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {imp.supabase_table_name || (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openImportDetails(imp)}
                          className="p-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded"
                          title="View details"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        <ImportActionButtons
                          importId={imp.id}
                          currentStatus={imp.import_status}
                          onStatusChange={updateImportStatus}
                        />
                        <button
                          onClick={() => {
                            const notes = prompt('Add notes for this table:');
                            if (notes) {
                              updateImportStatus(imp.id, imp.import_status || 'pending', notes);
                            }
                          }}
                          className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded"
                          title="Add notes"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Import Details Modal */}
        {isModalOpen && selectedImport && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Import Details: {selectedImport.table_name}
                  </h3>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Records</p>
                      <p className="text-lg font-semibold">{selectedImport.record_count.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Columns</p>
                      <p className="text-lg font-semibold">{selectedImport.column_count}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Primary Key</p>
                      <p className="text-lg font-semibold">{selectedImport.primary_key || 'None'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Auto Increment</p>
                      <p className="text-lg font-semibold">{selectedImport.has_autoincrement ? 'Yes' : 'No'}</p>
                    </div>
                  </div>

                  {selectedImport.sample_columns && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Sample Columns</p>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <code className="text-sm">{selectedImport.sample_columns}</code>
                      </div>
                    </div>
                  )}

                  {selectedImport.import_notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Import Notes</p>
                      <div className="bg-yellow-50 p-3 rounded-md">
                        <p className="text-sm">{selectedImport.import_notes}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          updateImportStatus(selectedImport.id, 'in_progress');
                          setIsModalOpen(false);
                        }}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        Start Import
                      </button>
                      <button
                        onClick={() => {
                          updateImportStatus(selectedImport.id, 'skipped');
                          setIsModalOpen(false);
                        }}
                        className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                      >
                        Skip Table
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};