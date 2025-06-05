# dhg-admin-suite Task Management Integration

## Overview

This document outlines how to integrate dev task management into dhg-admin-suite, creating a unified dashboard for managing both development tasks and AI work summaries.

## Proposed UI Components

### 1. Unified Task Dashboard

```typescript
// apps/dhg-admin-suite/src/pages/TaskDashboard.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function TaskDashboard() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'summaries'>('tasks');
  const [stats, setStats] = useState({
    pendingTasks: 0,
    inProgressTasks: 0,
    completedToday: 0,
    summariesToday: 0
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Development Dashboard</h1>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard title="Pending Tasks" value={stats.pendingTasks} color="yellow" />
        <StatCard title="In Progress" value={stats.inProgressTasks} color="blue" />
        <StatCard title="Completed Today" value={stats.completedToday} color="green" />
        <StatCard title="Work Summaries" value={stats.summariesToday} color="purple" />
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-4 mb-6">
        <TabButton 
          active={activeTab === 'tasks'} 
          onClick={() => setActiveTab('tasks')}
        >
          Dev Tasks
        </TabButton>
        <TabButton 
          active={activeTab === 'summaries'} 
          onClick={() => setActiveTab('summaries')}
        >
          Work Summaries
        </TabButton>
      </div>

      {/* Content */}
      {activeTab === 'tasks' ? <TasksView /> : <SummariesView />}
    </div>
  );
}
```

### 2. Quick Task Creator

```typescript
// apps/dhg-admin-suite/src/components/QuickTaskCreator.tsx

export function QuickTaskCreator() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'feature',
    priority: 'medium'
  });

  const createTask = async () => {
    const { data, error } = await supabase
      .from('dev_tasks')
      .insert({
        ...formData,
        claude_request: formatClaudeRequest(formData),
        status: 'pending'
      })
      .select()
      .single();

    if (!error && data) {
      // Copy to clipboard
      navigator.clipboard.writeText(data.claude_request);
      toast.success('Task created and request copied to clipboard!');
      setIsOpen(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white rounded-full p-4 shadow-lg"
      >
        + New Task
      </button>

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)}>
          <h2 className="text-xl font-bold mb-4">Create Dev Task</h2>
          
          <input
            type="text"
            placeholder="Task title..."
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            className="w-full p-2 border rounded mb-4"
          />

          <textarea
            placeholder="Describe the task..."
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full p-2 border rounded mb-4 h-32"
          />

          <div className="flex gap-4 mb-4">
            <select 
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              className="flex-1 p-2 border rounded"
            >
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="refactor">Refactor</option>
              <option value="question">Question</option>
            </select>

            <select
              value={formData.priority}
              onChange={(e) => setFormData({...formData, priority: e.target.value})}
              className="flex-1 p-2 border rounded"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <button
            onClick={createTask}
            className="w-full bg-blue-500 text-white p-2 rounded"
          >
            Create & Copy to Clipboard
          </button>
        </Modal>
      )}
    </>
  );
}
```

### 3. Task List with Inline Actions

```typescript
// apps/dhg-admin-suite/src/components/TaskList.tsx

export function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('pending');

  const copyRequest = async (task) => {
    await navigator.clipboard.writeText(task.claude_request);
    toast.success('Request copied to clipboard!');
  };

  const quickComplete = async (taskId) => {
    const response = prompt('Paste Claude\'s response:');
    if (response) {
      await supabase
        .from('dev_tasks')
        .update({
          status: 'completed',
          claude_response: response,
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId);
      
      // Also create work summary
      await createWorkSummary(taskId, response);
      toast.success('Task completed!');
      refreshTasks();
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex gap-2">
        <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')}>
          Pending
        </FilterButton>
        <FilterButton active={filter === 'in_progress'} onClick={() => setFilter('in_progress')}>
          In Progress
        </FilterButton>
        <FilterButton active={filter === 'completed'} onClick={() => setFilter('completed')}>
          Completed
        </FilterButton>
      </div>

      {/* Task cards */}
      {tasks.map(task => (
        <TaskCard key={task.id}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{task.title}</h3>
              <p className="text-sm text-gray-600">{task.description}</p>
              <div className="flex gap-2 mt-2">
                <Badge color={task.priority === 'high' ? 'red' : 'gray'}>
                  {task.priority}
                </Badge>
                <Badge>{task.task_type}</Badge>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => copyRequest(task)}
                className="text-blue-500 hover:text-blue-700"
                title="Copy to Claude"
              >
                📋
              </button>
              
              {task.status !== 'completed' && (
                <button
                  onClick={() => quickComplete(task.id)}
                  className="text-green-500 hover:text-green-700"
                  title="Quick Complete"
                >
                  ✅
                </button>
              )}
            </div>
          </div>
        </TaskCard>
      ))}
    </div>
  );
}
```

