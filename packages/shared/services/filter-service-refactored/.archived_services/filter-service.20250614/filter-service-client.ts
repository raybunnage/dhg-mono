import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
import { FilterService, FilterProfile } from './filter-service';

/**
 * Browser-specific singleton client for FilterService
 * This automatically configures the Supabase client for browser environment
 */
export class FilterServiceClient {
  private static instance: FilterService | null = null;

  /**
   * Gets the singleton instance of FilterService configured for browser
   * @returns The FilterService instance
   */
  public static getInstance(): FilterService {
    if (!this.instance) {
      const supabase = createSupabaseAdapter();
      this.instance = new FilterService(supabase);
    }
    return this.instance;
  }

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {}
}

// Export the FilterProfile type for convenience
export type { FilterProfile };