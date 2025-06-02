import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { CLIRegistryService } from '@shared/services/cli-registry-service';
import { DashboardLayout } from '../components/DashboardLayout';
import { CommandExecutionModal } from '../components/CommandExecutionModal';
import { PipelineUsageChart } from '../components/PipelineUsageChart';
import { ErrorAnalysis } from '../components/ErrorAnalysis';
import { CommandUsageIndicator } from '../components/CommandUsageIndicator';
import { CommandUsageTimeline } from '../components/CommandUsageTimeline';
import type { 
  CommandPipeline, 
  CommandDefinition, 
  CommandCategory,
  PipelineStatistics 
} from '@shared/services/cli-registry-service';

interface PipelineTableData {
  id: string;
  pipeline_id: string;
  table_name: string;
  operation_type: string | null;
  description?: string;
  created_at: string | null;
}

interface RawPipelineData {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category_id?: string;
  script_path: string;
  status: 'active' | 'deprecated' | 'maintenance';
  documentation_url?: string;
  last_scanned_at?: string;
  created_at: string;
  updated_at: string;
}

interface CommandUsageData {
  pipeline_name: string;
  command_name: string;
  execution_count: number;
  last_executed: string | null;
  success_count: number;
  failure_count: number;
}

export const CLICommandsRegistry: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CommandCategory[]>([]);
  const [pipelines, setPipelines] = useState<CommandPipeline[]>([]);
  const [rawPipelines, setRawPipelines] = useState<RawPipelineData[]>([]);
  const [pipelineTables, setPipelineTables] = useState<PipelineTableData[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<CommandPipeline | null>(null);
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [statistics, setStatistics] = useState<PipelineStatistics[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pipelines' | 'commands' | 'statistics' | 'raw-data'>('pipelines');
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [commandUsage, setCommandUsage] = useState<Map<string, CommandUsageData>>(new Map());
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('name');
  const [executionModalOpen, setExecutionModalOpen] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<{ pipeline: string; command: string } | null>(null);
  const [usageFilter, setUsageFilter] = useState<'all' | 'high' | 'low' | 'unused'>('all');

  const registryService = new CLIRegistryService(supabase);

  useEffect(() => {
    console.log('🚀 Component mounted, loading data...');
    loadData();
    loadCommandUsage(); // Load usage data on component mount
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel, including raw table data
      const [categoriesData, pipelinesData, statsData, rawPipelinesData, pipelineTablesData] = await Promise.all([
        registryService.getCategories().catch(() => []),
        registryService.getPipelines().catch(() => []),
        registryService.getPipelineStatistics().catch(() => []),
        // Load raw data directly from tables
        supabase.from('command_pipelines').select('*').order('display_name'),
        supabase.from('command_pipeline_tables').select('*').order('table_name')
      ]);
      
      setCategories(categoriesData);
      setPipelines(pipelinesData);
      setStatistics(statsData);
      
      // Set raw data
      if (rawPipelinesData.data) {
        setRawPipelines(rawPipelinesData.data);
        
        // Extract unique statuses from pipelines
        const pipelineStatuses = [...new Set(rawPipelinesData.data
          .map(p => p.status)
          .filter(Boolean))] as string[];
        
        // Also check command statuses
        const { data: commandStatuses } = await supabase
          .from('command_definitions')
          .select('status')
          .not('status', 'is', null);
        
        const cmdStatuses = [...new Set(commandStatuses?.map(c => c.status) || [])] as string[];
        
        // Combine and deduplicate all statuses
        const allStatuses = [...new Set([...pipelineStatuses, ...cmdStatuses])].sort();
        setAvailableStatuses(allStatuses);
      }
      if (pipelineTablesData.data) {
        setPipelineTables(pipelineTablesData.data);
      }
      
      console.log('Loaded data:', {
        categories: categoriesData.length,
        pipelines: pipelinesData.length,
        rawPipelines: rawPipelinesData.data?.length || 0,
        pipelineTables: pipelineTablesData.data?.length || 0,
        statuses: availableStatuses.length
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommandUsage = async () => {
    console.log('🔄 loadCommandUsage() called');
    try {
      // Use the new aggregation function for efficient data loading
      const { data: usageData, error } = await supabase
        .rpc('get_command_usage_stats');
      
      console.log('📊 Query result:', { 
        hasData: !!usageData, 
        recordCount: usageData?.length || 0,
        error: error 
      });
      
      if (usageData && usageData.length > 0) {
        console.log('📊 First few records:', usageData.slice(0, 3));
        
        // Check specifically for database records
        const databaseRecords = usageData.filter(r => r.pipeline_name === 'database');
        console.log(`📊 Database records found: ${databaseRecords.length}`);
        if (databaseRecords.length > 0) {
          console.log('📊 Sample database records:', databaseRecords.slice(0, 3));
        }
      }
      
      if (error) throw error;
      
      // Convert the aggregated data to our usage map format
      const usageMap = new Map<string, CommandUsageData>();
      
      usageData?.forEach(record => {
        const key = `${record.pipeline_name}:${record.command_name}`;
        
        // The RPC function already aggregated the data
        const usage: CommandUsageData = {
          pipeline_name: record.pipeline_name,
          command_name: record.command_name,
          execution_count: Number(record.execution_count) || 0,
          last_executed: record.last_executed,
          success_count: Number(record.success_count) || 0,
          failure_count: Number(record.failure_count) || 0
        };
        
        usageMap.set(key, usage);
        
        // Also handle compound command names (e.g., "migration-run-staged" -> "run-staged")
        // This handles the case where subcommands are tracked with prefixes
        const commandPrefixes = ['migration-', 'backup-', 'auth-', 'table-'];
        
        for (const prefix of commandPrefixes) {
          if (record.command_name.startsWith(prefix)) {
            // Extract the subcommand part after the prefix
            const subcommand = record.command_name.substring(prefix.length);
            const subcommandKey = `${record.pipeline_name}:${subcommand}`;
            
            // Create a copy for the subcommand
            const subcommandUsage: CommandUsageData = {
              ...usage,
              command_name: subcommand
            };
            
            usageMap.set(subcommandKey, subcommandUsage);
            break; // Only process the first matching prefix
          }
        }
      });
      
      // Log summary of loaded data
      console.log(`✅ Processed usage data:`, {
        totalRecords: usageData?.length || 0,
        uniqueCommands: usageMap.size,
        sampleKeys: Array.from(usageMap.keys()).slice(0, 5),
        databaseKeys: Array.from(usageMap.keys()).filter(k => k.startsWith('database:')),
        allKeys: Array.from(usageMap.keys())
      });
      
      setCommandUsage(usageMap);
      console.log('✅ commandUsage state updated');
    } catch (error) {
      console.error('❌ Error loading command usage:', error);
    }
  };

  const loadPipelineCommands = async (pipeline: CommandPipeline) => {
    try {
      console.log('📌 Selected pipeline:', {
        name: pipeline.name,
        display_name: pipeline.display_name,
        id: pipeline.id
      });
      
      setSelectedPipeline(pipeline);
      const commandsData = await registryService.getCommandsForPipeline(pipeline.id);
      setCommands(commandsData);
      setActiveTab('commands');
      
      // Load usage data if not already loaded
      if (commandUsage.size === 0) {
        await loadCommandUsage();
      }
    } catch (error) {
      console.error('Error loading commands:', error);
    }
  };

  const filteredPipelines = pipelines.filter(pipeline => {
    const matchesSearch = searchTerm === '' || 
      pipeline.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === '' || 
      (selectedCategory === 'uncategorized' ? !pipeline.category_id : pipeline.category_id === selectedCategory);
    const matchesStatus = selectedStatus === '' || 
      (selectedStatus === 'null' ? !pipeline.status : pipeline.status === selectedStatus);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredRawPipelines = rawPipelines.filter(pipeline => {
    const matchesSearch = searchTerm === '' || 
      pipeline.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === '' || 
      (selectedCategory === 'uncategorized' ? !pipeline.category_id : pipeline.category_id === selectedCategory);
    const matchesStatus = selectedStatus === '' || 
      (selectedStatus === 'null' ? !pipeline.status : pipeline.status === selectedStatus);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getTablesForPipeline = (pipelineId: string) => {
    return pipelineTables.filter(table => table.pipeline_id === pipelineId);
  };

  const getCategoryColor = (category?: CommandCategory) => {
    return category?.color || '#6B7280';
  };

  const getCategoryIcon = (category?: CommandCategory) => {
    const icons: { [key: string]: string } = {
      sync: '🔄',
      document: '📄',
      database: '🗄️',
      shield: '🛡️',
      chart: '📊',
      code: '💻',
      video: '🎥',
      brain: '🧠'
    };
    return icons[category?.icon || ''] || '📦';
  };

  const getRelativeTime = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 30) return date.toLocaleDateString();
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      deprecated: 'bg-red-100 text-red-800',
      maintenance: 'bg-yellow-100 text-yellow-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  const openExecutionModal = (pipelineName: string, commandName: string) => {
    console.log('Opening execution modal with:', { pipelineName, commandName });
    setSelectedCommand({ pipeline: pipelineName, command: commandName });
    setExecutionModalOpen(true);
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-700">You need admin privileges to access this area.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-900 mb-2">CLI Commands Registry</h1>
          <p className="text-green-700">Manage and view CLI pipeline commands and configurations</p>
        </div>
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search pipelines or commands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            {/* Debug: Test data button - always show for debugging */}
            <button
                onClick={() => {
                  // Create fake usage data for testing
                  const fakeUsage = new Map<string, CommandUsageData>();
                  
                  // Add some fake data including migration-run-staged
                  fakeUsage.set('database:migration-run-staged', {
                    pipeline_name: 'database',
                    command_name: 'migration-run-staged',
                    execution_count: 45,
                    last_executed: new Date().toISOString(),
                    success_count: 43,
                    failure_count: 2
                  });
                  
                  fakeUsage.set('database:list-tables', {
                    pipeline_name: 'database',
                    command_name: 'list-tables',
                    execution_count: 25,
                    last_executed: new Date().toISOString(),
                    success_count: 24,
                    failure_count: 1
                  });
                  
                  fakeUsage.set('database:check-tables', {
                    pipeline_name: 'database',
                    command_name: 'check-tables',
                    execution_count: 5,
                    last_executed: new Date(Date.now() - 86400000).toISOString(),
                    success_count: 5,
                    failure_count: 0
                  });
                  
                  fakeUsage.set('database:backup', {
                    pipeline_name: 'database',
                    command_name: 'backup',
                    execution_count: 0,
                    last_executed: null,
                    success_count: 0,
                    failure_count: 0
                  });
                  
                  // Process the fake data through our normalization logic
                  const processedUsage = new Map<string, CommandUsageData>();
                  fakeUsage.forEach((data, key) => {
                    processedUsage.set(key, data);
                    
                    // Apply the same prefix handling as loadCommandUsage
                    const commandPrefixes = ['migration-', 'backup-', 'auth-', 'table-'];
                    for (const prefix of commandPrefixes) {
                      if (data.command_name.startsWith(prefix)) {
                        const subcommand = data.command_name.substring(prefix.length);
                        const subcommandKey = `${data.pipeline_name}:${subcommand}`;
                        processedUsage.set(subcommandKey, {
                          ...data,
                          command_name: subcommand
                        });
                        break;
                      }
                    }
                  });
                  
                  setCommandUsage(processedUsage);
                  console.log('Loaded test data:', processedUsage);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Load Test Data
              </button>
            
            {/* Reload Usage Data */}
            <button
              onClick={async () => {
                console.log('🔄 Manually reloading usage data...');
                await loadCommandUsage();
                console.log('✅ Usage data reloaded');
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Reload Usage Data
            </button>
            
            {/* Debug: Test Query */}
            <button
              onClick={async () => {
                console.log('🔍 Testing command_tracking query...');
                try {
                  // First, check if table exists and has data
                  const { count, error: countError } = await supabase
                    .from('command_tracking')
                    .select('*', { count: 'exact', head: true });
                  
                  console.log('Count query result:', { count, error: countError });
                  
                  // Get a sample of data
                  const { data, error } = await supabase
                    .from('command_tracking')
                    .select('*')
                    .limit(5);
                    
                  console.log('Sample data query:', { 
                    success: !error,
                    error,
                    data,
                    dataLength: data?.length 
                  });
                  
                  if (data && data.length > 0) {
                    console.log('First record:', data[0]);
                    
                    // Show all unique pipeline names
                    const uniquePipelines = [...new Set(data.map(d => d.pipeline_name))];
                    console.log('Unique pipelines in sample:', uniquePipelines);
                  }
                  
                  // Get all unique pipelines in the table
                  const { data: allPipelines } = await supabase
                    .from('command_tracking')
                    .select('pipeline_name')
                    .order('pipeline_name');
                    
                  if (allPipelines) {
                    const uniqueAllPipelines = [...new Set(allPipelines.map(p => p.pipeline_name))];
                    console.log('All unique pipelines in table:', uniqueAllPipelines);
                    
                    // Count by pipeline
                    const pipelineCounts = uniqueAllPipelines.map(pipeline => {
                      const count = allPipelines.filter(p => p.pipeline_name === pipeline).length;
                      return { pipeline, count };
                    });
                    console.log('Records per pipeline:', pipelineCounts);
                  }
                  
                  // Specifically check for database commands
                  console.log('\n🔍 Checking specifically for database commands...');
                  const { data: dbCommands } = await supabase
                    .from('command_tracking')
                    .select('pipeline_name, command_name, execution_time')
                    .eq('pipeline_name', 'database')
                    .order('execution_time', { ascending: false })
                    .limit(10);
                    
                  console.log('Database pipeline commands:', dbCommands?.length || 0);
                  if (dbCommands && dbCommands.length > 0) {
                    console.log('Recent database commands:', dbCommands.slice(0, 5));
                  }
                  
                  // Check if there are any commands with database-like names
                  const { data: dbLikeCommands } = await supabase
                    .from('command_tracking')
                    .select('pipeline_name, command_name, execution_time')
                    .or('command_name.ilike.%table%,command_name.ilike.%migration%,command_name.ilike.%backup%')
                    .order('execution_time', { ascending: false })
                    .limit(20);
                    
                  if (dbLikeCommands && dbLikeCommands.length > 0) {
                    console.log('\n🔍 Commands that look like database commands:');
                    dbLikeCommands.forEach(cmd => {
                      console.log(`  - ${cmd.pipeline_name}:${cmd.command_name} (${new Date(cmd.execution_time).toLocaleDateString()})`);
                    });
                  }
                } catch (err) {
                  console.error('Test query error:', err);
                }
              }}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Test Query
            </button>
            
            {/* Debug: Inspect current data */}
            <button
              onClick={() => {
                console.log('=== Current Command Usage Data ===');
                console.log('Button clicked!');
                console.log('Total entries:', commandUsage.size);
                
                if (commandUsage.size === 0) {
                  console.log('⚠️ commandUsage is EMPTY!');
                  console.log('This means loadCommandUsage() either:');
                  console.log('1. Was never called');
                  console.log('2. Found no data in command_tracking table');
                  console.log('3. Had an error that was silently caught');
                  return;
                }
                
                // Group by pipeline
                const byPipeline = new Map<string, any[]>();
                commandUsage.forEach((usage, key) => {
                  const [pipeline, command] = key.split(':');
                  if (!byPipeline.has(pipeline)) {
                    byPipeline.set(pipeline, []);
                  }
                  byPipeline.get(pipeline)!.push({
                    key,
                    command,
                    count: usage.execution_count,
                    lastUsed: usage.last_executed
                  });
                });
                
                // Log each pipeline's data
                byPipeline.forEach((commands, pipeline) => {
                  console.log(`\nPipeline: ${pipeline} (${commands.length} commands)`);
                  commands
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
                    .forEach(cmd => {
                      console.log(`  - ${cmd.command}: ${cmd.count} uses`);
                    });
                });
                
                // Show high volume commands
                const highVolume = Array.from(commandUsage.entries())
                  .filter(([_, usage]) => usage.execution_count >= 10)
                  .map(([key, usage]) => ({ key, count: usage.execution_count }))
                  .sort((a, b) => b.count - a.count);
                
                console.log('\nHigh volume commands (10+ uses):', highVolume.length);
                highVolume.slice(0, 10).forEach(cmd => {
                  console.log(`  - ${cmd.key}: ${cmd.count} uses`);
                });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Inspect Usage Data
            </button>
          </div>
          
          <div className="flex gap-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {getCategoryIcon(cat)} {cat.name}
                </option>
              ))}
              <option value="uncategorized">❓ Uncategorized</option>
            </select>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              {availableStatuses.map(status => (
                <option key={status} value={status}>
                  {status === 'active' && '✅ '}
                  {status === 'deprecated' && '❌ '}
                  {status === 'maintenance' && '🔧 '}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
              <option value="null">❔ No Status</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-green-200">
          <nav className="-mb-px flex gap-8">
            <button
              onClick={() => setActiveTab('pipelines')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pipelines'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pipelines ({pipelines.length})
            </button>
            <button
              onClick={() => setActiveTab('commands')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'commands'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Commands {selectedPipeline && `(${commands.length})`}
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'statistics'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('raw-data')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'raw-data'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Raw Data ({rawPipelines.length} pipelines, {pipelineTables.length} tables)
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <>
            {/* Pipelines Tab */}
            {activeTab === 'pipelines' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPipelines.map(pipeline => (
                  <div
                    key={pipeline.id}
                    onClick={() => loadPipelineCommands(pipeline)}
                    className="bg-white p-6 rounded-lg shadow-sm border border-green-200 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getCategoryIcon(pipeline.category)}</span>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {pipeline.display_name}
                        </h3>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(pipeline.status)}`}>
                        {pipeline.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{pipeline.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>📂 {pipeline.name}</span>
                      {pipeline.category && (
                        <span
                          className="px-2 py-1 rounded"
                          style={{ 
                            backgroundColor: `${getCategoryColor(pipeline.category)}20`,
                            color: getCategoryColor(pipeline.category)
                          }}
                        >
                          {pipeline.category.name}
                        </span>
                      )}
                    </div>
                    {pipeline.last_scanned_at && (
                      <div className="mt-2 text-xs text-gray-400">
                        Last scanned: {new Date(pipeline.last_scanned_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Commands Tab */}
            {activeTab === 'commands' && selectedPipeline && (
              <div>
                <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-green-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedPipeline.display_name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{selectedPipeline.description}</p>
                  <div className="text-xs text-gray-500 font-mono bg-green-50 p-2 rounded">
                    {selectedPipeline.script_path}
                  </div>
                </div>

                {/* Debug: Show keys for current pipeline */}
                <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => {
                      console.log('=== Keys for current pipeline ===');
                      console.log('Pipeline:', selectedPipeline.name);
                      
                      const pipelineKeys = Array.from(commandUsage.keys()).filter(key => {
                        const [pipeline] = key.split(':');
                        return pipeline === selectedPipeline.name || 
                               pipeline === selectedPipeline.name.replace(/-/g, '_') ||
                               pipeline === selectedPipeline.name.replace(/_/g, '-');
                      });
                      
                      console.log(`Found ${pipelineKeys.length} keys for this pipeline:`, pipelineKeys);
                      
                      // Also show ALL keys in commandUsage to see what we have
                      console.log('ALL keys in commandUsage:', Array.from(commandUsage.keys()));
                      
                      // Show command names from registry vs tracking
                      const registryCommands = commands.map(c => c.command_name).sort();
                      const trackingCommands = pipelineKeys.map(k => k.split(':')[1]).sort();
                      
                      console.log('Commands in registry:', registryCommands);
                      console.log('Commands in tracking:', trackingCommands);
                      
                      // Find mismatches
                      const inRegistryNotTracking = registryCommands.filter(c => !trackingCommands.includes(c));
                      const inTrackingNotRegistry = trackingCommands.filter(c => !registryCommands.includes(c));
                      
                      console.log('In registry but not tracking:', inRegistryNotTracking);
                      console.log('In tracking but not registry:', inTrackingNotRegistry);
                    }}
                    className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Debug Pipeline Keys
                  </button>
                </div>

                {/* Sort and Filter Options */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'usage' | 'recent')}
                      className="px-3 py-1 border border-green-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="name">Name</option>
                      <option value="usage">Most Used</option>
                      <option value="recent">Recently Used</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Show:</label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setUsageFilter('all')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          usageFilter === 'all' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setUsageFilter('high')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          usageFilter === 'high' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        High Volume
                      </button>
                      <button
                        onClick={() => setUsageFilter('low')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          usageFilter === 'low' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Low Volume
                      </button>
                      <button
                        onClick={() => setUsageFilter('unused')}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          usageFilter === 'unused' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Never Used
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {commands.length > 0 ? (
                    (() => {
                      // Debug: Log filter state
                      console.log('=== Filter Debug Info ===');
                      console.log('Current filter:', usageFilter);
                      console.log('Selected pipeline:', selectedPipeline?.name);
                      console.log('Total commands:', commands.length);
                      console.log('Command usage map size:', commandUsage.size);
                      
                      // Show what's in the usage map
                      const usageStats = {
                        total: commandUsage.size,
                        withData: 0,
                        high: 0,
                        low: 0,
                        unused: 0
                      };
                      
                      commandUsage.forEach((usage) => {
                        if (usage.execution_count > 0) usageStats.withData++;
                        if (usage.execution_count >= 10) usageStats.high++;
                        else if (usage.execution_count > 0 && usage.execution_count < 10) usageStats.low++;
                        else if (usage.execution_count === 0) usageStats.unused++;
                      });
                      
                      console.log('Usage statistics:', usageStats);
                      
                      const filteredCommands = commands
                      .filter(command => !command.is_hidden)
                      .map(command => {
                        // Try multiple key variations to handle underscore/hyphen differences
                        const pipelineName = selectedPipeline.name;
                        const commandName = command.command_name;
                        const keys = [
                          `${pipelineName}:${commandName}`,
                          `${pipelineName.replace(/-/g, '_')}:${commandName}`,
                          `${pipelineName.replace(/_/g, '-')}:${commandName}`,
                          // Also try command name variations
                          `${pipelineName}:${commandName.replace(/-/g, '_')}`,
                          `${pipelineName.replace(/-/g, '_')}:${commandName.replace(/-/g, '_')}`
                        ];
                        
                        let usage = null;
                        let matchedKey = null;
                        for (const key of keys) {
                          usage = commandUsage.get(key);
                          if (usage) {
                            matchedKey = key;
                            break;
                          }
                        }
                        
                        // Debug first few commands
                        if (commands.indexOf(command) < 3) {
                          console.log(`🔍 Looking up ${commandName}:`, {
                            pipeline: pipelineName,
                            triedKeys: keys,
                            found: !!usage,
                            matchedKey,
                            availableKeys: Array.from(commandUsage.keys()).filter(k => k.includes(commandName))
                          });
                        }
                        
                        return { command, usage };
                      })
                      .filter(({ usage, command }) => {
                        // Apply usage filter
                        const count = usage?.execution_count || 0;
                        
                        // More detailed debugging
                        const debugInfo: any = {
                          command: command.command_name,
                          hasUsage: !!usage,
                          count: count,
                          filter: usageFilter
                        };
                        
                        let shouldInclude = false;
                        
                        switch (usageFilter) {
                          case 'all':
                            shouldInclude = true;
                            debugInfo.reason = 'showing all';
                            break;
                          case 'unused':
                            shouldInclude = count === 0;
                            debugInfo.reason = `count === 0? ${count === 0}`;
                            break;
                          case 'high':
                            shouldInclude = count >= 10;
                            debugInfo.reason = `count >= 10? ${count >= 10}`;
                            break;
                          case 'low':
                            shouldInclude = count > 0 && count < 10;
                            debugInfo.reason = `0 < count < 10? ${count > 0 && count < 10}`;
                            break;
                          default:
                            shouldInclude = true;
                        }
                        
                        debugInfo.included = shouldInclude;
                        
                        // Log first few for debugging
                        if (commands.indexOf(command) < 5 || (shouldInclude && usageFilter !== 'all')) {
                          console.log('Filter decision:', debugInfo);
                        }
                        
                        return shouldInclude;
                      })
                      .sort((a, b) => {
                        if (sortBy === 'usage') {
                          return (b.usage?.execution_count || 0) - (a.usage?.execution_count || 0);
                        } else if (sortBy === 'recent') {
                          const aTime = a.usage?.last_executed || '0';
                          const bTime = b.usage?.last_executed || '0';
                          return bTime.localeCompare(aTime);
                        }
                        return a.command.command_name.localeCompare(b.command.command_name);
                      })
                      
                      // Debug: Log final results
                      console.log('=== Final Results ===');
                      console.log('Filtered commands count:', filteredCommands.length);
                      
                      // Check the actual distribution before filtering
                      const beforeFilter = commands
                        .filter(command => !command.is_hidden)
                        .map(command => {
                          // Try multiple key variations
                          const pipelineName = selectedPipeline.name;
                          const keys = [
                            `${pipelineName}:${command.command_name}`,
                            `${pipelineName.replace(/-/g, '_')}:${command.command_name}`,
                            `${pipelineName.replace(/_/g, '-')}:${command.command_name}`
                          ];
                          
                          let usage = null;
                          for (const key of keys) {
                            usage = commandUsage.get(key);
                            if (usage) break;
                          }
                          return { command, usage };
                        });
                      
                      console.log('Before filter distribution:', {
                        total: beforeFilter.length,
                        unused: beforeFilter.filter(({usage}) => !usage || usage.execution_count === 0).length,
                        low: beforeFilter.filter(({usage}) => usage && usage.execution_count > 0 && usage.execution_count < 10).length,
                        high: beforeFilter.filter(({usage}) => usage && usage.execution_count >= 10).length
                      });
                      
                      console.log('After filter distribution:', {
                        unused: filteredCommands.filter(({usage}) => !usage || usage.execution_count === 0).length,
                        low: filteredCommands.filter(({usage}) => usage && usage.execution_count > 0 && usage.execution_count < 10).length,
                        high: filteredCommands.filter(({usage}) => usage && usage.execution_count >= 10).length
                      });
                      
                      return (
                        <>
                          {/* Show filter status */}
                          {usageFilter !== 'all' && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-700">
                                Showing {filteredCommands.length} of {commands.filter(c => !c.is_hidden).length} commands 
                                {usageFilter === 'high' && ' with high usage (10+ executions)'}
                                {usageFilter === 'low' && ' with low usage (1-9 executions)'}
                                {usageFilter === 'unused' && ' that have never been used'}
                              </p>
                            </div>
                          )}
                          
                          {/* Show warning if no tracking data */}
                          {commandUsage.size === 0 && (
                            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <p className="text-sm text-yellow-700">
                                ⚠️ No command tracking data available. Commands will appear as "Never Used" until tracking data is collected.
                                Run commands through the CLI to start collecting usage data.
                              </p>
                            </div>
                          )}
                          {filteredCommands.map(({ command, usage }) => (
                      <div
                        key={command.id}
                        className={`bg-white p-4 rounded-lg shadow-sm border ${
                          command.status === 'deprecated' ? 'border-red-200 opacity-75' : 'border-green-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-md font-semibold text-gray-900 font-mono">
                                {command.command_name}
                              </h4>
                              {command.status && command.status !== 'active' && (
                                <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(command.status)}`}>
                                  {command.status}
                                </span>
                              )}
                            </div>
                            {/* Usage Indicator and Timeline */}
                            <div className="mb-3 space-y-2">
                              <CommandUsageIndicator
                                executionCount={usage?.execution_count || 0}
                                lastExecuted={usage?.last_executed || null}
                                successRate={usage && usage.execution_count > 0 
                                  ? Math.round((usage.success_count / usage.execution_count) * 100) 
                                  : 0}
                                className="mb-2"
                              />
                              <CommandUsageTimeline
                                pipelineName={selectedPipeline.name}
                                commandName={command.command_name}
                                days={45}
                                className="mt-1"
                              />
                            </div>
                            {command.description && (
                              <p className="text-sm text-gray-600 mt-1">{command.description}</p>
                            )}
                            {command.usage_pattern && (
                              <div className="mt-2 text-xs text-gray-500 font-mono bg-green-50 p-2 rounded">
                                Usage: {command.usage_pattern}
                              </div>
                            )}
                            {command.example_usage && (
                              <div className="mt-2 text-xs text-gray-500 font-mono bg-green-50 p-2 rounded">
                                Example: {command.example_usage}
                              </div>
                            )}
                            {command.deprecated_at && (
                              <div className="mt-2 text-xs text-red-600">
                                Deprecated: {new Date(command.deprecated_at).toLocaleDateString()}
                              </div>
                            )}
                            {command.last_verified_at && (
                              <div className="mt-1 text-xs text-gray-400">
                                Last verified: {new Date(command.last_verified_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => openExecutionModal(selectedPipeline.name, command.command_name)}
                              className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                            >
                              View History
                            </button>
                            {command.requires_auth && (
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                Auth
                              </span>
                            )}
                            {command.requires_google_api && (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                Google API
                              </span>
                            )}
                            {command.is_dangerous && (
                              <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
                                ⚠️ Dangerous
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                        </>
                      );
                    })()
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No commands found for this pipeline
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === 'statistics' && (
              <div className="space-y-6">
                {/* Usage Chart */}
                <PipelineUsageChart />
                
                {/* Error Analysis */}
                <ErrorAnalysis />
                
                {/* Statistics Table */}
                <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden">
                  <table className="min-w-full">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Pipeline
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Active Commands
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Deprecated
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Tables Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Executions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Last Used
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-green-100">
                    {statistics.map((stat: any) => (
                      <tr key={stat.pipeline_id} className="hover:bg-green-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {stat.pipeline_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.active_commands || stat.total_commands}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.deprecated_commands || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.tables_accessed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.total_executions}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getRelativeTime(stat.last_used)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Raw Data Tab */}
            {activeTab === 'raw-data' && (
              <div className="space-y-8">
                {/* Raw Pipelines */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Command Pipelines Table ({filteredRawPipelines.length})</h3>
                  <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Display Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Script Path</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Tables</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Last Scanned</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-100">
                          {filteredRawPipelines.map((pipeline) => {
                            const tables = getTablesForPipeline(pipeline.id);
                            return (
                              <tr key={pipeline.id} className="hover:bg-green-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{pipeline.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pipeline.display_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(pipeline.status)}`}>
                                    {pipeline.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono text-gray-600">{pipeline.script_path}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {tables.length > 0 ? `${tables.length} tables` : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {pipeline.last_scanned_at ? new Date(pipeline.last_scanned_at).toLocaleDateString() : 'Never'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Pipeline Tables */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Command Pipeline Tables ({pipelineTables.length})</h3>
                  <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Table Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Pipeline</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Access Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Description</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-100">
                          {pipelineTables.map((table) => {
                            const pipeline = rawPipelines.find(p => p.id === table.pipeline_id);
                            return (
                              <tr key={table.id} className="hover:bg-green-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{table.table_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {pipeline?.display_name || 'Unknown'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    table.operation_type === 'read' ? 'bg-blue-100 text-blue-800' :
                                    table.operation_type === 'write' ? 'bg-yellow-100 text-yellow-800' :
                                    table.operation_type === 'both' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {table.operation_type || 'unknown'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{table.description || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Execution History Modal */}
      {selectedCommand && (
        <CommandExecutionModal
          isOpen={executionModalOpen}
          onClose={() => setExecutionModalOpen(false)}
          pipelineName={selectedCommand.pipeline}
          commandName={selectedCommand.command}
        />
      )}
    </DashboardLayout>
  );
};