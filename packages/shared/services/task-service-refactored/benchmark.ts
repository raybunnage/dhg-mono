import { TaskService } from './TaskService';
import { SupabaseClientService } from '../supabase-client';

/**
 * Benchmark TaskService performance
 */
async function benchmark() {
  console.log('🚀 Starting TaskService benchmark...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const service = new TaskService(supabase);
  
  try {
    // Health Check
    console.log('📊 Testing health check...');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    console.log(`  Task count: ${health.details.taskCount}`);
    console.log(`  Enhanced view: ${health.details.enhancedViewAccessible ? 'accessible' : 'not accessible'}`);
    
    // List Tasks
    console.log('\n📊 Testing task listing...');
    const listStart = Date.now();
    const tasks = await service.getTasks();
    const listDuration = Date.now() - listStart;
    console.log(`✓ List tasks: ${listDuration}ms (found ${tasks.length} tasks)`);
    
    // Filter tasks by status
    if (tasks.length > 0) {
      console.log('\n📊 Testing filtered task listing...');
      
      // By status
      const statusStart = Date.now();
      const pendingTasks = await service.getTasks({ status: 'pending' });
      const statusDuration = Date.now() - statusStart;
      console.log(`✓ Filter by status: ${statusDuration}ms (found ${pendingTasks.length} pending tasks)`);
      
      // By priority
      const priorityStart = Date.now();
      const highPriorityTasks = await service.getTasks({ priority: 'high' });
      const priorityDuration = Date.now() - priorityStart;
      console.log(`✓ Filter by priority: ${priorityDuration}ms (found ${highPriorityTasks.length} high priority tasks)`);
      
      // Search
      const searchStart = Date.now();
      const searchTasks = await service.getTasks({ search: 'fix' });
      const searchDuration = Date.now() - searchStart;
      console.log(`✓ Search tasks: ${searchDuration}ms (found ${searchTasks.length} tasks with "fix")`);
      
      // Get single task
      const taskId = tasks[0].id;
      console.log('\n📊 Testing single task retrieval...');
      const getStart = Date.now();
      const task = await service.getTask(taskId);
      const getDuration = Date.now() - getStart;
      console.log(`✓ Get task: ${getDuration}ms`);
      console.log(`  Title: ${task.title}`);
      console.log(`  Status: ${task.status}`);
      console.log(`  Priority: ${task.priority}`);
      
      // Get task tags
      console.log('\n📊 Testing tag operations...');
      const tagsStart = Date.now();
      const tags = await service.getTaskTags(taskId);
      const tagsDuration = Date.now() - tagsStart;
      console.log(`✓ Get tags: ${tagsDuration}ms (found ${tags.length} tags)`);
      
      // Get task files
      console.log('\n📊 Testing file operations...');
      const filesStart = Date.now();
      const files = await service.getTaskFiles(taskId);
      const filesDuration = Date.now() - filesStart;
      console.log(`✓ Get files: ${filesDuration}ms (found ${files.length} files)`);
      
      // Get task commits
      console.log('\n📊 Testing git integration...');
      const commitsStart = Date.now();
      const commits = await service.getTaskCommits(taskId);
      const commitsDuration = Date.now() - commitsStart;
      console.log(`✓ Get commits: ${commitsDuration}ms (found ${commits.length} commits)`);
      
      // Get work sessions
      const sessionsStart = Date.now();
      const sessions = await service.getTaskWorkSessions(taskId);
      const sessionsDuration = Date.now() - sessionsStart;
      console.log(`✓ Get work sessions: ${sessionsDuration}ms (found ${sessions.length} sessions)`);
    }
    
    // Test task creation and update
    console.log('\n📊 Testing task creation/update...');
    const createStart = Date.now();
    const newTask = await service.createTask({
      title: 'Benchmark Test Task',
      description: 'Created for benchmarking TaskService',
      task_type: 'documentation',
      priority: 'low'
    });
    const createDuration = Date.now() - createStart;
    console.log(`✓ Create task: ${createDuration}ms`);
    
    if (newTask) {
      // Update task
      const updateStart = Date.now();
      const updatedTask = await service.updateTask(newTask.id, {
        status: 'in_progress',
        description: 'Updated during benchmark'
      });
      const updateDuration = Date.now() - updateStart;
      console.log(`✓ Update task: ${updateDuration}ms`);
      
      // Add tag
      const addTagStart = Date.now();
      const tag = await service.addTag(newTask.id, 'benchmark');
      const addTagDuration = Date.now() - addTagStart;
      console.log(`✓ Add tag: ${addTagDuration}ms`);
      
      // Add file
      const addFileStart = Date.now();
      const file = await service.addFile(newTask.id, '/benchmark/test.ts');
      const addFileDuration = Date.now() - addFileStart;
      console.log(`✓ Add file: ${addFileDuration}ms`);
      
      // Start work session
      const sessionStart = Date.now();
      const session = await service.startWorkSession(newTask.id);
      const sessionDuration = Date.now() - sessionStart;
      console.log(`✓ Start work session: ${sessionDuration}ms`);
      
      // End work session
      if (session) {
        const endSessionStart = Date.now();
        await service.endWorkSession(session.id, 'Benchmark completed', ['/benchmark/test.ts']);
        const endSessionDuration = Date.now() - endSessionStart;
        console.log(`✓ End work session: ${endSessionDuration}ms`);
      }
      
      // Complete task
      const completeStart = Date.now();
      await service.completeTask(newTask.id, 'Task completed during benchmark');
      const completeDuration = Date.now() - completeStart;
      console.log(`✓ Complete task: ${completeDuration}ms`);
      
      // Clean up - delete test task
      const deleteStart = Date.now();
      await service.deleteTask(newTask.id);
      const deleteDuration = Date.now() - deleteStart;
      console.log(`✓ Delete task: ${deleteDuration}ms`);
    }
    
    // Display metrics
    console.log('\n📈 Service Metrics:');
    const metrics = service.getMetrics();
    console.log(`  Tasks created: ${metrics.tasksCreated}`);
    console.log(`  Tasks updated: ${metrics.tasksUpdated}`);
    console.log(`  Tasks deleted: ${metrics.tasksDeleted}`);
    console.log(`  Tasks completed: ${metrics.tasksCompleted}`);
    console.log(`  Tags added: ${metrics.tagsAdded}`);
    console.log(`  Files tracked: ${metrics.filesTracked}`);
    console.log(`  Work sessions: ${metrics.workSessionsStarted}`);
    console.log(`  Errors: ${metrics.errors}`);
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  benchmark().catch(console.error);
}

export { benchmark };