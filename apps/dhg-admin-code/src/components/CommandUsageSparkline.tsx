import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UsageData {
  date: string;
  count: number;
}

interface CommandUsageSparklineProps {
  pipelineName: string;
  commandName: string;
  days?: number;
  height?: number;
  className?: string;
}

export const CommandUsageSparkline: React.FC<CommandUsageSparklineProps> = ({
  pipelineName,
  commandName,
  days = 7,
  height = 40,
  className = ''
}) => {
  const [data, setData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [max, setMax] = useState(0);

  useEffect(() => {
    loadUsageData();
  }, [pipelineName, commandName, days]);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Fetch usage data grouped by day
      const { data: usageData, error } = await supabase
        .from('command_tracking')
        .select('execution_time')
        .eq('pipeline_name', pipelineName)
        .eq('command_name', commandName)
        .gte('execution_time', startDate.toISOString())
        .lte('execution_time', endDate.toISOString());
      
      if (error) throw error;
      
      // Initialize all days with zero counts
      const dailyCounts = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyCounts.set(dateStr, 0);
      }
      
      // Count executions per day
      usageData?.forEach(record => {
        const dateStr = record.execution_time.split('T')[0];
        dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + 1);
      });
      
      // Convert to array and sort by date
      const sortedData = Array.from(dailyCounts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      const maxCount = Math.max(...sortedData.map(d => d.count), 1);
      
      setData(sortedData);
      setMax(maxCount);
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-xs text-gray-400">Loading...</div>
      </div>
    );
  }
  
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-xs text-gray-400">No data</div>
      </div>
    );
  }
  
  // Calculate bar width and spacing
  const barWidth = 100 / (data.length * 1.5); // 1.5 to add spacing
  const spacing = barWidth * 0.5;
  
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <svg
        width="100%"
        height={height}
        className="overflow-visible"
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
      >
        {/* Render bars */}
        {data.map((item, index) => {
          const barHeight = max > 0 ? (item.count / max) * (height - 4) : 0;
          const x = index * (barWidth + spacing);
          const y = height - barHeight - 2;
          
          return (
            <g key={item.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={item.count === 0 ? '#e5e7eb' : '#10b981'}
                opacity={item.count === 0 ? 0.3 : 0.8}
                rx="1"
              >
                <title>{`${item.date}: ${item.count} execution${item.count !== 1 ? 's' : ''}`}</title>
              </rect>
            </g>
          );
        })}
        
        {/* Zero line */}
        <line
          x1="0"
          y1={height - 2}
          x2="100"
          y2={height - 2}
          stroke="#e5e7eb"
          strokeWidth="0.5"
        />
      </svg>
      
      {/* Summary text */}
      <div className="absolute bottom-0 right-0 text-xs text-gray-500 bg-white px-1">
        {data.reduce((sum, d) => sum + d.count, 0)} total
      </div>
    </div>
  );
};