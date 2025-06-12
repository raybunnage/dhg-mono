import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const statusPillVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        // Task/Work status variants
        pending: 'bg-gray-50 text-gray-700 border border-gray-200',
        in_progress: 'bg-blue-50 text-blue-700 border border-blue-200',
        completed: 'bg-green-50 text-green-700 border border-green-200',
        failed: 'bg-red-50 text-red-700 border border-red-200',
        cancelled: 'bg-gray-100 text-gray-600 border border-gray-300',
        
        // Validation/Test status variants
        validated: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        not_validated: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
        validation_failed: 'bg-red-50 text-red-700 border border-red-200',
        issues_found: 'bg-orange-50 text-orange-700 border border-orange-200',
        
        // Category variants
        feature: 'bg-purple-50 text-purple-700 border border-purple-200',
        bug_fix: 'bg-red-50 text-red-700 border border-red-200',
        refactoring: 'bg-blue-50 text-blue-700 border border-blue-200',
        documentation: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
        infrastructure: 'bg-gray-50 text-gray-700 border border-gray-200',
        testing: 'bg-green-50 text-green-700 border border-green-200',
        
        // Priority variants
        high: 'bg-red-50 text-red-700 border border-red-200',
        medium: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
        low: 'bg-green-50 text-green-700 border border-green-200',
        
        // Generic variants
        default: 'bg-gray-100 text-gray-800 border border-gray-200',
        primary: 'bg-blue-50 text-blue-700 border border-blue-200',
        secondary: 'bg-gray-50 text-gray-700 border border-gray-200',
        success: 'bg-green-50 text-green-700 border border-green-200',
        warning: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
        danger: 'bg-red-50 text-red-700 border border-red-200',
        info: 'bg-blue-50 text-blue-700 border border-blue-200'
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm'
      },
      clickable: {
        true: 'cursor-pointer hover:opacity-80',
        false: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      clickable: false
    }
  }
);

const statusDotVariants = cva(
  'inline-block rounded-full',
  {
    variants: {
      status: {
        // Visual indicators using dots
        not_started: 'bg-gray-400',
        in_progress: 'bg-yellow-500',
        completed: 'bg-green-500',
        failed: 'bg-red-500',
        warning: 'bg-orange-500',
        pending: 'bg-gray-400',
        active: 'bg-blue-500'
      },
      size: {
        sm: 'w-1.5 h-1.5',
        md: 'w-2 h-2',
        lg: 'w-2.5 h-2.5'
      }
    },
    defaultVariants: {
      status: 'not_started',
      size: 'md'
    }
  }
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  children: React.ReactNode;
  count?: number;
  dot?: boolean;
  dotStatus?: VariantProps<typeof statusDotVariants>['status'];
  icon?: React.ReactNode;
}

export function StatusPill({
  className,
  variant,
  size,
  clickable,
  children,
  count,
  dot,
  dotStatus,
  icon,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(statusPillVariants({ variant, size, clickable }), className)}
      {...props}
    >
      {dot && (
        <span className={statusDotVariants({ status: dotStatus, size: size === 'lg' ? 'lg' : 'md' })} />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {count !== undefined && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-white bg-opacity-70 rounded-full text-[10px] font-semibold">
          {count}
        </span>
      )}
    </span>
  );
}

// Status Dot Component for visual indicators
export interface StatusDotProps extends VariantProps<typeof statusDotVariants> {
  className?: string;
  title?: string;
}

export function StatusDot({ status, size, className, title }: StatusDotProps) {
  return (
    <span 
      className={cn(statusDotVariants({ status, size }), className)}
      title={title}
      aria-label={title}
    />
  );
}

// Status Indicator Group for showing multiple status dots
export interface StatusIndicatorGroupProps {
  statuses: Array<{
    label: string;
    status: VariantProps<typeof statusDotVariants>['status'];
    active?: boolean;
  }>;
  size?: VariantProps<typeof statusDotVariants>['size'];
  className?: string;
}

export function StatusIndicatorGroup({ statuses, size = 'md', className }: StatusIndicatorGroupProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {statuses.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <StatusDot
            status={item.status}
            size={size}
            title={item.label}
            className={item.active === false ? 'opacity-30' : ''}
          />
          <span className="text-xs text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// Helper function to get status pill variant from common status values
export function getStatusVariant(status: string): StatusPillProps['variant'] {
  const statusMap: Record<string, StatusPillProps['variant']> = {
    // Task statuses
    pending: 'pending',
    in_progress: 'in_progress',
    completed: 'completed',
    failed: 'failed',
    cancelled: 'cancelled',
    
    // Validation statuses
    validated: 'validated',
    not_validated: 'not_validated',
    validation_failed: 'validation_failed',
    issues_found: 'issues_found',
    
    // Categories
    feature: 'feature',
    bug_fix: 'bug_fix',
    refactoring: 'refactoring',
    documentation: 'documentation',
    infrastructure: 'infrastructure',
    testing: 'testing',
    
    // Priorities
    high: 'high',
    medium: 'medium',
    low: 'low'
  };
  
  return statusMap[status] || 'default';
}