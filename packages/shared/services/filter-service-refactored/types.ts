/**
 * Represents a filter profile that can be applied to queries
 */
export interface FilterProfile {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean | null;
  created_at?: string | null;
}

/**
 * Represents a drive association for a filter profile
 */
export interface FilterProfileDrive {
  id: string;
  profile_id: string | null;
  root_drive_id: string;
  include_children?: boolean | null;
}

/**
 * Configuration options for FilterService
 */
export interface FilterServiceConfig {
  maxSourceIds?: number; // Maximum source IDs to include in query filter (default: 1500)
  enableCaching?: boolean; // Enable drive ID caching (default: true)
}

/**
 * Result of applying a filter to a query
 */
export interface FilterQueryResult<T = any> {
  query: T;
  filtered: boolean;
  sourceCount?: number;
  profileId?: string;
}