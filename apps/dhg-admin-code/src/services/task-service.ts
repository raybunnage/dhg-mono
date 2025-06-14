/**
 * Task Service Adapter
 * Wraps the shared DevTaskService for backward compatibility
 */

import { supabase } from '../lib/supabase';
import { DevTaskService } from '@shared/services/dev-task-service';

// Re-export types for backward compatibility
export type {
  DevTask,
  DevTaskTag,
  DevTaskFile,
  DevTaskCommit,
  DevTaskWorkSession
} from '@shared/services/dev-task-service';

// Create a singleton instance for this app
const devTaskService = DevTaskService.getInstance(supabase);

export class TaskService {
  // Delegate all static methods to the shared service instance
  static async getTasks(filters?: {
    status?: string;
    priority?: string;
    search?: string;
    app?: string;
  }) {
    return devTaskService.getTasks(filters);
  }

  static async getTask(id: string) {
    return devTaskService.getTask(id);
  }

  static async createTask(task: Parameters<typeof devTaskService.createTask>[0]) {
    return devTaskService.createTask(task);
  }

  static async updateTask(id: string, updates: Parameters<typeof devTaskService.updateTask>[1]) {
    return devTaskService.updateTask(id, updates);
  }

  static async deleteTask(id: string) {
    return devTaskService.deleteTask(id);
  }

  static async getTaskTags(taskId: string) {
    return devTaskService.getTaskTags(taskId);
  }

  static async addTag(taskId: string, tag: string) {
    return devTaskService.addTag(taskId, tag);
  }

  static async removeTag(tagId: string) {
    return devTaskService.removeTag(tagId);
  }

  static async getTaskFiles(taskId: string) {
    return devTaskService.getTaskFiles(taskId);
  }

  static async addFile(taskId: string, filePath: string, action: 'created' | 'modified' | 'deleted' = 'modified') {
    return devTaskService.addFile(taskId, filePath, action);
  }

  static async removeFile(fileId: string) {
    return devTaskService.removeFile(fileId);
  }

  static async getTaskCommits(taskId: string) {
    return devTaskService.getTaskCommits(taskId);
  }

  static async getTaskWorkSessions(taskId: string) {
    return devTaskService.getTaskWorkSessions(taskId);
  }

  static formatForClaude(task: Parameters<typeof devTaskService.formatForClaude>[0], tags: string[] = []) {
    return devTaskService.formatForClaude(task, tags);
  }

  static async completeTask(id: string, claudeResponse: string) {
    return devTaskService.completeTask(id, claudeResponse);
  }

  static async startWorkSession(taskId: string) {
    return devTaskService.startWorkSession(taskId);
  }

  static async endWorkSession(sessionId: string, summary: string, filesModified?: string[]) {
    return devTaskService.endWorkSession(sessionId, summary, filesModified);
  }

  static async updateWorkSessionClaude(sessionId: string, claudeSessionId: string) {
    return devTaskService.updateWorkSessionClaude(sessionId, claudeSessionId);
  }
}