import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface TimelineData {
  date: string;
  hasActivity: boolean;
  count: number;
}

interface CommandUsageTimelineProps {
  pipelineName: string;
  commandName: string;
  days?: number;
  className?: string;
}

export const CommandUsageTimeline: React.FC<CommandUsageTimelineProps> = ({
  pipelineName,
  commandName,
  days = 14,
  className = ''
}) => {
  const [data, setData] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadTimelineData();
  }, [pipelineName, commandName, days]);

  const loadTimelineData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Fetch usage data
      const { data: usageData, error } = await supabase
        .from('command_tracking')
        .select('execution_time')
        .eq('pipeline_name', pipelineName)
        .eq('command_name', commandName)
        .gte('execution_time', startDate.toISOString())
        .lte('execution_time', endDate.toISOString());
      
      if (error) throw error;
      
      // Initialize timeline data
      const timeline: TimelineData[] = [];
      const dailyCounts = new Map<string, number>();
      
      // Count executions per day
      usageData?.forEach(record => {
        const dateStr = record.execution_time.split('T')[0];
        dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + 1);
      });
      
      // Create timeline for last N days
      let total = 0;
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = dailyCounts.get(dateStr) || 0;
        total += count;
        
        timeline.push({
          date: dateStr,
          hasActivity: count > 0,
          count
        });
      }
      
      setData(timeline);
      setTotalCount(total);
    } catch (error) {
      console.error('Error loading timeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={`text-xs text-gray-400 ${className}`}>...</div>;
  }

  // Group data by weeks for compact display
  const weeks: TimelineData[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7));
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex gap-0.5">
        {data.map((day) => (
          <div
            key={day.date}
            className={`w-2 h-3 rounded-sm transition-colors ${
              day.hasActivity 
                ? day.count >= 5 
                  ? 'bg-green-600' 
                  : day.count >= 2 
                    ? 'bg-green-400' 
                    : 'bg-green-300'
                : 'bg-gray-200'
            }`}
            title={`${new Date(day.date).toLocaleDateString()}: ${day.count} execution${day.count !== 1 ? 's' : ''}`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500">
        {totalCount > 0 ? `${totalCount} in ${days}d` : `No activity in ${days}d`}
      </span>
    </div>
  );
};