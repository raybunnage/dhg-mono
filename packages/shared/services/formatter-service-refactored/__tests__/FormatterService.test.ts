/**
 * FormatterService Tests
 * 
 * Tests the FormatterService singleton that provides consistent formatting
 * utilities for dates, numbers, strings, bytes, durations, and CLI output.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormatterService } from '../FormatterService';

describe('FormatterService', () => {
  let service: FormatterService;

  beforeEach(() => {
    service = FormatterService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const service1 = FormatterService.getInstance();
      const service2 = FormatterService.getInstance();
      expect(service1).toBe(service2);
    });

    it('should initialize successfully', async () => {
      await expect(service.ensureInitialized()).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details).toHaveProperty('locale');
      expect(health.details).toHaveProperty('timezone');
      expect(health.details).toHaveProperty('chalkEnabled');
    });
  });

  describe('Date Formatting', () => {
    const testDate = new Date('2024-01-15T10:30:00Z');

    it('should format date in ISO format', () => {
      const formatted = service.formatDate(testDate, 'iso');
      expect(formatted).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should format date in short format', () => {
      const formatted = service.formatDate(testDate, 'short');
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it('should format date in medium format', () => {
      const formatted = service.formatDate(testDate, 'medium');
      expect(formatted).toContain('2024');
    });

    it('should format date in long format', () => {
      const formatted = service.formatDate(testDate, 'long');
      expect(formatted).toContain('Monday');
      expect(formatted).toContain('January');
    });

    it('should handle invalid dates', () => {
      const formatted = service.formatDate('invalid-date');
      expect(formatted).toBe('Invalid Date');
    });

    it('should handle null/undefined dates', () => {
      expect(service.formatDate(null as any)).toBe('');
      expect(service.formatDate(undefined as any)).toBe('');
    });

    it('should accept string dates', () => {
      const formatted = service.formatDate('2024-01-15T10:30:00Z', 'iso');
      expect(formatted).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should accept timestamp dates', () => {
      const timestamp = testDate.getTime();
      const formatted = service.formatDate(timestamp, 'iso');
      expect(formatted).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('Relative Time Formatting', () => {
    const baseDate = new Date('2024-01-15T10:30:00Z');

    it('should format "just now" for same time', () => {
      const result = service.formatRelativeTime(baseDate, baseDate);
      expect(result).toBe('just now');
    });

    it('should format seconds ago', () => {
      const pastDate = new Date(baseDate.getTime() - 30000); // 30 seconds ago
      const result = service.formatRelativeTime(pastDate, baseDate);
      expect(result).toBe('30 seconds ago');
    });

    it('should format minutes ago', () => {
      const pastDate = new Date(baseDate.getTime() - 300000); // 5 minutes ago
      const result = service.formatRelativeTime(pastDate, baseDate);
      expect(result).toBe('5 minutes ago');
    });

    it('should format hours ago', () => {
      const pastDate = new Date(baseDate.getTime() - 7200000); // 2 hours ago
      const result = service.formatRelativeTime(pastDate, baseDate);
      expect(result).toBe('2 hours ago');
    });

    it('should format days ago', () => {
      const pastDate = new Date(baseDate.getTime() - 259200000); // 3 days ago
      const result = service.formatRelativeTime(pastDate, baseDate);
      expect(result).toBe('3 days ago');
    });

    it('should format future times', () => {
      const futureDate = new Date(baseDate.getTime() + 3600000); // 1 hour from now
      const result = service.formatRelativeTime(futureDate, baseDate);
      expect(result).toBe('1 hour from now');
    });

    it('should handle invalid dates', () => {
      const result = service.formatRelativeTime('invalid-date', baseDate);
      expect(result).toBe('Invalid Date');
    });
  });

  describe('Byte Formatting', () => {
    it('should format zero bytes', () => {
      expect(service.formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(service.formatBytes(512)).toBe('512 Bytes');
    });

    it('should format kilobytes (binary)', () => {
      expect(service.formatBytes(1024)).toBe('1 KiB');
      expect(service.formatBytes(1536)).toBe('1.5 KiB');
    });

    it('should format megabytes (binary)', () => {
      expect(service.formatBytes(1048576)).toBe('1 MiB');
      expect(service.formatBytes(1572864)).toBe('1.5 MiB');
    });

    it('should format with decimal units', () => {
      expect(service.formatBytes(1000, 2, false)).toBe('1 KB');
      expect(service.formatBytes(1500, 2, false)).toBe('1.5 KB');
    });

    it('should handle decimal precision', () => {
      expect(service.formatBytes(1536, 0)).toBe('2 KiB');
      expect(service.formatBytes(1536, 3)).toBe('1.5 KiB');
    });
  });

  describe('Number Formatting', () => {
    it('should format basic numbers', () => {
      expect(service.formatNumber(1234)).toBe('1,234');
      expect(service.formatNumber(1234567)).toBe('1,234,567');
    });

    it('should format with custom options', () => {
      const result = service.formatNumber(1234.567, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      expect(result).toBe('1,234.57');
    });

    it('should format currency', () => {
      const result = service.formatNumber(1234.50, {
        style: 'currency',
        currency: 'USD'
      });
      expect(result).toContain('$');
      expect(result).toContain('1,235'); // Note: toFixed rounds 1234.50 to 1,235
    });

    it('should format percentages', () => {
      const result = service.formatNumber(0.1234, {
        style: 'percent'
      });
      expect(result).toContain('%');
    });
  });

  describe('Percentage Formatting', () => {
    it('should format decimal as percentage', () => {
      expect(service.formatPercentage(0.1234)).toBe('12.3%');
    });

    it('should format without multiplication', () => {
      expect(service.formatPercentage(12.34, 1, false)).toBe('12.3%');
    });

    it('should handle custom decimal places', () => {
      expect(service.formatPercentage(0.12345, 3)).toBe('12.345%');
      expect(service.formatPercentage(0.12345, 0)).toBe('12%');
    });
  });

  describe('Title Case Formatting', () => {
    it('should format snake_case', () => {
      expect(service.formatTitleCase('hello_world')).toBe('Hello World');
    });

    it('should format kebab-case', () => {
      expect(service.formatTitleCase('hello-world')).toBe('Hello World');
    });

    it('should format camelCase', () => {
      expect(service.formatTitleCase('helloWorld')).toBe('Hello World');
    });

    it('should handle multiple separators', () => {
      expect(service.formatTitleCase('hello-world_test')).toBe('Hello World Test');
    });

    it('should handle empty/null strings', () => {
      expect(service.formatTitleCase('')).toBe('');
      expect(service.formatTitleCase(null as any)).toBe('');
    });
  });

  describe('CLI Formatting', () => {
    it('should format success messages', () => {
      const result = service.formatCli('Success!', 'success');
      // Should contain ANSI escape codes for green color
      expect(result).toBeTruthy();
    });

    it('should format error messages', () => {
      const result = service.formatCli('Error!', 'error');
      expect(result).toBeTruthy();
    });

    it('should format warning messages', () => {
      const result = service.formatCli('Warning!', 'warning');
      expect(result).toBeTruthy();
    });

    it('should format info messages', () => {
      const result = service.formatCli('Info', 'info');
      expect(result).toBeTruthy();
    });

    it('should format headings', () => {
      const result = service.formatCli('Heading', 'heading');
      expect(result).toBeTruthy();
    });

    it('should format dim text', () => {
      const result = service.formatCli('Dim text', 'dim');
      expect(result).toBeTruthy();
    });
  });

  describe('Duration Formatting', () => {
    it('should format milliseconds', () => {
      expect(service.formatDuration(500, { showMilliseconds: true })).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(service.formatDuration(5000)).toBe('5 seconds');
      expect(service.formatDuration(1000)).toBe('1 second');
    });

    it('should format minutes', () => {
      expect(service.formatDuration(120000)).toBe('2 minutes');
      expect(service.formatDuration(60000)).toBe('1 minute');
    });

    it('should format hours', () => {
      expect(service.formatDuration(7200000)).toBe('2 hours');
      expect(service.formatDuration(3600000)).toBe('1 hour');
    });

    it('should format days', () => {
      expect(service.formatDuration(172800000)).toBe('2 days');
      expect(service.formatDuration(86400000)).toBe('1 day');
    });

    it('should format compact duration', () => {
      expect(service.formatDuration(3661000, { compact: true })).toBe('1h 1m 1s');
    });

    it('should format with specific units', () => {
      const result = service.formatDuration(3661000, {
        units: ['hours', 'minutes']
      });
      expect(result).toBe('1 hour, 1 minute');
    });

    it('should handle complex durations', () => {
      const duration = 90061000; // 1 day, 1 hour, 1 minute, 1 second
      const result = service.formatDuration(duration);
      expect(result).toContain('day');
      expect(result).toContain('hour');
      expect(result).toContain('minute');
      expect(result).toContain('second');
    });
  });

  describe('String Truncation', () => {
    const longText = 'This is a very long text that needs to be truncated';

    it('should truncate from end', () => {
      const result = service.truncate(longText, 20);
      expect(result).toBe('This is a very lo...');
      expect(result.length).toBe(20);
    });

    it('should truncate from start', () => {
      const result = service.truncate(longText, 20, { position: 'start' });
      expect(result).toBe('...s to be truncated');
      expect(result.length).toBe(20);
    });

    it('should truncate from middle', () => {
      const result = service.truncate(longText, 20, { position: 'middle' });
      expect(result).toContain('...');
      expect(result.length).toBe(20);
    });

    it('should not truncate short text', () => {
      const shortText = 'Short';
      expect(service.truncate(shortText, 20)).toBe('Short');
    });

    it('should handle custom suffix', () => {
      const result = service.truncate(longText, 20, { suffix: '***' });
      expect(result).toBe('This is a very lo***'); // Available length is 20 - 3 = 17
    });

    it('should handle empty/null strings', () => {
      expect(service.truncate('', 10)).toBe('');
      expect(service.truncate(null as any, 10)).toBe('');
    });
  });

  describe('File Path Formatting', () => {
    const testPath = '/Users/test/Documents/file.txt';

    it('should show filename only by default', () => {
      const result = service.formatFilePath(testPath);
      expect(result).toBe('file.txt');
    });

    it('should show full path when requested', () => {
      const result = service.formatFilePath(testPath, { showFullPath: true });
      expect(result).toBe(testPath);
    });

    it('should truncate long paths', () => {
      const result = service.formatFilePath(testPath, {
        showFullPath: true,
        maxLength: 20
      });
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toContain('...');
    });

    it('should handle empty paths', () => {
      expect(service.formatFilePath('')).toBe('');
      expect(service.formatFilePath(null as any)).toBe('');
    });
  });

  describe('List Formatting', () => {
    it('should format single item', () => {
      expect(service.formatList(['item1'])).toBe('item1');
    });

    it('should format two items', () => {
      expect(service.formatList(['item1', 'item2'])).toBe('item1 and item2');
    });

    it('should format multiple items with Oxford comma', () => {
      expect(service.formatList(['item1', 'item2', 'item3'])).toBe('item1, item2, and item3');
    });

    it('should use "or" conjunction', () => {
      expect(service.formatList(['item1', 'item2'], { conjunction: 'or' })).toBe('item1 or item2');
    });

    it('should handle empty arrays', () => {
      expect(service.formatList([])).toBe('');
      expect(service.formatList(null as any)).toBe('');
    });
  });

  describe('Plural Formatting', () => {
    it('should format singular', () => {
      expect(service.formatPlural(1, 'item')).toBe('1 item');
    });

    it('should format plural', () => {
      expect(service.formatPlural(2, 'item')).toBe('2 items');
      expect(service.formatPlural(0, 'item')).toBe('0 items');
    });

    it('should use custom plural form', () => {
      expect(service.formatPlural(2, 'child', 'children')).toBe('2 children');
    });
  });

  describe('JSON Formatting', () => {
    it('should format valid JSON', () => {
      const obj = { name: 'test', value: 123 };
      const result = service.formatJson(obj);
      expect(result).toContain('"name": "test"');
      expect(result).toContain('"value": 123');
    });

    it('should handle invalid JSON', () => {
      const circular: any = {};
      circular.self = circular;
      const result = service.formatJson(circular);
      expect(result).toBe('Invalid JSON');
    });

    it('should use custom indentation', () => {
      const obj = { name: 'test' };
      const result = service.formatJson(obj, 4);
      expect(result).toContain('    "name"'); // 4-space indent
    });
  });

  describe('Table Formatting', () => {
    const headers = ['Name', 'Age', 'City'];
    const rows = [
      ['John', '30', 'New York'],
      ['Jane', '25', 'Los Angeles']
    ];

    it('should format basic table', () => {
      const result = service.formatTable(headers, rows);
      expect(result).toContain('Name');
      expect(result).toContain('Age');
      expect(result).toContain('City');
      expect(result).toContain('John');
      expect(result).toContain('Jane');
      expect(result).toContain('---'); // Separator line
    });

    it('should handle custom padding', () => {
      const result = service.formatTable(headers, rows, { padding: 4 });
      expect(result).toBeTruthy();
    });

    it('should handle empty cells', () => {
      const rowsWithEmpty = [
        ['John', '', 'New York'],
        ['Jane', '25', '']
      ];
      const result = service.formatTable(headers, rowsWithEmpty);
      expect(result).toBeTruthy();
    });
  });

  describe('Issue Type Formatting', () => {
    it('should format snake_case issue types', () => {
      expect(service.formatIssueType('missing_primary_key')).toBe('Missing Primary Key');
    });

    it('should format single word', () => {
      expect(service.formatIssueType('error')).toBe('Error');
    });

    it('should handle empty strings', () => {
      expect(service.formatIssueType('')).toBe('');
      expect(service.formatIssueType(null as any)).toBe('');
    });
  });

  describe('Configuration', () => {
    it('should set default locale', () => {
      service.setDefaultLocale('fr-FR');
      // Test would require checking internal state or formatting output
      expect(() => service.setDefaultLocale('fr-FR')).not.toThrow();
    });

    it('should set default timezone', () => {
      service.setDefaultTimezone('America/New_York');
      expect(() => service.setDefaultTimezone('America/New_York')).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle null inputs gracefully', () => {
      expect(() => service.formatDate(null as any)).not.toThrow();
      expect(() => service.formatTitleCase(null as any)).not.toThrow();
      expect(() => service.formatFilePath(null as any)).not.toThrow();
    });

    it('should handle undefined inputs gracefully', () => {
      expect(() => service.formatDate(undefined as any)).not.toThrow();
      expect(() => service.truncate(undefined as any, 10)).not.toThrow();
    });
  });
});