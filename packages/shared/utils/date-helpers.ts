/**
 * Common date and time utilities
 */

/**
 * Get a date N days ago from now
 * @param days - Number of days to go back
 * @returns Date object
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Format date to ISO string for database queries
 * @param date - Date to format
 * @returns ISO string like "2024-01-15T10:30:00.000Z"
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Check if a date is within the last N days
 * @param date - Date to check
 * @param days - Number of days
 * @returns True if within range
 */
export function isWithinDays(date: Date | string, days: number): boolean {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const startDate = daysAgo(days);
  return checkDate >= startDate;
}

/**
 * Get the start of day for a given date
 * @param date - Date to process
 * @returns Date at 00:00:00
 */
export function startOfDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Get the end of day for a given date
 * @param date - Date to process
 * @returns Date at 23:59:59.999
 */
export function endOfDay(date: Date = new Date()): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Calculate the difference between two dates in various units
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Object with differences in various units
 */
export function dateDifference(date1: Date, date2: Date): {
  milliseconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
} {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  
  return {
    milliseconds: diffMs,
    seconds: Math.floor(diffMs / 1000),
    minutes: Math.floor(diffMs / (1000 * 60)),
    hours: Math.floor(diffMs / (1000 * 60 * 60)),
    days: Math.floor(diffMs / (1000 * 60 * 60 * 24))
  };
}

/**
 * Format date to human-readable string
 * @param date - Date to format
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string, 
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', options);
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param date - Date to compare
 * @param baseDate - Base date to compare against (default: now)
 * @returns Relative time string
 */
export function getRelativeTime(date: Date | string, baseDate: Date = new Date()): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const diff = dateDifference(dateObj, baseDate);
  const isFuture = dateObj > baseDate;
  
  if (diff.days > 0) {
    return isFuture ? `in ${diff.days} day${diff.days > 1 ? 's' : ''}` : `${diff.days} day${diff.days > 1 ? 's' : ''} ago`;
  } else if (diff.hours > 0) {
    return isFuture ? `in ${diff.hours} hour${diff.hours > 1 ? 's' : ''}` : `${diff.hours} hour${diff.hours > 1 ? 's' : ''} ago`;
  } else if (diff.minutes > 0) {
    return isFuture ? `in ${diff.minutes} minute${diff.minutes > 1 ? 's' : ''}` : `${diff.minutes} minute${diff.minutes > 1 ? 's' : ''} ago`;
  } else {
    return isFuture ? 'in a few seconds' : 'just now';
  }
}