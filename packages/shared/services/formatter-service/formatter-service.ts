/**
 * Formatter Service
 * 
 * A singleton service for consistent formatting of various data types
 * throughout the application, including dates, numbers, strings, and CLI output.
 */

import * as chalk from 'chalk';

export class FormatterService {
  private static instance: FormatterService;
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  public static getInstance(): FormatterService {
    if (!FormatterService.instance) {
      FormatterService.instance = new FormatterService();
    }
    return FormatterService.instance;
  }

  /**
   * Format a date to string with configurable format
   * @param date Date to format
   * @param format Format style ('iso', 'short', 'medium', 'long' or custom format)
   * @returns Formatted date string
   */
  public formatDate(date: Date | string | number, format: 'iso' | 'short' | 'medium' | 'long' | string = 'medium'): string {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    switch (format) {
      case 'iso':
        return dateObj.toISOString();
      case 'short':
        return dateObj.toLocaleDateString();
      case 'medium':
        return dateObj.toLocaleString();
      case 'long':
        return dateObj.toLocaleString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      default:
        return dateObj.toLocaleString();
    }
  }
  
  /**
   * Format a number as bytes (KB, MB, GB, etc.)
   * @param bytes Number of bytes
   * @param decimals Number of decimal places
   * @returns Formatted string with appropriate unit
   */
  public formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }
  
  /**
   * Format snake_case or kebab-case strings to Title Case
   * @param text String to format
   * @returns Formatted string in Title Case
   */
  public formatTitleCase(text: string): string {
    if (!text) return '';
    
    // Handle snake_case and kebab-case
    const words = text.split(/[_-]/);
    
    return words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  /**
   * Format a number with commas as thousands separators
   * @param number Number to format
   * @param decimals Number of decimal places
   * @returns Formatted number string
   */
  public formatNumber(number: number, decimals: number = 0): string {
    return number.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  
  /**
   * Format a percentage value
   * @param value Number to format as percentage
   * @param decimals Number of decimal places
   * @returns Formatted percentage string
   */
  public formatPercentage(value: number, decimals: number = 1): string {
    return `${(value * 100).toFixed(decimals)}%`;
  }
  
  /**
   * Format text for CLI output with color
   * @param text Text to format
   * @param type Type of formatting to apply
   * @returns Chalk-formatted string
   */
  public formatCli(text: string, type: 'success' | 'warning' | 'error' | 'info' | 'heading' = 'info'): string {
    switch (type) {
      case 'success':
        return chalk.green(text);
      case 'warning':
        return chalk.yellow(text);
      case 'error':
        return chalk.red(text);
      case 'info':
        return chalk.blue(text);
      case 'heading':
        return chalk.bold(text);
      default:
        return text;
    }
  }
  
  /**
   * Format an elapsed time duration in milliseconds to a human-readable string
   * @param milliseconds Time in milliseconds
   * @param showMilliseconds Whether to show milliseconds in the output
   * @returns Formatted duration string
   */
  public formatDuration(milliseconds: number, showMilliseconds: boolean = false): string {
    if (milliseconds < 1000 && showMilliseconds) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Format an issue type into a more readable string
   * (Extracted from schema-health.ts)
   * @param type Issue type string (e.g., "missing_primary_key")
   * @returns Formatted string (e.g., "Missing Primary Key")
   */
  public formatIssueType(type: string): string {
    if (!type) return '';
    
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Truncate a string if it exceeds the maximum length
   * @param text String to truncate
   * @param maxLength Maximum length before truncation
   * @param suffix Suffix to add when truncated (default: "...")
   * @returns Truncated string
   */
  public truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    
    return text.substring(0, maxLength - suffix.length) + suffix;
  }
  
  /**
   * Format a filepath for display, optionally showing only the filename
   * @param filePath Full file path
   * @param showFullPath Whether to show the full path or just the filename
   * @returns Formatted file path
   */
  public formatFilePath(filePath: string, showFullPath: boolean = false): string {
    if (!filePath) return '';
    
    if (showFullPath) {
      return filePath;
    }
    
    return filePath.split('/').pop() || filePath;
  }
}

// Export a singleton instance for use throughout the application
export const formatterService = FormatterService.getInstance();