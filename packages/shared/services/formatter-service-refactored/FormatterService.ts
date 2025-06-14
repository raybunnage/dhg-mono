/**
 * Formatter Service
 * 
 * A singleton service for consistent formatting of various data types
 * throughout the application, including dates, numbers, strings, and CLI output.
 * 
 * Refactored to extend SingletonService for proper lifecycle management.
 */

import chalk from 'chalk';
import { SingletonService } from '../base-classes/SingletonService';

// Format options for enhanced flexibility
export interface DateFormatOptions {
  locale?: string;
  timezone?: string;
  custom?: Intl.DateTimeFormatOptions;
}

export interface NumberFormatOptions {
  locale?: string;
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

/**
 * FormatterService provides consistent formatting utilities across the application.
 * 
 * @example
 * ```typescript
 * const formatter = FormatterService.getInstance();
 * await formatter.ensureInitialized();
 * 
 * const formatted = formatter.formatBytes(1024000); // "1000 KB"
 * const date = formatter.formatDate(new Date(), 'long');
 * ```
 */
export class FormatterService extends SingletonService {
  private static instance: FormatterService;
  private defaultLocale: string = 'en-US';
  private defaultTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  protected constructor() {
    super('FormatterService', {
      info: (msg: string) => console.log(`[FormatterService] ${msg}`),
      error: (msg: string, error?: any) => console.error(`[FormatterService] ${msg}`, error || ''),
      debug: (msg: string) => console.debug(`[FormatterService] ${msg}`),
      warn: (msg: string) => console.warn(`[FormatterService] ${msg}`)
    });
  }

  /**
   * Get the singleton instance of FormatterService
   */
  public static getInstance(): FormatterService {
    if (!FormatterService.instance) {
      FormatterService.instance = new FormatterService();
    }
    return FormatterService.instance;
  }

  /**
   * Ensure the service is initialized (public wrapper for protected method)
   */
  public async ensureInitialized(): Promise<void> {
    await super.ensureInitialized();
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('Initializing FormatterService');
    // Detect user's locale and timezone
    try {
      this.defaultLocale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
      this.defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      this.logger?.info(`Locale: ${this.defaultLocale}, Timezone: ${this.defaultTimezone}`);
    } catch (error) {
      this.logger?.warn('Failed to detect locale/timezone, using defaults', error);
    }
  }

  /**
   * Release resources (nothing to release for this service)
   */
  protected async releaseResources(): Promise<void> {
    this.logger?.info('FormatterService shutdown complete');
  }

