import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TaskService } from '../TaskService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../base-classes/BaseService';
import { DevTask, DevTaskTag, DevTaskFile, DevTaskCommit, DevTaskWorkSession, TaskFilters } from '../TaskService';

// Mock Supabase client factory
const createMockSupabase = () => {
  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null
    })
  };

  const mockFrom = vi.fn();
  
  return {
    from: mockFrom,
    auth: mockAuth
  } as unknown as SupabaseClient;
};

// Mock logger factory
const createMockLogger = () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}) as unknown as Logger;

// Mock data fixtures
const createMockTask = (overrides?: Partial<DevTask>): DevTask => ({
  id: 'test-task-id',
  title: 'Test Task',
  description: 'Test description',
  task_type: 'feature',
  status: 'pending',
  priority: 'medium',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockTag = (overrides?: Partial<DevTaskTag>): DevTaskTag => ({
  id: 'test-tag-id',
  task_id: 'test-task-id',
  tag: 'test-tag',
  created_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockFile = (overrides?: Partial<DevTaskFile>): DevTaskFile => ({
  id: 'test-file-id',
  task_id: 'test-task-id',
  file_path: '/src/test.ts',
  action: 'modified',
  created_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockCommit = (overrides?: Partial<DevTaskCommit>): DevTaskCommit => ({
  id: 'test-commit-id',
  task_id: 'test-task-id',
  commit_hash: 'abc123',
  commit_message: 'Test commit',
  files_changed: 2,
  insertions: 10,
  deletions: 5,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockWorkSession = (overrides?: Partial<DevTaskWorkSession>): DevTaskWorkSession => ({
  id: 'test-session-id',
  task_id: 'test-task-id',
  started_at: '2025-01-01T00:00:00Z',
  ...overrides
});

describe('TaskService', () => {
  let service: TaskService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockLogger = createMockLogger();
    service = new TaskService(mockSupabase, mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create an instance with required dependencies', () => {
      expect(service).toBeInstanceOf(TaskService);
      expect(service.getName()).toBe('TaskService');
    });

    it('should create an instance without optional logger', () => {
      const serviceNoLogger = new TaskService(mockSupabase);
      expect(serviceNoLogger).toBeInstanceOf(TaskService);
    });

    it('should throw error when supabase client is not provided', () => {
      expect(() => new TaskService(null as any)).toThrow('SupabaseClient is required');
    });

    it('should validate dependencies on construction', () => {
      expect(() => new TaskService(undefined as any)).toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should not enforce singleton pattern for business services', () => {
      const service1 = new TaskService(mockSupabase);
      const service2 = new TaskService(mockSupabase);
      
      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(TaskService);
      expect(service2).toBeInstanceOf(TaskService);
    });

    it('should accept dependency injection of infrastructure services', () => {
      const mockSupabase2 = createMockSupabase();
      const service2 = new TaskService(mockSupabase2, mockLogger);
      
      expect(service).not.toBe(service2);
      expect(service2).toBeInstanceOf(TaskService);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when database is accessible', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: 10,
          error: null
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details.taskCount).toBe(10);
      expect(health.details.metrics).toBeDefined();
      expect(health.details.metrics.tasksCreated).toBe(0);
    });

    it('should check enhanced view accessibility', async () => {
      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation((table) => {
        callCount++;
        if (callCount === 1) {
          // First call for task count
          return {
            select: vi.fn().mockResolvedValue({
              count: 5,
              error: null
            })
          };
        } else {
          // Second call for enhanced view
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                error: null
              })
            })
          };
        }
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.enhancedViewAccessible).toBe(true);
    });

    it('should report unhealthy when database is inaccessible', async () => {
      const mockError = new Error('Database connection failed');
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          count: null,
          error: mockError
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('TaskService: Health check failed', mockError);
    });

    it('should handle enhanced view inaccessibility gracefully', async () => {
      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation((table) => {
        callCount++;
        if (callCount === 1) {
          // First call for task count
          return {
            select: vi.fn().mockResolvedValue({
              count: 10,
              error: null
            })
          };
        } else {
          // Second call for enhanced view - fails
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                error: new Error('View not found')
              })
            })
          };
        }
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.enhancedViewAccessible).toBe(false);
    });
  });

  describe('Task CRUD Operations', () => {
    describe('getTasks', () => {
      it('should retrieve all tasks with default ordering', async () => {
        const mockTasks = [
          createMockTask(),
          createMockTask({ id: 'task-2', title: 'Task 2' })
        ];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockTasks,
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const tasks = await service.getTasks();
        
        expect(tasks).toEqual(mockTasks);
        expect(mockSupabase.from).toHaveBeenCalledWith('dev_tasks_enhanced_view');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TaskService: Getting tasks',
          { filters: undefined }
        );
      });

      it('should apply status filter', async () => {
        const mockQuery = {
          eq: vi.fn().mockResolvedValue({
            data: [createMockTask({ status: 'in_progress' })],
            error: null
          })
        };
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(mockQuery)
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const filters: TaskFilters = { status: 'in_progress' };
        await service.getTasks(filters);
        
        expect(mockQuery.eq).toHaveBeenCalledWith('status', 'in_progress');
      });

      it('should apply priority filter', async () => {
        const mockQuery = {
          eq: vi.fn().mockResolvedValue({
            data: [createMockTask({ priority: 'high' })],
            error: null
          })
        };
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(mockQuery)
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.getTasks({ priority: 'high' });
        
        expect(mockQuery.eq).toHaveBeenCalledWith('priority', 'high');
      });

      it('should apply app filter', async () => {
        const mockQuery = {
          eq: vi.fn().mockResolvedValue({
            data: [createMockTask({ app: 'dhg-hub' })],
            error: null
          })
        };
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(mockQuery)
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.getTasks({ app: 'dhg-hub' });
        
        expect(mockQuery.eq).toHaveBeenCalledWith('app', 'dhg-hub');
      });

      it('should apply search filter', async () => {
        const mockQuery = {
          or: vi.fn().mockResolvedValue({
            data: [createMockTask({ title: 'Search result' })],
            error: null
          })
        };
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(mockQuery)
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.getTasks({ search: 'test' });
        
        expect(mockQuery.or).toHaveBeenCalledWith(
          'title.ilike.%test%,description.ilike.%test%'
        );
      });

      it('should apply multiple filters', async () => {
        const mockSelect = vi.fn();
        const mockOrder = vi.fn();
        const mockEq = vi.fn();
        const mockOr = vi.fn().mockResolvedValue({
          data: [],
          error: null
        });

        mockEq.mockReturnValue({ or: mockOr });
        mockOrder.mockReturnValue({ eq: mockEq });
        mockSelect.mockReturnValue({ order: mockOrder });
        
        const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.getTasks({
          status: 'pending',
          priority: 'high',
          search: 'urgent'
        });
        
        expect(mockEq).toHaveBeenCalledWith('status', 'pending');
        expect(mockEq).toHaveBeenCalledWith('priority', 'high');
        expect(mockOr).toHaveBeenCalledWith(
          'title.ilike.%urgent%,description.ilike.%urgent%'
        );
      });

      it('should handle database errors', async () => {
        const mockError = new Error('Query failed');
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: mockError
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.getTasks()).rejects.toThrow('Query failed');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TaskService: Error getting tasks',
          mockError
        );
      });
    });

    describe('getTask', () => {
      it('should retrieve a single task by ID', async () => {
        const mockTask = createMockTask();
        
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const task = await service.getTask('test-task-id');
        
        expect(task).toEqual(mockTask);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TaskService: Retrieved task',
          { id: 'test-task-id', title: 'Test Task' }
        );
      });

      it('should handle task not found', async () => {
        const mockError = { message: 'Task not found' };
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: mockError
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.getTask('non-existent')).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TaskService: Error getting task',
          mockError
        );
      });
    });

    describe('createTask', () => {
      it('should create a new task with user ID', async () => {
        const newTask = {
          title: 'New Task',
          description: 'New description',
          task_type: 'feature' as const,
          priority: 'high' as const
        };

        const createdTask = createMockTask({
          ...newTask,
          id: 'new-id',
          created_by: 'test-user-id'
        });

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createdTask,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.createTask(newTask);
        
        expect(result).toEqual(createdTask);
        expect(result.created_by).toBe('test-user-id');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Task created',
          { id: 'new-id', title: 'New Task' }
        );
      });

      it('should create task without user when not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null
        });

        const newTask = { title: 'Unauthenticated Task' };
        const createdTask = createMockTask({
          ...newTask,
          id: 'new-id',
          created_by: undefined
        });

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createdTask,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.createTask(newTask);
        
        expect(result.created_by).toBeUndefined();
      });

      it('should handle creation errors', async () => {
        const mockError = { message: 'Insert failed' };
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: mockError
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.createTask({ title: 'Failed' })).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TaskService: Error creating task',
          mockError
        );
      });

      it('should track metrics on successful creation', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createMockTask(),
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.createTask({ title: 'Metric Test' });
        
        const metrics = service.getMetrics();
        expect(metrics.tasksCreated).toBe(1);
      });
    });

    describe('updateTask', () => {
      it('should update task and fetch enhanced data', async () => {
        const updates = { status: 'in_progress' as const };
        const updatedTask = createMockTask({ ...updates });
        const enhancedTask = createMockTask({
          ...updates,
          progress_status: 'in_development',
          current_lifecycle_stage: 'development'
        });

        let callCount = 0;
        const mockFrom = vi.fn().mockImplementation((table) => {
          callCount++;
          if (callCount === 1) {
            // Update operation
            return {
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
            };
          } else {
            // Fetch enhanced view
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: enhancedTask,
                    error: null
                  })
                })
              })
            };
          }
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.updateTask('test-task-id', updates);
        
        expect(result).toEqual(enhancedTask);
        expect(result.progress_status).toBe('in_development');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Task updated successfully',
          { id: 'test-task-id', title: 'Test Task' }
        );
      });

      it('should fall back to basic data when enhanced view fails', async () => {
        const updates = { status: 'completed' as const };
        const updatedTask = createMockTask({ ...updates });

        let callCount = 0;
        const mockFrom = vi.fn().mockImplementation((table) => {
          callCount++;
          if (callCount === 1) {
            // Update operation
            return {
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
            };
          } else {
            // Fetch enhanced view - fails
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'View not accessible' }
                  })
                })
              })
            };
          }
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.updateTask('test-task-id', updates);
        
        expect(result).toEqual(updatedTask);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'TaskService: Error fetching enhanced task data',
          expect.any(Object)
        );
      });

      it('should handle update errors with detailed logging', async () => {
        const mockError = {
          message: 'Update failed',
          details: 'Constraint violation',
          hint: 'Check foreign keys',
          code: 'PGRST204'
        };

        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: mockError
                })
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.updateTask('test-task-id', {})).rejects.toThrow('Failed to update task');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TaskService: Error updating task',
          expect.objectContaining({
            error: mockError,
            details: 'Constraint violation',
            hint: 'Check foreign keys',
            code: 'PGRST204'
          })
        );
      });

      it('should track metrics on successful update', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: createMockTask(),
                  error: null
                })
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.updateTask('test-task-id', { status: 'completed' });
        
        const metrics = service.getMetrics();
        expect(metrics.tasksUpdated).toBeGreaterThan(0);
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.deleteTask('test-task-id');
        
        expect(mockSupabase.from).toHaveBeenCalledWith('dev_tasks');
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Task deleted',
          { id: 'test-task-id' }
        );
      });

      it('should handle deletion errors', async () => {
        const mockError = { message: 'Delete failed' };
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: mockError
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.deleteTask('test-task-id')).rejects.toThrow();
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TaskService: Error deleting task',
          mockError
        );
      });

      it('should track metrics on successful deletion', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.deleteTask('test-task-id');
        
        const metrics = service.getMetrics();
        expect(metrics.tasksDeleted).toBe(1);
      });
    });
  });

  describe('Tag Operations', () => {
    describe('getTaskTags', () => {
      it('should retrieve tags for a task', async () => {
        const mockTags = [
          createMockTag(),
          createMockTag({ id: 'tag-2', tag: 'another-tag' })
        ];
        
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const tags = await service.getTaskTags('test-task-id');
        
        expect(tags).toEqual(mockTags);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TaskService: Retrieved task tags',
          { taskId: 'test-task-id', count: 2 }
        );
      });

      it('should handle empty tag list', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const tags = await service.getTaskTags('test-task-id');
        
        expect(tags).toEqual([]);
      });
    });

    describe('addTag', () => {
      it('should add a tag to a task', async () => {
        const newTag = createMockTag();
        
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: newTag,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const tag = await service.addTag('test-task-id', 'test-tag');
        
        expect(tag).toEqual(newTag);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Tag added',
          { taskId: 'test-task-id', tag: 'test-tag' }
        );
      });

      it('should track metrics on tag addition', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createMockTag(),
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.addTag('test-task-id', 'test-tag');
        
        const metrics = service.getMetrics();
        expect(metrics.tagsAdded).toBe(1);
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.removeTag('test-tag-id');
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Tag removed',
          { tagId: 'test-tag-id' }
        );
      });

      it('should track metrics on tag removal', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.removeTag('test-tag-id');
        
        const metrics = service.getMetrics();
        expect(metrics.tagsRemoved).toBe(1);
      });
    });
  });

  describe('File Operations', () => {
    describe('getTaskFiles', () => {
      it('should retrieve files for a task', async () => {
        const mockFiles = [
          createMockFile(),
          createMockFile({ id: 'file-2', file_path: '/src/test2.ts' })
        ];
        
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const files = await service.getTaskFiles('test-task-id');
        
        expect(files).toEqual(mockFiles);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TaskService: Retrieved task files',
          { taskId: 'test-task-id', count: 2 }
        );
      });
    });

    describe('addFile', () => {
      it('should add a file with default action', async () => {
        const newFile = createMockFile();
        
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: newFile,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const file = await service.addFile('test-task-id', '/src/test.ts');
        
        expect(file).toEqual(newFile);
        expect(file.action).toBe('modified');
      });

      it('should add a file with specific action', async () => {
        const newFile = createMockFile({ action: 'created' });
        
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: newFile,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const file = await service.addFile('test-task-id', '/src/new.ts', 'created');
        
        expect(file.action).toBe('created');
      });

      it('should track metrics on file addition', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createMockFile(),
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.addFile('test-task-id', '/src/test.ts');
        
        const metrics = service.getMetrics();
        expect(metrics.filesTracked).toBe(1);
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.removeFile('test-file-id');
        
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: File removed',
          { fileId: 'test-file-id' }
        );
      });
    });
  });

  describe('Git Integration', () => {
    describe('getTaskCommits', () => {
      it('should retrieve commits for a task', async () => {
        const mockCommits = [
          createMockCommit(),
          createMockCommit({ id: 'commit-2', commit_hash: 'def456' })
        ];
        
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const commits = await service.getTaskCommits('test-task-id');
        
        expect(commits).toEqual(mockCommits);
        expect(commits[0].commit_hash).toBe('abc123');
      });

      it('should handle commit fetch errors with specific message', async () => {
        const mockError = { message: 'Database error' };
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: mockError
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.getTaskCommits('test-task-id'))
          .rejects.toThrow('Failed to fetch commits: Database error');
      });

      it('should track metrics on error', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Error' }
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        try {
          await service.getTaskCommits('test-task-id');
        } catch (e) {
          // Expected
        }
        
        const metrics = service.getMetrics();
        expect(metrics.errors).toBeGreaterThan(0);
      });
    });

    describe('getTaskWorkSessions', () => {
      it('should retrieve work sessions for a task', async () => {
        const mockSessions = [
          createMockWorkSession(),
          createMockWorkSession({ id: 'session-2', started_at: '2025-01-01T01:00:00Z' })
        ];
        
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const sessions = await service.getTaskWorkSessions('test-task-id');
        
        expect(sessions).toEqual(mockSessions);
      });

      it('should handle work session fetch errors', async () => {
        const mockError = { message: 'Fetch failed' };
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: mockError
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.getTaskWorkSessions('test-task-id'))
          .rejects.toThrow('Failed to fetch work sessions');
      });
    });
  });

  describe('Helper Methods', () => {
    describe('formatForClaude', () => {
      it('should format task without tags', () => {
        const task = createMockTask();
        const formatted = service.formatForClaude(task);
        
        expect(formatted).toContain('# Task: Test Task');
        expect(formatted).toContain('ID: test-task-id');
        expect(formatted).toContain('Type: feature');
        expect(formatted).toContain('Priority: medium');
        expect(formatted).toContain('## Description\nTest description');
        expect(formatted).not.toContain('Tags:');
      });

      it('should format task with tags', () => {
        const task = createMockTask();
        const formatted = service.formatForClaude(task, ['urgent', 'bug-fix']);
        
        expect(formatted).toContain('Tags: urgent, bug-fix');
      });

      it('should format date correctly', () => {
        const task = createMockTask({ created_at: '2025-01-15T10:30:00Z' });
        const formatted = service.formatForClaude(task);
        
        expect(formatted).toMatch(/Created: \d{1,2}\/\d{1,2}\/\d{4}/);
      });
    });

    describe('completeTask', () => {
      it('should mark task as complete with response', async () => {
        const claudeResponse = 'Task has been completed successfully';
        const completedTask = createMockTask({
          status: 'completed',
          completed_at: '2025-01-01T01:00:00Z',
          claude_response: claudeResponse
        });

        // Mock the updateTask method
        vi.spyOn(service, 'updateTask').mockResolvedValue(completedTask);

        const result = await service.completeTask('test-task-id', claudeResponse);
        
        expect(result.status).toBe('completed');
        expect(result.claude_response).toBe(claudeResponse);
        expect(result.completed_at).toBeDefined();
      });

      it('should track completion metrics', async () => {
        const initialMetrics = service.getMetrics();
        
        vi.spyOn(service, 'updateTask').mockResolvedValue(
          createMockTask({ status: 'completed' })
        );

        await service.completeTask('test-task-id', 'Done');
        
        const metrics = service.getMetrics();
        expect(metrics.tasksCompleted).toBe(initialMetrics.tasksCompleted + 1);
      });

      it('should propagate update errors', async () => {
        vi.spyOn(service, 'updateTask').mockRejectedValue(
          new Error('Update failed')
        );

        await expect(service.completeTask('test-task-id', 'Response'))
          .rejects.toThrow('Update failed');
      });
    });
  });

  describe('Work Session Management', () => {
    describe('startWorkSession', () => {
      it('should start a new work session', async () => {
        const newSession = createMockWorkSession();
        
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: newSession,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const session = await service.startWorkSession('test-task-id');
        
        expect(session).toEqual(newSession);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TaskService: Work session started',
          { taskId: 'test-task-id', sessionId: 'test-session-id' }
        );
      });

      it('should track work session metrics', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createMockWorkSession(),
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.startWorkSession('test-task-id');
        
        const metrics = service.getMetrics();
        expect(metrics.workSessionsStarted).toBe(1);
      });
    });

    describe('endWorkSession', () => {
      it('should end a work session with summary', async () => {
        const endedSession = createMockWorkSession({
          ended_at: '2025-01-01T01:00:00Z',
          summary: 'Completed implementation',
          files_modified: ['/src/feature.ts', '/src/test.ts']
        });
        
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const session = await service.endWorkSession(
          'test-session-id',
          'Completed implementation',
          ['/src/feature.ts', '/src/test.ts']
        );
        
        expect(session.ended_at).toBeDefined();
        expect(session.summary).toBe('Completed implementation');
        expect(session.files_modified).toHaveLength(2);
      });

      it('should track work session end metrics', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: createMockWorkSession({ ended_at: '2025-01-01T01:00:00Z' }),
                  error: null
                })
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.endWorkSession('test-session-id', 'Done');
        
        const metrics = service.getMetrics();
        expect(metrics.workSessionsEnded).toBe(1);
      });
    });

    describe('updateWorkSessionClaude', () => {
      it('should update session with Claude ID', async () => {
        const updatedSession = createMockWorkSession({
          claude_session_id: 'claude-session-123'
        });
        
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
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const session = await service.updateWorkSessionClaude(
          'test-session-id',
          'claude-session-123'
        );
        
        expect(session.claude_session_id).toBe('claude-session-123');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkError';
      
      const mockFrom = vi.fn().mockImplementation(() => {
        throw networkError;
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await expect(service.getTasks()).rejects.toThrow('Network timeout');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle malformed responses', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: 'not-an-array',
            error: null
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const tasks = await service.getTasks();
      
      // Service should handle gracefully and return what it got
      expect(tasks).toBe('not-an-array');
    });

    it('should increment error metrics for all operation failures', async () => {
      const mockError = { message: 'Generic error' };
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: mockError
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const initialErrors = service.getMetrics().errors;
      
      try {
        await service.getTask('test-id');
      } catch (e) {
        // Expected
      }
      
      const metrics = service.getMetrics();
      expect(metrics.errors).toBe(initialErrors + 1);
    });

    it('should provide detailed error context in logs', async () => {
      const detailedError = {
        message: 'Constraint violation',
        details: 'foreign_key_violation',
        hint: 'Task must reference valid user',
        code: '23503'
      };
      
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: detailedError
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await expect(service.createTask({ title: 'Test' })).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TaskService: Error creating task',
        detailedError
      );
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should provide accurate metrics snapshot', async () => {
      const metrics = service.getMetrics();
      
      expect(metrics).toEqual({
        tasksCreated: 0,
        tasksUpdated: 0,
        tasksDeleted: 0,
        tasksCompleted: 0,
        tagsAdded: 0,
        tagsRemoved: 0,
        filesTracked: 0,
        commitsTracked: 0,
        workSessionsStarted: 0,
        workSessionsEnded: 0,
        errors: 0
      });
    });

    it('should return a copy of metrics to prevent external modification', () => {
      const metrics1 = service.getMetrics();
      metrics1.tasksCreated = 999;
      
      const metrics2 = service.getMetrics();
      expect(metrics2.tasksCreated).toBe(0);
    });

    it('should track all operation types correctly', async () => {
      // Mock successful operations
      const mockFrom = vi.fn();
      
      // Helper to create standard response
      const successResponse = (data: any) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data,
            error: null
          })
        })
      });
      
      // Mock different operations
      mockFrom
        .mockReturnValueOnce({ insert: vi.fn().mockReturnValue(successResponse(createMockTask())) })
        .mockReturnValueOnce({ insert: vi.fn().mockReturnValue(successResponse(createMockTag())) })
        .mockReturnValueOnce({ insert: vi.fn().mockReturnValue(successResponse(createMockFile())) });
      
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.createTask({ title: 'Test' });
      await service.addTag('task-id', 'tag');
      await service.addFile('task-id', '/file.ts');
      
      const metrics = service.getMetrics();
      expect(metrics.tasksCreated).toBe(1);
      expect(metrics.tagsAdded).toBe(1);
      expect(metrics.filesTracked).toBe(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full task lifecycle', async () => {
      const taskId = 'lifecycle-task-id';
      const mockTask = createMockTask({ id: taskId });
      
      // Mock create
      let mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTask,
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);
      
      // Create task
      const created = await service.createTask({
        title: 'Lifecycle Test',
        task_type: 'feature',
        priority: 'high'
      });
      expect(created.id).toBe(taskId);
      
      // Mock update
      vi.spyOn(service, 'updateTask').mockResolvedValue({
        ...mockTask,
        status: 'in_progress'
      });
      
      // Update status
      const updated = await service.updateTask(taskId, { status: 'in_progress' });
      expect(updated.status).toBe('in_progress');
      
      // Mock add tag
      mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: createMockTag({ task_id: taskId }),
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);
      
      // Add tag
      await service.addTag(taskId, 'important');
      
      // Complete task
      vi.spyOn(service, 'updateTask').mockResolvedValue({
        ...mockTask,
        status: 'completed',
        completed_at: new Date().toISOString(),
        claude_response: 'Task completed'
      });
      
      const completed = await service.completeTask(taskId, 'Task completed');
      expect(completed.status).toBe('completed');
      
      // Check metrics
      const metrics = service.getMetrics();
      expect(metrics.tasksCreated).toBe(1);
      expect(metrics.tasksUpdated).toBeGreaterThan(0);
      expect(metrics.tasksCompleted).toBe(1);
      expect(metrics.tagsAdded).toBe(1);
    });

    it('should handle concurrent operations safely', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      // Execute multiple operations concurrently
      const operations = [
        service.getTasks(),
        service.getTasks({ status: 'pending' }),
        service.getTasks({ priority: 'high' }),
        service.getTasks({ search: 'test' })
      ];
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(4);
      expect(results.every(r => Array.isArray(r))).toBe(true);
    });
  });
});