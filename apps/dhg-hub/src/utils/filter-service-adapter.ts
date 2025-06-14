// MIGRATED: This file now uses the enhanced shared FilterService
// Original implementation backed up as filter-service-adapter.ts.backup
// The shared service includes all the functionality plus more

export { filterService } from './filter-service-enhanced';
export type { FilterProfile } from './filter-service-enhanced';

// Legacy exports for backward compatibility
export const FilterService = filterService;
export type FilterProfileDrive = {
  id: string;
  profile_id: string;
  root_drive_id: string;
  include_children?: boolean | null;
};