  /**
   * Health check for the service
   */
  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: true,
      details: {
        locale: this.defaultLocale,
        timezone: this.defaultTimezone,
        chalkEnabled: chalk.level > 0
      }
    };
  }

  /**
   * Set default locale for formatting
   */
  public setDefaultLocale(locale: string): void {
    this.defaultLocale = locale;
    this.logger?.info(`Default locale set to: ${locale}`);
  }

  /**
   * Set default timezone for date formatting
   */
  public setDefaultTimezone(timezone: string): void {
    this.defaultTimezone = timezone;
    this.logger?.info(`Default timezone set to: ${timezone}`);
  }

  /**
   * Format a date to string with configurable format
   * @param date Date to format
   * @param format Format style ('iso', 'short', 'medium', 'long' or custom format)
   * @param options Additional formatting options
   * @returns Formatted date string
   */
  public formatDate(
    date: Date | string | number, 
    format: 'iso' | 'short' | 'medium' | 'long' | string = 'medium',
    options: DateFormatOptions = {}
  ): string {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const locale = options.locale || this.defaultLocale;
    const timezone = options.timezone || this.defaultTimezone;
    
    switch (format) {
      case 'iso':
        return dateObj.toISOString();
      case 'short':
        return dateObj.toLocaleDateString(locale, { timeZone: timezone });
      case 'medium':
        return dateObj.toLocaleString(locale, { timeZone: timezone });
      case 'long':
        return dateObj.toLocaleString(locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: timezone,
          ...options.custom
        });
      default:
        // Custom format options
        return dateObj.toLocaleString(locale, { timeZone: timezone, ...options.custom });
    }
  }

  /**
   * Format relative time (e.g., "2 hours ago", "in 3 days")
   */
  public formatRelativeTime(date: Date | string | number, baseDate: Date = new Date()): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const diffMs = dateObj.getTime() - baseDate.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);
    
    if (Math.abs(diffSec) < 60) {
      return diffSec === 0 ? 'just now' : `${Math.abs(diffSec)} seconds ${diffSec < 0 ? 'ago' : 'from now'}`;
    } else if (Math.abs(diffMin) < 60) {
      return `${Math.abs(diffMin)} minute${Math.abs(diffMin) !== 1 ? 's' : ''} ${diffMin < 0 ? 'ago' : 'from now'}`;
    } else if (Math.abs(diffHour) < 24) {
      return `${Math.abs(diffHour)} hour${Math.abs(diffHour) !== 1 ? 's' : ''} ${diffHour < 0 ? 'ago' : 'from now'}`;
    } else if (Math.abs(diffDay) < 30) {
      return `${Math.abs(diffDay)} day${Math.abs(diffDay) !== 1 ? 's' : ''} ${diffDay < 0 ? 'ago' : 'from now'}`;
    } else {
      return this.formatDate(dateObj, 'short');
    }
  }
  
  /**
   * Format a number as bytes (KB, MB, GB, etc.)
   * @param bytes Number of bytes
   * @param decimals Number of decimal places
   * @param binary Use binary (1024) vs decimal (1000) units
   * @returns Formatted string with appropriate unit
   */
  public formatBytes(bytes: number, decimals: number = 2, binary: boolean = true): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = binary ? 1024 : 1000;
    const sizes = binary 
      ? ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
      : ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
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
    
    // Handle snake_case, kebab-case, and camelCase
    const words = text
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
      .split(/[_-\s]+/); // snake_case, kebab-case, spaces
    
    return words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  /**
   * Format a number with commas as thousands separators
   * @param number Number to format
   * @param options Formatting options
   * @returns Formatted number string
   */
  public formatNumber(number: number, options: NumberFormatOptions = {}): string {
    const locale = options.locale || this.defaultLocale;
    
    return number.toLocaleString(locale, {
      style: options.style || 'decimal',
      currency: options.currency,
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
      maximumFractionDigits: options.maximumFractionDigits ?? 0
    });
  }
  
  /**
   * Format a percentage value
   * @param value Number to format as percentage
   * @param decimals Number of decimal places
   * @param multiply100 Whether to multiply by 100 (false if value is already a percentage)
   * @returns Formatted percentage string
   */
  public formatPercentage(value: number, decimals: number = 1, multiply100: boolean = true): string {
    const percentage = multiply100 ? value * 100 : value;
    return `${percentage.toFixed(decimals)}%`;
  }
  
  /**
   * Format text for CLI output with color
   * @param text Text to format
   * @param type Type of formatting to apply
   * @returns Chalk-formatted string
   */
  public formatCli(text: string, type: 'success' | 'warning' | 'error' | 'info' | 'heading' | 'dim' = 'info'): string {
    // Check if colors are supported
    if (chalk.level === 0) {
      return text;
    }
    
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
      case 'dim':
        return chalk.dim(text);
      default:
        return text;
    }
  }
  
  /**
   * Format an elapsed time duration in milliseconds to a human-readable string
   * @param milliseconds Time in milliseconds
   * @param options Formatting options
   * @returns Formatted duration string
   */
  public formatDuration(
    milliseconds: number, 
    options: { 
      showMilliseconds?: boolean;
      compact?: boolean;
      units?: ('days' | 'hours' | 'minutes' | 'seconds' | 'milliseconds')[];
    } = {}
  ): string {
    const { showMilliseconds = false, compact = false, units } = options;
    
    if (milliseconds < 1000 && showMilliseconds) {
      return `${milliseconds}ms`;
    }
    
    const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000));
    const hours = Math.floor((milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((milliseconds % (60 * 1000)) / 1000);
    const ms = milliseconds % 1000;
    
    const parts: string[] = [];
    
    if (days > 0 && (!units || units.includes('days'))) {
      parts.push(compact ? `${days}d` : `${days} day${days !== 1 ? 's' : ''}`);
    }
    if (hours > 0 && (!units || units.includes('hours'))) {
      parts.push(compact ? `${hours}h` : `${hours} hour${hours !== 1 ? 's' : ''}`);
    }
    if (minutes > 0 && (!units || units.includes('minutes'))) {
      parts.push(compact ? `${minutes}m` : `${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }
    if ((seconds > 0 || parts.length === 0) && (!units || units.includes('seconds'))) {
      parts.push(compact ? `${seconds}s` : `${seconds} second${seconds !== 1 ? 's' : ''}`);
    }
    if (showMilliseconds && ms > 0 && (!units || units.includes('milliseconds'))) {
      parts.push(`${ms}ms`);
    }
    
    return parts.join(compact ? ' ' : ', ');
  }
  
  /**
   * Format an issue type into a more readable string
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
   * @param options Truncation options
   * @returns Truncated string
   */
  public truncate(
    text: string, 
    maxLength: number, 
    options: {
      suffix?: string;
      position?: 'end' | 'middle' | 'start';
    } = {}
  ): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    
    const { suffix = '...', position = 'end' } = options;
    const availableLength = maxLength - suffix.length;
    
    switch (position) {
      case 'start':
        return suffix + text.substring(text.length - availableLength);
      case 'middle':
        const startLength = Math.floor(availableLength / 2);
        const endLength = Math.ceil(availableLength / 2);
        return text.substring(0, startLength) + suffix + text.substring(text.length - endLength);
      case 'end':
      default:
        return text.substring(0, availableLength) + suffix;
    }
  }
  
  /**
   * Format a filepath for display, optionally showing only the filename
   * @param filePath Full file path
   * @param options Display options
   * @returns Formatted file path
   */
  public formatFilePath(
    filePath: string, 
    options: {
      showFullPath?: boolean;
      maxLength?: number;
      homeSymbol?: boolean;
    } = {}
  ): string {
    if (!filePath) return '';
    
    const { showFullPath = false, maxLength, homeSymbol = true } = options;
    
    let formatted = filePath;
    
    // Replace home directory with ~
    if (homeSymbol && formatted.startsWith(process.env.HOME || '')) {
      formatted = formatted.replace(process.env.HOME || '', '~');
    }
    
    if (!showFullPath) {
      formatted = formatted.split('/').pop() || formatted;
    }
    
    if (maxLength && formatted.length > maxLength) {
      return this.truncate(formatted, maxLength, { position: 'middle' });
    }
    
    return formatted;
  }

  /**
   * Format a list of items with proper grammar (Oxford comma)
   */
  public formatList(items: string[], options: { conjunction?: 'and' | 'or' } = {}): string {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(` ${options.conjunction || 'and'} `);
    
    const conjunction = options.conjunction || 'and';
    const lastItem = items[items.length - 1];
    const otherItems = items.slice(0, -1);
    
    return `${otherItems.join(', ')}, ${conjunction} ${lastItem}`;
  }

  /**
   * Format a plural word based on count
   */
  public formatPlural(count: number, singular: string, plural?: string): string {
    if (count === 1) return `${count} ${singular}`;
    return `${count} ${plural || singular + 's'}`;
  }

  /**
   * Format JSON for pretty printing
   */
  public formatJson(obj: any, indent: number = 2): string {
    try {
      return JSON.stringify(obj, null, indent);
    } catch (error) {
      return 'Invalid JSON';
    }
  }

  /**
   * Format a table for CLI output
   */
  public formatTable(headers: string[], rows: string[][], options: { padding?: number } = {}): string {
    const { padding = 2 } = options;
    const columnWidths: number[] = headers.map((h, i) => {
      const columnValues = [h, ...rows.map(r => r[i] || '')];
      return Math.max(...columnValues.map(v => v.length));
    });
    
    const lines: string[] = [];
    
    // Header
    const headerRow = headers.map((h, i) => h.padEnd(columnWidths[i])).join(' '.repeat(padding));
    lines.push(headerRow);
    lines.push('-'.repeat(headerRow.length));
    
    // Rows
    rows.forEach(row => {
      const rowStr = row.map((cell, i) => (cell || '').padEnd(columnWidths[i])).join(' '.repeat(padding));
      lines.push(rowStr);
    });
    
    return lines.join('\n');
  }
}

// Export a singleton instance for backwards compatibility
export const formatterService = FormatterService.getInstance();