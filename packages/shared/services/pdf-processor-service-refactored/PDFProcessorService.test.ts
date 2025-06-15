/**
 * PDFProcessorService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PDFProcessorService } from './PDFProcessorService';
import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Mock dependencies
vi.mock('fs');
vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn)
}));

vi.mock('../claude-service', () => ({
  claudeService: {
    analyzePdf: vi.fn()
  }
}));

vi.mock('../google-drive/google-auth-service', () => ({
  GoogleAuthService: {
    getDefaultInstance: vi.fn(() => ({}))
  }
}));

vi.mock('../google-drive', () => ({
  GoogleDriveService: {
    getInstance: vi.fn(() => ({
      getFile: vi.fn()
    }))
  }
}));

const mockSupabase = {} as SupabaseClient;

describe('PDFProcessorService', () => {
  let service: PDFProcessorService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    (PDFProcessorService as any).instance = undefined;
    
    // Mock fs functions
    (fs.promises as any) = {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readdir: vi.fn(() => []),
      rm: vi.fn()
    };
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PDFProcessorService.getInstance(mockSupabase);
      const instance2 = PDFProcessorService.getInstance(mockSupabase);
      expect(instance1).toBe(instance2);
      service = instance1;
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize successfully', async () => {
      service = PDFProcessorService.getInstance(mockSupabase);
      await expect(service['initialize']()).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      service = PDFProcessorService.getInstance(mockSupabase);
      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details.metrics).toBeDefined();
    });
  });

  describe('PDF Processing', () => {
    beforeEach(() => {
      service = PDFProcessorService.getInstance(mockSupabase);
    });

    it('should track metrics', () => {
      const metrics = service.getMetrics();
      expect(metrics.totalProcessed).toBe(0);
      expect(metrics.cacheHits).toBe(0);
    });

    it('should reset metrics', () => {
      service.resetMetrics();
      const metrics = service.getMetrics();
      expect(metrics.totalProcessed).toBe(0);
    });
  });
});