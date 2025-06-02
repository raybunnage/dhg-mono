import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

interface ChartData {
  pipeline: string;
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  successRate: number;
}

export const PipelineUsageChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    loadChartData();
  }, [timeRange]);

  const loadChartData = async () => {
    try {
      setLoading(true);
      
      // Calculate time range
      let fromTime = null;
      if (timeRange !== 'all') {
        const now = new Date();
        fromTime = new Date();
        if (timeRange === '7d') {
          fromTime.setDate(now.getDate() - 7);
        } else if (timeRange === '30d') {
          fromTime.setDate(now.getDate() - 30);
        }
      }

      // Build query
      let query = supabase
        .from('command_tracking')
        .select('pipeline_name, status');
      
      if (fromTime) {
        query = query.gte('execution_time', fromTime.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aggregate data by pipeline
      const pipelineStats = new Map<string, { total: number; success: number; error: number }>();
      
      data?.forEach(record => {
        const stats = pipelineStats.get(record.pipeline_name) || { total: 0, success: 0, error: 0 };
        stats.total++;
        if (record.status === 'success') {
          stats.success++;
        } else if (record.status === 'error' || record.status === 'failed') {
          stats.error++;
        }
        pipelineStats.set(record.pipeline_name, stats);
      });

      // Convert to chart format
      const chartData: ChartData[] = Array.from(pipelineStats.entries())
        .map(([pipeline, stats]) => ({
          pipeline: pipeline.replace('_', ' ').replace('-', ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          totalExecutions: stats.total,
          successCount: stats.success,
          errorCount: stats.error,
          successRate: Math.round((stats.success / stats.total) * 100)
        }))
        .sort((a, b) => b.totalExecutions - a.totalExecutions)
        .slice(0, 10); // Top 10 pipelines

      setChartData(chartData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading chart data...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-green-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Pipeline Usage Overview</h3>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="text-sm border border-gray-300 rounded px-3 py-1"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>
      
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="pipeline" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                      <p className="font-semibold text-sm">{label}</p>
                      <p className="text-sm text-gray-600">Total: {data.totalExecutions}</p>
                      <p className="text-sm text-green-600">Success: {data.successCount}</p>
                      <p className="text-sm text-red-600">Errors: {data.errorCount}</p>
                      <p className="text-sm text-blue-600">Success Rate: {data.successRate}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar dataKey="successCount" fill="#10b981" name="Success" stackId="a" />
            <Bar dataKey="errorCount" fill="#ef4444" name="Errors" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {chartData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No execution data available for the selected time range
        </div>
      )}
    </div>
  );
};