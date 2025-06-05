import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, Clock, AlertCircle, Archive, Package, TestTube } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';

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
  pipeline: string | null;
  test_criteria: string[];
  test_results: string | null;
  issues_found: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  notes: string | null;
  options: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

interface StatusSummary {
  command_type: string;
  current_status: string;
  pipeline: string | null;
  count: number;
}

interface CommandStats {
  pipeline_name: string;
  command_name: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  running_executions: number;
  avg_duration_ms: number | null;
  last_execution: string | null;
}

export function CommandRefactorStatus() {
  const [commands, setCommands] = useState<CommandRefactor[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);
  const [commandStats, setCommandStats] = useState<Record<string, CommandStats>>({});
  const [selectedPipeline, setSelectedPipeline] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [pipelines, setPipelines] = useState<string[]>([]);
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

      // Fetch command stats using the RPC function
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_command_stats');

      if (statsError) {
        console.error('Error fetching command stats:', statsError);
      } else {
        // Convert stats array to a map for easy lookup
        const statsMap: Record<string, CommandStats> = {};
        (statsData || []).forEach((stat: CommandStats) => {
          // Map command stats to command names from refactor tracking
          statsMap[stat.command_name] = stat;
        });
        setCommandStats(statsMap);
      }

      setCommands(commandsData || []);
      setStatusSummary(summaryData || []);
      
      // Extract unique pipelines from commands
      const uniquePipelines = [...new Set(
        (commandsData || [])
          .map(cmd => cmd.pipeline)
          .filter(p => p !== null)
      )] as string[];
      setPipelines(uniquePipelines.sort());
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
    // Initialize with all command types found in the data
    const totals: Record<string, number> = {};
    const completed: Record<string, number> = {};
    
    // Filter status summary by selected pipeline
    const filteredSummary = selectedPipeline === 'all' 
      ? statusSummary 
      : statusSummary.filter(item => item.pipeline === selectedPipeline);
    
    // Initialize counters for each command type
    filteredSummary.forEach(item => {
      if (!totals[item.command_type]) {
        totals[item.command_type] = 0;
        completed[item.command_type] = 0;
      }
    });

    filteredSummary.forEach(item => {
      totals[item.command_type] += item.count;
      
      // Count various completion statuses as "completed"
      const completedStatuses = ['signed_off', 'completed', 'tested'];
      const archivedStatuses = ['archived'];
      
      if (completedStatuses.includes(item.current_status)) {
        completed[item.command_type] += item.count;
      } else if (archivedStatuses.includes(item.current_status)) {
        // For archived commands, they could be considered "completed" in terms of being done
        completed[item.command_type] += item.count;
      }
    });

    // Calculate overall totals
    const totalCommands = Object.values(totals).reduce((sum, count) => sum + count, 0);
    const completedCommands = Object.values(completed).reduce((sum, count) => sum + count, 0);
    const progressPercent = totalCommands > 0 ? Math.round((completedCommands / totalCommands) * 100) : 0;

    // Return both the dynamic totals and the specific ones for the UI cards
    const specificTotals = { 
      existing: totals.existing || 0, 
      new: totals.new || 0, 
      to_archive: totals.to_archive || 0 
    };
    const specificCompleted = { 
      existing: completed.existing || 0, 
      new: completed.new || 0, 
      to_archive: completed.to_archive || 0 
    };

    return { 
      totals: specificTotals, 
      completed: specificCompleted, 
      progressPercent,
      allTotals: totals,
      allCompleted: completed
    };
  };

  // Calculate usage statistics
  const calculateUsageStats = () => {
    const commandsWithStats = commands.filter(cmd => commandStats[cmd.command_name]);
    const commandsWithoutStats = commands.filter(cmd => !commandStats[cmd.command_name]);
    const totalExecutions = Object.values(commandStats).reduce((sum, stat) => sum + stat.total_executions, 0);
    
    return {
      commandsWithStats: commandsWithStats.length,
      commandsWithoutStats: commandsWithoutStats.length,
      totalExecutions
    };
  };

  // Filter commands
  const filteredCommands = commands.filter(cmd => {
    if (selectedPipeline !== 'all' && cmd.pipeline !== selectedPipeline) return false;
    if (selectedType !== 'all' && cmd.command_type !== selectedType) return false;
    if (selectedStatus !== 'all' && cmd.current_status !== selectedStatus) return false;
    return true;
  });

  const { totals, completed, progressPercent } = calculateProgress();
  const usageStats = calculateUsageStats();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Progress Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedPipeline !== 'all' 
              ? `${selectedPipeline} Pipeline Progress` 
              : 'Overall Progress'}
          </h2>
          
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

        {/* Usage Statistics Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{usageStats.totalExecutions}</div>
              <div className="text-sm text-gray-600">Total Command Executions</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{usageStats.commandsWithStats}</div>
              <div className="text-sm text-gray-600">Commands with Usage Data</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-600">{usageStats.commandsWithoutStats}</div>
              <div className="text-sm text-gray-600">Commands Never Used</div>
              {usageStats.commandsWithoutStats > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  May be new or not yet integrated
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pipeline
              </label>
              <select
                value={selectedPipeline}
                onChange={(e) => setSelectedPipeline(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Pipelines</option>
                {pipelines.map(pipeline => (
                  <option key={pipeline} value={pipeline}>
                    {pipeline}
                  </option>
                ))}
              </select>
            </div>

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
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(command.current_status)}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{command.command_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {command.pipeline && (
                            <span className="text-sm text-blue-600 font-medium">
                              {command.pipeline}
                            </span>
                          )}
                          <span className="text-sm text-gray-500">
                            {getTypeIcon(command.command_type)} {command.command_type}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(command.current_status)}`}>
                            {command.current_status.replace('_', ' ')}
                          </span>
                          {commandStats[command.command_name] && (
                            <span className="text-xs text-gray-500">
                              • {commandStats[command.command_name].total_executions} executions
                            </span>
                          )}
                        </div>
                        {command.description && (
                          <p className="text-sm text-gray-600 mt-1" style={{ 
                            display: '-webkit-box', 
                            WebkitLineClamp: 2, 
                            WebkitBoxOrient: 'vertical', 
                            overflow: 'hidden' 
                          }}>
                            {command.description}
                          </p>
                        )}
                        {command.options && Object.keys(command.options).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.keys(command.options).slice(0, 4).map((option) => (
                              <span 
                                key={option}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                                title={command.options![option]}
                              >
                                {option}
                              </span>
                            ))}
                            {Object.keys(command.options).length > 4 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                                +{Object.keys(command.options).length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Package className={`h-5 w-5 text-gray-400 transform transition-transform flex-shrink-0 ml-4 ${expandedCommands.has(command.id) ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {expandedCommands.has(command.id) && (
                <div className="px-4 pb-4 border-t">
                  <div className="pt-4 space-y-3">
                    {commandStats[command.command_name] && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Usage Statistics</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Total Executions:</span>
                            <p className="font-medium">{commandStats[command.command_name].total_executions}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Success Rate:</span>
                            <p className="font-medium text-green-600">
                              {commandStats[command.command_name].total_executions > 0
                                ? Math.round((commandStats[command.command_name].successful_executions / commandStats[command.command_name].total_executions) * 100)
                                : 0}%
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Avg Duration:</span>
                            <p className="font-medium">
                              {commandStats[command.command_name].avg_duration_ms !== null
                                ? `${Math.round(commandStats[command.command_name].avg_duration_ms!)}ms`
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Used:</span>
                            <p className="font-medium">
                              {commandStats[command.command_name].last_execution
                                ? new Date(commandStats[command.command_name].last_execution!).toLocaleDateString()
                                : 'Never'}
                            </p>
                          </div>
                        </div>
                        {commandStats[command.command_name].failed_executions > 0 && (
                          <div className="mt-2 text-sm">
                            <span className="text-red-600">
                              {commandStats[command.command_name].failed_executions} failed execution(s)
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {command.options && Object.keys(command.options).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Command Options</h4>
                        <div className="space-y-1">
                          {Object.entries(command.options).map(([option, description]) => (
                            <div key={option} className="flex items-start text-sm">
                              <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800 font-mono text-xs mr-2 flex-shrink-0">
                                {option}
                              </code>
                              <span className="text-gray-600">{description}</span>
                            </div>
                          ))}
                        </div>
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
    </DashboardLayout>
  );
}