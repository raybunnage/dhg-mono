/**
 * Application-specific Supabase types and re-exports
 * 
 * For database types, this file re-exports from the central types file.
 * New code should preferably import directly from /supabase/types.ts
 * when only database types are needed.
 */

// Re-export all types from the central Supabase types file
export * from '../../../../supabase/types';

// Additional application-specific types
export type SourceGoogle = Database['public']['Tables']['sources_google']['Row'];

// Generic API response type
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
