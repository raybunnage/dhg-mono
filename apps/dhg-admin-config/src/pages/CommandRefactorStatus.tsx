import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ArrowLeft, CheckCircle, Clock, AlertCircle, Archive, Package, TestTube } from 'lucide-react';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CommandRefactor {
  id: string;
  command_name: string;
  command_type: string;
  current_status: string;
  description: string;
  test_criteria: string[];
  test_results: string | null;
  issues_found: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface StatusSummary {
  command_type: string;
  current_status: string;
  count: number;
}

export function CommandRefactorStatus() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [commands, setCommands] = useState<CommandRefactor[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch commands
      const { data: commandsData, error: commandsError } = await supabase
        .from('command_refactor_tracking')
        .select('*')
        .order('command_type')
        .order('command_name');

      if (commandsError) throw commandsError;

      // Fetch status summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('command_refactor_status_summary')
        .select('*')
        .order('command_type')
        .order('current_status');

      if (summaryError) throw summaryError;

      setCommands(commandsData || []);
      setStatusSummary(summaryData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCommands);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCommands(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Clock className="h-5 w-5 text-gray-400" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />;
      case 'needs_testing':
        return <TestTube className="h-5 w-5 text-purple-500" />;
      case 'tested':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'signed_off':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'archived':
        return <Archive className="h-5 w-5 text-gray-400" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-700';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700';
      case 'needs_testing':
        return 'bg-purple-100 text-purple-700';
      case 'tested':
        return 'bg-blue-100 text-blue-700';
      case 'signed_off':
        return 'bg-green-100 text-green-700';
      case 'archived':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'existing':
        return '📋';
      case 'new':
        return '✨';
      case 'to_archive':
        return '📦';
      default:
        return '📄';
    }
  };

  // Calculate progress
  const calculateProgress = () => {
    const totals = { existing: 0, new: 0, to_archive: 0 };
    const completed = { existing: 0, new: 0, to_archive: 0 };

    statusSummary.forEach(item => {
      if (item.command_type in totals) {
        totals[item.command_type as keyof typeof totals] += item.count;
        if (item.current_status === 'signed_off') {
          completed[item.command_type as keyof typeof totals] += item.count;
        } else if (item.current_status === 'archived' && item.command_type === 'to_archive') {
          completed.to_archive += item.count;
        }
      }
    });

    const totalCommands = totals.existing + totals.new + totals.to_archive;
    const completedCommands = completed.existing + completed.new + completed.to_archive;
    const progressPercent = totalCommands > 0 ? Math.round((completedCommands / totalCommands) * 100) : 0;

    return { totals, completed, progressPercent };
  };

  // Filter commands
  const filteredCommands = commands.filter(cmd => {
    if (selectedType !== 'all' && cmd.command_type !== selectedType) return false;
    if (selectedStatus !== 'all' && cmd.current_status !== selectedStatus) return false;
    return true;
  });

  const { totals, completed, progressPercent } = calculateProgress();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading refactor status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Command Refactor Status</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/work-summaries')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Work Summaries
              </button>
              <span className="text-sm text-gray-600">
                {user?.email}
              </span>
              <button
                onClick={async () => {
                  await signOut();
                  navigate('/login');
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Progress</h2>
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Total Progress</span>
              <span>{progressPercent}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{getTypeIcon('existing')}</span>
                <span className="text-2xl font-bold">{completed.existing}/{totals.existing}</span>
              </div>
              <div className="text-sm text-gray-600">Existing Commands</div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${totals.existing > 0 ? (completed.existing / totals.existing) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{getTypeIcon('new')}</span>
                <span className="text-2xl font-bold">{completed.new}/{totals.new}</span>
              </div>
              <div className="text-sm text-gray-600">New Commands</div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${totals.new > 0 ? (completed.new / totals.new) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{getTypeIcon('to_archive')}</span>
                <span className="text-2xl font-bold">{completed.to_archive}/{totals.to_archive}</span>
              </div>
              <div className="text-sm text-gray-600">To Archive</div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gray-500 h-2 rounded-full"
                  style={{ width: `${totals.to_archive > 0 ? (completed.to_archive / totals.to_archive) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Command Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="existing">Existing</option>
                <option value="new">New</option>
                <option value="to_archive">To Archive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_testing">Needs Testing</option>
                <option value="tested">Tested</option>
                <option value="signed_off">Signed Off</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Commands List */}
        <div className="space-y-4">
          {filteredCommands.map(command => (
            <div key={command.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpanded(command.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(command.current_status)}
                    <div>
                      <h3 className="font-medium text-gray-900">{command.command_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500">
                          {getTypeIcon(command.command_type)} {command.command_type}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(command.current_status)}`}>
                          {command.current_status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Package className={`h-5 w-5 text-gray-400 transform transition-transform ${expandedCommands.has(command.id) ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {expandedCommands.has(command.id) && (
                <div className="px-4 pb-4 border-t">
                  <div className="pt-4 space-y-3">
                    {command.description && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Description</h4>
                        <p className="text-sm text-gray-600 mt-1">{command.description}</p>
                      </div>
                    )}

                    {command.test_criteria && command.test_criteria.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Test Criteria</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                          {command.test_criteria.map((criteria, idx) => (
                            <li key={idx}>{criteria}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {command.test_results && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Test Results</h4>
                        <p className="text-sm text-gray-600 mt-1">{command.test_results}</p>
                      </div>
                    )}

                    {command.issues_found && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Issues Found</h4>
                        <p className="text-sm text-red-600 mt-1">{command.issues_found}</p>
                      </div>
                    )}

                    {command.notes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Notes</h4>
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{command.notes}</p>
                      </div>
                    )}

                    {command.signed_off_by && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-gray-600">
                          Signed off by <span className="font-medium">{command.signed_off_by}</span> on{' '}
                          {new Date(command.signed_off_at!).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 pt-2">
                      Last updated: {new Date(command.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredCommands.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            No commands found matching your filters
          </div>
        )}
      </div>
    </div>
  );
}