/**
 * Mock Data Factory
 * Creates consistent test data for service testing
 */

import type { Database } from '../../../supabase/types';

type DocumentTypeRow = Database['public']['Tables']['document_types']['Row'];
type ExpertProfileRow = Database['public']['Tables']['expert_profiles']['Row'];

export class MockDataFactory {
  /**
   * Create a mock Supabase record with proper UUID and timestamps
   */
  static createSupabaseRecord<T extends Record<string, any>>(
    table: string, 
    overrides: Partial<T> = {}
  ): T {
    const baseRecord = {
      id: this.generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: this.getTestUserId(),
      updated_by: this.getTestUserId(),
      ...overrides
    };

    return baseRecord as T;
  }

  /**
   * Create a mock Google Drive file for testing
   */
  static createGoogleDriveFile(type: 'audio' | 'document' | 'video'): any {
    const baseId = this.generateDriveId();
    const extensions = {
      audio: 'm4a',
      document: 'pdf', 
      video: 'mp4'
    };

    return {
      id: baseId,
      name: `test-${type}-file.${extensions[type]}`,
      mimeType: this.getMimeType(type),
      webViewLink: `https://drive.google.com/file/d/${baseId}/view`,
      webContentLink: `https://drive.google.com/uc?id=${baseId}&export=download`,
      size: Math.floor(Math.random() * 10000000), // Random size up to 10MB
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
      parents: ['1234567890abcdef'],
      capabilities: {
        canDownload: true,
        canEdit: false
      }
    };
  }

  /**
   * Create a mock auth profile for testing
   */
  static createAuthProfile(role: 'admin' | 'user' = 'user'): Partial<ExpertProfileRow> {
    return this.createSupabaseRecord<Partial<ExpertProfileRow>>('expert_profiles', {
      expert_name: `Test ${role} User`,
      email: `test-${role}@example.com`,
      bio: `Test ${role} profile for service testing`,
      phone: '+1-555-TEST',
      linkedin: `https://linkedin.com/in/test-${role}`,
      website: `https://test-${role}.example.com`
    });
  }

  /**
   * Create mock document type for testing
   */
  static createDocumentType(docType: string): Partial<DocumentTypeRow> {
    return this.createSupabaseRecord<Partial<DocumentTypeRow>>('document_types', {
      document_type: docType,
      description: `Test document type: ${docType}`,
      file_extensions: ['.txt', '.md'],
      mime_types: ['text/plain', 'text/markdown']
    });
  }

  /**
   * Create error scenarios for testing edge cases
   */
  static createErrorScenario(type: 'network' | 'auth' | 'validation'): {
    name: string;
    error: Error;
    expectedBehavior: string;
  } {
    const scenarios = {
      network: {
        name: 'Network Timeout',
        error: new Error('ETIMEDOUT: Connection timed out'),
        expectedBehavior: 'Service should retry with exponential backoff'
      },
      auth: {
        name: 'Authentication Failed',
        error: new Error('Invalid JWT token'),
        expectedBehavior: 'Service should handle auth errors gracefully'
      },
      validation: {
        name: 'Invalid Input Data',
        error: new Error('Required field missing: id'),
        expectedBehavior: 'Service should validate inputs and return clear error messages'
      }
    };

    return scenarios[type];
  }

  /**
   * Create test environment variables
   */
  static createTestEnvironment(): Record<string, string> {
    return {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key-' + this.generateRandomString(50),
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-' + this.generateRandomString(50),
      CLAUDE_API_KEY: 'test-claude-key-' + this.generateRandomString(30),
      NODE_ENV: 'test'
    };
  }

  /**
   * Generate a realistic UUID v4
   */
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Generate a Google Drive file ID
   */
  private static generateDriveId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < 33; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random string of specified length
   */
  private static generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get test user ID (consistent across tests)
   */
  private static getTestUserId(): string {
    return '00000000-0000-0000-0000-000000000001'; // Test user ID
  }

  /**
   * Get MIME type for file type
   */
  private static getMimeType(type: 'audio' | 'document' | 'video'): string {
    const mimeTypes = {
      audio: 'audio/mp4',
      document: 'application/pdf',
      video: 'video/mp4'
    };
    return mimeTypes[type];
  }
}