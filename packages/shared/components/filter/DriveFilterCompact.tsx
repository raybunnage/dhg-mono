import React from 'react';
import { FilterService } from '../../services/filter-service/filter-service';
import { DriveFilterCombobox } from './DriveFilterCombobox';

export interface DriveFilterCompactProps {
  /** The FilterService instance to use */
  filterService: FilterService;
  /** Optional CSS classes to apply */
  className?: string;
  /** Callback when filter changes */
  onFilterChange?: (profileId: string | null, profile: any) => void;
}

/**
 * Compact drive filter component for use in headers, sidebars, or toolbars
 * Shows only the dropdown without labels or current filter info
 */
export const DriveFilterCompact: React.FC<DriveFilterCompactProps> = ({
  filterService,
  className = '',
  onFilterChange
}) => {
  return (
    <DriveFilterCombobox
      filterService={filterService}
      className={className}
      onFilterChange={onFilterChange}
      label=""
      showSuccessMessages={false}
      showErrorMessages={false}
      showCurrentFilterInfo={false}
    />
  );
};