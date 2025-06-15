import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskService } from './TaskService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../logger-service/LoggerService';
import { DevTask, DevTaskTag, DevTaskFile, DevTaskCommit, DevTaskWorkSession } from './types';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn()
  }
} as unknown as SupabaseClient;

// Mock logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
} as unknown as Logger;

// Mock data
const mockTask: DevTask = {
  id: 'test-task-id',
  title: 'Test Task',
  description: 'Test description',
  task_type: 'feature',
  status: 'pending',
  priority: 'medium',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

const mockTag: DevTaskTag = {
  id: 'test-tag-id',
  task_id: 'test-task-id',
  tag: 'test-tag',
  created_at: '2025-01-01T00:00:00Z'
};

const mockFile: DevTaskFile = {
  id: 'test-file-id',
  task_id: 'test-task-id',
  file_path: '/src/test.ts',
  action: 'modified',
  created_at: '2025-01-01T00:00:00Z'
};

const mockCommit: DevTaskCommit = {
  id: 'test-commit-id',
  task_id: 'test-task-id',
  commit_hash: 'abc123',
  commit_message: 'Test commit',
  files_changed: 2,
  insertions: 10,
  deletions: 5,
  created_at: '2025-01-01T00:00:00Z'
};

const mockWorkSession: DevTaskWorkSession = {
  id: 'test-session-id',
  task_id: 'test-task-id',
  started_at: '2025-01-01T00:00:00Z'
};

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TaskService(mockSupabase, mockLogger);
    
    // Default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null
    });
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Service Lifecycle', () => {
    it('should create an instance with supabase client', () => {
      expect(service).toBeInstanceOf(TaskService);
    });

    it('should create an instance without logger', () => {
      const serviceNoLogger = new TaskService(mockSupabase);
      expect(serviceNoLogger).toBeInstanceOf(TaskService);
    });

    it('should handle health check when healthy', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: 10,
          error: null
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details.taskCount).toBe(10);
      expect(health.details.metrics).toBeDefined();
    });

    it('should handle health check when unhealthy', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: null,
          error: new Error('Database error')
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Database error');
    });
  });

  describe('Task CRUD Operations', () => {
    describe('getTasks', () => {
      it('should get all tasks', async () => {
        const mockTasks = [mockTask, { ...mockTask, id: 'task-2', title: 'Task 2' }];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockTasks,
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const tasks = await service.getTasks();
        
        expect(tasks).toEqual(mockTasks);
        expect(mockSupabase.from).toHaveBeenCalledWith('dev_tasks_enhanced_view');
      });

      it('should filter tasks by status', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [mockTask],
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await service.getTasks({ status: 'pending' });
        
        expect(mockFrom().select().order().eq).toHaveBeenCalledWith('status', 'pending');
      });

      it('should search tasks', async () => {
        const mockFrom = vi.fn();
        const mockSelect = vi.fn();
        const mockOrder = vi.fn();
        const mockOr = vi.fn().mockResolvedValue({
          data: [mockTask],
          error: null
        });

        mockOrder.mockReturnValue({ or: mockOr });
        mockSelect.mockReturnValue({ order: mockOrder });
        mockFrom.mockReturnValue({ select: mockSelect });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.getTasks({ search: 'test' });
        
        expect(mockOr).toHaveBeenCalledWith(
          'title.ilike.%test%,description.ilike.%test%'
        );
      });
    });

    describe('getTask', () => {
      it('should get a single task', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockTask,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const task = await service.getTask('test-task-id');
        
        expect(task).toEqual(mockTask);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TaskService: Retrieved task',
          expect.objectContaining({ id: 'test-task-id' })
        );
      });

      it('should handle task not found', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' }
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await expect(service.getTask('non-existent')).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('createTask', () => {
      it('should create a new task', async () => {
        const newTask = {
          title: 'New Task',
          description: 'New description',
          task_type: 'feature' as const,
          priority: 'high' as const
        };

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...newTask, id: 'new-id', created_by: 'test-user-id' },
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const created = await service.createTask(newTask);
        
        expect(created).toMatchObject(newTask);
        expect(created.id).toBe('new-id');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Task created',
          expect.any(Object)
        );
      });

      it('should handle creation error', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Creation failed' }
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await expect(service.createTask({
          title: 'Failed Task'
        })).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('updateTask', () => {
      it('should update a task', async () => {
        const updates = { status: 'in_progress' as const };
        const updatedTask = { ...mockTask, ...updates };

        // Mock update operation
        const mockFrom = vi.fn();
        mockFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: updatedTask,
                  error: null
                })
              })
            })
          })
        });
        
        // Mock fetch from enhanced view
        mockFrom.mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: updatedTask,
                error: null
              })
            })
          })
        });
        
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.updateTask('test-task-id', updates);
        
        expect(result.status).toBe('in_progress');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Task updated successfully',
          expect.any(Object)
        );
      });

      it('should fall back to basic data if enhanced view fails', async () => {
        const updates = { status: 'in_progress' as const };
        const updatedTask = { ...mockTask, ...updates };

        // Mock update operation (success)
        const mockFrom = vi.fn();
        mockFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: updatedTask,
                  error: null
                })
              })
            })
          })
        });
        
        // Mock fetch from enhanced view (failure)
        mockFrom.mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'View error' }
              })
            })
          })
        });
        
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.updateTask('test-task-id', updates);
        
        expect(result).toEqual(updatedTask);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe('deleteTask', () => {
      it('should delete a task', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await service.deleteTask('test-task-id');
        
        expect(mockSupabase.from).toHaveBeenCalledWith('dev_tasks');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Task deleted',
          expect.objectContaining({ id: 'test-task-id' })
        );
      });
    });
  });

  describe('Tag Operations', () => {
    describe('getTaskTags', () => {
      it('should get task tags', async () => {
        const mockTags = [mockTag, { ...mockTag, id: 'tag-2', tag: 'another-tag' }];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockTags,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const tags = await service.getTaskTags('test-task-id');
        
        expect(tags).toEqual(mockTags);
      });
    });

    describe('addTag', () => {
      it('should add a tag to a task', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockTag,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const tag = await service.addTag('test-task-id', 'test-tag');
        
        expect(tag).toEqual(mockTag);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Tag added',
          expect.any(Object)
        );
      });
    });

    describe('removeTag', () => {
      it('should remove a tag', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await service.removeTag('test-tag-id');
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Tag removed',
          expect.objectContaining({ tagId: 'test-tag-id' })
        );
      });
    });
  });

  describe('File Operations', () => {
    describe('getTaskFiles', () => {
      it('should get task files', async () => {
        const mockFiles = [mockFile, { ...mockFile, id: 'file-2', file_path: '/src/test2.ts' }];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockFiles,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const files = await service.getTaskFiles('test-task-id');
        
        expect(files).toEqual(mockFiles);
      });
    });

    describe('addFile', () => {
      it('should add a file to a task', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockFile,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const file = await service.addFile('test-task-id', '/src/test.ts');
        
        expect(file).toEqual(mockFile);
      });
    });

    describe('removeFile', () => {
      it('should remove a file', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await service.removeFile('test-file-id');
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: File removed',
          expect.objectContaining({ fileId: 'test-file-id' })
        );
      });
    });
  });

  describe('Git Integration', () => {
    describe('getTaskCommits', () => {
      it('should get task commits', async () => {
        const mockCommits = [mockCommit, { ...mockCommit, id: 'commit-2', commit_hash: 'def456' }];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockCommits,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const commits = await service.getTaskCommits('test-task-id');
        
        expect(commits).toEqual(mockCommits);
      });

      it('should handle commit fetch error', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Failed to fetch' }
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        await expect(service.getTaskCommits('test-task-id')).rejects.toThrow('Failed to fetch commits');
      });
    });

    describe('getTaskWorkSessions', () => {
      it('should get task work sessions', async () => {
        const mockSessions = [mockWorkSession];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockSessions,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const sessions = await service.getTaskWorkSessions('test-task-id');
        
        expect(sessions).toEqual(mockSessions);
      });
    });
  });

  describe('Helper Methods', () => {
    describe('formatForClaude', () => {
      it('should format task for Claude without tags', () => {
        const formatted = service.formatForClaude(mockTask);
        
        expect(formatted).toContain('# Task: Test Task');
        expect(formatted).toContain('ID: test-task-id');
        expect(formatted).toContain('Type: feature');
        expect(formatted).toContain('Priority: medium');
        expect(formatted).toContain('Test description');
      });

      it('should format task for Claude with tags', () => {
        const formatted = service.formatForClaude(mockTask, ['tag1', 'tag2']);
        
        expect(formatted).toContain('Tags: tag1, tag2');
      });
    });

    describe('completeTask', () => {
      it('should complete a task with Claude response', async () => {
        const claudeResponse = 'Task completed successfully';
        
        // Mock the updateTask method
        const updateTaskSpy = vi.spyOn(service, 'updateTask').mockResolvedValue({
          ...mockTask,
          status: 'completed',
          completed_at: '2025-01-01T01:00:00Z',
          claude_response: claudeResponse
        });

        const result = await service.completeTask('test-task-id', claudeResponse);
        
        expect(result.status).toBe('completed');
        expect(result.claude_response).toBe(claudeResponse);
        expect(updateTaskSpy).toHaveBeenCalledWith('test-task-id', {
          status: 'completed',
          completed_at: expect.any(String),
          claude_response: claudeResponse
        });
      });
    });
  });

  describe('Work Session Management', () => {
    describe('startWorkSession', () => {
      it('should start a work session', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockWorkSession,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const session = await service.startWorkSession('test-task-id');
        
        expect(session).toEqual(mockWorkSession);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Work session started',
          expect.any(Object)
        );
      });
    });

    describe('endWorkSession', () => {
      it('should end a work session', async () => {
        const endedSession = {
          ...mockWorkSession,
          ended_at: '2025-01-01T01:00:00Z',
          summary: 'Completed feature implementation',
          files_modified: ['/src/feature.ts']
        };

        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: endedSession,
                  error: null
                })
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const session = await service.endWorkSession(
          'test-session-id',
          'Completed feature implementation',
          ['/src/feature.ts']
        );
        
        expect(session).toEqual(endedSession);
      });
    });

    describe('updateWorkSessionClaude', () => {
      it('should update work session with Claude ID', async () => {
        const updatedSession = {
          ...mockWorkSession,
          claude_session_id: 'claude-123'
        };

        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: updatedSession,
                  error: null
                })
              })
            })
          })
        });
        (mockSupabase.from as any).mockReturnValue(mockFrom());

        const session = await service.updateWorkSessionClaude('test-session-id', 'claude-123');
        
        expect(session.claude_session_id).toBe('claude-123');
      });
    });
  });

  describe('Metrics', () => {
    it('should track metrics correctly', async () => {
      // Mock successful operations
      const mockFrom = vi.fn();
      
      // Create task
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTask,
              error: null
            })
          })
        })
      });
      
      // Update task (for updateTask)
      mockFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockTask,
                error: null
              })
            })
          })
        })
      });
      
      // Fetch from enhanced view (for updateTask)
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTask,
              error: null
            })
          })
        })
      });
      
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.createTask({ title: 'Test' });
      await service.updateTask('test-id', { status: 'completed' });

      const metrics = service.getMetrics();
      
      expect(metrics.tasksCreated).toBe(1);
      expect(metrics.tasksUpdated).toBe(1);
      expect(metrics.errors).toBe(0);
    });

    it('should track errors', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      try {
        await service.getTasks();
      } catch (e) {
        // Expected
      }
      
      const metrics = service.getMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle auth errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockTask, created_by: null },
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      const task = await service.createTask({ title: 'Test' });
      
      expect(task.created_by).toBeNull();
    });

    it('should handle database errors with proper logging', async () => {
      const dbError = {
        message: 'Database connection failed',
        details: 'Connection timeout',
        hint: 'Check network',
        code: 'PGRST301'
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: dbError
            })
          })
        })
      });
      (mockSupabase.from as any).mockReturnValue(mockFrom());

      await expect(service.getTask('test-id')).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TaskService: Error getting task',
        dbError
      );
    });
  });
});