### 4. Work Summary Integration

```typescript
// apps/dhg-admin-suite/src/components/WorkSummaryList.tsx

export function WorkSummaryList() {
  const [summaries, setSummaries] = useState([]);
  const [dateRange, setDateRange] = useState('today');

  return (
    <div className="space-y-4">
      {/* Date filter */}
      <select 
        value={dateRange} 
        onChange={(e) => setDateRange(e.target.value)}
        className="p-2 border rounded"
      >
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
      </select>

      {/* Summary cards */}
      {summaries.map(summary => (
        <SummaryCard key={summary.id}>
          <h3 className="font-semibold">{summary.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{summary.summary_content}</p>
          
          {summary.commands && summary.commands.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500">Commands used:</p>
              <code className="text-xs bg-gray-100 p-1 rounded">
                {summary.commands.join(', ')}
              </code>
            </div>
          )}
          
          <div className="flex gap-2 mt-2">
            {summary.tags?.map(tag => (
              <Badge key={tag} size="sm">{tag}</Badge>
            ))}
          </div>
          
          {summary.metadata?.dev_task_id && (
            <p className="text-xs text-blue-500 mt-2">
              From task: {summary.metadata.dev_task_id}
            </p>
          )}
        </SummaryCard>
      ))}
    </div>
  );
}
```

## CLI Integration from UI

### Copy CLI Commands

```typescript
// Helper component to show CLI commands
export function CLICommandHelper({ taskId }) {
  const commands = {
    copyRequest: `./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh copy-request ${taskId}`,
    complete: `./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh complete ${taskId} --response "..."`,
    addFile: `./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh add-file ${taskId} --path "..." --action modified`
  };

  return (
    <div className="bg-gray-100 p-4 rounded text-sm">
      <h4 className="font-semibold mb-2">CLI Commands:</h4>
      {Object.entries(commands).map(([key, cmd]) => (
        <div key={key} className="mb-2">
          <code className="bg-gray-200 p-1 rounded text-xs">{cmd}</code>
          <button
            onClick={() => navigator.clipboard.writeText(cmd)}
            className="ml-2 text-blue-500"
          >
            Copy
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Benefits of Integration

### 1. Unified Workflow
- Create tasks from UI or CLI
- Complete tasks from either interface
- Automatic work summary generation
- Cross-reference between systems

### 2. Quick Actions
- One-click copy to clipboard
- Inline task completion
- Quick status updates
- Batch operations

### 3. Analytics & Insights
- Task completion rates
- Time tracking
- Common patterns
- Productivity metrics

### 4. Knowledge Base
- Searchable task history
- Claude's responses archived
- Pattern recognition
- Solution reuse

## Implementation Steps

1. **Add to dhg-admin-suite router**:
```typescript
// In App.tsx or routes config
<Route path="/tasks" element={<TaskDashboard />} />
```

2. **Add navigation link**:
```typescript
// In navigation component
<NavLink to="/tasks">Dev Tasks</NavLink>
```

3. **Create shared hooks**:
```typescript
// hooks/useDevTasks.ts
export function useDevTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch logic
  // CRUD operations
  // Real-time subscriptions
  
  return { tasks, loading, createTask, updateTask, completeTask };
}
```

4. **Add to landing page**:
```typescript
// Show recent tasks widget
// Quick create button
// Summary statistics
```

## Future Enhancements

### 1. Real-time Updates
```typescript
// Subscribe to task changes
supabase
  .from('dev_tasks')
  .on('*', payload => {
    // Update UI in real-time
  })
  .subscribe();
```

### 2. Task Templates
- Common task patterns
- Pre-filled descriptions
- Suggested tags
- Priority recommendations

### 3. AI Insights
- Similar task suggestions
- Solution recommendations
- Time estimates
- Complexity analysis

### 4. Team Features
- Task assignment
- Comments/discussion
- Review workflow
- Approval process

This integration creates a seamless workflow between CLI and UI, making task management efficient and accessible from any context.